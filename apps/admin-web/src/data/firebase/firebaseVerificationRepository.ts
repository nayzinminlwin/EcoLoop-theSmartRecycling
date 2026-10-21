// =============================================================================
// firebaseVerificationRepository.ts — Firebase-backed VerificationRepository
// Phase AB-07 — Evidence-backed review resolution and shared settlement
// =============================================================================

import { httpsCallable, type Functions } from "firebase/functions";
import {
  doc,
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

      // Convert items to VerificationDetail
      const items: VerificationDetail[] = decoded.items.map((r) => {
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
            captureImageUrl: null,
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
      });

      return {
        items,
        total: decoded.total,
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

        this.list(query)
          .then((page) => {
            if (!isCancelled) observer.next(page);
          })
          .catch((err) => {
            if (!isCancelled) observer.error(toFailure(err));
          });

        const unsubscribeRevision = onSnapshot(
          doc(this.firestore, "adminReadVersions/reviews"),
          () => {
            if (!isCancelled) {
              this.list(query)
                .then((page) => {
                  if (!isCancelled) observer.next(page);
                })
                .catch((err) => {
                  if (!isCancelled) observer.error(toFailure(err));
                });
            }
          },
          (error) => {
            if (!isCancelled) observer.error(toFailure(error));
          }
        );

        return () => {
          isCancelled = true;
          unsubscribeRevision();
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

        this.get(id)
          .then((detail) => {
            if (!isCancelled) observer.next(detail);
          })
          .catch((err) => {
            if (!isCancelled) observer.error(toFailure(err));
          });

        const unsubscribeDoc = onSnapshot(
          doc(this.firestore, `reviewTickets/${id}`),
          () => {
            if (!isCancelled) {
              this.get(id)
                .then((detail) => {
                  if (!isCancelled) observer.next(detail);
                })
                .catch((err) => {
                  if (!isCancelled) observer.error(toFailure(err));
                });
            }
          },
          (error) => {
            if (!isCancelled) observer.error(toFailure(error));
          }
        );

        return () => {
          isCancelled = true;
          unsubscribeDoc();
        };
      },
    };
  }

  async getReviewDetail(ticketId: string): Promise<AdminReviewDetailView> {
    const callable = httpsCallable<{ ticketId: string }, unknown>(
      this.functions,
      "getAdminReview"
    );
    const res = await callable({ ticketId });
    return decodeAdminReviewDetailView(res.data);
  }

  watchReviewDetail(ticketId: string): Observable<AdminReviewDetailView | null> {
    return {
      subscribe: (observer: Observer<AdminReviewDetailView | null>): Unsubscribe => {
        let isCancelled = false;

        this.getReviewDetail(ticketId)
          .then((detail) => {
            if (!isCancelled) observer.next(detail);
          })
          .catch((err) => {
            if (!isCancelled) observer.error(toFailure(err));
          });

        const unsubscribeDoc = onSnapshot(
          doc(this.firestore, `reviewTickets/${ticketId}`),
          () => {
            if (!isCancelled) {
              this.getReviewDetail(ticketId)
                .then((detail) => {
                  if (!isCancelled) observer.next(detail);
                })
                .catch((err) => {
                  if (!isCancelled) observer.error(toFailure(err));
                });
            }
          },
          (error) => {
            if (!isCancelled) observer.error(toFailure(error));
          }
        );

        return () => {
          isCancelled = true;
          unsubscribeDoc();
        };
      },
    };
  }

  async previewResolution(input: {
    ticketId: string;
    inventoryState: "resolved" | "empty" | "unreadable" | "uncertain";
    objects: ObjectResolutionDecisionInput[];
  }): Promise<ReviewResolutionPreview> {
    const callable = httpsCallable<typeof input, ReviewResolutionPreview>(
      this.functions,
      "previewAdminReviewResolution"
    );
    const res = await callable(input);
    return res.data;
  }

  async resolveReview(input: ResolveReviewInput): Promise<VerificationDecisionResult> {
    await this.commandClient.execute("adminResolveReview", input as unknown as Record<string, unknown>);
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
      // Fetch ticket to get current decision version and findings
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
