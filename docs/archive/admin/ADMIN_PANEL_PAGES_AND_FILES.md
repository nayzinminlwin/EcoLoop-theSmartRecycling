# EcoLoop AI — Admin Panel Pages & Files Architecture Specification

> **Document Type:** System Architecture & Artifact Decomposition  
> **Target System:** EcoLoop AI — Standalone Admin Web Portal  
> **Source Artifact:** `../../../EcoLoop_AI_Figma_Design_Artifacts` (`src/App.tsx`, `src/index.css`)  
> **Target Flutter Project:** `../../../lib` (Mobile Resident App) vs. Standalone Admin Portal  

---

## 1. Executive Summary & Context

The repository contains a Flutter mobile project (`../../../lib`) and a web prototype artifact folder (`../../../EcoLoop_AI_Figma_Design_Artifacts`). 

In the prototype artifact (`App.tsx`), both the **Resident Mobile Application** and the **Admin Management Dashboard** are colocated within a single unified prototype for demonstration purposes:
- In the **Resident Settings** screen (`ResidentSettings`), a secondary button labeled **"Open admin demo"** triggers role switching (`switchRole()`) from `"resident"` to `"admin"`.
- Upon switching to `"admin"`, the application mounts `<AdminApp />`, revealing a desktop-oriented **Admin Panel** containing **6 dedicated pages**.

### Why the Admin Panel Must Be a Separate Site

While convenient for prototype demonstration, housing the Admin Panel inside the mobile app is unsuitable for production:

1. **Security & Role-Based Access Control (RBAC):** Admin operations (overriding AI deposit rejections, triggering bin capacity resets, modifying point-to-currency reward conversion rates) require strict server-side authentication, SSO, and IP/VPN access restrictions. Embedding admin views in the client mobile bundle exposes admin endpoints and sensitive resident information (`RES-•••842`).
2. **Form Factor & User Experience:** The resident app is designed for mobile portrait view (QR scanning at physical bins, mobile vouchers, personal recycling history). The admin panel is a multi-column desktop dashboard with data tables, 7-day metric bar charts, split-pane AI camera verification queues, and system configuration forms.
3. **Independent Deployment & Release Lifecycle:** The admin site needs rapid operational updates, audit logging, and integrations with municipal waste dispatch systems without requiring App Store / Play Store releases.

---

## 2. Navigation Analysis & Discovery in Artifacts

### 2.1 The Entry Point: Resident Settings
In `../../../EcoLoop_AI_Figma_Design_Artifacts/src/App.tsx` (Lines 164–193):
```tsx
function ResidentSettings({ switchRole }: { switchRole: () => void }) {
  // ... settings list ...
  return (
    <div className="stack page">
      <div><p className="eyebrow">ACCOUNT</p><h1>Settings</h1></div>
      {/* Profile info & list of settings options */}
      <Button variant="secondary" onClick={switchRole}>
        Open admin demo
      </Button>
      <Button variant="ghost">Sign out</Button>
    </div>
  );
}
```

### 2.2 Role Switcher & Admin Shell Mounting
In `App.tsx` (Lines 264–268):
```tsx
export default function App() {
  const [role, setRole] = useState<"resident" | "admin">("resident");
  const [capacity, setCapacity] = useState(65);

  return role === "resident" 
    ? <ResidentApp switchRole={() => setRole("admin")} onDepositVerified={() => setCapacity(85)} />
    : <AdminApp switchRole={() => setRole("resident")} capacity={capacity} setCapacity={setCapacity} />;
}
```

### 2.3 The 6 Admin Navigation Items
In `App.tsx` (Line 195), the admin navigation array defines exactly **6 pages**:
```tsx
const adminNav: [IconName, string, string][] = [
  ["grid",     "Overview",              "overview"],
  ["bin",      "Smart Bins",            "bins"],
  ["alert",    "Capacity Alerts",       "alerts"],
  ["camera",   "Deposit Verification",  "verification"],
  ["gift",     "Rewards & Vouchers",    "vouchers"],
  ["settings", "Settings",              "settings"],
];
```

---

## 3. Detailed Specification of the 6 Dedicated Admin Pages

Below is the detailed breakdown of the 6 pages, their components, interactions, state, and data models discovered in `App.tsx` and `index.css`:

```
                       ┌──────────────────────────────────────────────┐
                       │           EcoLoop AI Admin Portal            │
                       └──────────────────────┬───────────────────────┘
                                              │
         ┌───────────────┬────────────────────┼───────────────────┬────────────────┬────────────────┐
         │               │                    │                   │                │                │
         ▼               ▼                    ▼                   ▼                ▼                ▼
    1. Overview    2. Smart Bins     3. Capacity Alerts   4. Verification   5. Vouchers     6. Settings
    (Dashboard)    (Fleet Mgmt)      (Workflow Dispatch)   (AI Review Queue) (Rewards Mgmt)  (System Config)
```

---

### Page 1: Overview (`overview`)
* **Route / Identifier:** `/overview`
* **Artifact Component:** `Overview` (Lines 219–229)
* **Eyebrow & Title:** `ADMIN CONSOLE` / `Township overview`
* **Purpose:** High-level dashboard summarizing recycling volume, active alerts, bin health, and recent operations.

#### UI Components & Sections:
1. **Header Action:** `Simulate BIN-004 to 85%` button (demonstrates live reactive alerting).
2. **Critical Alert Banner:** Conditionally displayed when `capacity >= threshold && !resolved`. Direct link button to `/alerts`.
3. **Key Metrics Grid (4 KPI Cards):**
   - **Registered Bins:** `24` (Township network)
   - **Active Alerts:** `1` or `0` (`Action needed` / `Ready to resolve` / `All clear`)
   - **Verified Deposits:** `1,284` (Illustrative total)
   - **EcoPoints Issued:** `18,450` (Illustrative total)
4. **Analytics Charts Panel:**
   - **Recycling Activity Bar Chart:** 7-day verified deposit volume (`Mon` to `Sun`: `[52, 68, 44, 76, 62, 88, 73]%`, scale up to 200).
   - **Material Mix Donut Chart:** Breakdown of `328 kg total` verified weight (Plastic: 42%, Metal: 28%, Paper: 21%, Glass: 9%).
5. **Bins Requiring Attention Panel:**
   - Embedded `<BinTable />` highlighting bins with `Critical` or `Warning` status.
   - Direct button `View all alerts`.

---

### Page 2: Smart Bins (`bins`)
* **Route / Identifier:** `/bins`
* **Artifact Component:** `Bins` & `BinTable` (Lines 231–233)
* **Eyebrow & Title:** `FLEET MANAGEMENT` / `Smart bins`
* **Purpose:** Fleet monitoring, real-time bin telemetry, fill level tracking, and hardware collection status.

#### UI Components & Sections:
1. **Search & Filter Toolbar:** Live search input (`Search by bin ID or location`).
2. **Fleet Data Table (`BinTable`):**
   - **Bin ID:** e.g., `BIN-004`, `BIN-011`, `BIN-008`, `BIN-002`
   - **Location:** e.g., `Cedar Residence · Ground Floor`, `Town Square · West Entrance`
   - **Capacity Indicator:** Graphic progress fill bar with color logic:
     - `>= 80%`: Red / Critical
     - `>= 60%`: Amber / Warning
     - `< 60%`: Green / Normal
   - **Status Badge:** `Critical`, `Warning`, or `Normal`
   - **Collection Status:** `Pending`, `Scheduled`, `Collected`, `Not scheduled`
3. **Simulation Action:** Quick button to force bin capacity simulation.

---

### Page 3: Capacity Alerts (`alerts`)
* **Route / Identifier:** `/alerts`
* **Artifact Component:** `Alerts` (Lines 235–244)
* **Eyebrow & Title:** `PRIORITY WORKFLOW` / `Capacity alerts`
* **Purpose:** Operational alert handling and waste management collection dispatch state machine.

#### UI Components & Sections:
1. **Workflow Stepper (5-Stage Visual Lifecycle):**
   - `Step 1: Reach 85%` (Sensor threshold exceeded)
   - `Step 2: Alert created` (Automated dispatch ticket triggered)
   - `Step 3: Schedule` (Municipal pickup scheduled)
   - `Step 4: Collect & reset` (Bin emptied, capacity reset to 10%)
   - `Step 5: Resolve` (Incident resolved and archived)
2. **Alert State Tabs:**
   - `Active alerts [count]`
   - `Resolved [count]`
3. **Alert Detail Card & Lifecycle Action Controls:**
   - **Header:** Tone-coded alert icon, Bin identifier, physical location, and large current capacity metric (`85%`).
   - **Telemetry Facts Grid:** `Time triggered`, `Last capacity update`, `Collection status` badge, `Alert threshold`.
   - **State Machine Action Buttons:**
     - `Schedule collection` (Transitions `Not scheduled` / `Pending` &rarr; `Scheduled`)
     - `Mark collected & reset bin` (Transitions `Scheduled` &rarr; `Collected`, resets capacity to `10%`)
     - `Resolve alert` (Transitions alert to `Resolved` and moves to the Resolved tab)
   - **Empty States:** Clean state graphic when zero alerts are open or resolved.

---

### Page 4: Deposit Verification (`verification`)
* **Route / Identifier:** `/verification`
* **Artifact Component:** `Verification` (Line 246)
* **Eyebrow & Title:** `AI REVIEW QUEUE` / `Deposit verification`
* **Badge:** `2 need review` (Amber)
* **Purpose:** Human-in-the-loop (HITL) review queue for flagged, low-confidence, or contaminated smart bin deposits.

#### UI Components & Sections:
1. **Review Queue Sidebar / List (`.review-list`):**
   - List of pending verification tickets:
     - `DEP-1087`: `BIN-007 · 11:24 AM`, Badge: `Uncertain`, Confidence: `62%`
     - `DEP-1081`: `BIN-004 · 9:46 AM`, Badge: `Possible contaminant`, Confidence: `48%`
2. **Inspection & Evidence Panel (`.review-detail`):**
   - **Internal Camera Snapshot Frame:** Displays the captured item snapshot (`Flattened drink carton`) from the physical smart bin's internal camera.
   - **Classification Analysis (2x2 Metadata Grid):**
     - `Predicted material`: Paper / mixed packaging
     - `AI confidence`: 62%
     - `Resident reference`: Masked resident identifier (`RES-•••842`)
     - `Points status`: Real-time status (`On hold · no points issued`, `20 points credited`, or `Not eligible`)
3. **Moderation Decision Actions:**
   - `Reject deposit` (Red / Danger) &rarr; Marks deposit non-eligible, awards 0 points.
   - `Approve deposit` (Green / Primary) &rarr; Confirms material, credits points to resident.
4. **Compliance Notice:** Explicit rule explaining that low-confidence AI predictions never issue points automatically until manual admin sign-off.

---

### Page 5: Rewards & Vouchers (`vouchers`)
* **Route / Identifier:** `/vouchers`
* **Artifact Component:** `AdminVouchers` (Lines 248–255)
* **Eyebrow & Title:** `REWARDS PROGRAM` / `Rewards & vouchers`
* **Purpose:** Merchant reward management, point redemption catalog, and voucher lifecycle administration.

#### UI Components & Sections:
1. **Header Action:** `Create voucher` button (with `plus` icon).
2. **Create Voucher Drawer / Form (`.voucher-form`):**
   - Form inputs for Voucher Title, Point Cost, Expiration Date.
   - Actions: `Cancel` and `Create draft voucher`.
3. **Voucher Management Table:**
   - **Voucher Name:** e.g., `RM5 café voucher`, `Vending snack`, `Township tote bag`
   - **Points Required:** Point cost (e.g., `200 pts`, `100 pts`, `350 pts`)
   - **Expiry Date:** e.g., `30 Jun 2025`
   - **Status Badge:** `Active` (Green) or `Draft` (Gray)
   - **Row Actions:** Inline `Edit` / `Done` toggles, `Set draft` / `Set active` status switches.

---

### Page 6: Settings (`settings`)
* **Route / Identifier:** `/settings`
* **Artifact Component:** `AdminSettings` (Lines 257–262)
* **Eyebrow & Title:** `SYSTEM CONFIGURATION` / `Settings`
* **Purpose:** System-wide thresholds, accepted recycling materials, and EcoPoints reward exchange rates.

#### UI Components & Sections:
1. **Header Action:** `Save settings` button with automatic floating success banner (`Settings saved. Demo rules are now active.`).
2. **Configuration Sections (`.settings-stack`):**
   - **Capacity Alert Threshold:** Dropdown selector (`75%`, `80%`, `85%`) to configure the automated alert trigger point across all smart bins.
   - **Accepted Material Categories:** Checkbox toggle list (`Plastic`, `Metal`, `Paper`, `Glass`) determining which materials are eligible for rewards.
   - **EcoPoints Calculation Rules:** Numerical rate configuration inputs (`pts/kg`):
     - `Plastic`: 50 pts/kg
     - `Metal`: 80 pts/kg
     - `Paper`: 25 pts/kg
     - `Glass`: 40 pts/kg

---

## 4. Existing Artifact Decomposition

The table below catalogs all existing code within `EcoLoop_AI_Figma_Design_Artifacts/` that belongs exclusively to the Admin Panel:

| Artifact Source File | Line Range | Dedicated Admin Element / Component | Description |
|---|---|---|---|
| `src/App.tsx` | Lines 195 | `const adminNav` | 6-page navigation metadata definition |
| `src/App.tsx` | Lines 197–215 | `function AdminApp` | Admin application shell, sidebar, responsive drawer, top header, routing state |
| `src/App.tsx` | Line 217 | `function AdminTitle` | Reusable admin page title with eyebrow, title, and actions |
| `src/App.tsx` | Lines 219–229 | `function Overview` | Page 1: Overview dashboard, metrics cards, bar chart, donut chart |
| `src/App.tsx` | Line 231 | `function BinTable` | Shared data table for smart bins and collection status |
| `src/App.tsx` | Line 233 | `function Bins` | Page 2: Smart bins fleet management and search |
| `src/App.tsx` | Lines 235–244 | `function Alerts` | Page 3: Capacity alerts 5-step workflow stepper, alert detail, action lifecycle |
| `src/App.tsx` | Line 246 | `function Verification` | Page 4: AI deposit verification queue and camera inspection |
| `src/App.tsx` | Lines 248–255 | `type Voucher`, `AdminVouchers` | Page 5: Voucher catalog table, draft form, active/draft toggle |
| `src/App.tsx` | Lines 257–262 | `function AdminSettings` | Page 6: System settings (thresholds, accepted materials, pts/kg rates) |
| `src/App.tsx` | Line 192 | `<Button ...>Open admin demo</Button>` | Trigger button in `ResidentSettings` (to be removed in mobile production) |
| `src/index.css` | Lines 23–25 | `.admin-shell`, `.admin-page`, etc. | Grid layout, sidebar, desktop table styling, charts, responsive breakpoints |
| `src/index.css` | Lines 26–28 | `.workflow`, `.review-layout`, etc. | Admin MVP styles for stepper, camera preview, voucher drawer, setting sections |

---

## 5. Dedicated Project Architecture for the Standalone Admin Site

To completely isolate the Admin Panel into its own independent web repository or standalone web project, the following file and directory architecture is required:

### 5.1 Architecture Plan (Vite / Next.js / React Web)

```
ecoloop-admin-portal/
├── public/
│   ├── favicon.svg
│   └── camera-placeholder.svg
├── src/
│   ├── assets/
│   │   └── styles/
│   │       ├── globals.css                # Base theme & Tailwind v4 config
│   │       ├── admin-layout.css           # Admin shell, sidebar, headers
│   │       └── components.css             # Charts, stepper, review queue styles
│   ├── components/
│   │   ├── common/
│   │   │   ├── Badge.tsx                  # Status badges (green, amber, red, gray)
│   │   │   ├── Button.tsx                 # Primary, secondary, danger, ghost buttons
│   │   │   ├── Icon.tsx                   # SVG icons (grid, bin, alert, camera, etc.)
│   │   │   ├── SearchInput.tsx            # Standardized search bar with icon
│   │   │   └── SuccessBanner.tsx          # Toast / banner alert notifications
│   │   ├── layout/
│   │   │   ├── AdminLayout.tsx            # Main shell with responsive grid
│   │   │   ├── AdminSidebar.tsx           # Dark green navigation sidebar with badge pill
│   │   │   ├── AdminHeader.tsx            # Header with search, alert notifications, admin profile
│   │   │   └── AdminTitle.tsx             # Standardized page title & actions slot
│   │   ├── bins/
│   │   │   ├── BinTable.tsx               # Reusable fleet data table
│   │   │   └── CapacityBar.tsx            # Color-coded capacity fill indicator
│   │   ├── alerts/
│   │   │   ├── WorkflowStepper.tsx        # 5-stage collection workflow component
│   │   │   ├── AlertDetailCard.tsx        # Interactive alert resolution card
│   │   │   └── AlertTabs.tsx              # Active vs. Resolved tab switcher
│   │   ├── verification/
│   │   │   ├── ReviewQueueList.tsx        # Left-hand queue of pending deposits
│   │   │   ├── CameraSnapshotView.tsx     # Simulated internal camera preview
│   │   │   └── ClassificationDetails.tsx  # 2x2 AI confidence & resident reference grid
│   │   ├── vouchers/
│   │   │   ├── VoucherTable.tsx           # Reward vouchers data table
│   │   │   └── CreateVoucherModal.tsx     # Voucher creation form drawer
│   │   └── charts/
│   │       ├── RecyclingActivityChart.tsx # 7-day bar chart component
│   │       └── MaterialMixDonut.tsx       # Material distribution donut chart
│   ├── pages/ (or app/ routes):
│   │   ├── OverviewPage.tsx               # Page 1: /overview
│   │   ├── SmartBinsPage.tsx              # Page 2: /bins
│   │   ├── CapacityAlertsPage.tsx         # Page 3: /alerts
│   │   ├── DepositVerificationPage.tsx    # Page 4: /verification
│   │   ├── RewardsVouchersPage.tsx        # Page 5: /vouchers
│   │   └── SettingsPage.tsx               # Page 6: /settings
│   ├── types/
│   │   ├── bin.ts                         # SmartBin, BinCapacity, BinStatus types
│   │   ├── alert.ts                       # CapacityAlert, WorkflowStep, CollectionStatus
│   │   ├── deposit.ts                     # DepositVerification, MaterialPrediction
│   │   ├── voucher.ts                     # Voucher, VoucherStatus
│   │   └── settings.ts                    # AdminConfig, MaterialRate
│   ├── services/ / api/
│   │   ├── api-client.ts                  # Axios / Fetch client with Auth token handling
│   │   ├── bins-api.ts                    # Fleet telemetry endpoints
│   │   ├── alerts-api.ts                  # Alert dispatch & status transition endpoints
│   │   ├── verification-api.ts            # HITL deposit review & point crediting endpoints
│   │   ├── vouchers-api.ts                # Voucher CRUD endpoints
│   │   └── settings-api.ts                # System rules & rates endpoints
│   ├── context/ / store/
│   │   ├── AdminAuthContext.tsx           # Admin session & authentication
│   │   └── AlertNotificationContext.tsx   # Real-time WebSocket / polling for bin alerts
│   ├── App.tsx                            # Root routing (React Router)
│   └── main.tsx                           # Application entry point
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

### 5.2 Alternative Architecture Plan (Dedicated Flutter Web Admin App)

If the team prefers a unified Flutter / Dart codebase, the Admin Panel should be created as a separate Flutter project (e.g. `ecoloop_admin_web/`) or a strictly isolated feature module:

```
lib/
├── core/
│   ├── theme/
│   │   ├── admin_colors.dart              # #102e21 dark green, #176b45 primary, etc.
│   │   └── admin_typography.dart
│   └── routing/
│       └── admin_router.dart              # GoRouter with 6 distinct paths
├── shared/
│   └── widgets/
│       ├── admin_title.dart               # Eyebrow, Title, Actions
│       ├── status_badge.dart              # Critical, Warning, Normal, Draft, Active
│       └── capacity_progress_bar.dart
└── features/
    ├── layout/
    │   ├── admin_shell_screen.dart        # Scaffold with NavigationRail / Drawer
    │   ├── admin_sidebar.dart             # Desktop navigation sidebar
    │   └── admin_top_header.dart          # Search bar, alerts indicator, admin profile
    ├── overview/
    │   ├── presentation/
    │   │   ├── overview_screen.dart       # Page 1: Overview
    │   │   ├── kpi_metric_card.dart
    │   │   ├── weekly_activity_chart.dart
    │   │   └── material_donut_chart.dart
    │   └── models/overview_metrics.dart
    ├── smart_bins/
    │   ├── presentation/
    │   │   ├── smart_bins_screen.dart     # Page 2: Smart Bins
    │   │   └── bin_data_table.dart
    │   └── models/smart_bin.dart
    ├── capacity_alerts/
    │   ├── presentation/
    │   │   ├── capacity_alerts_screen.dart # Page 3: Capacity Alerts
    │   │   ├── workflow_stepper_widget.dart
    │   │   └── alert_detail_view.dart
    │   └── models/capacity_alert.dart
    ├── deposit_verification/
    │   ├── presentation/
    │   │   ├── verification_screen.dart   # Page 4: Deposit Verification
    │   │   ├── review_queue_tile.dart
    │   │   └── camera_inspection_card.dart
    │   └── models/verification_ticket.dart
    ├── rewards_vouchers/
    │   ├── presentation/
    │   │   ├── vouchers_screen.dart       # Page 5: Rewards & Vouchers
    │   │   ├── voucher_data_table.dart
    │   │   └── create_voucher_dialog.dart
    │   └── models/voucher.dart
    └── settings/
        ├── presentation/
        │   ├── admin_settings_screen.dart # Page 6: Settings
        │   ├── threshold_setting_card.dart
        │   ├── material_categories_card.dart
        │   └── reward_rates_card.dart
        └── models/admin_settings_config.dart
```

---

## 6. Matrix: 6 Admin Pages to Dedicated File Mapping

| # | Admin Page | Route | Artifact Component | Dedicated Web Component | Dedicated Flutter Screen | Key Functionalities |
|---|---|---|---|---|---|---|
| **1** | **Overview** | `/overview` | `Overview` (`App.tsx:219`) | `pages/OverviewPage.tsx` | `overview_screen.dart` | 4 KPI cards, 7-day bar chart, material mix donut, attention bin table, simulate alert button |
| **2** | **Smart Bins** | `/bins` | `Bins` (`App.tsx:233`) | `pages/SmartBinsPage.tsx` | `smart_bins_screen.dart` | Search fleet, bin table with location, capacity percentage bar, status badges, collection statuses |
| **3** | **Capacity Alerts** | `/alerts` | `Alerts` (`App.tsx:235`) | `pages/CapacityAlertsPage.tsx` | `capacity_alerts_screen.dart` | 5-stage stepper, Active/Resolved tabs, Schedule collection, Collect & reset, Resolve alert |
| **4** | **Deposit Verification** | `/verification` | `Verification` (`App.tsx:246`) | `pages/DepositVerificationPage.tsx` | `verification_screen.dart` | Review queue list, internal bin camera frame, AI classification (material, 62% confidence, resident ref), Approve/Reject |
| **5** | **Rewards & Vouchers** | `/vouchers` | `AdminVouchers` (`App.tsx:249`) | `pages/RewardsVouchersPage.tsx` | `vouchers_screen.dart` | Create voucher drawer/modal, voucher table, points cost, expiry dates, Active/Draft toggles |
| **6** | **Settings** | `/settings` | `AdminSettings` (`App.tsx:257`) | `pages/SettingsPage.tsx` | `admin_settings_screen.dart` | Capacity alert threshold (75%/80%/85%), Accepted materials checklist, EcoPoints pts/kg rates |

---

## 7. Decoupling & Separation Recommendations

1. **Remove Admin Hook from Flutter Mobile App:**
   - In the mobile resident app (`lib/main.dart` and future Flutter screens), omit the "Open admin demo" button from `ResidentSettings`.
   - The Flutter mobile application should remain strictly focused on resident features (QR scanner, points wallet, redemption, recycling guides).
2. **Independent Repository or Monorepo Setup:**
   - Host the Admin Web Portal as a separate package (e.g. `apps/admin-web` in a monorepo or a separate repository `EcoLoop_Admin_Portal`).
3. **Backend Service Separation:**
   - Separate resident-facing mobile APIs (`/api/v1/resident/*`) from administrative control APIs (`/api/v1/admin/*`).
   - Secure `/api/v1/admin/*` behind Admin JWT / OAuth2 and role verification middleware.
