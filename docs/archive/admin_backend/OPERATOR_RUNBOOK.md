# EcoLoop Admin Portal — Operator Runbook

- **Document ID:** RUNBOOK-ADMIN-OPS-001
- **Target Audience:** Recycling Operations Staff, Facility Managers, Verification Officers
- **Application:** EcoLoop Admin Portal (`../../../apps/admin-web`)
- **System Version:** EcoLoop Admin Backend v1.0

---

## 1. Getting Started & Authentication

1. **Accessing the Portal:**
   - Navigate to the designated HTTPS Admin URL (e.g. `https://ecoloop-admin.web.app/login`).
2. **Signing In:**
   - Enter your provisioned administrative email and password.
   - Click **Sign In to Dashboard**.
   - *Note: Self-registration is disabled. If you do not have credentials or your account is deactivated, contact your system administrator.*
3. **Session Persistence:**
   - Your session remains active across tab reloads and browser restarts.
   - When finishing your shift, always click **Sign Out** in the navigation header to clear local credentials and active real-time listeners.

---

## 2. Daily Workflow Guide

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│ 1. Fleet Status │ ───> │ 2. Handle Alerts│ ───> │ 3. Verify Batch │
│    & Overview   │      │    & Collection │      │    Submissions  │
└─────────────────┘      └─────────────────┘      └─────────────────┘
                                                           │
                                                           ▼
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│ 6. End of Shift │ <─── │ 5. Program &    │ <─── │ 4. Maintain     │
│    Sign Out     │      │    Policy Check │      │    Catalog      │
└─────────────────┘      └─────────────────┘      └─────────────────┘
```

---

## 3. Workflow 1: Fleet Overview & Analytics (`/overview`)

The **Fleet Overview** dashboard provides a live operational summary of the entire recycling network:

- **Key Metrics Cards:**
  - **Active Smart Bins:** Total active bins currently deployed and accepting deposits.
  - **Open Capacity Alerts:** Number of bins currently at or above the alert threshold (default 80%).
  - **Verified Deposits:** Cumulative count of verified batches processed since system inception.
  - **EcoPoints Issued:** Total gross EcoPoints awarded to residents for accepted recyclable materials. *(Note: resident voucher redemptions do not decrement this total).*
- **Attention Bins Panel:**
  - Displays bins requiring urgent physical attention (e.g., bins exceeding capacity threshold or offline).
  - Click on any bin row to jump directly to its management page.
- **7-Day Deposit Activity:**
  - Shows verified deposits by calendar day (calculated in Malaysia Time, UTC+8).
- **Recycled Material Mix:**
  - Live breakdown of accepted materials (Plastic Bottles, Aluminium Cans, Paper, Glass Bottles) and estimated kg diverted.

---

## 4. Workflow 2: Smart Bin Fleet Management (`/bins`)

Manage physical smart recycling bins, monitor fill levels, and export registration QR codes:

### 4.1 Registering a New Smart Bin
1. Click **+ Add Smart Bin** in the top right corner.
2. Fill in the required fields:
   - **Bin Name / Identifier:** (e.g. `Bin-CentralPark-01`)
   - **Location Description:** (e.g. `Level 1 Food Court Entrance`)
   - **Total Capacity (spc):** Physical volume in standard spatial units (must be a positive integer, e.g., `1000`).
3. Click **Create Smart Bin**.
4. The system automatically initializes the bin with `occupancy: 0 spc (0%)`, status `active`, and a new active collection cycle.

### 4.2 Exporting & Printing QR Codes
1. In the Smart Bins table, locate the bin and click the **QR Code** icon.
2. The modal displays the canonical registered QR payload:
   `ecoloop://bin/<BIN_ID>`
3. Click **Download QR Code** to save a print-ready image for physical affixing to the recycling kiosk.
4. *Important: Residents must scan this registered QR code to begin a deposit session.*

### 4.3 Deleting or Decommissioning a Bin
- Bins that have active collection cycles or historical deposit batches cannot be deleted to preserve audit trails.
- Instead, set the bin status to **Maintenance** or **Decommissioned**.

---

## 5. Workflow 3: Capacity Alerts & Collection Cycles (`/alerts`)

When a bin's fill level reaches or exceeds the threshold (e.g., 80%), a **Capacity Alert** is automatically generated.

### 5.1 Step-by-Step Collection Process
1. Navigate to **Capacity Alerts** in the sidebar.
2. Locate the alert in the **Active Alerts** list.
3. Review the alert details:
   - Current Fill % and Occupancy in `spc`.
   - Snapshot of the threshold active when the alert fired.
4. **Schedule Collection:**
   - Click **Schedule Collection**.
   - Assign the dispatch team / collection schedule. The alert status transitions to `scheduled`.
5. **Record Collection & Reset:**
   - Once collection staff have physically emptied the bin kiosk, click **Record Collection**.
   - Provide the vehicle / crew reference identifier.
   - The system executes an audited collection cycle transition:
     - The current collection cycle is sealed with historical stats.
     - A new collection cycle is initialized.
     - **The bin occupancy is reset to 0 spc (0%).**
     - The capacity alert status transitions to `resolved`.
6. Click **Confirm Resolution** to close the workflow ticket.

---

## 6. Workflow 4: Deposit Verification & Manual Review (`/verification`)

Batches flagged by the automated computer vision pipeline (e.g. uncertain classification, unreadable items, or mixed contamination) appear in the **Deposit Verification** queue.

### 6.1 Reviewing a Batch
1. Open **Deposit Verification** from the sidebar.
2. Select a batch with status `pending_review`.
3. The review workspace displays:
   - **Chamber Photo / Evidence Crop:** High-resolution image of the items deposited inside the chamber.
   - **Detection Findings:** List of detected objects with bounding boxes and model confidence.
   - **Pinned Policy Snapshot:** The EcoPoints rates and material rules that were active when the resident deposited the items.
4. Inspect each item:
   - **Accepted Object:** If correctly identified (e.g. PET Plastic Bottle), confirm category and item count.
   - **Misidentified Object:** Reclassify to the correct category (e.g., Aluminium Can).
   - **Contaminant / Excluded Object:** Mark as excluded (e.g. Cardboard or organic trash).
5. **Special Case: Affirmative Empty Chamber**
   - If the camera captured a false deposit (e.g. resident closed door without depositing anything), click **Mark Empty Chamber**.
   - Awards 0 points, confirms 0 items, and releases provisional chamber space.
6. **Submit Decision:**
   - Click **Resolve Batch & Award Points**.
   - The resident's wallet is credited immediately with points computed against their pinned policy.
   - A verified receipt is recorded.

---

## 7. Workflow 5: Reward Offer Catalog Management (`/vouchers`)

Manage reward vouchers that residents can redeem using their earned EcoPoints:

### 7.1 Creating a Reward Offer
1. Navigate to **Reward Vouchers** (`/vouchers`).
2. Click **+ Create Catalog Offer**.
3. Fill in the offer details:
   - **Title & Merchant:** (e.g. `RM5 Eco-Coffee Voucher`, `Green Bean Cafe`)
   - **Category:** (e.g. `Beverages & Food`, `Sustainable Living`, `Transport`)
   - **EcoPoints Cost:** Points required to redeem (e.g. `150`).
   - **Per-Resident Limit:** Maximum vouchers a single user can redeem (e.g. `2`).
   - **Expiry Date:** Future expiration date (evaluated at 23:59:59 Malaysia Time).
   - **Demo Terms & Artwork URL:** Standard terms of use and badge image URL.
4. Set status to **Active** (published) or **Draft**.
5. Click **Save Offer**.

### 7.2 Reference Fencing on Deletion
> [!WARNING]
> If any resident has already redeemed an offer into their wallet, **the offer cannot be deleted**. This protects the resident's active voucher and transaction history.
> To remove a redeemed offer from future resident discovery, edit the offer and set status to **Deactivated / Draft**.

---

## 8. Workflow 6: Program Settings & Policy Configuration (`/settings`)

Configure global recycling rates and operating parameters:

1. **Capacity Alert Threshold:**
   - Choose between `75%`, `80%`, or `85%` fill trigger.
2. **Accepted Material Classes:**
   - Toggle accepted categories: `plastic`, `aluminium`, `paper`, `glass`.
   - *Note: Cardboard is permanently excluded from smart bin acceptance.*
3. **Reward Points per Item:**
   - Specify EcoPoints awarded per accepted item (e.g. Plastic: 5 pts, Can: 7 pts, Paper: 2 pts, Glass: 10 pts).
4. **Publishing New Policy:**
   - Click **Publish Updated Policy**.
   - The system creates a new immutable policy version (e.g. `policy-v2`).
   - *Key Rule:* New rates apply only to future deposits. Any batches already submitted or currently pending verification will settle against their original pinned policy version.

---

## 9. Operator Troubleshooting & FAQs

### Q: I received an error saying "Concurrency Conflict" or "Version Out of Date".
- **Cause:** Another operator made a modification to the same bin, reward offer, or settings document while you were viewing it.
- **Resolution:** Refresh your page or click **Reload Data**. Verify the updated details and re-apply your change.

### Q: A resident claims they did not receive points for a verified deposit.
- **Checklist:**
  1. Open **Deposit Verification** -> **Resolved Tab**.
  2. Search by Batch ID or Resident ID.
  3. Confirm if the batch was resolved as `verified`, `rejected`, or `empty`.
  4. If `verified`, check the **Verified Receipt** to inspect points awarded.

### Q: Why can't I edit a bin's fill percentage directly?
- **Answer:** Fill percentage is physically derived from sensor occupancy (`occupiedSpc / capacitySpc * 100%`). Manual percentage overrides are disabled to prevent sensor and financial discrepancies. Use **Record Collection** to empty a full bin.
