# EcoLoop Admin Portal — System Administration Runbook

- **Document ID:** RUNBOOK-ADMIN-SYS-001
- **Target Audience:** DevOps Engineers, Platform Administrators, Site Reliability Engineers
- **System:** EcoLoop Smart Recycling Platform — Administrative Subsystem
- **Scope:** Deployment, identity provisioning, environment management, monitoring, and disaster recovery for `../../../apps/admin-web` and admin backend functions.

---

## 1. System Topology & Architecture

The EcoLoop administrative backend adheres to Clean Architecture principles, ensuring complete decoupling between administrative operations and the resident Flutter mobile/web client while sharing canonical domain persistence:

```
[ Admin Portal SPA ] (React 19 / Vite)
      │
      ├── HTTPS Hosting: Target "admin" (apps/admin-web/dist)
      │
      ▼
[ Firebase Callable Gateway ] (functions/src/transport/admin_callables.ts)
      │ (App Check + role: "admin" Custom Claim + adminAccounts/{uid}.enabled)
      ▼
[ Admin Application Services ] (functions/src/application/admin_*.ts)
      │
      ▼
[ Domain & Shared Stores ] (functions/src/infrastructure/firestore/*)
      │
      ▼
[ Cloud Firestore: ecoloop-db (Named Database) ]
```

### Key Topology Attributes:
- **Firebase Project ID:** `ecoloop-thesmartrecycling`
- **Named Firestore Database:** `ecoloop-db`
- **Functions Execution Region:** `us-central1`
- **Inference/Vision Worker Region:** `asia-southeast1`
- **Hosting Targets:**
  - `resident`: Serves `build/web` (Resident Flutter Web Client)
  - `admin`: Serves `apps/admin-web/dist` (Admin Web Portal)

---

## 2. Identity & Access Provisioning

Administrative authorization strictly requires **two-factor boundary gating**:
1. **Firebase Auth Custom Claim:** `token.role === "admin"` (Legacy `{ admin: true }` is rejected).
2. **Firestore Account Record:** `adminAccounts/{uid}` with `enabled === true` in `ecoloop-db`.

Direct public self-registration for administrators is forbidden.

### 2.1 Provisioning a New Administrator

Run the privileged provisioning tool from the `functions/` directory:

```powershell
# Live Environment Provisioning
npm run tool:admin-provision -- `
  --environment=live `
  --project=ecoloop-thesmartrecycling `
  --database=ecoloop-db `
  --action=provision `
  --email=ops-lead@ecoloop.org `
  --password="<SECURE_TEMPORARY_PASSWORD>" `
  --displayName="Operations Lead"
```

*For local emulator testing, replace `--environment=live` with `--environment=emulator`.*

### 2.2 Immediate Account Suspension / Revocation

To suspend an administrator's privileges immediately:

```powershell
# Disable Account and Revoke Claims
npm run tool:admin-provision -- `
  --environment=live `
  --project=ecoloop-thesmartrecycling `
  --database=ecoloop-db `
  --action=disable `
  --email=ops-lead@ecoloop.org
```

**Suspension Mechanics:**
- The document `adminAccounts/{uid}` is updated with `enabled: false`.
- The custom claim `role` is removed or revoked.
- Callable functions evaluate `adminAccounts/{uid}.enabled` on every privileged command invocation; existing JWTs are rejected immediately without waiting for token expiry.

---

## 3. Environment & Configuration Specifications

The Admin Web client consumes standard environment variables defined in `apps/admin-web/.env.production`:

| Variable | Recommended Live Setting | Description |
| --- | --- | --- |
| `VITE_ECOLOOP_BACKEND_MODE` | `firebase` | Forces use of real Firebase SDK adapters (`FirebaseRepositoryBundle`). |
| `VITE_FIREBASE_PROJECT_ID` | `ecoloop-thesmartrecycling` | Pinned project ID. |
| `VITE_FIREBASE_DATABASE_ID` | `ecoloop-db` | Pinned named Firestore database. |
| `VITE_FIREBASE_STORAGE_BUCKET` | `ecoloop-thesmartrecycling.firebasestorage.app` | Artifacts and inspection images bucket. |
| `VITE_FIREBASE_FUNCTIONS_REGION` | `us-central1` | Regional location of admin callables. |
| `VITE_APP_CHECK_SITE_KEY` | `<RECAPTCHA_ENTERPRISE_SITE_KEY>` | Public web reCAPTCHA key registered for the admin domain. |

---

## 4. Build & Deployment Lifecycle

Deployments are strictly segregated into multi-target configurations to prevent accidental disruption of the resident application.

### 4.1 Deployment Pre-Flight Checks

Run the verification pipeline sequentially on the Windows host before any production push:

```powershell
# Step 1: Verify Functions Release Suite
cd functions
npm run test:admin:release
cd ..

# Step 2: Verify Admin Web Typecheck & Suite
cd apps/admin-web
npm run check:all
npm test
npm run build
cd ..
```

### 4.2 Step-by-Step Production Release

Deploy components in strict architectural order:

#### Step 1: Deploy Firestore Security Rules & Composite Indexes
```powershell
firebase deploy --only firestore:rules,firestore:indexes
```
*Wait until the Firebase Console confirms all composite indexes for `adminReviewViews`, `adminAlertViews`, and `adminRewardViews` report status **READY**.*

#### Step 2: Deploy Cloud Functions
```powershell
firebase deploy --only functions
```

#### Step 3: Deploy Admin Web Portal to Hosting
Build the production assets and deploy **strictly to the admin target**:
```powershell
cd apps/admin-web
npm run build
cd ..

firebase deploy --only hosting:admin
```
> [!IMPORTANT]
> Never run `firebase deploy --only hosting` without specifying `:admin`, as that would attempt to deploy both targets or overwrite the resident web client.

---

## 5. Rollback Procedures

### 5.1 Web Application Rollback
Because Firebase Hosting maintains immutable releases:
1. Open Firebase Console -> Hosting -> Target `ecoloop-admin`.
2. Locate the previous stable release.
3. Click **Rollback** to instantly point traffic to the previous build.
Alternatively, redeploy the previous tagged commit using `firebase deploy --only hosting:admin`.

### 5.2 Backend Functions Rollback
Checkout the previous stable Git commit and deploy functions:
```powershell
git checkout <PREVIOUS_STABLE_SHA>
cd functions
npm run build
firebase deploy --only functions
```

> [!CAUTION]
> **Data Immutability Guarantee:** Under no circumstances should database rollbacks be executed by re-seeding or deleting collections. EcoLoop financial ledgers (`ecoPointsLedger`), verified deposit records, and issued voucher snapshots are immutable. If a schema bug occurs, roll forward with a projection rebuild script.

---

## 6. Projections Rebuild & Data Reconciliation

If read-optimized projection views (`adminAlertViews`, `adminReviewViews`, `adminRewardViews`, `adminDashboardViews`) desynchronize due to network interruptions:

1. **Idempotent Rebuild:** Re-run the projection backfill tool:
   ```powershell
   cd functions
   npm run tool:rebuild-projections -- --project=ecoloop-thesmartrecycling --database=ecoloop-db
   ```
2. **Reconciliation Auditing:** The tool walks canonical collections (`bins`, `cycles`, `batches`, `reviews`, `rewards`, `redemptions`) and atomically recomputes view documents using transaction checkpoints.
3. **Ledger Integrity Check:** Run the ledger consistency verification:
   ```powershell
   npm run tool:verify-ledger -- --project=ecoloop-thesmartrecycling --database=ecoloop-db
   ```
   Ensures that `SUM(ecoPointsLedger.pointsAwarded) == adminDashboardViews.totalPointsIssued`.

---

## 7. Monitoring & Alerting

Monitor Cloud Logging with these critical metric queries:

- **Unauthorized Admin Invocations:**
  ```text
  resource.type="cloud_function"
  severity>=WARNING
  "UNAUTHENTICATED" OR "PERMISSION_DENIED"
  ```
- **Stale Concurrency Conflicts:**
  ```text
  resource.type="cloud_function"
  "CONCURRENCY_CONFLICT" OR "FAILED_PRECONDITION"
  ```
- **Capacity Alert Breaches:**
  ```text
  resource.type="cloud_function"
  jsonPayload.event="ADMIN_CAPACITY_ALERT_TRIGGERED"
  ```
