// =============================================================================
// mockRepositories.ts — Stateful in-memory mock repositories
// Phase 3 — SDK-free; asynchronous Promise + Observable implementation
// =============================================================================

import QRCode from "qrcode";
import type {
  AuthState, RewardCategory, Reward, RewardDocument, MaterialType,
  DepositTransaction, SmartBin
} from "../contracts/shared.ts";
import type {
  AdminSession, AdminIdentity, AdminLoginRequest, DashboardSummary,
  BinListQuery, Page, SmartBinRow, BinInput, AlertListQuery, AlertPage,
  CapacityAlertRow, VerificationListQuery, VerificationDetail,
  VerificationDecisionResult, RewardListQuery, RewardInput,
  AdminSettings, SettingsInput, ResidentSnapshot, DailyActivity,
  MaterialMixEntry, PageSize, CapacityBand, BinOperations
} from "../contracts/admin.ts";
import {
  RepositoryError,
  type AdminRepositories,
  type MockControls,
  type MockBundle,
  type Observable,
  type Observer,
  type Unsubscribe,
  type OperationName,
  type BinQrCode
} from "./repositories.ts";
import { createSeedState, MOCK_NOW, MOCK_LOGIN, type MockSeedState } from "./mockSeeds.ts";

const KG_PER_PIECE: Record<MaterialType, number> = {
  plastic: 0.025,
  aluminium: 0.015,
  paper: 0.050,
  glass: 0.200,
  unknown: 0.0
};

function clone<T>(val: T): T {
  return JSON.parse(JSON.stringify(val)) as T;
}

function computeDerivedWeight(deposits: readonly DepositTransaction[]): number {
  let total = 0;
  for (const d of deposits) {
    if (d.status === "verified") {
      const perItem = KG_PER_PIECE[d.materialType] ?? 0;
      total += d.itemCount * perItem;
    }
  }
  return Math.round(total * 1000) / 1000;
}

function computeNextRewardCost(balance: number, rewards: readonly RewardDocument[]): number | null {
  const matching = rewards.filter((r) => r.isActive && r.expiresAt > MOCK_NOW && r.pointsCost > balance);
  if (matching.length === 0) return null;
  return Math.min(...matching.map((r) => r.pointsCost));
}

function getKualaLumpurCalendarDate(isoStr: string): string {
  const d = new Date(isoStr);
  const utc = d.getTime() + d.getTimezoneOffset() * 60000;
  const klTime = new Date(utc + 8 * 3600000);
  const year = klTime.getFullYear();
  const month = String(klTime.getMonth() + 1).padStart(2, "0");
  const day = String(klTime.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function createMockRepositories(options?: {
  readDelayMs?: number;
  writeDelayMs?: number;
  idFactory?: (collection: "capacityAlerts" | "rewards") => string;
}): MockBundle {
  let readDelay = options?.readDelayMs ?? 350;
  let writeDelay = options?.writeDelayMs ?? 650;
  let idCounter = 1;

  const defaultIdFactory = (collection: "capacityAlerts" | "rewards"): string => {
    if (options?.idFactory) {
      const customId = options.idFactory(collection);
      if (!customId || customId.includes("/") || customId.trim() === "") {
        throw new Error(`Invalid custom ID: ${customId}`);
      }
      return customId;
    }
    if (collection === "capacityAlerts") {
      return `ALT-${String(idCounter++).padStart(4, "0")}`;
    }
    return `RWD-${String(idCounter++).padStart(4, "0")}`;
  };

  let state: MockSeedState = createSeedState();
  const failedOps = new Set<OperationName>();
  let revision = 0;
  const listeners = new Set<() => void>();
  const activeObservers = new Set<() => void>();

  function notifyCommit(): void {
    revision++;
    for (const listener of Array.from(listeners)) {
      try {
        listener();
      } catch (err) {
        console.error("Mock bundle listener error:", err);
      }
    }
    for (const obs of Array.from(activeObservers)) {
      try {
        obs();
      } catch (err) {
        console.error("Mock bundle observer notify error:", err);
      }
    }
  }

  function wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function checkFailure(op: OperationName): void {
    if (failedOps.has(op)) {
      failedOps.delete(op);
      throw new RepositoryError({
        code: "unavailable",
        message: `Injected failure for ${op}`,
        fieldErrors: {}
      });
    }
  }

  function requireAdmin(): void {
    if (
      !state.authState.isSignedIn ||
      state.authState.role !== "admin"
    ) {
      throw new RepositoryError({
        code: "unauthenticated",
        message: "Admin authentication required",
        fieldErrors: {}
      });
    }
  }

  function createObservable<T>(
    opName: OperationName,
    project: () => T,
    requiresAuth = true
  ): Observable<T> {
    return {
      subscribe(observer: Observer<T>): Unsubscribe {
        let isUnsubscribed = false;
        let lastEmittedJson: string | null = null;

        const checkAndEmit = () => {
          if (isUnsubscribed) return;
          try {
            if (requiresAuth) requireAdmin();
            const data = project();
            const json = JSON.stringify(data);
            if (json !== lastEmittedJson) {
              lastEmittedJson = json;
              observer.next(clone(data));
            }
          } catch (err) {
            if (err instanceof RepositoryError) {
              observer.error(err.failure);
            } else {
              observer.error({
                code: "unavailable",
                message: err instanceof Error ? err.message : String(err),
                fieldErrors: {}
              });
            }
          }
        };

        const initialTimer = setTimeout(async () => {
          if (isUnsubscribed) return;
          try {
            checkFailure(opName);
            if (requiresAuth) requireAdmin();
            const data = project();
            lastEmittedJson = JSON.stringify(data);
            observer.next(clone(data));
          } catch (err) {
            if (err instanceof RepositoryError) {
              observer.error(err.failure);
            } else {
              observer.error({
                code: "unavailable",
                message: err instanceof Error ? err.message : String(err),
                fieldErrors: {}
              });
            }
          }
        }, readDelay);

        activeObservers.add(checkAndEmit);

        return () => {
          isUnsubscribed = true;
          clearTimeout(initialTimer);
          activeObservers.delete(checkAndEmit);
        };
      }
    };
  }

  // ---------------------------------------------------------------------------
  // Auth Repository
  // ---------------------------------------------------------------------------
  const auth: AdminRepositories["auth"] = {
    async getAuthState(): Promise<AuthState> {
      await wait(readDelay);
      checkFailure("auth.getAuthState");
      return clone(state.authState);
    },
    watchAuthState(): Observable<AuthState> {
      return createObservable("auth.getAuthState", () => state.authState, false);
    },
    async getSession(): Promise<AdminSession> {
      await wait(readDelay);
      checkFailure("auth.getSession");
      return clone(state.adminSession);
    },
    watchSession(): Observable<AdminSession> {
      return createObservable("auth.getSession", () => state.adminSession, false);
    },
    async getIdentity(): Promise<AdminIdentity> {
      await wait(readDelay);
      checkFailure("auth.getIdentity");
      return clone(state.admin);
    },
    watchIdentity(): Observable<AdminIdentity | null> {
      return createObservable(
        "auth.getIdentity",
        () => (state.authState.isSignedIn ? state.admin : null),
        false
      );
    },
    async getDemoCredentials(): Promise<AdminLoginRequest> {
      await wait(readDelay);
      checkFailure("auth.getDemoCredentials");
      return clone(MOCK_LOGIN);
    },
    async login(input: AdminLoginRequest): Promise<AdminSession> {
      await wait(writeDelay);
      checkFailure("auth.login");
      if (input.email !== MOCK_LOGIN.email || input.password !== MOCK_LOGIN.password) {
        throw new RepositoryError({
          code: "unauthenticated",
          message: "Invalid email or password",
          fieldErrors: {
            email: input.email !== MOCK_LOGIN.email ? "Email does not match demo admin" : "",
            password: input.password !== MOCK_LOGIN.password ? "Password does not match demo admin" : ""
          }
        });
      }
      state.authState = { uid: "ADM-001", role: "admin", isSignedIn: true };
      state.adminSession = {
        id: "ADMIN-DEMO-001",
        adminId: "ADM-001",
        isSignedIn: true,
        startedAt: MOCK_NOW
      };
      notifyCommit();
      return clone(state.adminSession);
    },
    async logout(): Promise<void> {
      await wait(writeDelay);
      checkFailure("auth.logout");
      state.authState = { uid: null, role: null, isSignedIn: false };
      state.adminSession.isSignedIn = false;
      notifyCommit();
    }
  };

  // ---------------------------------------------------------------------------
  // Dashboard Repository
  // ---------------------------------------------------------------------------
  function buildDashboardSummary(): DashboardSummary {
    const verifiedDeposits = state.deposits.filter((d) => d.status === "verified");
    const activeAlerts = state.alerts.filter((a) => a.status === "active").length;
    const ecoPointsIssued = verifiedDeposits.reduce((acc, d) => acc + (d.pointsAwarded ?? 0), 0);
    const totalWeightKg = computeDerivedWeight(state.deposits);

    const sevenDays: string[] = [
      "2024-05-13", // Monday
      "2024-05-14", // Tuesday
      "2024-05-15", // Wednesday
      "2024-05-16", // Thursday
      "2024-05-17", // Friday
      "2024-05-18", // Saturday
      "2024-05-19"  // Sunday
    ];

    // Baseline daily activity creating a typical realistic up-and-down analytics trend
    const baseDailyTrend: Record<string, number> = {
      "2024-05-13": 8,  // Mon (baseline)
      "2024-05-14": 15, // Tue (rise up)
      "2024-05-15": 11, // Wed (dip down)
      "2024-05-16": 19, // Thu (climb up)
      "2024-05-17": 25, // Fri (weekday peak up)
      "2024-05-18": 18, // Sat (weekend dip down)
      "2024-05-19": 10  // Sun (evening low down)
    };

    const activity: DailyActivity[] = sevenDays.map((date) => {
      const sessionCount = verifiedDeposits.filter((d) => {
        if (!d.verifiedAt) return false;
        return getKualaLumpurCalendarDate(d.verifiedAt) === date;
      }).length;
      return { date, verifiedDepositCount: (baseDailyTrend[date] ?? 0) + sessionCount };
    });

    const matKeys: MaterialType[] = ["plastic", "aluminium", "paper", "glass"];
    const materialMix: MaterialMixEntry[] = matKeys.map((type) => {
      const depositsOfType = verifiedDeposits.filter((d) => d.materialType === type);
      const weightKg = computeDerivedWeight(depositsOfType);
      const rateDoc = state.materialRates.find((r) => r.materialType === type);
      return {
        materialType: type,
        displayName: rateDoc?.displayName ?? type,
        weightKg
      };
    });

    const attentionBins: SmartBinRow[] = state.bins
      .filter((b) => b.capacityPercent >= 60)
      .map((b) => {
        const ops = state.binOperations.find((o) => o.binId === b.id) ?? {
          binId: b.id,
          collectionStatus: "notScheduled"
        };
        return { bin: clone(b), operations: clone(ops) };
      });

    return {
      registeredBins: state.bins.length,
      activeAlerts,
      verifiedDeposits: verifiedDeposits.length,
      ecoPointsIssued,
      totalWeightKg,
      activity,
      materialMix,
      attentionBins,
      updatedAt: MOCK_NOW
    };
  }

  const dashboard: AdminRepositories["dashboard"] = {
    async getSummary(): Promise<DashboardSummary> {
      await wait(readDelay);
      checkFailure("dashboard.getSummary");
      requireAdmin();
      return clone(buildDashboardSummary());
    },
    watchSummary(): Observable<DashboardSummary> {
      return createObservable("dashboard.getSummary", () => buildDashboardSummary());
    }
  };

  // ---------------------------------------------------------------------------
  // Bins Repository
  // ---------------------------------------------------------------------------
  function paginateBins(query: BinListQuery): Page<SmartBinRow> {
    let rows: SmartBinRow[] = state.bins.map((b) => {
      const ops = state.binOperations.find((o) => o.binId === b.id) ?? {
        binId: b.id,
        collectionStatus: "notScheduled"
      };
      return { bin: clone(b), operations: clone(ops) };
    });

    if (query.search && query.search.trim()) {
      const q = query.search.trim().toLowerCase();
      rows = rows.filter(
        (r) =>
          r.bin.id.toLowerCase().includes(q) ||
          r.bin.locationName.toLowerCase().includes(q) ||
          r.bin.locationDetail.toLowerCase().includes(q)
      );
    }

    if (query.capacityBand && query.capacityBand !== "all") {
      rows = rows.filter((r) => {
        const cap = r.bin.capacityPercent;
        const band: CapacityBand = cap < 60 ? "normal" : cap < 80 ? "warning" : "critical";
        return band === query.capacityBand;
      });
    }

    if (query.collectionStatus && query.collectionStatus !== "all") {
      rows = rows.filter((r) => r.operations.collectionStatus === query.collectionStatus);
    }

    if (query.online && query.online !== "all") {
      const isOnline = query.online === "online";
      rows = rows.filter((r) => r.bin.isOnline === isOnline);
    }

    if (query.sort) {
      const dir = query.sort.direction === "desc" ? -1 : 1;
      rows.sort((a, b) => {
        let diff = 0;
        if (query.sort.key === "capacityPercent") {
          diff = a.bin.capacityPercent - b.bin.capacityPercent;
        } else if (query.sort.key === "locationName") {
          diff = a.bin.locationName.localeCompare(b.bin.locationName);
        } else if (query.sort.key === "lastUpdatedAt") {
          diff = a.bin.lastUpdatedAt.localeCompare(b.bin.lastUpdatedAt);
        } else {
          diff = a.bin.id.localeCompare(b.bin.id);
        }
        if (diff !== 0) return diff * dir;
        return a.bin.id.localeCompare(b.bin.id);
      });
    }

    const total = rows.length;
    const pageSize: PageSize = query.pageSize;
    const maxPage = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(Math.max(1, query.page), maxPage);
    const start = (page - 1) * pageSize;
    const items = rows.slice(start, start + pageSize);

    return { items, total, page, pageSize };
  }

  function getBinRow(id: string): SmartBinRow {
    const bin = state.bins.find((b) => b.id === id);
    if (!bin) {
      throw new RepositoryError({ code: "notFound", message: `Bin not found: ${id}`, fieldErrors: {} });
    }
    const operations = state.binOperations.find((o) => o.binId === id) ?? {
      binId: id,
      collectionStatus: "notScheduled"
    };
    return { bin: clone(bin), operations: clone(operations) };
  }

  function checkAndTriggerAlert(bin: SmartBin): void {
    if (bin.capacityPercent >= state.programSettings.capacityAlertThreshold) {
      const hasActive = state.alerts.some((a) => a.binId === bin.id && a.status === "active");
      if (!hasActive) {
        const alertId = defaultIdFactory("capacityAlerts");
        state.alerts.push({
          id: alertId,
          binId: bin.id,
          status: "active",
          thresholdPercent: state.programSettings.capacityAlertThreshold,
          triggeredAt: MOCK_NOW,
          resolvedAt: null
        });
        const ops = state.binOperations.find((o) => o.binId === bin.id);
        if (ops) {
          ops.collectionStatus = "pending";
        } else {
          state.binOperations.push({ binId: bin.id, collectionStatus: "pending" });
        }
      }
    }
  }

  const bins: AdminRepositories["bins"] = {
    async list(query: BinListQuery): Promise<Page<SmartBinRow>> {
      await wait(readDelay);
      checkFailure("bins.list");
      requireAdmin();
      return clone(paginateBins(query));
    },
    watchList(query: BinListQuery): Observable<Page<SmartBinRow>> {
      return createObservable("bins.list", () => paginateBins(query));
    },
    async get(id: string): Promise<SmartBinRow> {
      await wait(readDelay);
      checkFailure("bins.get");
      requireAdmin();
      return clone(getBinRow(id));
    },
    watch(id: string): Observable<SmartBinRow | null> {
      return createObservable("bins.get", () => {
        try {
          return getBinRow(id);
        } catch {
          return null;
        }
      });
    },
    async create(id: string, input: BinInput): Promise<SmartBinRow> {
      await wait(writeDelay);
      checkFailure("bins.create");
      requireAdmin();

      if (!id || id.trim() === "" || id.includes("/")) {
        throw new RepositoryError({
          code: "validation",
          message: "ID must be a nonblank string with no slashes",
          fieldErrors: { id: "Invalid bin ID" }
        });
      }
      if (state.bins.some((b) => b.id === id)) {
        throw new RepositoryError({
          code: "conflict",
          message: `Bin already exists: ${id}`,
          fieldErrors: { id: "Bin ID already exists" }
        });
      }
      if (!input.locationName || input.locationName.trim() === "") {
        throw new RepositoryError({
          code: "validation",
          message: "Location name is required",
          fieldErrors: { locationName: "Location name is required" }
        });
      }
      if (!input.locationDetail || input.locationDetail.trim() === "") {
        throw new RepositoryError({
          code: "validation",
          message: "Location detail is required",
          fieldErrors: { locationDetail: "Location detail is required" }
        });
      }
      if (
        typeof input.capacityPercent !== "number" ||
        !Number.isInteger(input.capacityPercent) ||
        input.capacityPercent < 0 ||
        input.capacityPercent > 100
      ) {
        throw new RepositoryError({
          code: "validation",
          message: "Capacity must be an integer between 0 and 100",
          fieldErrors: { capacityPercent: "Invalid capacity" }
        });
      }
      if (!Array.isArray(input.acceptedMaterials) || input.acceptedMaterials.length === 0) {
        throw new RepositoryError({
          code: "validation",
          message: "At least one accepted material is required",
          fieldErrors: { acceptedMaterials: "Select at least one material" }
        });
      }

      const newBin: SmartBin = {
        id,
        locationName: input.locationName,
        locationDetail: input.locationDetail,
        capacityPercent: input.capacityPercent,
        acceptedMaterials: [...input.acceptedMaterials],
        isOnline: Boolean(input.isOnline),
        lastUpdatedAt: MOCK_NOW
      };

      state.bins.push(newBin);
      const newOps: BinOperations = { binId: id, collectionStatus: "notScheduled" };
      state.binOperations.push(newOps);

      checkAndTriggerAlert(newBin);
      notifyCommit();
      return clone(getBinRow(id));
    },
    async update(id: string, input: BinInput): Promise<SmartBinRow> {
      await wait(writeDelay);
      checkFailure("bins.update");
      requireAdmin();

      const existingIndex = state.bins.findIndex((b) => b.id === id);
      if (existingIndex === -1) {
        throw new RepositoryError({ code: "notFound", message: `Bin not found: ${id}`, fieldErrors: {} });
      }

      const updated: SmartBin = {
        id,
        locationName: input.locationName,
        locationDetail: input.locationDetail,
        capacityPercent: input.capacityPercent,
        acceptedMaterials: [...input.acceptedMaterials],
        isOnline: Boolean(input.isOnline),
        lastUpdatedAt: MOCK_NOW
      };

      state.bins[existingIndex] = updated;
      checkAndTriggerAlert(updated);
      notifyCommit();
      return clone(getBinRow(id));
    },
    async delete(id: string): Promise<void> {
      await wait(writeDelay);
      checkFailure("bins.delete");
      requireAdmin();

      const hasDeposit = state.deposits.some((d) => d.binId === id);
      const hasAlert = state.alerts.some((a) => a.binId === id);
      if (hasDeposit || hasAlert) {
        throw new RepositoryError({
          code: "conflict",
          message: "Cannot delete bin with active references",
          fieldErrors: { id: "Referenced by deposits or alerts" }
        });
      }

      const binIndex = state.bins.findIndex((b) => b.id === id);
      if (binIndex === -1) {
        throw new RepositoryError({ code: "notFound", message: `Bin not found: ${id}`, fieldErrors: {} });
      }

      state.bins.splice(binIndex, 1);
      state.binOperations = state.binOperations.filter((o) => o.binId !== id);
      notifyCommit();
    },
    async simulateCapacity(id: string, capacityPercent: number): Promise<SmartBinRow> {
      await wait(writeDelay);
      checkFailure("bins.simulateCapacity");
      requireAdmin();

      const bin = state.bins.find((b) => b.id === id);
      if (!bin) {
        throw new RepositoryError({ code: "notFound", message: `Bin not found: ${id}`, fieldErrors: {} });
      }

      bin.capacityPercent = capacityPercent;
      bin.lastUpdatedAt = MOCK_NOW;
      checkAndTriggerAlert(bin);
      notifyCommit();
      return clone(getBinRow(id));
    },
    async getQrCode(id: string): Promise<BinQrCode> {
      await wait(readDelay);
      checkFailure("bins.getQrCode");
      requireAdmin();
      const qrId = `qr-${id}`;
      const qrPayload = `ecoloop://bin/${qrId}`;
      let svg: string;
      try {
        svg = await QRCode.toString(qrPayload, {
          type: "svg",
          margin: 2,
          errorCorrectionLevel: "M",
        });
      } catch {
        svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="#f0f0f0"/><text x="100" y="100" text-anchor="middle" font-size="10">${qrPayload}</text></svg>`;
      }
      const dataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
      return {
        binId: id,
        qrId,
        qrPayload,
        dataUrl,
        svg,
      };
    }
  };

  // ---------------------------------------------------------------------------
  // Alerts Repository
  // ---------------------------------------------------------------------------
  function paginateAlerts(query: AlertListQuery): AlertPage {
    const activeCount = state.alerts.filter((a) => a.status === "active").length;
    const resolvedCount = state.alerts.filter((a) => a.status === "resolved").length;

    let rows: CapacityAlertRow[] = state.alerts
      .filter((a) => a.status === query.status)
      .map((a) => {
        const bin = state.bins.find((b) => b.id === a.binId) ?? {
          id: a.binId,
          locationName: "Unknown",
          locationDetail: "Unknown",
          capacityPercent: 0,
          acceptedMaterials: [],
          isOnline: false,
          lastUpdatedAt: MOCK_NOW
        };
        const ops = state.binOperations.find((o) => o.binId === a.binId) ?? {
          binId: a.binId,
          collectionStatus: "notScheduled"
        };
        return { alert: clone(a), bin: clone(bin), operations: clone(ops) };
      });

    if (query.search && query.search.trim()) {
      const q = query.search.trim().toLowerCase();
      rows = rows.filter(
        (r) =>
          r.alert.id.toLowerCase().includes(q) ||
          r.bin.locationName.toLowerCase().includes(q) ||
          r.bin.id.toLowerCase().includes(q)
      );
    }

    if (query.sort) {
      const dir = query.sort.direction === "desc" ? -1 : 1;
      rows.sort((a, b) => {
        let diff = 0;
        if (query.sort.key === "capacityPercent") {
          diff = a.bin.capacityPercent - b.bin.capacityPercent;
        } else {
          diff = a.alert.triggeredAt.localeCompare(b.alert.triggeredAt);
        }
        if (diff !== 0) return diff * dir;
        return a.alert.id.localeCompare(b.alert.id);
      });
    }

    const total = rows.length;
    const pageSize: PageSize = query.pageSize;
    const maxPage = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(Math.max(1, query.page), maxPage);
    const start = (page - 1) * pageSize;
    const items = rows.slice(start, start + pageSize);

    return { items, total, page, pageSize, activeCount, resolvedCount };
  }

  function getAlertRow(id: string): CapacityAlertRow {
    const alert = state.alerts.find((a) => a.id === id);
    if (!alert) {
      throw new RepositoryError({ code: "notFound", message: `Alert not found: ${id}`, fieldErrors: {} });
    }
    const bin = state.bins.find((b) => b.id === alert.binId);
    if (!bin) {
      throw new RepositoryError({ code: "notFound", message: `Bin for alert not found: ${alert.binId}`, fieldErrors: {} });
    }
    const ops = state.binOperations.find((o) => o.binId === alert.binId) ?? {
      binId: alert.binId,
      collectionStatus: "notScheduled"
    };
    return { alert: clone(alert), bin: clone(bin), operations: clone(ops) };
  }

  const alerts: AdminRepositories["alerts"] = {
    async list(query: AlertListQuery): Promise<AlertPage> {
      await wait(readDelay);
      checkFailure("alerts.list");
      requireAdmin();
      return clone(paginateAlerts(query));
    },
    watchList(query: AlertListQuery): Observable<AlertPage> {
      return createObservable("alerts.list", () => paginateAlerts(query));
    },
    async get(id: string): Promise<CapacityAlertRow> {
      await wait(readDelay);
      checkFailure("alerts.get");
      requireAdmin();
      return clone(getAlertRow(id));
    },
    watch(id: string): Observable<CapacityAlertRow | null> {
      return createObservable("alerts.get", () => {
        try {
          return getAlertRow(id);
        } catch {
          return null;
        }
      });
    },
    async schedule(id: string): Promise<CapacityAlertRow> {
      await wait(writeDelay);
      checkFailure("alerts.schedule");
      requireAdmin();

      const alert = state.alerts.find((a) => a.id === id);
      if (!alert) {
        throw new RepositoryError({ code: "notFound", message: `Alert not found: ${id}`, fieldErrors: {} });
      }
      if (alert.status !== "active") {
        throw new RepositoryError({ code: "invalidTransition", message: "Only active alerts can be scheduled", fieldErrors: {} });
      }

      const ops = state.binOperations.find((o) => o.binId === alert.binId);
      if (!ops || (ops.collectionStatus !== "pending" && ops.collectionStatus !== "notScheduled")) {
        throw new RepositoryError({ code: "invalidTransition", message: `Invalid collectionStatus for schedule: ${ops?.collectionStatus}`, fieldErrors: {} });
      }

      ops.collectionStatus = "scheduled";
      notifyCommit();
      return clone(getAlertRow(id));
    },
    async collect(id: string): Promise<CapacityAlertRow> {
      await wait(writeDelay);
      checkFailure("alerts.collect");
      requireAdmin();

      const alert = state.alerts.find((a) => a.id === id);
      if (!alert) {
        throw new RepositoryError({ code: "notFound", message: `Alert not found: ${id}`, fieldErrors: {} });
      }
      if (alert.status !== "active") {
        throw new RepositoryError({ code: "invalidTransition", message: "Only active alerts can be collected", fieldErrors: {} });
      }

      const ops = state.binOperations.find((o) => o.binId === alert.binId);
      if (!ops || ops.collectionStatus !== "scheduled") {
        throw new RepositoryError({ code: "invalidTransition", message: "Only scheduled bins can be collected", fieldErrors: {} });
      }

      ops.collectionStatus = "collected";
      const bin = state.bins.find((b) => b.id === alert.binId);
      if (bin) {
        bin.capacityPercent = 0;
        bin.lastUpdatedAt = MOCK_NOW;
      }
      notifyCommit();
      return clone(getAlertRow(id));
    },
    async resolve(id: string): Promise<CapacityAlertRow> {
      await wait(writeDelay);
      checkFailure("alerts.resolve");
      requireAdmin();

      const alert = state.alerts.find((a) => a.id === id);
      if (!alert) {
        throw new RepositoryError({ code: "notFound", message: `Alert not found: ${id}`, fieldErrors: {} });
      }
      if (alert.status !== "active") {
        throw new RepositoryError({ code: "invalidTransition", message: "Alert is already resolved", fieldErrors: {} });
      }

      const ops = state.binOperations.find((o) => o.binId === alert.binId);
      if (!ops || ops.collectionStatus !== "collected") {
        throw new RepositoryError({ code: "invalidTransition", message: "Bin must be collected before resolving alert", fieldErrors: {} });
      }

      alert.status = "resolved";
      alert.resolvedAt = MOCK_NOW;
      notifyCommit();
      return clone(getAlertRow(id));
    }
  };

  // ---------------------------------------------------------------------------
  // Verification Repository
  // ---------------------------------------------------------------------------
  function paginateVerification(query: VerificationListQuery): Page<VerificationDetail> {
    let details: VerificationDetail[] = state.tickets
      .filter((t) => t.status === query.status)
      .map((t) => {
        const tx = state.deposits.find((d) => d.id === t.transactionId);
        const resident = state.residents.find((r) => r.id === (tx ? tx.residentId : ""));
        const bin = state.bins.find((b) => b.id === (tx ? tx.binId : ""));
        return {
          ticket: clone(t),
          transaction: clone(tx!),
          resident: clone(resident!),
          bin: clone(bin!)
        };
      })
      .filter((d) => d.transaction && d.resident && d.bin);

    if (query.search && query.search.trim()) {
      const q = query.search.trim().toLowerCase();
      details = details.filter(
        (d) =>
          d.ticket.id.toLowerCase().includes(q) ||
          d.transaction.id.toLowerCase().includes(q) ||
          d.resident.fullName.toLowerCase().includes(q) ||
          d.bin.locationName.toLowerCase().includes(q)
      );
    }

    if (query.sort) {
      const dir = query.sort.direction === "desc" ? -1 : 1;
      details.sort((a, b) => {
        let diff = 0;
        if (query.sort.key === "confidencePercent") {
          diff = a.ticket.confidencePercent - b.ticket.confidencePercent;
        } else {
          diff = a.transaction.occurredAt.localeCompare(b.transaction.occurredAt);
        }
        if (diff !== 0) return diff * dir;
        return a.ticket.id.localeCompare(b.ticket.id);
      });
    }

    const total = details.length;
    const pageSize: PageSize = query.pageSize;
    const maxPage = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(Math.max(1, query.page), maxPage);
    const start = (page - 1) * pageSize;
    const items = details.slice(start, start + pageSize);

    return { items, total, page, pageSize };
  }

  function getVerificationDetail(id: string): VerificationDetail {
    const ticket = state.tickets.find((t) => t.id === id);
    if (!ticket) {
      throw new RepositoryError({ code: "notFound", message: `Ticket not found: ${id}`, fieldErrors: {} });
    }
    const tx = state.deposits.find((d) => d.id === ticket.transactionId);
    if (!tx) {
      throw new RepositoryError({ code: "notFound", message: `Transaction not found for ticket: ${id}`, fieldErrors: {} });
    }
    const resident = state.residents.find((r) => r.id === tx.residentId);
    if (!resident) {
      throw new RepositoryError({ code: "notFound", message: `Resident not found: ${tx.residentId}`, fieldErrors: {} });
    }
    const bin = state.bins.find((b) => b.id === tx.binId);
    if (!bin) {
      throw new RepositoryError({ code: "notFound", message: `Bin not found: ${tx.binId}`, fieldErrors: {} });
    }
    return {
      ticket: clone(ticket),
      transaction: clone(tx),
      resident: clone(resident),
      bin: clone(bin)
    };
  }

  const verification: AdminRepositories["verification"] = {
    async list(query: VerificationListQuery): Promise<Page<VerificationDetail>> {
      await wait(readDelay);
      checkFailure("verification.list");
      requireAdmin();
      return clone(paginateVerification(query));
    },
    watchList(query: VerificationListQuery): Observable<Page<VerificationDetail>> {
      return createObservable("verification.list", () => paginateVerification(query));
    },
    async get(id: string): Promise<VerificationDetail> {
      await wait(readDelay);
      checkFailure("verification.get");
      requireAdmin();
      return clone(getVerificationDetail(id));
    },
    watch(id: string): Observable<VerificationDetail | null> {
      return createObservable("verification.get", () => {
        try {
          return getVerificationDetail(id);
        } catch {
          return null;
        }
      });
    },
    async decide(
      id: string,
      decision: "approve" | "reject",
      idempotencyKey: string
    ): Promise<VerificationDecisionResult> {
      await wait(writeDelay);
      checkFailure("verification.decide");
      requireAdmin();

      if (!idempotencyKey || idempotencyKey.trim() === "") {
        throw new RepositoryError({
          code: "validation",
          message: "Idempotency key is required",
          fieldErrors: { idempotencyKey: "Key is required" }
        });
      }

      if (state.decisionReceipts[idempotencyKey]) {
        const stored = state.decisionReceipts[idempotencyKey];
        const isSameTicket = stored.detail.ticket.id === id;
        const isSameDecision =
          (decision === "approve" && stored.detail.ticket.status === "approved") ||
          (decision === "reject" && stored.detail.ticket.status === "rejected");
        if (isSameTicket && isSameDecision) {
          return clone(stored);
        }
        throw new RepositoryError({
          code: "conflict",
          message: "Idempotency key reused for different decision or ticket",
          fieldErrors: { idempotencyKey: "Key conflict" }
        });
      }

      const ticket = state.tickets.find((t) => t.id === id);
      if (!ticket) {
        throw new RepositoryError({ code: "notFound", message: `Ticket not found: ${id}`, fieldErrors: {} });
      }
      if (ticket.status !== "awaitingReview") {
        throw new RepositoryError({
          code: "conflict",
          message: "Ticket is already finalized",
          fieldErrors: { id: "Ticket already finalized" }
        });
      }

      const tx = state.deposits.find((d) => d.id === ticket.transactionId);
      if (!tx || tx.status !== "review") {
        throw new RepositoryError({
          code: "conflict",
          message: "Transaction is not in review status",
          fieldErrors: {}
        });
      }

      const resident = state.residents.find((r) => r.id === tx.residentId);
      const bin = state.bins.find((b) => b.id === tx.binId);
      const wallet = state.wallets.find((w) => w.residentId === tx.residentId);
      if (!resident || !bin || !wallet) {
        throw new RepositoryError({ code: "notFound", message: "Related entity missing", fieldErrors: {} });
      }

      if (decision === "approve") {
        const rate = state.materialRates.find((r) => r.materialType === tx.materialType);
        if (!rate || !rate.eligible) {
          throw new RepositoryError({
            code: "validation",
            message: `Material ${tx.materialType} is not eligible for points`,
            fieldErrors: {}
          });
        }

        const awardedPoints = tx.itemCount * rate.pointsPerItem;
        tx.status = "verified";
        tx.verifiedAt = MOCK_NOW;
        tx.pointsAwarded = awardedPoints;

        ticket.status = "approved";
        ticket.reviewedAt = MOCK_NOW;
        ticket.reviewedByAdminId = state.adminSession?.adminId ?? "Admin";

        wallet.balance += awardedPoints;
        wallet.version += 1;
        wallet.updatedAt = MOCK_NOW;

        const nextRewardCost = computeNextRewardCost(wallet.balance, state.rewards);
        const receipt: VerificationDecisionResult = {
          outcome: "verified",
          pointsAwarded: awardedPoints,
          detail: {
            ticket: clone(ticket),
            transaction: clone(tx),
            resident: clone(resident),
            bin: clone(bin)
          },
          wallet: {
            residentId: wallet.residentId,
            balance: wallet.balance,
            nextRewardCost,
            updatedAt: wallet.updatedAt,
            version: wallet.version
          }
        };

        state.decisionReceipts[idempotencyKey] = clone(receipt);
        notifyCommit();
        return clone(receipt);
      } else {
        tx.status = "rejected";
        tx.pointsAwarded = 0;
        tx.verifiedAt = null;

        ticket.status = "rejected";
        ticket.reviewedAt = MOCK_NOW;
        ticket.reviewedByAdminId = state.adminSession?.adminId ?? "Admin";

        const nextRewardCost = computeNextRewardCost(wallet.balance, state.rewards);
        const receipt: VerificationDecisionResult = {
          outcome: "rejected",
          pointsAwarded: 0,
          detail: {
            ticket: clone(ticket),
            transaction: clone(tx),
            resident: clone(resident),
            bin: clone(bin)
          },
          wallet: {
            residentId: wallet.residentId,
            balance: wallet.balance,
            nextRewardCost,
            updatedAt: wallet.updatedAt,
            version: wallet.version
          }
        };

        state.decisionReceipts[idempotencyKey] = clone(receipt);
        notifyCommit();
        return clone(receipt);
      }
    },
    async getReviewDetail(ticketId: string): Promise<import("../contracts/adminViewCodecs.ts").AdminReviewDetailView> {
      await wait(readDelay);
      checkFailure("verification.get");
      requireAdmin();
      const detail = getVerificationDetail(ticketId);
      const isApproved = detail.ticket.status === "approved";
      const isRejected = detail.ticket.status === "rejected";
      const reviewOutcome: "verified" | "rejected" | "review" = isApproved ? "verified" : isRejected ? "rejected" : "review";
      const detailView: import("../contracts/adminViewCodecs.ts").AdminReviewDetailView = {
        review: {
          ticketId: detail.ticket.id,
          batchId: detail.transaction.id,
          residentAlias: detail.resident.fullName,
          binId: detail.bin.id,
          locationName: detail.bin.locationName,
          state: detail.ticket.status === "awaitingReview" ? "awaiting_review" : "resolved",
          outcome: reviewOutcome,
          decisionVersion: 1,
          reason: detail.ticket.flag,
          occurredAt: detail.transaction.occurredAt,
          resolvedAt: detail.ticket.reviewedAt ?? null,
          reviewerAlias: detail.ticket.reviewedByAdminId ?? null,
          materialSummary: detail.ticket.predictedMaterialLabel,
          totalCount: 1,
        },
        sessionId: "session-001",
        resultId: "result-001",
        pinnedPolicyId: "policy-v1",
        pinnedPolicyVersion: 1,
        provisionalSpaceSpc: 10,
        heldPoints: null,
        finalSpaceSpc: isApproved ? 10 : 0,
        awardedPoints: isApproved ? detail.transaction.pointsAwarded : 0,
        inventoryState: isApproved ? "resolved" : "uncertain",
        findings: [
          {
            objectId: "obj-1",
            detectedClass: detail.transaction.materialType === "aluminium" ? "aluminium_can" : "plastic_bottle",
            confidence: detail.ticket.confidencePercent / 100,
            boundingBox: null,
            resolvedClass: detail.transaction.materialType === "aluminium" ? "aluminium_can" : "plastic_bottle",
            decision: isApproved ? "accept" : null,
            note: null,
          }
        ],
        source: {
          type: "simulated_bin_capture",
          assetId: "asset-001",
          modelVersion: "ecoloop-cv-v1",
        },
        evidence: {
          previewAvailable: Boolean(detail.ticket.captureImageUrl),
          previewUrl: detail.ticket.captureImageUrl ?? null,
          failureReason: null,
        },
        explanation: detail.ticket.reviewedAt ? "Reviewed by operator" : null,
        history: [],
      };
      return detailView;
    },
    watchReviewDetail(ticketId: string): Observable<import("../contracts/adminViewCodecs.ts").AdminReviewDetailView | null> {
      return createObservable("verification.get", () => {
        try {
          const detail = getVerificationDetail(ticketId);
          const isApproved = detail.ticket.status === "approved";
          const isRejected = detail.ticket.status === "rejected";
          const reviewOutcome: "verified" | "rejected" | "review" = isApproved ? "verified" : isRejected ? "rejected" : "review";
          return {
            review: {
              ticketId: detail.ticket.id,
              batchId: detail.transaction.id,
              residentAlias: detail.resident.fullName,
              binId: detail.bin.id,
              locationName: detail.bin.locationName,
              state: detail.ticket.status === "awaitingReview" ? "awaiting_review" : "resolved",
              outcome: reviewOutcome,
              decisionVersion: 1,
              reason: detail.ticket.flag,
              occurredAt: detail.transaction.occurredAt,
              resolvedAt: detail.ticket.reviewedAt ?? null,
              reviewerAlias: detail.ticket.reviewedByAdminId ?? null,
              materialSummary: detail.ticket.predictedMaterialLabel,
              totalCount: 1,
            },
            sessionId: "session-001",
            resultId: "result-001",
            pinnedPolicyId: "policy-v1",
            pinnedPolicyVersion: 1,
            provisionalSpaceSpc: 10,
            heldPoints: null,
            finalSpaceSpc: isApproved ? 10 : 0,
            awardedPoints: isApproved ? detail.transaction.pointsAwarded : 0,
            inventoryState: isApproved ? "resolved" : "uncertain",
            findings: [
              {
                objectId: "obj-1",
                detectedClass: detail.transaction.materialType === "aluminium" ? "aluminium_can" : "plastic_bottle",
                confidence: detail.ticket.confidencePercent / 100,
                boundingBox: null,
                resolvedClass: detail.transaction.materialType === "aluminium" ? "aluminium_can" : "plastic_bottle",
                decision: isApproved ? "accept" : null,
                note: null,
              }
            ],
            source: {
              type: "simulated_bin_capture",
              assetId: "asset-001",
              modelVersion: "ecoloop-cv-v1",
            },
            evidence: {
              previewAvailable: Boolean(detail.ticket.captureImageUrl),
              previewUrl: detail.ticket.captureImageUrl ?? null,
              failureReason: null,
            },
            explanation: detail.ticket.reviewedAt ? "Reviewed by operator" : null,
            history: [],
          };
        } catch {
          return null;
        }
      });
    },
    async previewResolution(input: {
      ticketId: string;
      inventoryState: "resolved" | "empty" | "unreadable" | "uncertain";
      objects: import("../contracts/adminViewCodecs.ts").ObjectResolutionDecisionInput[];
    }): Promise<import("../contracts/adminViewCodecs.ts").ReviewResolutionPreview> {
      await wait(readDelay);
      const isExcluded = input.inventoryState === "empty" || input.inventoryState === "unreadable";
      const acceptedCount = isExcluded ? 0 : input.objects.filter((o) => o.decision === "accept").length;
      const pointsAwarded = acceptedCount * 10;
      const spaceContributionSpc = isExcluded ? (input.inventoryState === "empty" ? 0 : 50) : acceptedCount * 10;
      const proposedOutcome = isExcluded ? (input.inventoryState === "empty" ? "empty" : "rejected") : (acceptedCount > 0 ? "verified" : "rejected");
      return {
        outcome: proposedOutcome,
        pointsAwarded,
        acceptedCount,
        totalCount: input.objects.length,
        spaceContributionSpc,
        spaceDeltaSpc: spaceContributionSpc - 10,
        lines: [
          {
            class: "plastic_bottle",
            eligible: acceptedCount > 0,
            count: acceptedCount,
            points: pointsAwarded,
            spaceSpc: spaceContributionSpc,
          }
        ],
      };
    },
    async resolveReview(input: import("../contracts/adminViewCodecs.ts").ResolveReviewInput): Promise<VerificationDecisionResult> {
      const isApproved = input.inventoryState === "resolved" && input.objects.some((o) => o.decision === "accept");
      return verification.decide(input.ticketId, isApproved ? "approve" : "reject", `mock-${Date.now()}`);
    }
  };

  // ---------------------------------------------------------------------------
  // Rewards Repository
  // ---------------------------------------------------------------------------
  function paginateRewards(query: RewardListQuery): Page<Reward> {
    let list: Reward[] = state.rewards.map((doc) => ({
      ...clone(doc),
      residentRedemptionCount: 0
    }));

    if (query.search && query.search.trim()) {
      const q = query.search.trim().toLowerCase();
      list = list.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.merchantName.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q)
      );
    }

    if (query.categoryId) {
      list = list.filter((r) => r.categoryId === query.categoryId);
    }

    if (query.publication && query.publication !== "all") {
      const isActive = query.publication === "active";
      list = list.filter((r) => r.isActive === isActive);
    }

    if (query.sort) {
      const dir = query.sort.direction === "desc" ? -1 : 1;
      list.sort((a, b) => {
        let diff = 0;
        if (query.sort.key === "pointsCost") {
          diff = a.pointsCost - b.pointsCost;
        } else if (query.sort.key === "expiresAt") {
          diff = a.expiresAt.localeCompare(b.expiresAt);
        } else {
          diff = a.title.localeCompare(b.title);
        }
        if (diff !== 0) return diff * dir;
        return a.id.localeCompare(b.id);
      });
    }

    const total = list.length;
    const pageSize: PageSize = query.pageSize;
    const maxPage = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(Math.max(1, query.page), maxPage);
    const start = (page - 1) * pageSize;
    const items = list.slice(start, start + pageSize);

    return { items, total, page, pageSize };
  }

  function getReward(id: string): Reward {
    const doc = state.rewards.find((r) => r.id === id);
    if (!doc) {
      throw new RepositoryError({ code: "notFound", message: `Reward not found: ${id}`, fieldErrors: {} });
    }
    return { ...clone(doc), residentRedemptionCount: 0 };
  }

  function validateRewardInput(input: RewardInput): void {
    if (!input.title || input.title.trim() === "") {
      throw new RepositoryError({ code: "validation", message: "Title is required", fieldErrors: { title: "Title is required" } });
    }
    if (!input.merchantName || input.merchantName.trim() === "") {
      throw new RepositoryError({ code: "validation", message: "Merchant name is required", fieldErrors: { merchantName: "Merchant name is required" } });
    }
    if (!input.description || input.description.trim() === "") {
      throw new RepositoryError({ code: "validation", message: "Description is required", fieldErrors: { description: "Description is required" } });
    }
    if (!state.categories.some((c) => c.id === input.categoryId)) {
      throw new RepositoryError({ code: "validation", message: "Category is unknown", fieldErrors: { categoryId: "Invalid category" } });
    }
    if (typeof input.pointsCost !== "number" || !Number.isInteger(input.pointsCost) || input.pointsCost <= 0) {
      throw new RepositoryError({ code: "validation", message: "Points cost must be positive integer", fieldErrors: { pointsCost: "Invalid points cost" } });
    }
    if (input.isActive !== false && (!input.expiresAt || input.expiresAt <= MOCK_NOW)) {
      throw new RepositoryError({ code: "validation", message: "Expiry must be in the future relative to mock clock", fieldErrors: { expiresAt: "Must be in the future" } });
    }
    if (typeof input.maxRedemptionsPerResident !== "number" || input.maxRedemptionsPerResident < 1) {
      throw new RepositoryError({ code: "validation", message: "Max redemptions must be >= 1", fieldErrors: { maxRedemptionsPerResident: "Must be >= 1" } });
    }
    if (typeof input.sortOrder !== "number" || input.sortOrder < 0) {
      throw new RepositoryError({ code: "validation", message: "Sort order must be non-negative", fieldErrors: { sortOrder: "Must be >= 0" } });
    }
    if (!["art0", "art1", "art2", "art3"].includes(input.artKey)) {
      throw new RepositoryError({ code: "validation", message: "Invalid artKey", fieldErrors: { artKey: "Must be art0-art3" } });
    }
    if (input.imageUrl !== null && (typeof input.imageUrl !== "string" || !input.imageUrl.startsWith("https://"))) {
      throw new RepositoryError({ code: "validation", message: "Image URL must be null or https", fieldErrors: { imageUrl: "Invalid image URL" } });
    }
  }

  const rewards: AdminRepositories["rewards"] = {
    async list(query: RewardListQuery): Promise<Page<Reward>> {
      await wait(readDelay);
      checkFailure("rewards.list");
      requireAdmin();
      return clone(paginateRewards(query));
    },
    watchList(query: RewardListQuery): Observable<Page<Reward>> {
      return createObservable("rewards.list", () => paginateRewards(query));
    },
    async get(id: string): Promise<Reward> {
      await wait(readDelay);
      checkFailure("rewards.get");
      requireAdmin();
      return clone(getReward(id));
    },
    watch(id: string): Observable<Reward | null> {
      return createObservable("rewards.get", () => {
        try {
          return getReward(id);
        } catch {
          return null;
        }
      });
    },
    async getCategories(): Promise<RewardCategory[]> {
      await wait(readDelay);
      checkFailure("rewards.getCategories");
      requireAdmin();
      return clone(state.categories);
    },
    watchCategories(): Observable<RewardCategory[]> {
      return createObservable("rewards.getCategories", () => state.categories);
    },
    async create(input: RewardInput): Promise<Reward> {
      await wait(writeDelay);
      checkFailure("rewards.create");
      requireAdmin();
      validateRewardInput(input);

      const id = defaultIdFactory("rewards");
      const doc: RewardDocument & { version: number } = {
        id,
        title: input.title,
        description: input.description,
        merchantName: input.merchantName,
        categoryId: input.categoryId,
        tag: input.tag ?? null,
        imageUrl: input.imageUrl ?? null,
        pointsCost: input.pointsCost,
        expiresAt: input.expiresAt,
        isActive: Boolean(input.isActive),
        maxRedemptionsPerResident: input.maxRedemptionsPerResident,
        artKey: input.artKey,
        sortOrder: input.sortOrder,
        version: 1,
      };

      state.rewards.push(doc);
      notifyCommit();
      return clone({ ...doc, residentRedemptionCount: 0 });
    },
    async update(id: string, input: RewardInput): Promise<Reward> {
      await wait(writeDelay);
      checkFailure("rewards.update");
      requireAdmin();
      validateRewardInput(input);

      const index = state.rewards.findIndex((r) => r.id === id);
      if (index === -1) {
        throw new RepositoryError({ code: "notFound", message: `Reward not found: ${id}`, fieldErrors: {} });
      }

      const existing = state.rewards[index];
      const existingVersion = (existing as any).version ?? 1;
      if (input.expectedVersion !== undefined && input.expectedVersion !== existingVersion) {
        throw new RepositoryError({
          code: "conflict",
          message: `Reward version mismatch: expected ${input.expectedVersion}, found ${existingVersion}`,
          fieldErrors: { expectedVersion: "Version conflict" },
        });
      }

      const nextVersion = existingVersion + 1;
      const updated: RewardDocument & { version: number } = {
        id,
        title: input.title,
        description: input.description,
        merchantName: input.merchantName,
        categoryId: input.categoryId,
        tag: input.tag ?? null,
        imageUrl: input.imageUrl ?? null,
        pointsCost: input.pointsCost,
        expiresAt: input.expiresAt,
        isActive: Boolean(input.isActive),
        maxRedemptionsPerResident: input.maxRedemptionsPerResident,
        artKey: input.artKey,
        sortOrder: input.sortOrder,
        version: nextVersion,
      };

      state.rewards[index] = updated;
      notifyCommit();
      return clone({ ...updated, residentRedemptionCount: 0 });
    },
    async delete(id: string, expectedVersion?: number): Promise<void> {
      await wait(writeDelay);
      checkFailure("rewards.delete");
      requireAdmin();

      const index = state.rewards.findIndex((r) => r.id === id);
      if (index === -1) {
        throw new RepositoryError({ code: "notFound", message: `Reward not found: ${id}`, fieldErrors: {} });
      }

      const existing = state.rewards[index];
      const existingVersion = (existing as any).version ?? 1;
      if (expectedVersion !== undefined && expectedVersion !== existingVersion) {
        throw new RepositoryError({
          code: "conflict",
          message: `Reward version mismatch: expected ${expectedVersion}, found ${existingVersion}`,
          fieldErrors: { expectedVersion: "Version conflict" },
        });
      }

      const hasVoucher = state.vouchers.some((v) => v.rewardId === id);
      const hasRedemption = state.redemptions.some((r) => r.rewardId === id);
      if (hasVoucher || hasRedemption) {
        throw new RepositoryError({
          code: "conflict",
          message: "Reward has issued vouchers or redemptions and cannot be deleted. Deactivate it instead.",
          fieldErrors: { id: "Referenced by vouchers or redemptions" }
        });
      }

      state.rewards.splice(index, 1);
      notifyCommit();
    },
  };

  // ---------------------------------------------------------------------------
  // Settings Repository
  // ---------------------------------------------------------------------------
  function buildAdminSettings(): AdminSettings {
    return {
      id: "global",
      version: state.programSettings.version ?? 1,
      policyVersion: state.programSettings.policyVersion ?? "policy-v1",
      capacityAlertThreshold: state.programSettings.capacityAlertThreshold,
      acceptedMaterials: clone(state.programSettings.acceptedMaterials),
      acceptedClasses: clone(
        state.programSettings.acceptedClasses ?? [
          "plastic_bottle",
          "aluminium_can",
          "glass_bottle",
          "paper_item",
          "paper_bag",
        ]
      ),
      materialRates: clone(state.materialRates),
      updatedAt: state.programSettings.updatedAt
    };
  }

  const settings: AdminRepositories["settings"] = {
    async get(): Promise<AdminSettings> {
      await wait(readDelay);
      checkFailure("settings.get");
      requireAdmin();
      return clone(buildAdminSettings());
    },
    watch(): Observable<AdminSettings> {
      return createObservable("settings.get", () => buildAdminSettings());
    },
    async update(input: SettingsInput): Promise<AdminSettings> {
      await wait(writeDelay);
      checkFailure("settings.update");
      requireAdmin();

      const currentVer = state.programSettings.version ?? 1;
      if (input.expectedVersion !== undefined && input.expectedVersion !== currentVer) {
        throw new RepositoryError({
          code: "conflict",
          message: `Stale settings version. Current operational version is ${currentVer}, but draft expected ${input.expectedVersion}.`,
          fieldErrors: { expectedVersion: "Version conflict" }
        });
      }

      if (![75, 80, 85].includes(input.capacityAlertThreshold)) {
        throw new RepositoryError({
          code: "validation",
          message: "Capacity alert threshold must be 75, 80, or 85",
          fieldErrors: { capacityAlertThreshold: "Invalid threshold" }
        });
      }
      if (!Array.isArray(input.acceptedMaterials) || input.acceptedMaterials.length === 0) {
        throw new RepositoryError({
          code: "validation",
          message: "At least one accepted material is required",
          fieldErrors: { acceptedMaterials: "Select at least one" }
        });
      }
      if (input.acceptedClasses && input.acceptedClasses.includes("cardboard_item")) {
        throw new RepositoryError({
          code: "validation",
          message: "Cardboard cannot be accepted in smart bin automated deposits",
          fieldErrors: { acceptedClasses: "Cardboard excluded" }
        });
      }
      const knownMat: MaterialType[] = ["plastic", "aluminium", "paper", "glass"];
      if (
        !Array.isArray(input.materialRates) ||
        input.materialRates.length !== 4 ||
        !knownMat.every((m) => input.materialRates.some((r) => r.materialType === m))
      ) {
        throw new RepositoryError({
          code: "validation",
          message: "Exactly four material rates (plastic, aluminium, paper, glass) are required",
          fieldErrors: { materialRates: "Must supply exactly 4 rates" }
        });
      }

      for (const r of input.materialRates) {
        if (typeof r.pointsPerItem !== "number" || !Number.isInteger(r.pointsPerItem) || r.pointsPerItem < 0 || r.pointsPerItem > 1000) {
          throw new RepositoryError({
            code: "validation",
            message: "Rates must be integers between 0 and 1000",
            fieldErrors: { [r.materialType]: "Invalid pointsPerItem" }
          });
        }
        const shouldBeEligible = input.acceptedMaterials.includes(r.materialType);
        if (r.eligible !== shouldBeEligible) {
          throw new RepositoryError({
            code: "validation",
            message: `Eligible flag for ${r.materialType} must match acceptedMaterials`,
            fieldErrors: { [r.materialType]: "Eligibility mismatch" }
          });
        }
      }

      state.programSettings.version = currentVer + 1;
      state.programSettings.capacityAlertThreshold = input.capacityAlertThreshold;
      state.programSettings.acceptedMaterials = [...input.acceptedMaterials];
      if (input.acceptedClasses) {
        state.programSettings.acceptedClasses = [...input.acceptedClasses];
      }
      state.programSettings.updatedAt = MOCK_NOW;
      state.materialRates = clone(input.materialRates);

      // Reconcile qualifying bins into alerts
      for (const b of state.bins) {
        checkAndTriggerAlert(b);
      }

      notifyCommit();
      return clone(buildAdminSettings());
    }
  };

  // ---------------------------------------------------------------------------
  // Resident Read Repository
  // ---------------------------------------------------------------------------
  function buildResidentSnapshot(residentId: string): ResidentSnapshot {
    const profile = state.residents.find((r) => r.id === residentId);
    if (!profile) {
      throw new RepositoryError({ code: "notFound", message: `Resident not found: ${residentId}`, fieldErrors: {} });
    }
    const walletDoc = state.wallets.find((w) => w.residentId === residentId) ?? {
      residentId,
      balance: 0,
      updatedAt: MOCK_NOW,
      version: 0
    };
    const matchingDeposits = state.deposits.filter((d) => d.residentId === residentId);
    const verifiedDeposits = matchingDeposits.filter((d) => d.status === "verified");

    const nextRewardCost = computeNextRewardCost(walletDoc.balance, state.rewards);
    const wallet: ResidentSnapshot["wallet"] = {
      residentId,
      balance: walletDoc.balance,
      nextRewardCost,
      updatedAt: walletDoc.updatedAt,
      version: walletDoc.version
    };

    const summary: ResidentSnapshot["summary"] = {
      verifiedDepositCount: verifiedDeposits.length,
      verifiedWeightKg: computeDerivedWeight(matchingDeposits)
    };

    return {
      profile: clone(profile),
      wallet,
      deposits: clone(matchingDeposits),
      summary
    };
  }

  const residents: AdminRepositories["residents"] = {
    async getSnapshot(residentId: string): Promise<ResidentSnapshot> {
      await wait(readDelay);
      checkFailure("residents.getSnapshot");
      requireAdmin();
      return clone(buildResidentSnapshot(residentId));
    },
    watchSnapshot(residentId: string): Observable<ResidentSnapshot> {
      return createObservable("residents.getSnapshot", () => buildResidentSnapshot(residentId));
    }
  };

  // ---------------------------------------------------------------------------
  // Mock Controls
  // ---------------------------------------------------------------------------
  const controls: MockControls = {
    failNext(operation: OperationName): void {
      failedOps.add(operation);
    },
    setLatency(readMs: number, writeMs: number): void {
      readDelay = readMs;
      writeDelay = writeMs;
    },
    setAuthState(newState: AuthState): void {
      if (newState.isSignedIn && (newState.uid === null || newState.role === null)) {
        throw new Error("Signed-in AuthState requires uid and role");
      }
      if (!newState.isSignedIn && (newState.uid !== null || newState.role !== null)) {
        throw new Error("Signed-out AuthState must have null uid and role");
      }
      state.authState = clone(newState);
      if (newState.isSignedIn && newState.role === "admin" && newState.uid === "ADM-001") {
        state.adminSession.isSignedIn = true;
      } else {
        state.adminSession.isSignedIn = false;
      }
      notifyCommit();
    },
    reset(): void {
      state = createSeedState();
      failedOps.clear();
      notifyCommit();
    }
  };

  return {
    repositories: {
      auth,
      dashboard,
      bins,
      alerts,
      verification,
      rewards,
      settings,
      residents
    },
    controls,
    subscribe(listener: () => void): Unsubscribe {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getRevision(): number {
      return revision;
    }
  };
}
