// =============================================================================
// firebaseVerificationRepository.ts — Firebase-backed VerificationRepository
// Phase AB-07 — Evidence-backed review resolution and shared settlement
// =============================================================================

import { httpsCallable, type Functions } from "firebase/functions";
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  onSnapshot,
  type Firestore,
} from "firebase/firestore";
import {
  type VerificationRepository,
  type Observable,
  type Observer,
  type Unsubscribe,
  RepositoryError,
} from "../repositories.ts";
import type {
  VerificationListQuery,
  VerificationDetail,
  VerificationDecisionResult,
  Page,
} from "../../contracts/admin.ts";
import {
  decodeAdminReviewView,
  decodeAdminReviewDetailView,
  decodeAdminPaginatedResponse,
  adminReviewDetailToVerificationDetail,
  type AdminReviewView,
  type AdminReviewDetailView,
  type AdminPaginatedResponse,
  type ObjectResolutionDecisionInput,
  type ReviewResolutionPreview,
  type ResolveReviewInput,
} from "../../contracts/adminViewCodecs.ts";
import type { FirebaseCommandClient } from "../../core/firebase/commandClient.ts";

function toFailure(err: unknown): import("../repositories.ts").RepositoryFailure {
  if (err instanceof RepositoryError) return err.failure;
  return {
    code: "unavailable",
    message: err instanceof Error ? err.message : String(err),
    fieldErrors: {},
  };
}

function adminReviewViewToVerificationDetail(r: AdminReviewView): VerificationDetail {
  const isApproved = r.outcome === "verified";
  const isRejected = r.outcome === "rejected" || r.outcome === "empty";
  const status = isApproved ? "approved" : isRejected ? "rejected" : "awaitingReview";

  let txStatus: import("../../contracts/shared.ts").DepositStatus = "review";
  if (r.outcome === "verified") txStatus = "verified";
  else if (r.outcome === "rejected" || r.outcome === "empty") txStatus = "rejected";

  return {
    ticket: {
      id: r.ticketId,
      transactionId: r.batchId,
      predictedMaterialType: "plastic",
      predictedMaterialLabel: r.materialSummary ?? "Mixed Batch",
      confidencePercent: 90,
      captureDescription: `Batch ${r.batchId} (${r.totalCount ?? 0} items)`,
      captureImageUrl: r.imageUrl ?? null,
      flag: "uncertain",
      status,
      reviewedAt: r.resolvedAt ?? null,
      reviewedByAdminId: r.reviewerAlias ?? null,
    },
    transaction: {
      id: r.batchId,
      residentId: r.residentAlias,
      sessionId: null,
      binId: r.binId,
      binLocation: r.locationName,
      materialType: "plastic",
      materialLabel: r.materialSummary ?? "Mixed Batch",
      itemCount: r.totalCount ?? 1,
      pointsAwarded: 0,
      status: txStatus,
      occurredAt: r.occurredAt,
      verifiedAt: r.resolvedAt ?? null,
    },
    resident: {
      id: r.residentAlias,
      fullName: r.residentAlias,
      email: `${r.residentAlias.toLowerCase().replace(/[^a-z0-9]/g, "")}@example.com`,
      avatarUrl: null,
      createdAt: r.occurredAt,
    },
    bin: {
      id: r.binId,
      locationName: r.locationName,
      locationDetail: "Smart Recycling Chamber",
      capacityPercent: 50,
      acceptedMaterials: ["plastic", "aluminium", "paper", "glass"],
      isOnline: true,
      lastUpdatedAt: r.occurredAt,
    },
  };
}

export class FirebaseVerificationRepository implements VerificationRepository {
  private readonly functions: Functions;
  private readonly firestore: Firestore;
  private readonly commandClient: FirebaseCommandClient;
  private readonly fallbackVerificationRepo: VerificationRepository;

  constructor(
    functions: Functions,
    firestore: Firestore,
    commandClient: FirebaseCommandClient,
    fallbackVerificationRepo: VerificationRepository
  ) {
    this.functions = functions;
    this.firestore = firestore;
    this.commandClient = commandClient;
    this.fallbackVerificationRepo = fallbackVerificationRepo;
  }

  async list(query: VerificationListQuery): Promise<Page<VerificationDetail>> {
    try {
      const callable = httpsCallable<
        Record<string, unknown>,
        AdminPaginatedResponse<AdminReviewView>
      >(this.functions, "listAdminReviews");

      const targetState = query.status === "awaitingReview" ? "awaiting_review" : "resolved";
      const filters: Record<string, unknown> = {
        state: targetState,
      };

      const res = await callable({
        search: query.search || undefined,
        sortKey: "occurredAt",
        sortDirection: "desc",
        pageSize: query.pageSize,
        filters,
      });

      const decoded = decodeAdminPaginatedResponse(res.data, decodeAdminReviewView);

      if (decoded.items && decoded.items.length > 0) {
        return {
          items: decoded.items.map(adminReviewViewToVerificationDetail),
          total: decoded.total,
          page: query.page,
          pageSize: query.pageSize,
        };
      }
    } catch {
      // Continue to direct Firestore fallback
    }

    // Direct Firestore fetch fallback
    try {
      const snap = await getDocs(collection(this.firestore, "adminReviewViews"));
      let views: AdminReviewView[] = [];

      if (!snap.empty) {
        views = snap.docs.map((d) => decodeAdminReviewView(d.data()));
      } else {
        const ticketsSnap = await getDocs(collection(this.firestore, "reviewTickets"));
        views = ticketsSnap.docs.map((d) => {
          const data = d.data();
          const ticketId = d.id;
          const batchId = String(data.batchId ?? ticketId);
          const rawState = String(data.state ?? "open");
          const state: "awaiting_review" | "resolved" = rawState === "resolved" ? "resolved" : "awaiting_review";
          const ownerId = String(data.ownerId ?? "");
          const assetId = String(data.assetId ?? "asset-demo-0010");
          const assetVersion = String(data.assetVersion ?? "sha256-4a5e8b49da2c64c3");
          const imageUrl = data.imageUrl
            ? String(data.imageUrl)
            : `https://firebasestorage.googleapis.com/v0/b/ecoloop-thesmartrecycling.firebasestorage.app/o/simulation-assets%2F${encodeURIComponent(assetId)}%2F${encodeURIComponent(assetVersion)}%2Fsource.jpg?alt=media`;
          return {
            ticketId,
            batchId,
            binId: String(data.binId ?? "bin-demo-main"),
            locationName: "EcoLoop Demo Bin",
            occurredAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : String(data.createdAt ?? new Date().toISOString()),
            state,
            outcome: (data.finalOutcome ?? "review") as any,
            decisionVersion: Number(data.decisionVersion ?? 1),
            residentAlias: ownerId ? `Resident •••${ownerId.slice(-4)}` : "Resident Unknown",
            totalCount: null,
            materialSummary: "Recyclable Batch",
            reviewerAlias: data.resolvedBy ? `Admin •••${String(data.resolvedBy).slice(-4)}` : null,
            resolvedAt: data.resolvedAt ? String(data.resolvedAt) : null,
            imageUrl,
          };
        });
      }

      // Filter by status
      if (query.status === "awaitingReview") {
        views = views.filter((v) => v.state === "awaiting_review");
      } else if (query.status === "approved") {
        views = views.filter((v) => v.outcome === "verified");
      } else if (query.status === "rejected") {
        views = views.filter((v) => v.outcome === "rejected" || v.outcome === "empty");
      }

      // Filter by search
      if (query.search && query.search.trim().length > 0) {
        const term = query.search.toLowerCase().trim();
        views = views.filter((v) =>
          v.ticketId.toLowerCase().includes(term) ||
          v.batchId.toLowerCase().includes(term) ||
          v.binId.toLowerCase().includes(term) ||
          v.locationName.toLowerCase().includes(term) ||
          v.residentAlias.toLowerCase().includes(term) ||
          (v.materialSummary && v.materialSummary.toLowerCase().includes(term))
        );
      }

      // Sort by occurredAt desc
      views.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());

      const total = views.length;
      const pageIndex = Math.max(0, (query.page ?? 1) - 1);
      const pageSize = query.pageSize ?? 10;
      const paginated = views.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);

      return {
        items: paginated.map(adminReviewViewToVerificationDetail),
        total,
        page: query.page,
        pageSize: query.pageSize,
      };
    } catch (err: unknown) {
      if (err instanceof RepositoryError) throw err;
      return this.fallbackVerificationRepo.list(query);
    }
  }

  watchList(query: VerificationListQuery): Observable<Page<VerificationDetail>> {
    return {
      subscribe: (observer: Observer<Page<VerificationDetail>>): Unsubscribe => {
        let isCancelled = false;

        const refresh = () => {
          if (!isCancelled) {
            this.list(query)
              .then((page) => {
                if (!isCancelled) observer.next(page);
              })
              .catch((err) => {
                if (!isCancelled) observer.error(toFailure(err));
              });
          }
        };

        refresh();

        const unsubVersion = onSnapshot(
          doc(this.firestore, "adminReadVersions/reviews"),
          () => refresh(),
          () => {}
        );

        const unsubCollection = onSnapshot(
          collection(this.firestore, "adminReviewViews"),
          () => refresh(),
          () => {}
        );

        return () => {
          isCancelled = true;
          unsubVersion();
          unsubCollection();
        };
      },
    };
  }

  async get(id: string): Promise<VerificationDetail> {
    try {
      const reviewDetail = await this.getReviewDetail(id);
      return adminReviewDetailToVerificationDetail(reviewDetail);
    } catch (err: unknown) {
      if (err instanceof RepositoryError) throw err;
      return this.fallbackVerificationRepo.get(id);
    }
  }

  watch(id: string): Observable<VerificationDetail | null> {
    return {
      subscribe: (observer: Observer<VerificationDetail | null>): Unsubscribe => {
        let isCancelled = false;

        const refresh = () => {
          if (!isCancelled) {
            this.get(id)
              .then((detail) => {
                if (!isCancelled) observer.next(detail);
              })
              .catch((err) => {
                if (!isCancelled) observer.error(toFailure(err));
              });
          }
        };

        refresh();

        const unsubDoc = onSnapshot(
          doc(this.firestore, `adminReviewViews/${id}`),
          () => refresh(),
          () => {}
        );

        const unsubTicket = onSnapshot(
          doc(this.firestore, `reviewTickets/${id}`),
          () => refresh(),
          () => {}
        );

        return () => {
          isCancelled = true;
          unsubDoc();
          unsubTicket();
        };
      },
    };
  }

  async getReviewDetail(ticketId: string): Promise<AdminReviewDetailView> {
    try {
      const callable = httpsCallable<{ ticketId: string }, unknown>(
        this.functions,
        "getAdminReview"
      );
      const res = await callable({ ticketId });
      return decodeAdminReviewDetailView(res.data);
    } catch {
      // Assemble directly from Firestore
      const [viewDoc, ticketDoc] = await Promise.all([
        getDoc(doc(this.firestore, "adminReviewViews", ticketId)),
        getDoc(doc(this.firestore, "reviewTickets", ticketId)),
      ]);

      const ticketData = ticketDoc.exists() ? ticketDoc.data() : {};
      const viewData = viewDoc.exists() ? viewDoc.data() : {};

      const batchId = String(ticketData.batchId ?? viewData.batchId ?? ticketId);
      const depositDoc = await getDoc(doc(this.firestore, "deposits", batchId));
      const depositData = depositDoc.exists() ? depositDoc.data() : {};

      const binId = String(viewData.binId ?? ticketData.binId ?? depositData.binId ?? "bin-demo-main");
      const locationName = String(viewData.locationName ?? depositData.binLocation ?? "EcoLoop Demo Bin");
      const occurredAt = String(viewData.occurredAt ?? ticketData.createdAt ?? depositData.createdAt ?? new Date().toISOString());
      const rawState = String(viewData.state ?? ticketData.state ?? "open");
      const state = rawState === "resolved" ? "resolved" : "awaiting_review";
      const outcome = String(viewData.outcome ?? ticketData.finalOutcome ?? depositData.status ?? "review") as any;
      const decisionVersion = Number(viewData.decisionVersion ?? ticketData.decisionVersion ?? depositData.decisionVersion ?? 1);
      const ownerId = String(ticketData.ownerId ?? depositData.ownerId ?? "");
      const residentAlias = String(viewData.residentAlias ?? (ownerId ? `Resident •••${ownerId.slice(-4)}` : "Resident Unknown"));
      const totalCount = depositData.totalDetectedObjectCount !== undefined ? Number(depositData.totalDetectedObjectCount) : null;

      let materialSummary = viewData.materialSummary ?? null;
      if (!materialSummary && Array.isArray(depositData.lines)) {
        materialSummary = depositData.lines.map((l: any) => `${l.count ?? 1}x ${l.class ?? "item"}`).join(", ");
      }

      const assetId = String(viewData.assetId ?? ticketData.assetId ?? depositData.assetId ?? "asset-demo-0010");
      const assetVersion = String(viewData.assetVersion ?? ticketData.assetVersion ?? depositData.assetVersion ?? "sha256-4a5e8b49da2c64c3");
      const previewUrl = viewData.imageUrl
        ? String(viewData.imageUrl)
        : `https://firebasestorage.googleapis.com/v0/b/ecoloop-thesmartrecycling.firebasestorage.app/o/simulation-assets%2F${encodeURIComponent(assetId)}%2F${encodeURIComponent(assetVersion)}%2Fsource.jpg?alt=media`;

      const review: AdminReviewView = {
        ticketId,
        batchId,
        binId,
        locationName,
        occurredAt,
        state,
        outcome,
        decisionVersion,
        residentAlias,
        totalCount,
        materialSummary,
        reviewerAlias: viewData.reviewerAlias ?? null,
        resolvedAt: viewData.resolvedAt ?? null,
        imageUrl: previewUrl,
      };

      const findings: AdminReviewDetailView["findings"] = [];
      if (Array.isArray(depositData.lines) && depositData.lines.length > 0) {
        let idx = 1;
        for (const line of depositData.lines) {
          const count = Number(line.count ?? 1);
          for (let c = 0; c < count; c++) {
            findings.push({
              objectId: `obj-${idx++}`,
              detectedClass: String(line.class ?? "unknown"),
              confidence: 0.9,
              boundingBox: null,
              resolvedClass: String(line.class ?? "unknown"),
              decision: line.class === "cardboard_item" ? "exclude" : "accept",
              note: null,
            });
          }
        }
      } else {
        findings.push({
          objectId: "obj-1",
          detectedClass: "plastic_bottle",
          confidence: 0.9,
          boundingBox: null,
          resolvedClass: "plastic_bottle",
          decision: "accept",
          note: null,
        });
      }

      return {
        review,
        sessionId: String(depositData.sessionId ?? ticketData.sessionId ?? ""),
        resultId: String(depositData.resultId ?? ""),
        pinnedPolicyId: String(depositData.policyVersion ?? "policy-v1"),
        pinnedPolicyVersion: 1,
        provisionalSpaceSpc: Number(ticketData.provisionalSpaceSpc ?? depositData.spaceContributionSpc ?? 0),
        heldPoints: ticketData.heldPoints !== undefined ? ticketData.heldPoints : null,
        finalSpaceSpc: ticketData.finalSpaceSpc !== undefined ? ticketData.finalSpaceSpc : null,
        awardedPoints: depositData.pointsAwarded !== undefined ? depositData.pointsAwarded : null,
        inventoryState: "resolved",
        findings,
        source: {
          type: "simulated_bin_capture",
          assetId: depositData.assetId ? String(depositData.assetId) : assetId,
          modelVersion: depositData.assetVersion ? String(depositData.assetVersion) : assetVersion,
        },
        evidence: {
          previewAvailable: true,
          previewUrl,
          failureReason: null,
        },
        explanation: String(ticketData.explanation ?? "Referred for operator review"),
        history: [],
      };
    }
  }

  watchReviewDetail(ticketId: string): Observable<AdminReviewDetailView | null> {
    return {
      subscribe: (observer: Observer<AdminReviewDetailView | null>): Unsubscribe => {
        let isCancelled = false;

        const refresh = () => {
          if (!isCancelled) {
            this.getReviewDetail(ticketId)
              .then((detail) => {
                if (!isCancelled) observer.next(detail);
              })
              .catch((err) => {
                if (!isCancelled) observer.error(toFailure(err));
              });
          }
        };

        refresh();

        const unsubDoc = onSnapshot(
          doc(this.firestore, `adminReviewViews/${ticketId}`),
          () => refresh(),
          () => {}
        );

        const unsubTicket = onSnapshot(
          doc(this.firestore, `reviewTickets/${ticketId}`),
          () => refresh(),
          () => {}
        );

        return () => {
          isCancelled = true;
          unsubDoc();
          unsubTicket();
        };
      },
    };
  }

  async previewResolution(input: {
    ticketId: string;
    inventoryState: "resolved" | "empty" | "unreadable" | "uncertain";
    objects: ObjectResolutionDecisionInput[];
  }): Promise<ReviewResolutionPreview> {
    try {
      const callable = httpsCallable<typeof input, ReviewResolutionPreview>(
        this.functions,
        "previewAdminReviewResolution"
      );
      const res = await callable(input);
      return res.data;
    } catch {
      // Local calculation fallback
      const RATES: Record<string, { points: number; spc: number }> = {
        plastic_bottle: { points: 5, spc: 10 },
        aluminium_can: { points: 8, spc: 6 },
        glass_bottle: { points: 10, spc: 12 },
        paper_item: { points: 3, spc: 4 },
        paper_bag: { points: 3, spc: 4 },
        cardboard_item: { points: 0, spc: 0 },
        other: { points: 0, spc: 0 },
        unknown: { points: 0, spc: 0 },
      };

      if (input.inventoryState === "empty") {
        return {
          outcome: "empty",
          totalCount: 0,
          pointsAwarded: 0,
          spaceContributionSpc: 0,
          spaceDeltaSpc: -10,
          acceptedCount: 0,
          lines: [],
        };
      }

      if (input.inventoryState === "unreadable") {
        return {
          outcome: "rejected",
          totalCount: null,
          pointsAwarded: 0,
          spaceContributionSpc: 50,
          spaceDeltaSpc: 0,
          acceptedCount: 0,
          lines: [],
        };
      }

      let totalPoints = 0;
      let totalSpc = 0;
      let acceptedCount = 0;
      const classCounts: Record<string, number> = {};

      for (const obj of input.objects) {
        if (obj.decision === "accept") {
          const rate = RATES[obj.resolvedClass] ?? { points: 0, spc: 0 };
          totalPoints += rate.points;
          totalSpc += rate.spc;
          acceptedCount++;
          classCounts[obj.resolvedClass] = (classCounts[obj.resolvedClass] ?? 0) + 1;
        }
      }

      const lines = Object.entries(classCounts).map(([cls, count]) => ({
        class: cls,
        lineId: `line-${cls}`,
        count,
        eligible: true,
        points: (RATES[cls]?.points ?? 0) * count,
        pointsPerItem: RATES[cls]?.points ?? 0,
        spaceSpc: (RATES[cls]?.spc ?? 0) * count,
        spacePerItem: RATES[cls]?.spc ?? 0,
      }));

      const outcome = acceptedCount > 0 ? "verified" : "rejected";

      return {
        outcome,
        totalCount: input.objects.length,
        pointsAwarded: totalPoints,
        spaceContributionSpc: totalSpc,
        spaceDeltaSpc: 0,
        acceptedCount,
        lines,
      };
    }
  }

  async resolveReview(input: ResolveReviewInput): Promise<VerificationDecisionResult> {
    try {
      await this.commandClient.execute("adminResolveReview", input as unknown as Record<string, unknown>);
    } catch {
      // Direct Firestore settlement fallback
      const nowIso = new Date().toISOString();
      const preview = await this.previewResolution({
        ticketId: input.ticketId,
        inventoryState: input.inventoryState,
        objects: [...input.objects],
      });

      const outcome = preview.outcome;
      const points = preview.pointsAwarded;
      const newVersion = input.expectedDecisionVersion + 1;

      // Update reviewTickets
      await updateDoc(doc(this.firestore, "reviewTickets", input.ticketId), {
        state: "resolved",
        finalOutcome: outcome,
        decisionVersion: newVersion,
        resolvedAt: serverTimestamp(),
        resolvedBy: "admin",
        explanation: input.explanation,
      }).catch(async () => {
        await setDoc(doc(this.firestore, "reviewTickets", input.ticketId), {
          state: "resolved",
          finalOutcome: outcome,
          decisionVersion: newVersion,
          resolvedAt: serverTimestamp(),
          resolvedBy: "admin",
          explanation: input.explanation,
        }, { merge: true });
      });

      // Update adminReviewViews
      await updateDoc(doc(this.firestore, "adminReviewViews", input.ticketId), {
        state: "resolved",
        outcome,
        decisionVersion: newVersion,
        resolvedAt: nowIso,
        reviewerAlias: "Admin",
      }).catch(async () => {
        await setDoc(doc(this.firestore, "adminReviewViews", input.ticketId), {
          state: "resolved",
          outcome,
          decisionVersion: newVersion,
          resolvedAt: nowIso,
          reviewerAlias: "Admin",
        }, { merge: true });
      });

      // Update deposits
      await updateDoc(doc(this.firestore, "deposits", input.ticketId), {
        status: outcome,
        pointsAwarded: points,
        decisionVersion: newVersion,
        updatedAt: serverTimestamp(),
      }).catch(() => {});

      // Invalidate cache
      await setDoc(doc(this.firestore, "adminReadVersions/reviews"), {
        topic: "reviews",
        version: Date.now(),
        updatedAt: serverTimestamp(),
      }, { merge: true }).catch(() => {});
    }

    const updated = await this.get(input.ticketId);

    return {
      detail: updated,
      wallet: {
        residentId: updated.resident.id,
        balance: updated.transaction.pointsAwarded ?? 0,
        nextRewardCost: null,
        updatedAt: updated.transaction.occurredAt,
        version: 1,
      },
    };
  }

  async decide(
    id: string,
    decision: "approve" | "reject",
    _idempotencyKey: string
  ): Promise<VerificationDecisionResult> {
    try {
      const reviewDetail = await this.getReviewDetail(id);

      const objects: ObjectResolutionDecisionInput[] = reviewDetail.findings.map((f) => ({
        objectId: f.objectId,
        resolvedClass: f.resolvedClass ?? f.detectedClass,
        decision: decision === "approve" ? "accept" : "exclude",
        note: decision === "approve" ? "Approved by operator" : "Excluded by operator",
      }));

      const input: ResolveReviewInput = {
        ticketId: id,
        expectedDecisionVersion: reviewDetail.review.decisionVersion,
        inventoryState: "resolved",
        objects,
        explanation: `${decision === "approve" ? "Approved" : "Rejected"} by administrator review.`,
      };

      return await this.resolveReview(input);
    } catch {
      return await this.fallbackVerificationRepo.decide(id, decision, _idempotencyKey);
    }
  }
}
