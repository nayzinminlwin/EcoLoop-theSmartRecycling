import { describe, expect, it } from "vitest";
import { HttpsError } from "firebase-functions/v2/https";
import { unpackResidentRequest } from "../../src/transport/request.js";

describe("resident callable request envelope", () => {
  it("unwraps the Flutter backend.v1 envelope", () => {
    expect(unpackResidentRequest({
      schemaVersion: "backend.v1",
      operation: "getResidentProfile",
      requestId: "req-12345678",
      payload: {},
    }, "getResidentProfile")).toEqual({
      requestId: "req-12345678",
      payload: {},
    });
  });

  it("rejects an operation or payload that does not match the contract", () => {
    expect(() => unpackResidentRequest({
      schemaVersion: "backend.v1",
      operation: "getResidentProfile",
      requestId: "req-12345678",
      payload: [],
    }, "getResidentProfile")).toThrow(HttpsError);
    expect(() => unpackResidentRequest({
      schemaVersion: "backend.v1",
      operation: "saveResidentPreferences",
      requestId: "req-12345678",
      payload: {},
    }, "getResidentProfile")).toThrow(HttpsError);
  });
});
