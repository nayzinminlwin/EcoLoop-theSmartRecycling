# Flutter UI Refactor — Visual Checklist

Living checklist linking each gap-register row (V01–V13) to reviewed
comparison captures. Captures live in `docs/archive/refactor_visuals`; evidence in
`../../../Demo_Screenshots` stays immutable.

Status values: **pass** (structural/color/hierarchy gaps resolved), **partial**
(remaining work noted), **pending** (not yet reviewed by the owning phase).

## Phase 2 — Shell, Home, and History

Shared shell (owns the shared chrome of V01–V13):

| Check | Status | Notes |
|---|---|---|
| Centered 480px shell frame at desktop width; header/content/nav share it | pass | `home_480_top.png` vs `Figma_HomePage1`; 390/320 fill width |
| Green `#176B45` / background `#F8FAF6` / white surfaces / border `#E2E8E0` | pass | source tokens already centralized in `AppColors` |
| `AppBrand` leaf mark + EcoLoop AI wordmark, not cropped | pass | FittedBox scale-down protects 320/2.0 scale |
| Outlined bell button with red dot, routes to History | pass | shell scenario test asserts the route |
| Raised 58px scan circle, contrasting ring, shadow | pass | `home_480_top.png` |
| Home/Settings outline SVGs, compact untracked nav labels | pass | nav labels use `AppTypography.navLabel` (10px, untracked) |
| Branch selection reflects actual destination (no false Scan emphasis) | pass | Scan label highlights only while the scan branch is current |
| Named text roles; eyebrow tracking does not leak | pass | roles centralized in `AppTypography` |
| Single top/bottom inset owner; no duplicate page AppBars | pass | one shell Scaffold; `AppPage` is the scroll owner |
| ≥48px interactive targets on compact visuals | pass | asserted in the shell test (back control, nav cells, bell) |

V01 — `Figma_HomePage1` / `Flutter_HomePage1`:

| Check | Status | Notes |
|---|---|---|
| Green rounded wallet card, white 44px balance | pass | `home_390_top.png` |
| Pale leaf orbit, amber progress, white full-width Browse rewards + arrow | pass | |
| White scan CTA with green square icon tile and trailing arrow | pass | scan route preserved |
| Compact joined impact card with divider (12 / 1.04 kg) | pass | semantic: 1.04 kg kept per data rules |
| White bordered guide/history quick cards with mint icon tiles | pass | |
| ACTIVITY eyebrow + section heading/action + grouped recent rows | pass | `home_390_activity.png` |

V02 — `Figma_HomePage2` / `Flutter_HomePage2`:

| Check | Status | Notes |
|---|---|---|
| Two recent transactions in one white bordered group | pass | separators match source |
| Clean location labels; bin ID appears once | pass | `AppFormatters.location` normalization |
| Demo-local dates (`Today, 10:42 AM`) | pass | +08:00 display offset |
| No trailing-badge overflow | pass | content-sized row; stacked layout at enlarged scale |

V03 — `Figma_RecyclingHistoryPage` / `Flutter_RecyclingHistoryPage`:

| Check | Status | Notes |
|---|---|---|
| YOUR IMPACT eyebrow + page heading | pass | `history_390.png` |
| Two visible date/status dropdown-style controls | pass | open the accessible sheet to the relevant section |
| Grouped bordered list with separators (all records) | pass | canonical data not truncated |
| Derived kg per row; result records remain count-based | pass | semantic: count-derived kg differs from prototype's weight copy |
| Muted shield/explanatory note after the list | pass | |
| History filters apply on direct link and reflect in URI | pass | tested incl. invalid input recovery |
| History updates after a deposit without manual refresh | pass | stream observation test |

Text-scale spot checks: 1.0/1.3 readable, 2.0 reflows without clipping —
pass (shell test + `home_320_top.png`).

Intentional semantic differences recorded: 105 remaining / 70% (not 55/82%),
1.04 kg (not 3.2 kg), `Today`/derived weights from count-based rules, bell
routes to History, no permanent Scan emphasis.

## Phase 3 — Scan experience

Shared scan frame (all scan stages):

| Check | Status | Notes |
|---|---|---|
| SMART BIN SESSION eyebrow + page heading + bordered back control | pass | `scanner_390.png`; titles/copy from store instructions |
| Dark 250px stage surface, radius 22, radial overlay | pass | shared `ScannerStage`; success variant swaps to primary green |
| Centered flow info; full-width stage actions | pass | actions: Confirm session / I pressed the finish button / Continue / Back to home |
| Reduced-motion static equivalents; animation never drives state | pass | `MediaQuery.disableAnimations` respected |
| Scanner is the entry point; URLs canonicalize to committed stage | pass | route redirects via store-backed stage peek; tested |

V04 — `Figma_RecyclingProcess_1` / `Flutter_RecyclingProcess_1`:

| Check | Status | Notes |
|---|---|---|
| Dark stage, white outlined bin, amber capacity 65% | pass | `scan_bin_found_390.png` |
| Centered BIN-004 badge + Cedar Residence · Ground Floor | pass | location rendered once |
| Split accepts/capacity detail row (Plastic · Cans / 65% · Warning) | pass | amber warning tone at source thresholds |
| Full-width Confirm session | pass | |

V05 — `Figma_RecyclingProcess_2` / `Flutter_RecyclingProcess_2`:

| Check | Status | Notes |
|---|---|---|
| Dark bin visual with READY label | pass | `scan_ready_390.png` |
| Centered physical-finish instruction | pass | repository readyDescription |
| "I pressed the finish button" action | pass | |

V06 — `Figma_RecyclingProcess_3` / `Flutter_RecyclingProcess_3`:

| Check | Status | Notes |
|---|---|---|
| Camera SVG inside subtle mint pulse rings | pass | `scan_item_detected_390.png` |
| Centered status/description; Continue action | pass | |

V07 — `Figma_RecyclingProcess_4` / `Flutter_RecyclingProcess_4`:

| Check | Status | Notes |
|---|---|---|
| Recycle/identification visual on dark surface | pass | `scan_processing_390.png`; captured while processing actually ran (controlled 30s classification delay) |
| Amber Processing badge; timing/help copy | pass | repository pointsTimingNotice; no manual completion button |
| Automatic completion; Retry only on error | pass | injected-failure test keeps processing and retries once |

V08 — `Figma_RecyclingProcess_5` / `Flutter_RecyclingProcess_5`:

| Check | Status | Notes |
|---|---|---|
| Green verified surface + white check success ring | pass | `scan_result_390.png` |
| Green Verified badge; outcome-specific title/copy | pass | review/rejected alternatives covered by tests |
| Structured `2 pcs / PET plastic bottles` count-material row | pass | count-based per data rules |
| Mint EcoPoints earned strip (+10) | pass | only for credited results |
| Back to home action | pass | optional new scan left to the Scan nav resume policy |

QR scanner (no supplied pair — compared against the source/plan):

| Check | Status | Notes |
|---|---|---|
| Dark stage, corner frame, scan SVG, camera-simulation caption | pass | `scanner_390.png` |
| Simulate QR scan + ghost Cancel; distinct invalid-QR failure | pass | |

Intentional semantic differences recorded: result copy is count-based
(2 pcs / +10) not the prototype's 0.4 kg / +20; timing notice comes from the
repository instead of the prototype's hardcoded 3-minute copy; capacity
increases on review/rejected completions because items are physically in the
bin; completion is automatic through the mock service.

## Phase 4 — Rewards and Guide

| Pair | Status | Captures |
|---|---|---|
| V09 rewards 2×2 | partial | Implementation covers responsive 2-column catalog at 390/480, differentiated artwork tones, intrinsic compact cards, live success banner, and voucher tile; live capture pending because no Flutter target was connected |
| V10 guide page 1 | partial | Implementation covers shared LEARN/header, sage hero with white medallion, compact two-column material cards, and distinct To-do/To-avoid panels; live capture pending because no Flutter target was connected |
| V11 guide page 2 | partial | Implementation covers connecting-line steps and responsive count-based points table; examples are 2 pcs = 10/16 and 4 pcs = 12; live capture pending because no Flutter target was connected |

Phase 4 semantic/accessibility notes: the catalog falls back to one column
below 340 logical pixels or at text scale 1.35+, preserving action labels and
reading order. The guide table retains points per piece (not points per kg);
example counts come from the guide fixture and points are calculated through
the same `MaterialRate.pointsFor` rule used by scan classification.

## Phase 5 — Settings/Profile

| Pair | Status | Captures |
|---|---|---|
| V12 settings | pending | |
| V13 profile details | pending | |
