# Rewards Page: Text Visibility Refactor Plan

- **Date:** 2026-10-21
- **Status:** Proposed, based on code review and the supplied screenshot
- **Size:** Small; three phases are sufficient.

## Findings from the current implementation

The screenshot's clearest readability problems are white category labels on pale
chips and faint text on the unavailable reward buttons.

| Location | Current structure / relevant finding |
| --- | --- |
| `lib/app/router/app_router.dart` | `/rewards` builds `RewardsScreen`, passing the `category` query parameter. |
| `lib/features/rewards/presentation/screens/rewards_screen.dart` | `AppPage` contains the heading/balance, optional success banner, `_CategoryChips`, `_RewardGrid`, and My vouchers preview. Riverpod supplies categories, rewards, wallet, and vouchers. |
| Same file, `_CategoryChips` | Uses `ChoiceChip` directly, with no explicit label, selected-label, fill, or checkmark colors. Its `Wrap` has horizontal spacing but no `runSpacing`. |
| `lib/core/theme/app_theme.dart`, `app_typography.dart` | The global chip theme assigns the raw `labelMedium` typography, which has no color. Selected-label and selected-fill colors are also unspecified. This leaves critical chip colors to inheritance/framework defaults; the exact rendered source of white needs confirmation under the production theme. |
| `lib/features/rewards/presentation/widgets/reward_card.dart` | Displays artwork/tag, title, merchant, points, then `AppButton`. Already distinguishes `Redeem`, `Redeemed`, and `Not enough points` using balance and redemption limit. |
| `lib/shared/widgets/app_button.dart` | Primary disabled buttons use green at 45% opacity but do not specify `disabledForegroundColor`. The resulting foreground is framework-derived. `_content()` also hard-codes a white loading spinner. |
| Existing layout | `_RewardGrid` uses two columns when available content width is at least 340 logical pixels and text scale is below 1.35; otherwise one column. Cards have a minimum height, not a fixed height. `AppPage` owns scrolling; `ResidentShell` caps the app at 480 logical pixels. |
| Existing coverage | `test/features/rewards/rewards_screen_test.dart` only checks a few text strings and uses an unthemed `MaterialApp`. It cannot establish whether production-theme text is readable. Shared button behavior tests already use `AppTheme.light`. |

`Demo_Screenshots/Figma_RewardPage.png` is a useful composition reference, but its
content and costs differ from the supplied screenshot. Use the supplied screenshot
as the defect baseline and the current data as the content source.

## Phase 1 — Make category filters explicitly readable

**Edit:** `lib/features/rewards/presentation/screens/rewards_screen.dart`,
specifically `_CategoryChips.build`.

1. Give both the All rewards chip and mapped category chips the same explicit
   styling. Use the existing label typography with `AppColors.primaryDark` for
   selected text and `AppColors.text` for unselected text. Set `ChoiceChip.labelStyle`
   directly so selected-label defaults cannot override the intended foreground.
2. Set selected fill to `AppColors.sage`, unselected fill to `AppColors.mint`, and
   the selected checkmark to `AppColors.primaryDark`. Retain the checkmark and a
   selected border so selection is identifiable beyond color alone.
3. Add `runSpacing: 8` to the existing `Wrap`. Keep labels at their natural size,
   allow chips to wrap on narrow screens, and retain Material's normal touch target.

**Done when:** All three category labels are readable before and after selection;
selection still filters the catalog and updates the existing category URL. Apply
this styling locally to the rewards chips to keep this change focused.

## Phase 2 — Give unavailable actions readable state colors

**Edit:** The primary branch of `lib/shared/widgets/app_button.dart` and its
loading-content color handling. Review its use in `reward_card.dart` and
`reward_redemption_dialog.dart`.

1. Replace the translucent disabled fill with the existing opaque
   `AppColors.grayBackground` and explicitly set `disabledForegroundColor` to
   `AppColors.grayText`. This creates a subdued state while keeping the explanatory
   label readable. Keep enabled primary actions green with white text.
2. Make the primary loading spinner use a contrasting color on the new disabled
   fill, such as `AppColors.primary`. Resolve/pass that color into `_content()`;
   avoid globally recoloring spinners on other button variants.
3. Preserve the existing null callbacks and disabled semantics. In `RewardCard`,
   keep redemption-limit precedence over insufficient balance, and retain the
   existing label wrapping and minimum 48-pixel button height.

**Done when:** `Redeem` remains the prominent action; `Redeemed` and `Not enough
points` are clearly legible and non-interactive. The primary loading spinner is
visible and repeat confirmation remains blocked. Because `AppButton` is shared,
visually check another primary disabled/loading consumer as well as the reward
confirmation dialog.

## Phase 3 — Verify production-theme readability and responsive behavior

**Use:** `test/features/rewards/rewards_screen_test.dart`,
`test/shared/widgets/shared_components_test.dart`, and a running Flutter app.

1. Update the rewards test host to use `AppTheme.light`. For selection/navigation
   checks, supply a router because `_selectCategory` calls `context.go`. Use a
   shared overridden mock store/providers so wallet and reward state agree.
2. Exercise a controlled 55-point state: a 50-point reward available to redeem,
   a 75-point reward unaffordable, and a reward whose redemption count is already
   at its limit. Reuse existing fixtures/models; verify enabled/disabled behavior
   with the existing widget-test approach. Avoid a new visual-testing framework.
3. Inspect the rendered colors, including inherited/resolved text colors rather
   than only finding text widgets. Target at least **4.5:1** text contrast for
   category labels and action labels, including unavailable-state explanations
   as a deliberate readability goal. Disabled controls are normally exempt from
   that accessibility threshold, but their messages are important here.
4. Check 360- and 390-logical-pixel viewports at normal text size, plus 390 pixels
   at 1.5x text scaling. At 360 pixels the current padded grid should use one
   column; at 390 pixels it should use two at normal scale and one at 1.5x.
   Confirm chip wrapping, full button labels, and scrolling to My vouchers.
5. Capture an updated screenshot matching the supplied state, then check category
   switching, redemption confirmation/loading/success, and voucher navigation.
   Record visual checks only after actually viewing the rendered page.

**Implementation checks:**

```text
dart format lib/features/rewards/presentation/screens/rewards_screen.dart lib/shared/widgets/app_button.dart test/features/rewards/rewards_screen_test.dart test/shared/widgets/shared_components_test.dart
flutter analyze
flutter test test/features/rewards test/shared/widgets/shared_components_test.dart
```

**Complete when:** The screenshot's pale-on-pale labels are resolved, both filter
states and all three reward action states are readable, and the focused checks
pass with no overflow at the listed sizes.
