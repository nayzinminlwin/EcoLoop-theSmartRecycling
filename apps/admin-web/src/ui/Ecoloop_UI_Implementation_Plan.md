You are a senior frontend engineer and UI/UX designer working on the EcoLoop AI admin dashboard. I've attached a reference screenshot of the TARGET design (the redesigned "Smart Bins" page). Our current implementation looks flatter and less structured. Redesign the UI to match the target and apply it consistently to EVERY page of the app. Do not change business logic, routes, API calls or data models. This is a presentation and UX task.

## Step 0: Audit first
1. Explore the codebase: framework, styling approach (Tailwind / CSS modules / etc.), layout components, shared components, and the list of pages (Overview, Smart Bins, Capacity Alerts, Deposit Verification, Rewards & Vouchers, Settings, plus all modals/forms/dialogs).
2. Report briefly what you found, then proceed. Reuse existing components where possible; create shared ones where logic is duplicated.

## Step 1: Design tokens (centralize them, no hardcoded colors in pages)
Sample exact values from the reference image where you can; otherwise use these:
- Sidebar: dark forest green (~#0F3D2B), active item with a lighter translucent green rounded background, hover state on all items, white/soft-green text.
- Brand/primary: green (~#166534 / #15803D), used for primary buttons, links, active sort, focus rings.
- App background: very light neutral with a slight green tint (~#F3F6F4). Surfaces (cards, inputs, tables): white.
- Borders: 1px light gray-green (~#E2E8E4). Radius: 8px for inputs/buttons, 12px for cards. Subtle shadow on cards only.
- Status colors (background / text pairs): success green, warning amber, critical red, neutral gray.
- Typography: Inter (or the existing sans), page title ~28px semibold, eyebrow label 11px uppercase letter-spaced green, table headers 11px uppercase letter-spaced muted gray, body 14px.
Define these as CSS variables or Tailwind theme tokens.

## Step 2: Shared components (build once, use everywhere)
- **AppShell**: sidebar + top bar. The top bar has a bottom border and the notification bell in a bordered rounded icon button with an unread dot. Sidebar badge is a compact red pill with the count. User block at the bottom with avatar initial and truncated name/email.
- **PageHeader**: eyebrow label, title, description, and a right-aligned primary action button.
- **Alert/Toast banner**: light green background, check icon, message, dismiss (X) button. Variants: success, error, warning, info. Show it after create/update/delete actions and auto-dismiss after ~5s (also dismissible manually). Add `role="status"` / `aria-live`.
- **SearchInput**: bordered, rounded, white, with the search icon inside on the left, clear button when it has text, debounced.
- **Select/Filter dropdown**: bordered, rounded, white, same height as the search input, with a chevron. Include a "Reset" text button that clears all filters.
- **DataTable card**: white card with border and rounded corners, tinted header row, row dividers, row hover highlight, sortable column headers (↕ icon when sortable, green ▲/▼ when active), and a footer with "Showing X–Y of Z", rows-per-page select and Previous / Page N of M / Next buttons styled as bordered buttons (disabled state clearly muted).
- **StatusBadge**: pill with a tinted background and matching text color, uppercase 11px semibold. Map: NORMAL/ENABLED = green, WARNING = amber, CRITICAL = red, DISABLED/OFFLINE = gray.
- **CapacityBar**: rounded track in light gray (always visible, even at 0%), fill colored by threshold (green < warning, amber for warning, red for critical), percentage in bold directly beside the bar.
- **Buttons**: Primary (solid green), Secondary/outline (white, border, green text, used for QR/Edit), Danger-soft (light red background, red text, used for Delete). Consistent height, focus ring, disabled and loading states.
- **Empty state, loading skeleton, error state** for every table/list.

## Step 3: Apply to every page
- **Smart Bins**: exactly as in the reference: PageHeader, success banner after registering a bin, search + three filters + Reset, DataTable card with columns Bin ID (sortable, default ascending), Location (sortable, two-line name + sublocation), Capacity (sortable, CapacityBar), Status (two badges: level + enabled/disabled), Collection Status, Actions (QR / Edit / Delete buttons).
- **Overview**: use the same card style for KPI/stat cards and charts (white, border, radius, shadow), same header pattern, status colors consistent with the badges.
- **Capacity Alerts**: same table card, severity StatusBadges, CapacityBar, and keep the sidebar badge count in sync with the actual alert count.
- **Deposit Verification**: same table card and filters; verification states as StatusBadges; approve/reject as Primary / Danger-soft buttons; image previews in rounded bordered thumbnails with a click-to-enlarge modal.
- **Rewards & Vouchers**: same table or card grid styling; voucher status as StatusBadges; same filters, search and buttons.
- **Settings**: form sections in white cards with a section title and description, bordered inputs matching SearchInput styling, inline validation messages, and a sticky or clearly placed Save button with a success banner after saving.
- **Modals/forms (Add/Edit Smart Bin, Delete confirm, QR dialog, etc.)**: white rounded-12 dialog, header with title and close button, labeled bordered inputs, clear primary/secondary buttons, destructive confirmation for Delete that names the item being deleted.

## Step 4: UX improvements
- Immediate feedback on every mutation (success/error banner), and the new/updated row should be visible after the action (stay on the current sort/page, or highlight the changed row briefly).
- Persist filters, search and sort in the URL query string so refresh and back/forward work.
- Hover, focus-visible and active states on all interactive elements. Full keyboard navigation and visible focus rings.
- Proper loading skeletons and empty states ("No bins match your filters" with a Reset action).
- Disable buttons while a request is running to prevent double submits.
- Accessibility: WCAG AA contrast, aria-labels on icon-only buttons, `aria-sort` on sortable headers, labels tied to inputs, and don't rely on color alone (badges include text).
- Responsive: sidebar collapses to icons or a drawer on tablet/mobile, the table scrolls horizontally inside its card, and filters wrap onto multiple lines.
- Smooth, short transitions (150–200ms) and respect `prefers-reduced-motion`.

## Constraints
- Don't change behavior, API contracts, route names or data shapes.
- Don't copy the dimmed overlay look of the reference background; use the soft tinted app background defined above.
- No new heavy UI dependency unless the project already uses it.
- Keep commits/changes organized: tokens → shared components → each page.

## Definition of done
- Every page uses AppShell, PageHeader and the shared components; no page-specific one-off styles for tables, badges, buttons or inputs remain.
- Smart Bins page matches the reference screenshot closely (side-by-side check at 1440px width).
- Lint, type-check and existing tests pass. Add/adjust tests for StatusBadge, CapacityBar and sorting.
- Finish with a short summary: what changed per page, the shared components created, any deviations from the reference and why, and anything you couldn't verify.