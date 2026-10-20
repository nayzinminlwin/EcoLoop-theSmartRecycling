import { createHash } from "node:crypto";
import { CloudTasksClient, type protos } from "@google-cloud/tasks";
import type { DocumentData, Firestore } from "firebase-admin/firestore";
import { DomainError } from "../domain/errors.js";
import type { Instant } from "../domain/types.js";

type CreateTaskRequest = protos.google.cloud.tasks.v2.ICreateTaskRequest;
type Task = protos.google.cloud.tasks.v2.ITask;

export interface CloudTasksApi {
  queuePath(project: string, location: string, queue: string): string;
  createTask(request: CreateTaskRequest): Promise<[Task, ...unknown[]]>;
}

export interface DispatchConfig {
  readonly projectId: string;
  readonly region: string;
  readonly queueName: string;
  readonly workerServiceUrl: string;
  readonly taskInvokerServiceAccount: string;
  readonly audience: string;
  readonly dispatchDeadlineSeconds: number;
}

export interface DispatchResult {
  readonly jobId: string;
  readonly taskName: string;
  readonly state: "dispatched" | "recovered" | "already_dispatched";
}

export interface Dispatcher {
  dispatchJob(jobId: string, now: Instant): Promise<DispatchResult>;
  reconcilePending(now: Instant, limit?: number): Promise<DispatchResult[]>;
}

export class CloudTasksDispatcher implements Dispatcher {
  private readonly tasks: CloudTasksApi;

  constructor(
    private readonly firestore: Firestore,
    private readonly config: DispatchConfig,
    tasks: CloudTasksApi = new CloudTasksClient(),
  ) {
    this.tasks = tasks;
  }

  async dispatchJob(jobId: string, now: Instant): Promise<DispatchResult> {
    const jobRef = this.firestore.doc(`inferenceJobs/${jobId}`);
    const snapshot = await jobRef.get();
    if (!snapshot.exists) throw new DomainError("invalid_input", `Job ${jobId} does not exist`);
    const job = snapshot.data() ?? {};
    if (job.dispatchState === "dispatched") {
      return {
        jobId,
        taskName: String(job.taskName ?? this.taskName(jobId)),
        state: "already_dispatched",
      };
    }
    if (job.dispatchState !== "pending") {
      throw new DomainError("invalid_transition", `Job ${jobId} is not pending dispatch`);
    }
    if (typeof job.deadlineAt !== "string" || Date.parse(job.deadlineAt) <= Date.parse(now)) {
      await jobRef.update({
        dispatchState: "expired",
        dispatchFailure: "processing_deadline_elapsed",
        updatedAt: now,
      });
      throw new DomainError("session_expired", `Job ${jobId} is past its processing deadline`);
    }

    const taskName = this.taskName(jobId);
    const request = createTaskRequest(this.config, this.tasks.queuePath(
      this.config.projectId,
      this.config.region,
      this.config.queueName,
    ), taskName, job);
    let state: DispatchResult["state"] = "dispatched";
    try {
      await this.tasks.createTask(request);
    } catch (error) {
      if (!isAlreadyExists(error)) throw error;
      state = "recovered";
    }

    await this.firestore.runTransaction(async (transaction) => {
      const current = await transaction.get(jobRef);
      if (!current.exists) throw new DomainError("invalid_input", `Job ${jobId} does not exist`);
      const currentData = current.data() ?? {};
      if (currentData.dispatchState === "dispatched") return;
      if (currentData.dispatchState !== "pending") {
        throw new DomainError("invalid_transition", `Job ${jobId} is no longer pending dispatch`);
      }
      transaction.update(jobRef, {
        dispatchState: "dispatched",
        taskName,
        dispatchedAt: now,
        dispatchAttempts: Number(currentData.dispatchAttempts ?? 0) + 1,
        updatedAt: now,
      });
    });
    return { jobId, taskName, state };
  }

  async reconcilePending(now: Instant, limit = 25): Promise<DispatchResult[]> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new DomainError("invalid_input", "Dispatch reconciliation limit must be between 1 and 100");
    }
    const snapshot = await this.firestore.collection("inferenceJobs")
      .where("dispatchState", "==", "pending")
      .limit(limit)
      .get();
    const results: DispatchResult[] = [];
    for (const document of snapshot.docs) {
      try {
        results.push(await this.dispatchJob(document.id, now));
      } catch (error) {
        if (error instanceof DomainError && error.code === "session_expired") continue;
        throw error;
      }
    }
    return results;
  }

  private taskName(jobId: string): string {
    const queuePath = this.tasks.queuePath(this.config.projectId, this.config.region, this.config.queueName);
    return `${queuePath}/tasks/job-${hash(jobId)}`;
  }
}

export function createDispatchConfig(environment: NodeJS.ProcessEnv = process.env): DispatchConfig {
  const projectId = environment.GCLOUD_PROJECT ?? environment.GCP_PROJECT ?? "ecoloop-thesmartrecycling";
  const workerServiceUrl = requiredEnvironment(environment, "ECOLOOP_WORKER_SERVICE_URL");
  const taskInvokerServiceAccount = requiredEnvironment(environment, "ECOLOOP_TASK_INVOKER_SERVICE_ACCOUNT");
  const audience = environment.ECOLOOP_WORKER_AUDIENCE ?? workerServiceUrl;
  return {
    projectId,
    region: environment.ECOLOOP_TASKS_REGION ?? "asia-southeast1",
    queueName: environment.ECOLOOP_TASKS_QUEUE ?? "vision-processing",
    workerServiceUrl,
    taskInvokerServiceAccount,
    audience,
    dispatchDeadlineSeconds: 30,
  };
}

export function createTaskRequest(
  config: DispatchConfig,
  parent: string,
  taskName: string,
  job: DocumentData,
): CreateTaskRequest {
  const body = JSON.stringify({
    schemaVersion: "backend.v1",
    operation: "processJob",
    jobId: String(job.id),
    traceId: String(job.traceId),
  });
  return {
    parent,
    task: {
      name: taskName,
      httpRequest: {
        httpMethod: "POST",
        url: config.workerServiceUrl,
        headers: { "Content-Type": "application/json" },
        body: Buffer.from(body).toString("base64"),
        oidcToken: {
          serviceAccountEmail: config.taskInvokerServiceAccount,
          audience: config.audience,
        },
      },
      dispatchDeadline: { seconds: config.dispatchDeadlineSeconds },
    },
  };
}

function requiredEnvironment(environment: NodeJS.ProcessEnv, name: string): string {
  const value = environment[name]?.trim();
  if (value === undefined || value === "") {
    throw new DomainError("processing_unavailable", `${name} must be configured for dispatch`);
  }
  return value;
}

function isAlreadyExists(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const value = error as { code?: unknown; status?: unknown };
  return value.code === 6 || value.code === "ALREADY_EXISTS" || value.status === 409;
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}
