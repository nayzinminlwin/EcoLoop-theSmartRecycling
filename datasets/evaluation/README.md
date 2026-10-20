# EcoLoop Evaluation Image Set

**Dataset version:** `evaluation-2026-10-18-v0`
**Unit:** BK-P00-D
**Purpose:** Evaluation test cases for hosted A/B/D predictions and EcoLoop matching/counting rules. These images are not training data and are not runtime-selectable inference metadata.

## Current status

The repository currently contains **15 inventoried candidate images and 0 human-labeled images**. This is honest scaffolding, not the approximately 100-image evaluation target and not evidence for any CV acceptance threshold.

The immutable inventory is in [manifest.json](manifest.json). Each candidate has a generic `imageId`, byte count, dimensions, format and SHA-256 identity. Expected objects, eligibility, scene grouping and split assignment are intentionally absent until a labeling owner completes review.

## Required preparation

The labeling owner must:

1. Confirm source provenance and permission for each image.
2. Assign a `sceneGroupId`; all related frames/views remain in one split.
3. Assign `development` or `frozen-evaluation` only after the scene grouping is known.
4. Annotate every visible physical object with normalized finite coordinates, canonical/uncertain material label, eligibility truth and difficulty.
5. Include the required coverage:
   - eligible `plastic_bottle`, `aluminium_can`, `glass_bottle`, `paper_item`
     and `paper_bag` objects;
   - all five eligible classes;
   - cardboard and other exclusions;
   - touching and overlapping objects;
   - bags versus bottles;
   - generic can/glass ambiguity;
   - unknowns and empty images.
6. Have a second reviewer inspect ambiguous, overlapping, empty and excluded cases.
7. Preserve the original annotation disagreement and resolution rather than silently overwriting it.

The first image used for the provider smoke probe is `img-0014`; its smoke result is documented in [MODEL_ACCESS.md](../../docs/backend_evidence/MODEL_ACCESS.md). That result does not supply expected labels for this evaluation manifest.

## Annotation boundary

Expected annotations must remain separate from runtime-selectable image metadata. Provider prompts and production inference requests must receive image bytes or approved asset references, never this manifest's expected answers or filenames that reveal them.

The schema requires a completed record to contain:

- `sceneGroupId`;
- `split`;
- `category` (`clear`, `difficult`, `empty`, or `excluded`);
- object annotations, including `objectId`, normalized `bbox`, canonical/uncertain label, `eligible`, and `difficulty`;
- reviewer status and annotation version.

Unlabeled inventory entries use `annotationStatus: "unlabeled"` and `annotations: null`; they cannot be used for CV scoring.

## Counts and gate

| Measure | Current |
|---|---:|
| Inventoried candidates | 15 |
| Human-labeled images | 0 |
| Development images | 0 |
| Frozen evaluation images | 0 |
| Second-reviewed images | 0 |
| Approximate target | 100 |

BK-P00-D remains incomplete until a labeling owner, handoff path, labeled development subset and frozen evaluation subset are recorded. Dataset incompleteness does not invalidate the completed provider smoke or Cloud Run probe, but no accuracy claim may be published.
