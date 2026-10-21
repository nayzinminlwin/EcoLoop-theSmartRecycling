from __future__ import annotations

import hashlib
import json
import math
import time
from contextvars import copy_context
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeoutError
from collections.abc import Callable, Mapping
from dataclasses import asdict, dataclass
from typing import Any

from ecoloop_vision.adapters.detectors import normalize_detector_response
from ecoloop_vision.adapters.gemini import GeminiResult, validate_gemini_response
from ecoloop_vision.adapters.specialist import normalize_specialist_response
from ecoloop_vision.domain.matching import CandidateGroup, MatchingConfig, reconcile_candidates
from ecoloop_vision.domain.models import DetectionCandidate, NormalizedResult, ProcessingInput, StageOutcome
from ecoloop_vision.domain.resolution import ResolvedObject, resolve_groups
from ecoloop_vision.domain.taxonomy import classify_label
from ecoloop_vision.infrastructure.images import crop_candidate
from ecoloop_vision.logging import emit_structured


@dataclass(frozen=True)
class InspectionConfig:
    config_id: str = "inspection-v1"
    matching: MatchingConfig = MatchingConfig()
    max_specialist_crops: int = 8
    max_gemini_crops: int = 4
    max_full_image_objects: int = 12
    max_detector_calls: int = 2
    total_budget_ms: int = 90_000
    call_timeout_ms: int = 15_000
    max_retries: int = 1
    detector_models: tuple[str, str] = ("waste-detection-0momv/6", "yolo-waste-detection/1")
    specialist_model: str = "waste-classification-rjo28/2"


@dataclass(frozen=True)
class FallbackEvidence:
    mode: str
    object_id: str | None
    result: GeminiResult


@dataclass(frozen=True)
class ProviderAttempt:
    stage: str
    attempt: int
    status: str
    error_type: str | None = None
    latency_ms: float = 0.0


@dataclass(frozen=True)
class InspectionResult:
    input_sha256: str
    config_id: str
    detector_results: Mapping[str, NormalizedResult]
    specialist_results: tuple[NormalizedResult, ...]
    groups: tuple[CandidateGroup, ...]
    objects: tuple[ResolvedObject, ...]
    fallbacks: tuple[FallbackEvidence, ...]
    raw_responses: Mapping[str, Any]
    outcomes: tuple[StageOutcome, ...] = ()
    attempts: tuple[ProviderAttempt, ...] = ()

    @property
    def inventory_state(self) -> str:
        if any(outcome.status in {"provider_error", "invalid_response", "budget_exhausted", "review_required"}
               for outcome in self.outcomes):
            return "uncertain"
        if self.objects:
            return "resolved"
        return "uncertain" if self.fallbacks else "empty"


DetectorProvider = Callable[[str, ProcessingInput], Any]
SpecialistProvider = Callable[[ProcessingInput, str], Any]
GeminiProvider = Callable[[ProcessingInput, str, str | None], Any]


def inspect_image(
    image: ProcessingInput,
    *,
    detector_provider: DetectorProvider,
    specialist_provider: SpecialistProvider | None = None,
    gemini_provider: GeminiProvider | None = None,
    config: InspectionConfig = InspectionConfig(),
) -> InspectionResult:
    raw_responses: dict[str, Any] = {}
    outcomes: list[StageOutcome] = []
    attempts: list[ProviderAttempt] = []
    started_at = time.monotonic()
    emit_structured(level=20, event="vision.inspection_started", fields={
        "inputSha256": image.sha256,
        "configId": config.config_id,
    })
    detector_results: dict[str, NormalizedResult] = {}
    candidates: list[DetectionCandidate] = []
    detector_specs = (
        ("A", config.detector_models[0]),
        ("B", config.detector_models[1]),
    )[:config.max_detector_calls]
    def run_detector(role: str, model_id: str) -> tuple[str, str, Any, Exception | None]:
        if _budget_exhausted(started_at, config):
            return role, model_id, None, RuntimeError("budget_exhausted")
        try:
            return role, model_id, _invoke_provider(
                detector_provider, (model_id, image), "detector", started_at, config, attempts
            ), None
        except Exception as error:
            return role, model_id, None, error

    detector_started_at = time.perf_counter()
    detector_runs: list[tuple[str, str, Any, Exception | None]] = []
    if detector_specs:
        with ThreadPoolExecutor(max_workers=min(2, len(detector_specs))) as executor:
            futures = [
                executor.submit(copy_context().run, run_detector, *spec)
                for spec in detector_specs
            ]
            detector_runs = [future.result() for future in futures]
    emit_structured(level=20, event="vision.stage_completed", fields={
        "stage": "detectors",
        "durationMs": round((time.perf_counter() - detector_started_at) * 1000, 2),
        "roles": [role for role, _model_id in detector_specs],
    })
    for role, model_id, raw, provider_error in detector_runs:
        if provider_error is not None:
            outcomes.append(_provider_outcome("detector", provider_error))
            detector_results[role] = NormalizedResult(model_id=model_id, model_version=None, error=type(provider_error).__name__)
            continue
        if raw is None:
            outcomes.append(StageOutcome("detectors", "budget_exhausted", "detector_call_budget"))
            continue
        raw_responses[role] = raw
        try:
            normalized = normalize_detector_response(
                raw,
                model_id=model_id,
                original_width=image.width,
                original_height=image.height,
            )
        except (TypeError, ValueError) as error:
            outcomes.append(StageOutcome("detector", "invalid_response", "normalization_failed", type(error).__name__))
            detector_results[role] = NormalizedResult(model_id=model_id, model_version=None, error="normalization_failed")
            continue
        detector_results[role] = normalized
        candidates.extend(normalized.candidates)

    groups = reconcile_candidates(candidates, config=config.matching)
    emit_structured(level=20, event="vision.matching_completed", fields={
        "inputSha256": image.sha256,
        "candidateCount": len(candidates),
        "groupCount": len(groups),
    })
    objects = resolve_groups(groups, image_width=image.width, image_height=image.height)
    emit_structured(level=20, event="vision.resolution_completed", fields={
        "inputSha256": image.sha256,
        "objectCount": len(objects),
        "unresolvedCount": sum(item.eligibility == "unresolved" for item in objects),
    })
    specialist_results: list[NormalizedResult] = []
    specialist_by_group: dict[str, NormalizedResult] = {}
    if specialist_provider is not None:
        specialist_started_at = time.perf_counter()
        for group in groups[:config.max_specialist_crops]:
            if not _needs_specialist(group, objects):
                continue
            crop, _ = crop_candidate(image, object_id=group.group_id, box=group.box)
            try:
                raw = _invoke_provider(
                    specialist_provider, (crop, group.group_id), "specialist", started_at, config, attempts
                )
            except Exception as error:
                outcomes.append(_provider_outcome("specialist", error))
                continue
            raw_responses[f"D:{group.group_id}"] = raw
            try:
                normalized_specialist = normalize_specialist_response(
                    raw,
                    model_id=config.specialist_model,
                )
                specialist_results.append(normalized_specialist)
                specialist_by_group[group.group_id] = normalized_specialist
            except (TypeError, ValueError) as error:
                outcomes.append(StageOutcome("specialist", "invalid_response", "normalization_failed", type(error).__name__))
        emit_structured(level=20, event="vision.stage_completed", fields={
            "stage": "specialist",
            "durationMs": round((time.perf_counter() - specialist_started_at) * 1000, 2),
            "candidateCount": len(specialist_by_group),
        })
        objects = _apply_specialist_evidence(objects, specialist_by_group)

    fallbacks: list[FallbackEvidence] = []
    if gemini_provider is not None:
        gemini_started_at = time.perf_counter()
        uncertain_groups = [
            (group, item)
            for group, item in zip(groups, objects)
            if item.eligibility == "unresolved" or item.confidence < 0.85
        ][:config.max_gemini_crops]
        for group, _ in uncertain_groups:
            crop, _ = crop_candidate(image, object_id=group.group_id, box=group.box)
            try:
                raw = _invoke_provider(
                    gemini_provider, (crop, "crop", group.group_id), "gemini_crop", started_at, config, attempts
                )
            except Exception as error:
                outcomes.append(_provider_outcome("gemini_crop", error))
                continue
            raw_responses[f"Gemini:crop:{group.group_id}"] = raw
            evidence = FallbackEvidence(
                mode="crop",
                object_id=group.group_id,
                result=validate_gemini_response(
                    raw,
                    mode="crop",
                    candidate_id=group.group_id,
                ),
            )
            fallbacks.append(evidence)
            if evidence.result.status != "resolved":
                outcomes.append(StageOutcome("gemini_crop", "review_required", evidence.result.reason_code))
            if evidence.result.status == "resolved":
                objects = _apply_crop_fallback(objects, evidence.result, group.group_id, image.width, image.height)
        if (
            not groups
            and not detector_results["A"].candidates
            and not detector_results["B"].candidates
            and detector_results["A"].error is None
            and detector_results["B"].error is None
        ):
            try:
                raw = _invoke_provider(
                    gemini_provider, (image, "full_image", None), "gemini_full_image", started_at, config, attempts
                )
            except Exception as error:
                outcomes.append(_provider_outcome("gemini_full_image", error))
                raw = None
            if raw is None:
                raw_responses["Gemini:full_image"] = None
                final_result = InspectionResult(
                    input_sha256=image.sha256,
                    config_id=config.config_id,
                    detector_results=detector_results,
                    specialist_results=tuple(specialist_results),
                    groups=groups,
                    objects=objects,
                    fallbacks=tuple(fallbacks),
                    raw_responses=raw_responses,
                    outcomes=tuple(outcomes),
                    attempts=tuple(attempts),
                )
                emit_structured(level=20, event="vision.inspection_completed", fields={
                    "inputSha256": image.sha256,
                    "objectCount": len(final_result.objects),
                    "fallbackCount": len(final_result.fallbacks),
                    "outcomeCount": len(final_result.outcomes),
                    "latencyMs": round((time.monotonic() - started_at) * 1000, 2),
                })
                return final_result
            raw_responses["Gemini:full_image"] = raw
            evidence = FallbackEvidence(
                mode="full_image",
                object_id=None,
                result=validate_gemini_response(
                    raw,
                    mode="full_image",
                    max_objects=config.max_full_image_objects,
                ),
            )
            fallbacks.append(evidence)
            if evidence.result.status != "resolved":
                outcomes.append(StageOutcome("gemini_full_image", "review_required", evidence.result.reason_code))
            if evidence.result.status == "resolved":
                objects = _materialize_full_image(evidence.result, image.width, image.height)
        emit_structured(level=20, event="vision.stage_completed", fields={
                "stage": "gemini",
                "durationMs": round((time.perf_counter() - gemini_started_at) * 1000, 2),
                "fallbackCount": len(fallbacks),
        })
    return InspectionResult(
        input_sha256=image.sha256,
        config_id=config.config_id,
        detector_results=detector_results,
        specialist_results=tuple(specialist_results),
        groups=groups,
        objects=objects,
        fallbacks=tuple(fallbacks),
        raw_responses=raw_responses,
        outcomes=tuple(outcomes),
        attempts=tuple(attempts),
    )


def _needs_specialist(group: CandidateGroup, objects: tuple[ResolvedObject, ...]) -> bool:
    item = next((item for item in objects if item.object_id == group.group_id), None)
    return item is not None and item.confidence < 0.85


def _apply_specialist_evidence(
    objects: tuple[ResolvedObject, ...],
    specialist_results: Mapping[str, NormalizedResult],
) -> tuple[ResolvedObject, ...]:
    updated: list[ResolvedObject] = []
    for item in objects:
        result = specialist_results.get(item.object_id)
        vector = None if result is None else result.score_vector
        if vector is None:
            updated.append(item)
            continue
        candidates = sorted(vector.scores.items(), key=lambda pair: (-pair[1], pair[0]))
        if not candidates or candidates[0][1] < 0.85:
            updated.append(item)
            continue
        label = classify_label(candidates[0][0])
        if label.canonical is None or label.specificity != "specific":
            updated.append(item)
            continue
        eligibility = "eligible" if label.canonical in {
            "plastic_bottle", "aluminium_can", "glass_bottle", "paper_item", "paper_bag"
        } else "excluded"
        updated.append(ResolvedObject(
            object_id=item.object_id,
            resolution=label.canonical,
            eligibility=eligibility,
            box=item.box,
            normalized_box=item.normalized_box,
            model_ids=item.model_ids + (vector.model_id,),
            raw_labels=item.raw_labels + (candidates[0][0],),
            confidence=item.confidence,
            rule_id="rule.specialist_existing_candidate",
            reason_code="specialist_evidence",
        ))
    return tuple(updated)


def _apply_crop_fallback(
    objects: tuple[ResolvedObject, ...],
    result: GeminiResult,
    object_id: str,
    image_width: int,
    image_height: int,
) -> tuple[ResolvedObject, ...]:
    finding = result.findings[0]
    updated: list[ResolvedObject] = []
    for item in objects:
        if item.object_id != object_id:
            updated.append(item)
            continue
        label = classify_label(finding.label)
        canonical = label.canonical or "unknown"
        eligibility = "eligible" if canonical in {"plastic_bottle", "aluminium_can", "glass_bottle", "paper_item", "paper_bag"} else (
            "excluded" if canonical == "cardboard_item" else "unresolved"
        )
        updated.append(ResolvedObject(
            object_id=item.object_id,
            resolution=canonical,
            eligibility=eligibility,
            box=item.box,
            normalized_box=item.normalized_box,
            model_ids=item.model_ids + (result.model_id,),
            raw_labels=item.raw_labels + (finding.label,),
            confidence=item.confidence,
            rule_id="rule.gemini_crop_taxonomy",
            reason_code="fallback",
        ))
    return tuple(updated)


def _materialize_full_image(
    result: GeminiResult,
    image_width: int,
    image_height: int,
) -> tuple[ResolvedObject, ...]:
    materialized: list[ResolvedObject] = []
    for index, finding in enumerate(result.findings, start=1):
        label = classify_label(finding.label)
        canonical = label.canonical or "unknown"
        eligibility = "eligible" if canonical in {"plastic_bottle", "aluminium_can", "glass_bottle", "paper_item", "paper_bag"} else (
            "excluded" if canonical == "cardboard_item" else "unresolved"
        )
        normalized = finding.box or (0.0, 0.0, 1.0, 1.0)
        pixel = (
            normalized[0] * image_width,
            normalized[1] * image_height,
            normalized[2] * image_width,
            normalized[3] * image_height,
        )
        for count_index in range(finding.count):
            materialized.append(ResolvedObject(
                object_id=f"gemini-full-{index:04d}-{count_index + 1:02d}",
                resolution=canonical,
                eligibility=eligibility,
                box=pixel,
                normalized_box=normalized,
                model_ids=(result.model_id,),
                raw_labels=(finding.label,),
                confidence=0.0,
                rule_id="rule.gemini_full_inventory",
                reason_code="fallback",
            ))
    return tuple(materialized)


def result_to_dict(result: InspectionResult) -> dict[str, Any]:
    return _json_safe(asdict(result))


def configuration_fingerprint(config: InspectionConfig) -> str:
    payload = {
        "configId": config.config_id,
        "matching": asdict(config.matching),
        "maxSpecialistCrops": config.max_specialist_crops,
        "maxGeminiCrops": config.max_gemini_crops,
        "maxFullImageObjects": config.max_full_image_objects,
        "maxDetectorCalls": config.max_detector_calls,
        "totalBudgetMs": config.total_budget_ms,
        "callTimeoutMs": config.call_timeout_ms,
        "maxRetries": config.max_retries,
    }
    return hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()


def _json_safe(value: Any) -> Any:
    if isinstance(value, Mapping):
        return {str(key): _json_safe(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_json_safe(item) for item in value]
    if hasattr(value, "__dataclass_fields__"):
        return _json_safe(asdict(value))
    if isinstance(value, float) and not math.isfinite(value):
        return None
    return value


def _provider_outcome(stage: str, error: Exception) -> StageOutcome:
    if str(error) == "budget_exhausted":
        return StageOutcome(stage, "budget_exhausted", "budget_exhausted", type(error).__name__)
    return StageOutcome(stage, "provider_error", "provider_exception", type(error).__name__)


def _budget_exhausted(started_at: float, config: InspectionConfig) -> bool:
    return (time.monotonic() - started_at) * 1000 >= config.total_budget_ms


def _invoke_provider(
    provider: Callable[..., Any],
    args: tuple[Any, ...],
    stage: str,
    started_at: float,
    config: InspectionConfig,
    attempts: list[ProviderAttempt],
) -> Any:
    last_error: Exception | None = None
    for attempt in range(config.max_retries + 1):
        attempt_started = time.monotonic()
        remaining_ms = min(
            config.call_timeout_ms,
            max(0, config.total_budget_ms - int((time.monotonic() - started_at) * 1000)),
        )
        if remaining_ms <= 0:
            raise RuntimeError("budget_exhausted")
        executor = ThreadPoolExecutor(max_workers=1)
        future = executor.submit(provider, *args)
        try:
            result = future.result(timeout=remaining_ms / 1000)
            attempts.append(ProviderAttempt(
                stage, attempt + 1, "success",
                latency_ms=round((time.monotonic() - attempt_started) * 1000, 2),
            ))
            return result
        except FutureTimeoutError as error:
            last_error = error
            attempts.append(ProviderAttempt(
                stage, attempt + 1, "timeout", type(error).__name__,
                round((time.monotonic() - attempt_started) * 1000, 2),
            ))
            if attempt >= config.max_retries:
                raise RuntimeError("budget_exhausted") from error
        except Exception as error:
            last_error = error
            attempts.append(ProviderAttempt(
                stage, attempt + 1, "error", type(error).__name__,
                round((time.monotonic() - attempt_started) * 1000, 2),
            ))
            if not _is_transient(error) or attempt >= config.max_retries:
                raise
        finally:
            executor.shutdown(wait=False, cancel_futures=True)
    raise last_error or RuntimeError("provider_call_failed")


def _is_transient(error: Exception) -> bool:
    return isinstance(error, (TimeoutError, ConnectionError)) or type(error).__name__ in {
        "TransientProviderError",
        "ReadTimeout",
        "ConnectTimeout",
        "ServiceUnavailable",
        "InternalServerError",
    }
