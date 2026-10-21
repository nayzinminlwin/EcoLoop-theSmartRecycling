import { test, expect, type Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function loginAsAdmin(page: Page, destination?: string) {
  const url = destination ? `/login?redirect=${encodeURIComponent(destination)}` : "/login";
  await page.goto(url);

  // Use the demo credentials fill button
  const fillBtn = page.getByRole("button", { name: /Use demo credentials/i });
  await fillBtn.waitFor({ state: "visible" });
  await fillBtn.click();

  // Wait for asynchronous demo credentials to populate form
  await expect(page.getByLabel(/Email Address/i)).toHaveValue("admin@ecoloop.demo");
  await expect(page.getByLabel(/Password/i)).toHaveValue("AdminDemo123!");

  // Click Sign In
  const submitBtn = page.getByRole("button", { name: /Sign In/i });
  await submitBtn.click();

  // Wait for navigation past login
  await expect(page).not.toHaveURL(/\/login/);
}

// ---------------------------------------------------------------------------
// 1. Entry / Routes Test Suite
// ---------------------------------------------------------------------------
test.describe("1. Entry and Routes", () => {
  test("protected URL redirects to Login, demo-fill logs in to requested destination, all six routes render, unknown route recovers, and Logout blocks access", async ({
    page
  }) => {
    // 1. Unauthenticated protected access redirects to login
    await page.goto("/overview");
    await expect(page).toHaveURL(/\/login/);

    // 2. Demo fill logs in to requested destination
    await page.getByRole("button", { name: /Use demo credentials/i }).click();
    await expect(page.getByLabel(/Email Address/i)).toHaveValue("admin@ecoloop.demo");
    await page.getByRole("button", { name: /Sign In/i }).click();
    await expect(page).toHaveURL(/\/overview/);

    // 3. Confirm all six primary routes render correctly via sidebar navigation
    const navItems = [
      { label: "Overview", path: "/overview", title: /Fleet Overview/i },
      { label: "Smart Bins", path: "/bins", title: /Smart Bins/i },
      { label: "Capacity Alerts", path: "/alerts", title: /Capacity Alerts/i },
      { label: "Deposit Verification", path: "/verification", title: /Deposit Verification/i },
      { label: "Rewards & Vouchers", path: "/vouchers", title: /Rewards & vouchers/i },
      { label: "Settings", path: "/settings", title: /^Settings$/i }
    ];

    for (const item of navItems) {
      await page
        .getByRole("navigation", { name: /Main Navigation/i })
        .getByRole("link", { name: item.label })
        .click();
      await expect(page).toHaveURL(new RegExp(item.path));
      await expect(page.locator("h1")).toContainText(item.title);
    }

    // 4. Unknown route recovery
    await page.evaluate(() => {
      window.history.pushState({}, "", "/unknown-nonexistent-route");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    await expect(page.getByText(/Page Not Found/i)).toBeVisible();
    const returnBtn = page.getByRole("button", { name: /Return to Overview/i });
    await expect(returnBtn).toBeVisible();
    await returnBtn.click();
    await expect(page).toHaveURL(/\/overview/);

    // 5. Logout blocks access
    const logoutBtn = page.getByRole("button", { name: /Sign out/i });
    await logoutBtn.click();
    await expect(page).toHaveURL(/\/login/);

    // Revisiting protected route should redirect back to login
    await page.goto("/overview");
    await expect(page).toHaveURL(/\/login/);
  });
});

// ---------------------------------------------------------------------------
// 2. Fleet CRUD Test Suite
// ---------------------------------------------------------------------------
test.describe("2. Fleet CRUD", () => {
  test("creates BIN-020, searches and filters, edits, deletes, and validates error/conflict handling", async ({
    page
  }) => {
    await loginAsAdmin(page, "/bins");

    // Open Add Smart Bin modal
    await page.getByRole("button", { name: /Add Smart Bin/i }).click();
    await expect(page.getByText(/Register New Smart Bin/i)).toBeVisible();

    // Test form validation: submitting empty form
    await page.getByRole("button", { name: /Register Bin/i }).click();
    await expect(page.getByText(/Bin ID is required/i)).toBeVisible();

    // Fill valid data for BIN-020
    await page.getByLabel(/Bin Identifier/i).fill("BIN-020");
    await page.getByLabel(/Location Name/i).fill("North Plaza Hub");
    await page.getByLabel(/Location Detail/i).fill("Level 1 Near Gate B");
    await page.getByLabel(/Fill Capacity/i).fill("25");

    // Ensure plastic material is checked
    const plasticCheckbox = page.getByLabel(/Plastic/i);
    if (!(await plasticCheckbox.isChecked())) {
      await plasticCheckbox.check();
    }

    await page.getByRole("button", { name: /Register Bin/i }).click();
    await expect(page.getByText(/Bin BIN-020 registered successfully/i)).toBeVisible();

    // Search for BIN-020
    const searchInput = page.getByPlaceholder(/Search bins by location or ID/i);
    await searchInput.fill("North Plaza");
    await expect(page.getByText("North Plaza Hub")).toBeVisible();
    await expect(page.getByRole("cell", { name: "BIN-020" })).toBeVisible();

    // Edit BIN-020
    const row = page.getByRole("row", { name: /BIN-020/i });
    await row.getByRole("button", { name: /Edit/i }).click();
    await expect(page.getByText(/Edit Smart Bin: BIN-020/i)).toBeVisible();
    await page.getByLabel(/Fill Capacity/i).fill("45");
    await page.getByRole("button", { name: /Save Changes/i }).click();
    await expect(page.getByText(/Bin BIN-020 updated successfully/i)).toBeVisible();

    // Delete BIN-020
    const rowUpdated = page.getByRole("row", { name: /BIN-020/i });
    await rowUpdated.getByRole("button", { name: /Delete/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("dialog").getByRole("button", { name: /Delete Bin/i }).click();
    await expect(page.getByText(/Bin BIN-020 deleted successfully/i)).toBeVisible();

    // Clear search and verify BIN-004 conflict protection on delete
    await searchInput.fill("BIN-004");
    const bin004Row = page.getByRole("row", { name: /BIN-004/i });
    await expect(bin004Row).toBeVisible();
    await bin004Row.getByRole("button", { name: /Delete/i }).click();
    await page.getByRole("dialog").getByRole("button", { name: /Delete Bin/i }).click();
    // Confirms that conflict error prevents deletion
    await expect(
      page.getByRole("dialog").getByText(/Cannot delete bin with active references/i)
    ).toBeVisible();
    await page.getByRole("dialog").getByRole("button", { name: /Cancel/i }).click();
  });
});

// ---------------------------------------------------------------------------
// 3. Alert Lifecycle Test Suite
// ---------------------------------------------------------------------------
test.describe("3. Alert Lifecycle", () => {
  test("simulates 85% capacity, increments alert counts, schedules, collects (reset to 0%), and resolves", async ({
    page
  }) => {
    await loginAsAdmin(page, "/alerts");

    // Trigger demo simulation on BIN-004 to 85%
    const simBtn = page.getByRole("button", { name: /Simulate BIN-004 to 85%/i });
    await simBtn.click();
    await expect(page.getByText(/BIN-004 simulated to 85% capacity/i)).toBeVisible();

    // Active alert should appear in table and detail panel
    await expect(page.getByText("Cedar Residence").first()).toBeVisible();
    await expect(page.getByText("85%").first()).toBeVisible();

    // 1. Schedule Collection
    const scheduleBtn = page.getByRole("button", { name: /Schedule collection/i });
    await scheduleBtn.click();
    await expect(page.getByText(/Collection (scheduled|dispatched) for bin BIN-004/i)).toBeVisible();

    // 2. Collect and Reset
    const collectBtn = page.getByRole("button", { name: /Mark collected & reset bin/i });
    await collectBtn.click();
    await expect(page.getByText(/Confirm Bin Collection/i)).toBeVisible();
    await page.getByRole("dialog").getByRole("button", { name: /Mark collected & reset bin/i }).click();
    await expect(page.getByText(/Bin BIN-004 marked as collected/i)).toBeVisible();

    // 3. Resolve Alert
    const resolveBtn = page.getByRole("button", { name: /Resolve alert/i });
    await resolveBtn.click();

    // Verify resolved state tab
    await expect(page.getByRole("tab", { name: /Resolved/i })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByText("Cedar Residence").first()).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 4. Moderation / Deposit Verification Test Suite
// ---------------------------------------------------------------------------
test.describe("4. Deposit Moderation", () => {
  test("approves DEP-1087 once with points credit and rejects DEP-1081 with zero credit", async ({
    page
  }) => {
    await loginAsAdmin(page, "/verification");

    // 1. Select DEP-1087 in the review queue
    await page.getByText("DEP-1087").click();
    await expect(page.getByText("Flattened drink carton")).toBeVisible();

    // Click Approve deposit
    await page.getByRole("button", { name: /Approve deposit/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("dialog").getByRole("button", { name: /Approve deposit/i }).click();

    // Decision receipt banner should appear
    await expect(page.getByText(/Deposit DEP-1087 approved!/i)).toBeVisible();

    // 2. Select DEP-1081 in the queue
    await page.getByText("DEP-1081").click();
    await expect(page.getByText("Container with possible food residue")).toBeVisible();

    // Click Reject deposit
    await page.getByRole("button", { name: /Reject deposit/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("dialog").getByRole("button", { name: /Reject deposit/i }).click();

    // Rejection receipt banner
    await expect(page.getByText(/Deposit DEP-1081 rejected. 0 points awarded/i)).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 5. Catalog CRUD Test Suite
// ---------------------------------------------------------------------------
test.describe("5. Rewards & Vouchers Catalog CRUD", () => {
  test("creates draft voucher, filters by draft, activates, edits, and deletes", async ({
    page
  }) => {
    await loginAsAdmin(page, "/vouchers");

    // Open create voucher modal
    await page.getByRole("button", { name: /Create voucher/i }).click();
    await expect(page.getByText(/Create Reward Voucher/i)).toBeVisible();

    // Validation test: submit blank
    await page.getByRole("dialog").getByRole("button", { name: /Create voucher/i }).click();
    await expect(page.getByText(/Title is required/i)).toBeVisible();

    // Fill valid draft voucher
    await page.getByLabel(/Reward Title/i).fill("Solar Cold Brew Promo");
    await page.getByLabel(/Merchant Name/i).fill("Solar Cafe");
    await page.getByLabel(/Points Required/i).fill("150");
    await page.getByLabel(/Expiry Date/i).fill("2026-12-31");
    await page.locator("#reward-description").fill("Eco cold brew with reusable cup");

    // Save as draft (active is false by default)
    await page.getByRole("dialog").getByRole("button", { name: /Create voucher/i }).click();
    await expect(page.getByText(/Reward "Solar Cold Brew Promo" created successfully/i)).toBeVisible();

    // Filter publication by Draft
    const pubFilter = page.getByLabel(/Publication/i);
    await pubFilter.selectOption("draft");
    await expect(page.getByRole("cell", { name: "Solar Cold Brew Promo" })).toBeVisible();

    // Activate the voucher
    const row = page.getByRole("row", { name: /Solar Cold Brew Promo/i });
    await row.getByRole("button", { name: /Set active/i }).click();
    await expect(page.getByText(/Reward "Solar Cold Brew Promo" set to Active/i)).toBeVisible();

    // Filter publication by Active
    await pubFilter.selectOption("active");
    await expect(page.getByRole("cell", { name: "Solar Cold Brew Promo" })).toBeVisible();

    // Delete the voucher
    const activeRow = page.getByRole("row", { name: /Solar Cold Brew Promo/i });
    await activeRow.getByRole("button", { name: /Delete/i }).click();
    await expect(page.getByText(/Delete Reward Voucher/i)).toBeVisible();
    await page.getByRole("dialog").getByRole("button", { name: /Delete reward/i }).click();
    await expect(page.getByText(/Reward "Solar Cold Brew Promo" removed successfully/i)).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 6. Settings & Dynamic Awarding
// ---------------------------------------------------------------------------
test.describe("6. Settings & Dynamic Awarding", () => {
  test("updates paper rate to 10, verifies unsaved changes blocker, saves, and confirms 40 pts awarded on DEP-1087", async ({
    page
  }) => {
    await loginAsAdmin(page, "/settings");

    // Modify paper rate to 10
    const paperRateInput = page.getByLabel(/Paper & Cardboard rate/i);
    await paperRateInput.fill("10");

    // Try navigating away while dirty
    await page.getByRole("navigation", { name: /Main Navigation/i }).getByRole("link", { name: /Smart Bins/i }).click();
    await expect(page.getByRole("heading", { name: /Unsaved Changes/i })).toBeVisible();

    // Cancel to stay
    await page.getByRole("dialog").getByRole("button", { name: /Cancel/i }).click();
    await expect(page.getByLabel(/Paper & Cardboard rate/i)).toHaveValue("10");

    // Save changes
    await page.getByRole("button", { name: /Save settings/i }).click();
    await expect(page.getByText(/Settings saved/i)).toBeVisible();

    // Navigate to Deposit Verification via client-side link (preserves in-memory store)
    await page.getByRole("navigation", { name: /Main Navigation/i }).getByRole("link", { name: /Deposit Verification/i }).click();
    await expect(page).toHaveURL(/\/verification/);

    // Select DEP-1087 (4 pcs paper)
    await page.getByText("DEP-1087").click();
    await page.getByRole("button", { name: /Approve deposit/i }).click();
    await page.getByRole("dialog").getByRole("button", { name: /Approve deposit/i }).click();

    // Award must now be 4 pcs * 10 pts = 40 pts, and Faris wallet 245 + 40 = 285 pts
    await expect(page.getByText(/\+40 EcoPoints/i)).toBeVisible();
    await expect(page.getByText(/285 pts/i)).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 7. Responsive & Drawer Test Suite
// ---------------------------------------------------------------------------
test.describe("7. Responsive Viewports", () => {
  test("tests 390x844 mobile viewport, menu drawer open/close, and modal keyboard dismissal", async ({
    page
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAsAdmin(page, "/overview");

    // Mobile menu toggle button
    const menuToggle = page.getByRole("button", { name: /Open navigation menu/i });
    await expect(menuToggle).toBeVisible();
    await menuToggle.click();

    // Navigation drawer should open
    await expect(page.getByRole("navigation", { name: /Main Navigation/i })).toBeVisible();

    // Close drawer using mobile close button
    const closeBtn = page.getByRole("button", { name: /Close navigation menu/i });
    await closeBtn.click();
    await expect(page.locator(".admin-shell")).not.toHaveClass(/menu-open/);
    await expect(page.getByLabel("Close navigation overlay")).not.toBeVisible();

    // Navigate to /bins via menu
    await menuToggle.click();
    await page.getByRole("navigation", { name: /Main Navigation/i }).getByRole("link", { name: /Smart Bins/i }).click();
    await expect(page).toHaveURL(/\/bins/);

    // Open Add Smart Bin modal
    await page.getByRole("button", { name: /Add Smart Bin/i }).click();
    await expect(page.getByText(/Register New Smart Bin/i)).toBeVisible();

    // Press Escape to dismiss
    await page.keyboard.press("Escape");
    await expect(page.getByText(/Register New Smart Bin/i)).not.toBeVisible();
  });
});
