// =============================================================================
// admin_auth_ab02.test.ts — Unit tests for Phase AB-02 Authentication and Command Client
// =============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { loadFirebaseConfig } from "../src/core/firebase/config.ts";
import { FirebaseCommandClient } from "../src/core/firebase/commandClient.ts";
import { RepositoryError } from "../src/data/repositories.ts";
import {
  computeScopedHash,
  computePayloadFingerprint,
} from "../../../functions/src/domain/admin_crypto.ts";

describe("Phase AB-02 — Config & Runtime Mode Resolution", () => {
  it("loads default configuration with named database ecoloop-db", () => {
    const config = loadFirebaseConfig();
    assert.equal(config.database, "ecoloop-db");
    assert.equal(config.projectId, "ecoloop-thesmartrecycling");
    assert.equal(config.region, "us-central1");
    assert.ok(["mock", "emulator", "firebase"].includes(config.mode));
  });
});

describe("Phase AB-02 — Firebase Command Client", () => {
  const mockFunctions = {} as unknown as import("firebase/functions").Functions;
  const client = new FirebaseCommandClient(mockFunctions);

  it("generates request IDs matching schema regex", () => {
    const reqId = client.generateRequestId();
    assert.ok(reqId.startsWith("req-"));
    assert.match(reqId, /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/);
  });

  it("maps Firebase unauthenticated error to RepositoryError", () => {
    const err = client.mapFirebaseError({ code: "functions/unauthenticated", message: "Auth required" }, "testOp");
    assert.ok(err instanceof RepositoryError);
    assert.equal(err.code, "unauthenticated");
  });

  it("maps Firebase permission-denied error to RepositoryError", () => {
    const err = client.mapFirebaseError({ code: "functions/permission-denied", message: "Admin claim required" }, "testOp");
    assert.ok(err instanceof RepositoryError);
    assert.equal(err.code, "permissionDenied");
  });

  it("maps Firebase not-found error to RepositoryError", () => {
    const err = client.mapFirebaseError({ code: "functions/not-found", message: "Receipt missing" }, "testOp");
    assert.ok(err instanceof RepositoryError);
    assert.equal(err.code, "notFound");
  });

  it("maps Firebase failed-precondition error to conflict", () => {
    const err = client.mapFirebaseError({ code: "functions/failed-precondition", message: "State stale" }, "testOp");
    assert.ok(err instanceof RepositoryError);
    assert.equal(err.code, "conflict");
  });

  it("maps Firebase invalid-argument error to validation", () => {
    const err = client.mapFirebaseError({ code: "functions/invalid-argument", message: "Missing field" }, "testOp");
    assert.ok(err instanceof RepositoryError);
    assert.equal(err.code, "validation");
  });
});

describe("Phase AB-02 — Scoped Hashing & Payload Fingerprinting", () => {
  it("computes deterministic scopedHash", () => {
    const hash1 = computeScopedHash("admin-1", "adminCreateBin", "req-001");
    const hash2 = computeScopedHash("admin-1", "adminCreateBin", "req-001");
    const hashOther = computeScopedHash("admin-2", "adminCreateBin", "req-001");

    assert.equal(hash1, hash2);
    assert.notEqual(hash1, hashOther);
    assert.equal(hash1.length, 64); // SHA-256 hex
  });

  it("computes deterministic payload fingerprint independent of key order", () => {
    const fp1 = computePayloadFingerprint({ b: 2, a: 1 });
    const fp2 = computePayloadFingerprint({ a: 1, b: 2 });
    assert.equal(fp1, fp2);
  });
});
