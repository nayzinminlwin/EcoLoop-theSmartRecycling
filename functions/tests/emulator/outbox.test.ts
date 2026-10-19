import { deleteApp, initializeApp } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { CloudTasksDispatcher, type CloudTasksApi, type DispatchConfig } from "../../src/infrastructure/cloud_tasks.js";

const jobId = "job-outbox-test";
const now = "2026-10-19T03:00:00.000Z";
const config: DispatchConfig = {
  projectId: "demo-ecoloop",
  region: "asia-southeast1",
  queueName: "vision-processing",
  workerServiceUrl: "https://vision-abc-uc.a.run.app",
  taskInvokerServiceAccount: "tasks@demo-ecoloop.iam.gserviceaccount.com",
  audience: "https://vision-abc-uc.a.run.app",
  dispatchDeadlineSeconds: 30,
};

class FakeTasks implements CloudTasksApi {
  readonly requests: unknown[] = [];
  duplicate = false;
  fail = false;

  queuePath(project: string, location: string, queue: string): string {
    return `projects/${project}/locations/${location}/queues/${queue}`;
  }

  async createTask(request: unknown): Promise<[{}]> {
    this.requests.push(request);
    if (this.fail) throw new Error("tasks unavailable");
    if (this.duplicate) throw Object.assign(new Error("already exists"), { code: 6 });
    return [{}];
  }
}

let firestore: Firestore;
let app: ReturnType<typeof initializeApp>;

beforeAll(() => {
  app = initializeApp({ projectId: "demo-ecoloop" }, `outbox-${Date.now()}`);
  firestore = getFirestore(app);
});

beforeEach(async () => {
  await firestore.recursiveDelete(firestore.collection("inferenceJobs"));
  await firestore.doc(`inferenceJobs/${jobId}`).set({
    id: jobId,
    state: "queued",
    dispatchState: "pending",
    deadlineAt: "2026-10-19T03:05:00.000Z",
    traceId: "trace-outbox-test",
  });
});

afterAll(async () => {
  await deleteApp(app);
});

describe("durable dispatch outbox", () => {
  it("dispatches a pending job once with deterministic task identity", async () => {
    const tasks = new FakeTasks();
    const dispatcher = new CloudTasksDispatcher(firestore, config, tasks);
    const first = await dispatcher.dispatchJob(jobId, now);
    const second = await dispatcher.dispatchJob(jobId, now);

    expect(first.state).toBe("dispatched");
    expect(second.state).toBe("already_dispatched");
    expect(tasks.requests).toHaveLength(1);
    expect((await firestore.doc(`inferenceJobs/${jobId}`).get()).data()).toMatchObject({
      dispatchState: "dispatched",
      dispatchAttempts: 1,
      taskName: first.taskName,
    });
  });

  it("recovers an enqueue-success/metadata-loss retry through duplicate task creation", async () => {
    const tasks = new FakeTasks();
    const dispatcher = new CloudTasksDispatcher(firestore, config, tasks);
    await dispatcher.dispatchJob(jobId, now);
    await firestore.doc(`inferenceJobs/${jobId}`).update({ dispatchState: "pending", taskName: null });
    tasks.duplicate = true;

    const recovered = await dispatcher.dispatchJob(jobId, now);

    expect(recovered.state).toBe("recovered");
    expect(tasks.requests).toHaveLength(2);
    expect((await firestore.doc(`inferenceJobs/${jobId}`).get()).data()).toMatchObject({
      dispatchState: "dispatched",
      taskName: recovered.taskName,
    });
  });

  it("leaves the committed intent pending when Cloud Tasks is unavailable", async () => {
    const tasks = new FakeTasks();
    tasks.fail = true;
    const dispatcher = new CloudTasksDispatcher(firestore, config, tasks);

    await expect(dispatcher.dispatchJob(jobId, now)).rejects.toThrow("tasks unavailable");
    expect((await firestore.doc(`inferenceJobs/${jobId}`).get()).data()?.dispatchState).toBe("pending");
  });
});
