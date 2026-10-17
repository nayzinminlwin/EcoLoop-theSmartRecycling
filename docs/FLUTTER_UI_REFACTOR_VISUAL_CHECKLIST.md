# Flutter UI Refactor — Visual Checklist

Living checklist linking each gap-register row (V01–V13) to reviewed
comparison captures. Captures live in `docs/refactor_visuals/`; evidence in
`Demo_Screenshots/` stays immutable.

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

| Pair | Status | Captures |
|---|---|---|
| V04 bin found | pending | |
| V05 ready | pending | |
| V06 item detected | pending | |
| V07 processing | pending | |
| V08 result | pending | |
| QR scanner (no supplied pair) | pending | compare against source/plan |

## Phase 4 — Rewards and Guide

| Pair | Status | Captures |
|---|---|---|
| V09 rewards 2×2 | pending | |
| V10 guide page 1 | pending | |
| V11 guide page 2 | pending | |

## Phase 5 — Settings/Profile

| Pair | Status | Captures |
|---|---|---|
| V12 settings | pending | |
| V13 profile details | pending | |
