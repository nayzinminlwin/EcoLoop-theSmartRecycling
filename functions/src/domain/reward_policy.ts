export interface VoucherUseState {
  readonly demo: boolean;
  readonly status: string;
  readonly expiresAt: string;
  readonly now: string;
}

export function canUseDemoVoucher(state: VoucherUseState): boolean {
  return state.demo === true &&
    state.status === "available" &&
    Number.isFinite(Date.parse(state.expiresAt)) &&
    Date.parse(state.expiresAt) > Date.parse(state.now);
}

export function hasReachedResidentRewardLimit(
  redemptionCount: number,
  configuredLimit: number,
): boolean {
  return Number.isInteger(configuredLimit) &&
    configuredLimit >= 0 &&
    redemptionCount >= configuredLimit;
}
