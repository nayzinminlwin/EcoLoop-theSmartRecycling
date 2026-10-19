import { describe, expect, it } from "vitest";
import { createTaskRequest, type DispatchConfig } from "../../src/infrastructure/cloud_tasks.js";

const config: DispatchConfig = {
  projectId: "demo-ecoloop",
  region: "asia-southeast1",
  queueName: "vision-processing",
  workerServiceUrl: "https://vision-abc-uc.a.run.app",
  taskInvokerServiceAccount: "tasks@demo-ecoloop.iam.gserviceaccount.com",
  audience: "https://vision-abc-uc.a.run.app",
  dispatchDeadlineSeconds: 30,
};

describe("Cloud Tasks dispatch contract", () => {
  it("builds an authenticated task with the committed job identity and configured audience", () => {
    const request = createTaskRequest(
      config,
      "projects/demo-ecoloop/locations/asia-southeast1/queues/vision-processing",
      "projects/demo-ecoloop/locations/asia-southeast1/queues/vision-processing/tasks/job-123",
      { id: "job-123", traceId: "trace-123" },
    );
    expect(request.task?.name).toContain("/tasks/job-123");
    expect(request.task?.httpRequest).toMatchObject({
      url: config.workerServiceUrl,
      httpMethod: "POST",
      oidcToken: {
        serviceAccountEmail: config.taskInvokerServiceAccount,
        audience: config.audience,
      },
    });
    const body = JSON.parse(Buffer.from(String(request.task?.httpRequest?.body), "base64").toString("utf8"));
    expect(body).toEqual({
      schemaVersion: "backend.v1",
      operation: "processJob",
      jobId: "job-123",
      traceId: "trace-123",
    });
  });
});
