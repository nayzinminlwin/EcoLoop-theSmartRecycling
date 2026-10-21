// =============================================================================
// admin_bins.ts — Domain rules and invariants for admin bin management
// Phase AB-04 — Fleet registration, immutable capacity, and registered QR codes
// =============================================================================

export interface CreateBinInput {
  readonly binId: string;
  readonly locationName: string;
  readonly locationDetail: string;
  readonly capacitySpc: number;
}

export interface UpdateBinInput {
  readonly binId: string;
  readonly expectedVersion: number;
  readonly locationName: string;
  readonly locationDetail: string;
  readonly enabled: boolean;
}

export interface DeleteBinInput {
  readonly binId: string;
  readonly expectedVersion: number;
}

const BIN_ID_REGEX = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

export function validateBinId(binId: string): void {
  if (!binId || !BIN_ID_REGEX.test(binId)) {
    throw new Error(
      `Invalid bin ID: "${binId}". Must start with an alphanumeric character and contain only letters, numbers, dots, dashes, underscores, or colons (1-128 chars).`
    );
  }
}

export function validateCapacitySpc(capacitySpc: number): void {
  if (!Number.isSafeInteger(capacitySpc) || capacitySpc < 50 || capacitySpc > 5000) {
    throw new Error(
      `Invalid capacitySpc: ${capacitySpc}. Must be an integer between 50 and 5000 spc.`
    );
  }
}

export function validateLocationName(locationName: string): void {
  if (!locationName || locationName.trim().length < 2 || locationName.length > 100) {
    throw new Error("Location name must be between 2 and 100 characters.");
  }
}

export function validateLocationDetail(locationDetail: string): void {
  if (!locationDetail || locationDetail.trim().length < 2 || locationDetail.length > 160) {
    throw new Error("Location detail must be between 2 and 160 characters.");
  }
}

export function computeQrId(binId: string): string {
  return `qr-${binId}`;
}

export function computeQrPayload(qrId: string): string {
  return `ecoloop://bin/${qrId}`;
}

export function computeInitialCycleId(binId: string): string {
  return `${binId}-cycle-001`;
}
