# Dev Log: Backend - BK-P04-F Python Job Runner

**Date:** 2026-10-19
**Agent:** Copilot SDK in VS Code
**Status:** Implemented; automated integration gates pass

## Objective

Implement the Cloud Run worker path for authenticated Cloud Tasks delivery:
claim a fenced attempt, load and verify the committed source, run bounded
inspection stages, write scoped artifacts, submit findings with the attempt
identity, and recover an already accepted result after an ambiguous callback.

## Changes

- Added `JobGateway` with attached service-account ID-token acquisition using
  the configured gateway audience.
- Added claim/checkpoint/complete/fail/current-result calls with structured
  error and retryability handling.
- Added committed source loading with asset-version and SHA-256 verification.
- Added bounded inspection configuration derived from the five-minute job
  deadline.
- Added scoped local artifact writing for development and a Cloud Storage
  artifact writer for deployment.
- Added `/tasks/vision`, which returns non-2xx until backend acceptance or
  recovered terminal state; Cloud Run IAM remains the request authentication
  boundary.
- Added findings conversion to the canonical `backend.v1` worker payload.

## Verification

- `Set-Location services/vision; uv run pytest` passed: 32 tests.
- `Set-Location functions; npm run build` passed.
- `git diff --check` passed.

The real private Cloud Tasks -> Cloud Run -> gateway -> Firestore delivery
still requires a deployed task with configured gateway URL, asset URL/bucket,
artifact bucket, service identity, and actual source pixels. That evidence
remains intentionally unclaimed under the BK-P04-D deployment gap.
