import type { Instant } from "../domain/types.js";
import type {
  SessionCommandResult,
  SessionsStore,
} from "../infrastructure/firestore/sessions_store.js";

export interface ResidentSessionIdentity {
  readonly uid: string;
  readonly requestId: string;
}

export function scanBinQr(
  store: SessionsStore,
  identity: ResidentSessionIdentity,
  qrPayload: string,
  now: Instant,
): Promise<SessionCommandResult> {
  return store.scanBinQr(identity, qrPayload, now);
}

export function confirmSession(
  store: SessionsStore,
  identity: ResidentSessionIdentity,
  sessionId: string,
  expectedVersion: number,
  now: Instant,
): Promise<SessionCommandResult> {
  return store.confirmSession(identity, sessionId, expectedVersion, now);
}

export function reportFinishPressed(
  store: SessionsStore,
  identity: ResidentSessionIdentity,
  sessionId: string,
  expectedVersion: number,
  now: Instant,
): Promise<SessionCommandResult> {
  return store.reportFinishPressed(identity, sessionId, expectedVersion, now);
}

export function saveImageSelection(
  store: SessionsStore,
  identity: ResidentSessionIdentity,
  sessionId: string,
  assetId: string,
  assetVersion: string,
  expectedVersion: number,
  now: Instant,
): Promise<SessionCommandResult> {
  return store.saveImageSelection(identity, sessionId, assetId, assetVersion, expectedVersion, now);
}

export function renewSession(
  store: SessionsStore,
  identity: ResidentSessionIdentity,
  sessionId: string,
  expectedVersion: number,
  now: Instant,
): Promise<SessionCommandResult> {
  return store.renewSession(identity, sessionId, expectedVersion, now);
}

export function cancelSession(
  store: SessionsStore,
  identity: ResidentSessionIdentity,
  sessionId: string,
  expectedVersion: number,
  now: Instant,
): Promise<SessionCommandResult> {
  return store.cancelSession(identity, sessionId, expectedVersion, now);
}

export function recoverOperation(
  store: SessionsStore,
  identity: ResidentSessionIdentity,
  operationRequestId: string,
): Promise<SessionCommandResult | null> {
  return store.recoverOperation(identity, operationRequestId);
}
