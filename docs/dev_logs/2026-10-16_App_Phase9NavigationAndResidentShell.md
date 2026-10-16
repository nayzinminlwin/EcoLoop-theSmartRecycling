# Dev Log: App - Phase 9 Navigation and Resident Shell

**Date and Time :** 2026-10-16 20:30  
**Agent:** AI assistant using Copilot SDK in VS Code  
**Moderator:** Alex  
**Status:** Completed

## 1. Objective

Implement Phase 9 of the Figma-to-Flutter plan by replacing the flat route
configuration with one guarded `go_router` resident shell. Connect the Home,
Scan, and Settings branches, centralize route parameter parsing, preserve
mock-session behavior, and verify direct links, branch navigation, auth
restoration, and recoverable route failures.

## 2. Reference Documents

- `docs/FIGMA_USER_APP_TO_FLUTTER_IMPLEMENTATION_PLAN.md` — Phase 9 route table,
  shell requirements, guard behavior, and cross-feature invalidation contract
- `docs/FLUTTER_UI_EXECUTION_LOG.md` — completed Phases 1–8 decisions and
  verification history
- `EcoLoop_AI_Figma_Design_Artifacts/src/App.tsx` — `ResidentApp` navigation,
  header, bottom navigation, and resident page behavior
- `EcoLoop_AI_Figma_Design_Artifacts/src/index.css` — `.resident-shell`,
  `.mobile-top`, `.mobile-content`, `.bottom-nav`, `.scan-nav`, and
  `.page-title` source styling
- `.agent/developer/agent.md` — Flutter implementation, mock-only, and commit
  requirements
- `.agent/templates/dev_log_template.md` — development log structure

## 3. Changes Made

- **Files Created:**
  - `lib/app/presentation/resident_bottom_navigation.dart`
  - `lib/app/presentation/resident_shell.dart`
  - `lib/app/presentation/resident_top_bar.dart`
  - `lib/app/presentation/route_error_screen.dart`
  - `lib/app/router/route_guards.dart`
  - `lib/app/router/route_parameter_parsers.dart`
  - `test/app/app_router_test.dart`
  - `test/app/resident_shell_test.dart`
  - this development log
- **Files Modified:**
  - `lib/app/providers/app_providers.dart`
  - `lib/app/router/app_router.dart`
  - `lib/app/presentation/bootstrap_screen.dart`
  - `test/features/scan/scan_flow_test.dart`
  - `docs/FLUTTER_UI_EXECUTION_LOG.md`
- **Impact to other modules:** The application now receives its router from
  the account repository provider so route guards observe the shared mock auth
  stream. Existing feature callbacks continue to navigate through the single
  route table. The resident shell supplies the shared header and bottom bar
  without adding admin routes or Firebase calls.

## 4. Technical Decisions & Deviations

- `StatefulShellRoute.indexedStack` owns three distinct branch navigator keys:
  Home, Scan, and Settings. Home owns guide, history, rewards, and voucher
  routes; Scan owns scanner and all session-stage routes; Settings owns its
  three detail routes.
- `RouteParameterParsers` validates non-empty opaque IDs, calendar dates,
  history statuses, and voucher statuses. Invalid query values normalize to
  the documented default behavior; invalid IDs redirect to the relevant
  parent route instead of using an `extra` object.
- `RouteGuards` observes `watchAuthState()` once for the router lifetime.
  Resident routes require a signed-in `user` role. Admin claims do not unlock
  resident admin controls. Auth resolution failures are represented on the
  bootstrap screen with a Retry action.
- The source-style bottom navigation uses a safe-area-aware 78 logical pixel
  content surface and keeps the raised circular Scan affordance. Home and
  Settings reselect to their branch roots; Scan preserves an unfinished
  session-stage route and starts at the scanner when no active session exists.
- The router factory retains an optional repository argument for existing
  focused tests. Its fallback repository uses zero read delay only for router
  construction tests; the production Riverpod provider supplies the normal
  delayed mock repository and shared `MockDataStore`.
- No new domain models, live Firebase SDK calls, network calls, emulator
  connections, or protected Android configuration changes were introduced.
- A scan test was adjusted to mount the guarded router before navigating
  directly to `/scan`, matching the real startup/auth-resolution lifecycle.

## 5. Phase 9 Deliverables

| Deliverable | Completion | Description |
|---|---|---|
| Centralized route table | ✅ | All required resident route families and names are registered in one `GoRouter` |
| Stateful resident shell | ✅ | Home, Scan, and Settings branches use `StatefulShellRoute.indexedStack` |
| Resident header and bottom navigation | ✅ | Shared top bar, notification entry point, safe-area layout, and raised Scan action |
| Route parameter handling | ✅ | Opaque IDs, date filters, deposit status, voucher status, and malformed input handling |
| Auth/session guards | ✅ | Mock auth observation, signed-out protection, bootstrap loading, and retryable auth failure |
| Scan-stage routing | ✅ | Session IDs are validated and existing canonical-stage redirects remain authoritative |
| Back and branch behavior | ✅ | Existing feature back callbacks remain connected; branch reselect behavior follows Phase 9 policy |
| Router and shell tests | ✅ | Route registration, parameter normalization, branch visibility, and branch switching covered |
| Mock-only boundary | ✅ | No Firebase initialization, network access, emulator connection, or admin entry point |
| Documentation | ✅ | Execution log updated and this template-compliant development log added |

## 6. Next Steps / Known Issues

- Phase 10 should add the connected resident journey integration test and the
  final acceptance and mock-contract documents.
- DTD hot reload/hot restart could not be executed because no Dart/Flutter MCP
  client was connected and no active VS Code Flutter application was available.
- Verification completed:
  - `flutter analyze`
  - `flutter test` — 42 tests passed
  - `flutter build web`
  - protected Android SHA-256 checksums unchanged
- The unrelated untracked file
  `docs/recycle_bin_multi_model_orchestrator_plan.md` was not modified.
