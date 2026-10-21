// =============================================================================
// repositories.ts — Repository contracts and mock bundle interfaces
// Phase 3 — SDK-free; asynchronous Promise + Observable contracts
// =============================================================================

import type { AuthState, RewardCategory, Reward } from "../contracts/shared.ts";
import type {
  AdminSession, AdminIdentity, AdminLoginRequest, DashboardSummary,
  BinListQuery, Page, SmartBinRow, BinInput, AlertListQuery, AlertPage,
  CapacityAlertRow, VerificationListQuery, VerificationDetail,
  VerificationDecisionResult, RewardListQuery, RewardInput,
  AdminSettings, SettingsInput, ResidentSnapshot
} from "../contracts/admin.ts";
import type {
  AdminReviewDetailView,
  ObjectResolutionDecisionInput,
  ReviewResolutionPreview,
  ResolveReviewInput,
} from "../contracts/adminViewCodecs.ts";

export type FailureCode = "unavailable" | "invalidData" | "notFound" |
  "validation" | "conflict" | "insufficientPoints" | "invalidQr" |
  "binUnavailable" | "invalidTransition" | "unauthenticated" | "permissionDenied";

export interface RepositoryFailure {
  code: FailureCode; message: string; fieldErrors: Record<string, string>;
}

export class RepositoryError extends Error {
  readonly code: FailureCode;
  readonly fieldErrors: Record<string, string>;
  readonly failure: RepositoryFailure;

  constructor(failure: RepositoryFailure) {
    super(failure.message);
    this.name = "RepositoryError";
    this.code = failure.code;
    this.fieldErrors = failure.fieldErrors;
    this.failure = failure;
  }
}

export type Unsubscribe = () => void;

export interface Observer<T> {
  next(value: T): void;
  error(failure: RepositoryFailure): void;
}

export interface Observable<T> {
  subscribe(observer: Observer<T>): Unsubscribe;
}

export interface AuthRepository {
  getAuthState(): Promise<AuthState>;
  watchAuthState(): Observable<AuthState>;
  getSession(): Promise<AdminSession>;
  watchSession(): Observable<AdminSession>;
  getIdentity(): Promise<AdminIdentity>;
  watchIdentity(): Observable<AdminIdentity | null>;
  getDemoCredentials(): Promise<AdminLoginRequest>;
  login(input: AdminLoginRequest): Promise<AdminSession>;
  logout(): Promise<void>;
}

export interface DashboardRepository {
  getSummary(): Promise<DashboardSummary>;
  watchSummary(): Observable<DashboardSummary>;
}

export interface BinQrCode {
  binId: string;
  qrId: string;
  qrPayload: string;
  dataUrl: string;
  svg: string;
}

export interface BinsRepository {
  list(query: BinListQuery): Promise<Page<SmartBinRow>>;
  watchList(query: BinListQuery): Observable<Page<SmartBinRow>>;
  get(id: string): Promise<SmartBinRow>;
  watch(id: string): Observable<SmartBinRow | null>;
  create(id: string, input: BinInput): Promise<SmartBinRow>;
  update(id: string, input: BinInput): Promise<SmartBinRow>;
  delete(id: string): Promise<void>;
  simulateCapacity(id: string, capacityPercent: number): Promise<SmartBinRow>;
  getQrCode(id: string): Promise<BinQrCode>;
}

export interface AlertsRepository {
  list(query: AlertListQuery): Promise<AlertPage>;
  watchList(query: AlertListQuery): Observable<AlertPage>;
  get(id: string): Promise<CapacityAlertRow>;
  watch(id: string): Observable<CapacityAlertRow | null>;
  schedule(id: string): Promise<CapacityAlertRow>;
  collect(id: string): Promise<CapacityAlertRow>;
  resolve(id: string): Promise<CapacityAlertRow>;
}

export interface VerificationRepository {
  list(query: VerificationListQuery): Promise<Page<VerificationDetail>>;
  watchList(query: VerificationListQuery): Observable<Page<VerificationDetail>>;
  get(id: string): Promise<VerificationDetail>;
  watch(id: string): Observable<VerificationDetail | null>;
  getReviewDetail?(ticketId: string): Promise<AdminReviewDetailView>;
  watchReviewDetail?(ticketId: string): Observable<AdminReviewDetailView | null>;
  previewResolution?(input: {
    ticketId: string;
    inventoryState: "resolved" | "empty" | "unreadable" | "uncertain";
    objects: ObjectResolutionDecisionInput[];
  }): Promise<ReviewResolutionPreview>;
  resolveReview?(input: ResolveReviewInput): Promise<VerificationDecisionResult>;
  decide(id: string, decision: "approve" | "reject", idempotencyKey: string): Promise<VerificationDecisionResult>;
}

export interface AdminRewardsRepository {
  list(query: RewardListQuery): Promise<Page<Reward>>;
  watchList(query: RewardListQuery): Observable<Page<Reward>>;
  get(id: string): Promise<Reward>;
  watch(id: string): Observable<Reward | null>;
  getCategories(): Promise<RewardCategory[]>;
  watchCategories(): Observable<RewardCategory[]>;
  create(input: RewardInput): Promise<Reward>;
  update(id: string, input: RewardInput): Promise<Reward>;
  delete(id: string): Promise<void>;
}

export interface SettingsRepository {
  get(): Promise<AdminSettings>;
  watch(): Observable<AdminSettings>;
  update(input: SettingsInput): Promise<AdminSettings>;
}

export interface ResidentReadRepository {
  getSnapshot(residentId: string): Promise<ResidentSnapshot>;
  watchSnapshot(residentId: string): Observable<ResidentSnapshot>;
}

export interface AdminRepositories {
  auth: AuthRepository; dashboard: DashboardRepository; bins: BinsRepository;
  alerts: AlertsRepository; verification: VerificationRepository;
  rewards: AdminRewardsRepository; settings: SettingsRepository;
  residents: ResidentReadRepository;
}

export type OperationName =
  "auth.getAuthState" | "auth.getSession" | "auth.getIdentity" | "auth.getDemoCredentials" | "auth.login" | "auth.logout" |
  "dashboard.getSummary" | "bins.list" | "bins.get" | "bins.create" | "bins.update" | "bins.delete" |
  "bins.simulateCapacity" | "bins.getQrCode" | "alerts.list" | "alerts.get" | "alerts.schedule" | "alerts.collect" |
  "alerts.resolve" | "verification.list" | "verification.get" | "verification.decide" |
  "rewards.list" | "rewards.get" | "rewards.getCategories" | "rewards.create" | "rewards.update" |
  "rewards.delete" | "settings.get" | "settings.update" | "residents.getSnapshot";

export interface MockControls {
  failNext(operation: OperationName): void;
  setLatency(readMs: number, writeMs: number): void;
  setAuthState(state: AuthState): void;
  reset(): void;
}

export interface MockBundle {
  repositories: AdminRepositories; controls: MockControls;
  subscribe(listener: () => void): () => void;
  getRevision(): number;
}
