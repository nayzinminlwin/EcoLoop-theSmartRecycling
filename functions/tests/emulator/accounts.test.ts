import { initializeApp, deleteApp } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { bootstrapAccount, type AuthenticatedAccount } from "../../src/application/accounts.js";
import { FirestoreAccountsStore } from "../../src/infrastructure/firestore/accounts_store.js";

const uid = "resident-bootstrap";
const now = "2026-10-18T12:00:00.000Z";

let firestore: Firestore;
let auth: Auth;
let store: FirestoreAccountsStore;
let app: ReturnType<typeof initializeApp>;

beforeAll(async () => {
  app = initializeApp({ projectId: "demo-ecoloop" }, `accounts-${Date.now()}`);
  firestore = getFirestore(app);
  auth = getAuth(app);
  store = new FirestoreAccountsStore(firestore, auth);
  await auth.createUser({ uid, displayName: "Google Resident", email: "resident@example.test" });
});

beforeEach(async () => {
  await firestore.recursiveDelete(firestore.doc(`residents/${uid}`));
  const user = await auth.getUser(uid);
  await auth.updateUser(uid, { customClaims: { role: "user" } });
  expect(user.uid).toBe(uid);
});

afterAll(async () => {
  await auth.deleteUser(uid).catch(() => undefined);
  await deleteApp(app);
});

describe("account bootstrap", () => {
  it("creates zeroed owner records and is idempotent", async () => {
    const identity = authenticatedAccount();
    const first = await bootstrapAccount(store, identity, "bootstrap-0001", {}, now);
    expect(first.created).toBe(true);
    expect(first.wallet.balance).toBe(0);
    expect(first.profile.residentId).toBe(uid);

    await firestore.doc(`residents/${uid}/wallet/current`).set({ balance: 75, version: 4 }, { merge: true });
    await firestore.doc(`residents/${uid}`).set({ displayName: "Edited Resident" }, { merge: true });
    const second = await bootstrapAccount(store, identity, "bootstrap-0002", { displayName: "Google Changed" }, now);
    expect(second.created).toBe(false);
    expect(second.wallet.balance).toBe(75);
    expect((await firestore.doc(`residents/${uid}`).get()).data()?.displayName).toBe("Edited Resident");
  });

  it("repairs partial provisioning without resetting existing wallet data", async () => {
    await firestore.doc(`residents/${uid}`).set({
      residentId: uid,
      displayName: "Existing",
      email: "old@example.test",
      role: "user",
      createdAt: now,
      updatedAt: now,
    });
    await firestore.doc(`residents/${uid}/wallet/current`).set({ residentId: uid, balance: 40, version: 2 });
    const result = await bootstrapAccount(store, authenticatedAccount(), "bootstrap-0003", {}, now);
    expect(result.created).toBe(false);
    expect(result.wallet.balance).toBe(40);
    expect((await firestore.doc(`residents/${uid}/preferences/current`).get()).exists).toBe(true);
    expect((await firestore.doc(`residents/${uid}/stats/current`).get()).exists).toBe(true);
  });

  it("preserves trusted admin claims while resolving the resident role", async () => {
    await auth.setCustomUserClaims(uid, { admin: true, role: "admin", tenant: "trusted" });
    const result = await bootstrapAccount(
      store,
      authenticatedAccount({ admin: true, role: "admin", tenant: "trusted" }),
      "bootstrap-0004",
      {},
      now,
    );
    expect(result.role).toBe("admin");
    expect((await auth.getUser(uid)).customClaims).toMatchObject({ admin: true, role: "admin", tenant: "trusted" });
  });

  it("rejects client identity and role injection", async () => {
    await expect(
      bootstrapAccount(store, authenticatedAccount(), "bootstrap-0005", { uid: "other", role: "admin" }, now),
    ).rejects.toMatchObject({ code: "permission_denied" });
    expect((await firestore.doc(`residents/${uid}`).get()).exists).toBe(false);
  });

  it("keeps a second resident isolated", async () => {
    const otherUid = "resident-other-bootstrap";
    await auth.createUser({ uid: otherUid, displayName: "Other", email: "other@example.test" });
    try {
      await bootstrapAccount(store, authenticatedAccount(), "bootstrap-0006", {}, now);
      const other = new FirestoreAccountsStore(firestore, auth);
      await bootstrapAccount(other, { ...authenticatedAccount(), uid: otherUid }, "bootstrap-0007", {}, now);
      expect((await firestore.doc(`residents/${otherUid}/wallet/current`).get()).data()?.balance).toBe(0);
      expect((await firestore.doc(`residents/${uid}/wallet/current`).get()).data()?.residentId).toBe(uid);
    } finally {
      await firestore.recursiveDelete(firestore.doc(`residents/${otherUid}`));
      await auth.deleteUser(otherUid);
    }
  });
});

function authenticatedAccount(overrides: Partial<AuthenticatedAccount> = {}): AuthenticatedAccount {
  return {
    uid,
    claims: { role: "user" },
    displayName: "Google Resident",
    email: "resident@example.test",
    avatarUrl: null,
    ...overrides,
  };
}
