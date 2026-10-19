import { initialPolicy } from "../src/domain/policy.js";
import type { SeedRecord, SeedWrite } from "./seed_transport.js";

export interface ReferenceDocument extends SeedWrite {
  readonly immutableFields: readonly string[];
}

/** Educational/reference content, never an inference answer or activity fixture. */
export function referenceDocuments(): ReferenceDocument[] {
  const policy = initialPolicy();
  const document = (path: string, data: SeedRecord): ReferenceDocument => ({ path, data, immutableFields: Object.keys(data) });
  return [
    document(`guideContent/${policy.id}`, {
      id: policy.id,
      heroTitle: "Small steps, meaningful impact.",
      heroDescription: "EcoLoop accepts plastic bottles, aluminium cans, glass bottles, paper items and paper bags under the current shared policy.",
      toDo: ["Empty containers and rinse when appropriate.", "Keep paper items and paper bags clean and dry.", "Scan the registered QR, finish your deposit, choose one prepared image, then press Continue."],
      toAvoid: ["Cardboard is not eligible for EcoPoints under policy-v1.", "Do not include food-filled containers, hazardous waste or general rubbish.", "Generic metal or glass objects are not automatically eligible; uncertain batches go to admin review."],
      pointsDisclaimer: "EcoPoints use accepted verified item counts, not weight. Any displayed kilograms or bin occupancy are software estimates. Points are held while a batch awaits review.",
      rateExamples: [{ materialType: "plastic", itemCount: 2 }, { materialType: "aluminium", itemCount: 3 }, { materialType: "paper", itemCount: 1 }, { materialType: "glass", itemCount: 1 }],
      policyVersion: policy.id,
      acceptedObjectClasses: policy.acceptedObjectClasses,
    }),
    document(`guideMaterials/${policy.id}`, {
      id: policy.id,
      items: [
        { id: "plastic-bottles", type: "plastic", canonicalClass: "plastic_bottle", title: "Plastic bottles", preparationTip: "Empty and rinse; bags and utensils are not automatically accepted.", iconKey: "recycle", sortOrder: 1 },
        { id: "aluminium-cans", type: "aluminium", canonicalClass: "aluminium_can", title: "Aluminium cans", preparationTip: "Empty and rinse; a generic metal can needs subtype verification.", iconKey: "recycle", sortOrder: 2 },
        { id: "glass-bottles", type: "glass", canonicalClass: "glass_bottle", title: "Glass bottles", preparationTip: "Empty and rinse; shards and unrelated glass objects are excluded.", iconKey: "recycle", sortOrder: 3 },
        { id: "paper-items", type: "paper", canonicalClass: "paper_item", title: "Paper items", preparationTip: "Keep clean and dry. Cardboard is excluded from EcoPoints.", iconKey: "book", sortOrder: 4 },
        { id: "paper-bags", type: "paper", canonicalClass: "paper_bag", title: "Paper bags", preparationTip: "Keep clean and dry; remove non-paper contents.", iconKey: "shopping-bag", sortOrder: 5 },
      ],
    }),
    document(`guideSteps/${policy.id}`, {
      id: policy.id,
      items: [
        { id: "scan", order: 1, instruction: "Scan the recycling bin's registered QR code." },
        { id: "confirm", order: 2, instruction: "Check the bin and confirm your recycling session." },
        { id: "finish", order: 3, instruction: "Finish depositing and report that you pressed Finish." },
        { id: "select", order: 4, instruction: "Select one prepared batch image; Continue submits it for real inference." },
        { id: "result", order: 5, instruction: "Receive a verified receipt or a pending-admin-review result." },
        { id: "redeem", order: 6, instruction: "Use earned EcoPoints to redeem and simulate use of a demo voucher." },
      ],
    }),
    document("scanContent/default", {
      id: "default", scannerTitle: "Scan a smart bin", scannerDescription: "Position the registered EcoLoop QR code inside the camera frame.",
      binFoundTitle: "Smart bin found", readyTitle: "Ready to recycle?", readyDescription: "Deposit your items, then report that you pressed Finish.",
      itemDetectedTitle: "Choose your batch image", itemDetectedDescription: "Choose exactly one prepared image. Processing begins only when you press Continue.",
      processingTitle: "Identifying your items", processingDescription: "The backend is analysing the selected image with hosted vision services.",
      verifiedTitle: "Deposit verified", reviewTitle: "Deposit sent for review", rejectedTitle: "Deposit not eligible",
      pointsTimingNotice: "Verified accepted items earn points once. Uncertain batches hold all points for admin review.",
    }),
    document("processingConfigurations/demo-vision-v1", {
      id: "demo-vision-v1", implementationState: "reference_configuration_not_yet_deployed", schemaVersion: "backend.v1",
      modelRegistryIds: ["roboflow-a-v6", "roboflow-b-v1", "roboflow-d-v2", "gemini-3-8-flash"],
      detectorProposalFloor: 0.2, detectorAcceptanceThresholds: { A: 0.85, B: 0.85 }, geminiMinimumReturnedConfidence: 0.9,
      confidenceCalibration: "unmeasured_conservative_demo_settings", lowConfidenceAction: "gemini", unresolvedGeminiAction: "whole_batch_review",
      maxObjects: 12, maxSpecialistCrops: 4, maxGeminiCrops: 4, maxFullImageCalls: 2,
      maxExecutionAttempts: 3, processingDeadlineSeconds: 300, reservationExpirySeconds: 600,
      workerLeaseSeconds: 90, leaseRenewalSeconds: 30, maxImageBytes: 10485760,
      permittedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    }),
    ...[
      { id: "roboflow-a-v6", provider: "roboflow", modelId: "waste-detection-0momv/6", kind: "object-detector" },
      { id: "roboflow-b-v1", provider: "roboflow", modelId: "yolo-waste-detection/1", kind: "object-detector" },
      { id: "roboflow-d-v2", provider: "roboflow", modelId: "waste-classification-rjo28/2", kind: "multi-label-classifier" },
      { id: "gemini-3-8-flash", provider: "google-ai-studio", modelId: "gemini-3.8-flash", kind: "structured-visual-fallback" },
    ].map((model) => document(`modelRegistry/${model.id}`, {
      ...model, executionMode: "hosted-api", weightsInContainer: false,
      registryVersion: "demo-registry-v1", validationStatus: "historical_access_smoke_only_no_accuracy_claim",
    })),
  ];
}
