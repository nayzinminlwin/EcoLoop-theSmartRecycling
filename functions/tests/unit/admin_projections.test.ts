import { describe, expect, it } from "vitest";
import type { Firestore } from "firebase-admin/firestore";
import { generatePrefixTokens, normalizeSearchString } from "../../src/domain/admin_search.js";
import { FirestoreAdminProjectionsStore } from "../../src/infrastructure/firestore/admin_projections_store.js";
import {
  FirestoreAdminQueriesStore,
  encodeCursor,
  decodeCursor,
} from "../../src/infrastructure/firestore/admin_queries_store.js";
import { FirestoreAdminReadVersionsStore } from "../../src/infrastructure/firestore/admin_read_versions_store.js";

describe("Phase AB-03 — Token Prefix Generation for Native Search", () => {
  it("normalizes search string and removes diacritics", () => {
    expect(normalizeSearchString("Café Cyberjaya")).toBe("cafe cyberjaya");
  });

  it("generates bounded prefix tokens from minLen 2 to maxLen 20", () => {
    const tokens = generatePrefixTokens(["BIN-001", "Cyberjaya"]);
    expect(tokens).toContain("bi");
    expect(tokens).toContain("bin");
    expect(tokens).toContain("cy");
    expect(tokens).toContain("cyb");
    expect(tokens).toContain("cyberjaya");
  });

  it("deduplicates tokens across multiple input fields", () => {
    const tokens = generatePrefixTokens(["Cyberjaya Hub", "Cyberjaya Central"]);
    const cyberTokens = tokens.filter((t) => t === "cy");
    expect(cyberTokens.length).toBe(1);
  });

  it("caps total tokens per document to prevent excessive index size", () => {
    const longTerms = Array.from({ length: 50 }, (_, i) => `verylonguniquewordnumber${i}`);
    const tokens = generatePrefixTokens(longTerms, { maxTokensPerDoc: 30 });
    expect(tokens.length).toBeLessThanOrEqual(30);
  });
});

describe("Phase AB-03 — Materialized Projection Builders", () => {
  const mockFirestore = {} as unknown as Firestore;
  const projectionsStore = new FirestoreAdminProjectionsStore(mockFirestore);

  it("projects bin with derived fill percentage and normal collectionState", () => {
    const bin = projectionsStore.projectBin({
      id: "bin-001",
      locationName: "Town Hall",
      locationAddress: "Main Street",
      capacitySpc: 1000,
      occupiedSpc: 400,
    });

    expect(bin.binId).toBe("bin-001");
    expect(bin.capacitySpc).toBe(1000);
    expect(bin.occupiedSpc).toBe(400);
    expect(bin.fillPercent).toBe(40);
    expect(bin.collectionState).toBe("normal");
    expect(bin.searchTokens).toBeDefined();
    expect(bin.searchTokens).toContain("to");
  });

  it("assigns warning state at 75% fill and critical state at 85% fill", () => {
    const warningBin = projectionsStore.projectBin({
      id: "bin-warn",
      capacitySpc: 1000,
      occupiedSpc: 750,
    });
    expect(warningBin.fillPercent).toBe(75);
    expect(warningBin.collectionState).toBe("warning");

    const criticalBin = projectionsStore.projectBin({
      id: "bin-crit",
      capacitySpc: 1000,
      occupiedSpc: 900,
    });
    expect(criticalBin.fillPercent).toBe(90);
    expect(criticalBin.collectionState).toBe("critical");
  });

  it("assigns collection_pending if operations document indicates scheduled collection", () => {
    const pendingBin = projectionsStore.projectBin(
      { id: "bin-pending", capacitySpc: 1000, occupiedSpc: 900 },
      { collectionStatus: "scheduled" }
    );
    expect(pendingBin.collectionState).toBe("collection_pending");
  });

  it("projects reward with clamped values and category joins", () => {
    const reward = projectionsStore.projectReward(
      {
        id: "rew-coffee",
        title: "Cold Brew",
        merchant: "Bean Co",
        cost: 150,
        artKey: "art2",
      },
      "Beverages"
    );

    expect(reward.rewardId).toBe("rew-coffee");
    expect(reward.title).toBe("Cold Brew");
    expect(reward.merchantName).toBe("Bean Co");
    expect(reward.categoryName).toBe("Beverages");
    expect(reward.pointsCost).toBe(150);
    expect(reward.artKey).toBe("art2");
    expect(reward.searchTokens).toContain("co");
  });
});

describe("Phase AB-03 — Query Matrix Validation & Cursor Serialization", () => {
  it("encodes and decodes cursor values symmetrically", () => {
    const values = ["Town Hall", "bin-100"];
    const encoded = encodeCursor(values);
    expect(decodeCursor(encoded)).toEqual(values);
  });

  it("throws invalid-argument on malformed cursor string", () => {
    expect(() => decodeCursor("not-base64-json-%%%")).toThrow(/Malformed pagination cursor/);
  });

  it("rejects unsupported bin sort key", async () => {
    const store = new FirestoreAdminQueriesStore({} as unknown as Firestore);
    await expect(
      store.listBins({ sortKey: "invalidNonIndexedField" })
    ).rejects.toThrow(/Unsupported bin sort key: invalidNonIndexedField/);
  });

  it("rejects unsupported bin filter", async () => {
    const store = new FirestoreAdminQueriesStore({} as unknown as Firestore);
    await expect(
      store.listBins({ filters: { unknownFilter: "hack" } })
    ).rejects.toThrow(/Unsupported bin filter: unknownFilter/);
  });

  it("rejects unsupported reward sort key", async () => {
    const store = new FirestoreAdminQueriesStore({} as unknown as Firestore);
    await expect(
      store.listRewards({ sortKey: "unsupportedKey" })
    ).rejects.toThrow(/Unsupported reward sort key: unsupportedKey/);
  });

  it("rejects unsupported reward filter", async () => {
    const store = new FirestoreAdminQueriesStore({} as unknown as Firestore);
    await expect(
      store.listRewards({ filters: { unindexedProp: true } })
    ).rejects.toThrow(/Unsupported reward filter: unindexedProp/);
  });
});

describe("Phase AB-03 — Read Versions Store", () => {
  const storeMap = new Map<string, Record<string, unknown>>();

  const mockFirestore = {
    doc: (path: string) => ({
      _path: path,
      get: async () => ({
        exists: storeMap.has(path),
        data: () => storeMap.get(path),
      }),
    }),
    runTransaction: async (fn: (t: unknown) => Promise<unknown>) => {
      const transaction = {
        get: async (docRef: { _path: string }) => ({
          exists: storeMap.has(docRef._path),
          data: () => storeMap.get(docRef._path),
        }),
        set: (docRef: { _path: string }, record: Record<string, unknown>) => {
          storeMap.set(docRef._path, record);
        },
      };
      return await fn(transaction);
    },
  } as unknown as Firestore;

  const versionsStore = new FirestoreAdminReadVersionsStore(mockFirestore);

  it("returns version 1 if topic document does not exist yet", async () => {
    const v = await versionsStore.getVersion("bins");
    expect(v.topic).toBe("bins");
    expect(v.version).toBe(1);
  });

  it("increments topic revision on bumpVersion", async () => {
    const bumped = await versionsStore.bumpVersion("bins", "admin-1");
    expect(bumped.version).toBe(1);

    const bumpedAgain = await versionsStore.bumpVersion("bins", "admin-1");
    expect(bumpedAgain.version).toBe(2);

    const current = await versionsStore.getVersion("bins");
    expect(current.version).toBe(2);
  });
});
