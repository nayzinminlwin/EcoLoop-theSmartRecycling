from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
import json
import os
import statistics
import time
import urllib.request
import uuid
from pathlib import Path
from typing import Any


def probe(url: str, image: bytes, content_type: str, token: str | None) -> dict[str, Any]:
    boundary = f"----ecoloop-{uuid.uuid4().hex}"
    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="image"; filename="benchmark.jpg"\r\n'
        f"Content-Type: {content_type}\r\n\r\n"
    ).encode() + image + f"\r\n--{boundary}--\r\n".encode()
    request = urllib.request.Request(
        url,
        data=body,
        method="POST",
        headers={
            "Content-Type": f"multipart/form-data; boundary={boundary}",
            "Authorization": f"Bearer {token}" if token else "",
        },
    )
    started = time.perf_counter()
    try:
        with urllib.request.urlopen(request, timeout=360) as response:
            body = response.read()
            return {
                "status": "success",
                "httpStatus": response.status,
                "elapsedMs": round((time.perf_counter() - started) * 1000, 2),
                "traceId": _trace_id(body),
            }
    except Exception as error:
        return {
            "status": "error",
            "elapsedMs": round((time.perf_counter() - started) * 1000, 2),
            "errorType": type(error).__name__,
            "error": str(error),
        }


def run_benchmark(
    *,
    url: str,
    image_path: Path,
    token: str | None,
    burst: int,
) -> dict[str, Any]:
    image = image_path.read_bytes()
    content_type = _content_type(image_path)
    sequential = [probe(url, image, content_type, token) for _ in range(2)]
    with concurrent.futures.ThreadPoolExecutor(max_workers=burst) as executor:
        concurrent_results = list(executor.map(
            lambda _: probe(url, image, content_type, token),
            range(burst),
        ))
    successes = [item for item in sequential + concurrent_results if item["status"] == "success"]
    latencies = [item["elapsedMs"] for item in successes]
    return {
        "benchmarkVersion": "bk-p07-d.1",
        "endpoint": url,
        "image": {
            "sha256": hashlib.sha256(image).hexdigest(),
            "bytes": len(image),
            "path": str(image_path),
        },
        "sequential": sequential,
        "concurrentBurst": {
            "size": burst,
            "results": concurrent_results,
        },
        "summary": {
            "successfulRequests": len(successes),
            "totalRequests": len(sequential) + len(concurrent_results),
            "minMs": min(latencies) if latencies else None,
            "medianMs": statistics.median(latencies) if latencies else None,
            "maxMs": max(latencies) if latencies else None,
            "providerMemory": "NOT_MEASURED_PROVIDER_EXECUTION_REMOTE",
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Bounded Cloud Run vision latency benchmark")
    parser.add_argument("--url", default=os.getenv("ECOLOOP_VISION_BENCHMARK_URL"))
    parser.add_argument("--image", type=Path, required=True)
    parser.add_argument("--token", default=os.getenv("ECOLOOP_VISION_BENCHMARK_TOKEN"))
    parser.add_argument("--burst", type=int, default=2)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if not args.url:
        raise SystemExit("--url or ECOLOOP_VISION_BENCHMARK_URL is required")
    if not args.image.is_file():
        raise FileNotFoundError(args.image)
    if args.burst < 1 or args.burst > 8:
        raise SystemExit("--burst must be between 1 and 8")
    report = run_benchmark(url=args.url, image_path=args.image, token=args.token, burst=args.burst)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report["summary"]))


def _content_type(path: Path) -> str:
    return {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
    }.get(path.suffix.lower(), "application/octet-stream")


def _trace_id(body: bytes) -> str | None:
    try:
        value = json.loads(body)
    except json.JSONDecodeError:
        return None
    return value.get("traceId") if isinstance(value, dict) else None


if __name__ == "__main__":
    main()
