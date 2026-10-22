import { describe, expect, it } from "vitest";
import type { Firestore } from "firebase-admin/firestore";
import type { Auth } from "firebase-admin/auth";
import {
  computeScopedHash,
  computePayloadFingerprint,
} from "../../src/domain/admin_crypto.js";
import { FirestoreAdminAccountsStore } from "../../src/infrastructure/firestore/admin_accounts_store.js";
import { FirestoreAdminOperationsStore } from "../../src/infrastructure/firestore/admin_operations_store.js";

describe("Phase AB-02 — Admin Crypto & Canonical Payloads", () => {
  it("computes deterministic scopedHash", () => {
    const hash1 = computeScopedHash("admin-1", "adminCreateBin", "req-100");
    const hash2 = computeScopedHash("admin-1", "adminCreateBin", "req-100");
    const hashOther = computeScopedHash("admin-2", "adminCreateBin", "req-100");

    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(hashOther);
    expect(hash1).toHaveLength(64);
  });

  it("sorts object keys recursively while preserving array order", () => {
    const fp1 = computePayloadFingerprint({
      nested: { b: 2, a: 1 },
      items: [3, 2, 1],
    });
    const fp2 = computePayloadFingerprint({
      items: [3, 2, 1],
      nested: { a: 1, b: 2 },
    });
    expect(fp1).toBe(fp2);

    const fpDifferingArray = computePayloadFingerprint({
      items: [1, 2, 3],
      nested: { a: 1, b: 2 },
    });
    expect(fp1).not.toBe(fpDifferingArray);
  });
});

describe("Phase AB-02 — FirestoreAdminAccountsStore Caller Verification", () => {
  const fakeDocs: Record<string, { uid: string; enabled: boolean; role: "admin"; email: string }> = {
    "adminAccounts/admin-valid": {
      uid: "admin-valid",
      enabled: true,
      role: "admin",
      email: "valid@ecoloop.test",
    },
    "adminAccounts/admin-disabled": {
      uid: "admin-disabled",
      enabled: false,
      role: "admin",
      email: "disabled@ecoloop.test",
    },
  };

  const mockFirestore = {
    doc: (path: string) => ({
      get: async () => ({
        exists: Boolean(fakeDocs[path]),
        data: () => fakeDocs[path],
      }),
    }),
  } as unknown as Firestore;

  const mockAuth = {} as unknown as Auth;
  const store = new FirestoreAdminAccountsStore(mockFirestore, mockAuth);

  it("accepts caller with valid role: 'admin' and enabled document", async () => {
    const res = await store.verifyCaller({
      uid: "admin-valid",
      token: { role: "admin", email: "valid@ecoloop.test" },
    });
    expect(res.uid).toBe("admin-valid");
    expect(res.role).toBe("admin");
    expect(res.enabled).toBe(true);
  });

  it("strictly rejects legacy-only { admin: true } token without role: 'admin'", async () => {
    await expect(
      store.verifyCaller({
        uid: "admin-valid",
        token: { admin: true, email: "valid@ecoloop.test" },
      })
    ).rejects.toThrow("Caller lacks required administrator role.");
  });

  it("rejects ordinary resident caller", async () => {
    await expect(
      store.verifyCaller({
        uid: "resident-123",
        token: { role: "resident", email: "resident@ecoloop.test" },
      })
    ).rejects.toThrow("Caller lacks required administrator role.");
  });

  it("rejects disabled admin account even with valid role claim", async () => {
    await expect(
      store.verifyCaller({
        uid: "admin-disabled",
        token: { role: "admin", email: "disabled@ecoloop.test" },
      })
    ).rejects.toThrow("Administrator account has been disabled.");
  });

  it("rejects unprovisioned admin account missing firestore record", async () => {
    await expect(
      store.verifyCaller({
        uid: "admin-unprovisioned",
        token: { role: "admin", email: "unprov@ecoloop.test" },
      })
    ).rejects.toThrow("Administrator account is not provisioned.");
  });
});

describe("Phase AB-02 — FirestoreAdminOperationsStore Idempotency & Conflict", () => {
  const storeMap = new Map<string, Record<string, unknown>>();

  const mockFirestore = {
    doc: (path: string) => ({
      _path: path,
      get: async () => ({
        exists: storeMap.has(path),
        data: () => storeMap.get(path),
      }),
    }),
    collection: (name: string) => ({
      where: (field1: string, op1: string, val1: string) => ({
        where: (field2: string, op2: string, val2: string) => ({
          limit: () => ({
            get: async () => {
              const matched: { data: () => Record<string, unknown> }[] = [];
              for (const [path, doc] of storeMap.entries()) {
                if (
                  path.startsWith(`${name}/`) &&
                  doc[field1] === val1 &&
                  doc[field2] === val2
                ) {
                  matched.push({ data: () => doc });
                }
              }
              return { docs: matched };
            },
          }),
        }),
      }),
    }),
    runTransaction: async (updateFunction: (t: unknown) => Promise<unknown>) => {
      const transaction = {
        get: async (docRef: { _path: string }) => ({
          exists: storeMap.has(docRef._path),
          data: () => storeMap.get(docRef._path),
        }),
        set: (docRef: { _path: string }, record: Record<string, unknown>) => {
          storeMap.set(docRef._path, record);
        },
      };
      return await updateFunction(transaction);
    },
  } as unknown as Firestore;

  const opsStore = new FirestoreAdminOperationsStore(mockFirestore);

  it("records a new receipt on first application with applied state", async () => {
    const receipt = await opsStore.recordReceipt(
      "admin-1",
      "adminCreateBin",
      "req-001",
      "fingerprint-aaa",
      "trace-001",
      { resourceId: "bin-1", version: 1 }
    );

    expect(receipt.status).toBe("committed");
    expect(receipt.data.operationState).toBe("applied");
    expect(receipt.data.resourceId).toBe("bin-1");
  });

  it("returns replayed receipt on identical retry with matching fingerprint", async () => {
    const replayed = await opsStore.recordReceipt(
      "admin-1",
      "adminCreateBin",
      "req-001",
      "fingerprint-aaa",
      "trace-002",
      { resourceId: "bin-1", version: 1 }
    );

    expect(replayed.status).toBe("committed");
    expect(replayed.data.operationState).toBe("replayed");
    expect(replayed.data.resourceId).toBe("bin-1");
  });

  it("throws already-exists conflict when the same requestId has a differing payload fingerprint", async () => {
    await expect(
      opsStore.recordReceipt(
        "admin-1",
        "adminCreateBin",
        "req-001",
        "fingerprint-DIFFERING",
        "trace-003",
        { resourceId: "bin-1", version: 2 }
      )
    ).rejects.toThrow(/Idempotency payload conflict/);
  });

  it("recovers original receipt by targetRequestId", async () => {
    const recovered = await opsStore.getReceiptByRequestId("admin-1", "req-001");
    expect(recovered).not.toBeNull();
    expect(recovered?.requestId).toBe("req-001");
    expect(recovered?.data.resourceId).toBe("bin-1");
  });
});
