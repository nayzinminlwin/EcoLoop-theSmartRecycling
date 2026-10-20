[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$RuntimeServiceAccount,
    [Parameter(Mandatory = $true)]
    [string]$RoboflowSecretName,
    [Parameter(Mandatory = $true)]
    [string]$GeminiSecretName,
    [string]$ProjectId = "ecoloop-thesmartrecycling",
    [string]$Region = "asia-southeast1",
    [string]$ServiceName = "ecoloop-vision",
    [Parameter(Mandatory = $true)]
    [string]$TaskInvokerServiceAccount,
    [Parameter(Mandatory = $true)]
    [string]$ArtifactBucket,
    [Parameter(Mandatory = $true)]
    [string]$WorkerGatewayUrl,
    [Parameter(Mandatory = $true)]
    [string]$WorkerGatewayAudience,
    [string]$SourceBucket = "ecoloop-thesmartrecycling.firebasestorage.app",
    [string]$QueueName = "vision-processing"
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
Set-Location $repoRoot

if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
    throw "gcloud is required"
}

if ($ProjectId -notmatch '^[a-z][a-z0-9-]{4,28}[a-z0-9]$') {
    throw "ProjectId must be an explicit Google Cloud project ID."
}

gcloud config set project $ProjectId --quiet | Out-Host
gcloud artifacts repositories describe ecoloop --location=$Region --project=$ProjectId *> $null
if ($LASTEXITCODE -ne 0) {
    throw "Artifact Registry repository 'ecoloop' is missing in $Region; create it explicitly before deploying."
}

foreach ($secret in @($RoboflowSecretName, $GeminiSecretName)) {
    gcloud secrets describe $secret --project=$ProjectId *> $null
    if ($LASTEXITCODE -ne 0) {
        throw "Secret '$secret' is missing in project '$ProjectId'."
    }
}

$bucket = $ArtifactBucket.Trim()
if ($bucket -eq "" -or $bucket -match '[^a-z0-9._-]') {
    throw "ArtifactBucket must be an existing Cloud Storage bucket name."
}
gcloud storage buckets describe "gs://$bucket" --project=$ProjectId *> $null
if ($LASTEXITCODE -ne 0) {
    throw "Artifact bucket '$bucket' is missing in project '$ProjectId'."
}
gcloud storage buckets add-iam-policy-binding "gs://$bucket" `
    --member="serviceAccount:$RuntimeServiceAccount" `
    --role=roles/storage.objectAdmin `
    --project=$ProjectId `
    --quiet | Out-Host
if ($LASTEXITCODE -ne 0) {
    throw "Could not grant the vision runtime artifact permission."
}

$shortSha = (git rev-parse --short=12 HEAD).Trim()
$image = "$Region-docker.pkg.dev/$ProjectId/ecoloop/vision:$shortSha"

gcloud builds submit `
    --project=$ProjectId `
    --config=infra/cloudbuild.vision.yaml `
    --substitutions="_IMAGE=$image" `
    --ignore-file=infra/vision.gcloudignore `
    .
if ($LASTEXITCODE -ne 0) {
    throw "Cloud Build failed."
}

$digest = (gcloud artifacts docker images describe $image `
    --project=$ProjectId `
    --format="value(image_summary.digest)").Trim()
if ($digest -notmatch '^sha256:[a-f0-9]{64}$') {
    throw "Cloud Build did not produce a verifiable image digest."
}
$imageByDigest = "$Region-docker.pkg.dev/$ProjectId/ecoloop/vision@$digest"

gcloud run deploy $ServiceName `
    --project=$ProjectId `
    --region=$Region `
    --image=$imageByDigest `
    --service-account=$RuntimeServiceAccount `
    --ingress=internal-and-cloud-load-balancing `
    --no-allow-unauthenticated `
    --concurrency=1 `
    --cpu=2 `
    --memory=4Gi `
    --min=0 `
    --max=1 `
    --timeout=300s `
    --set-secrets="ROBOFLOW_API_KEY=${RoboflowSecretName}:latest,GEMINI_API_KEY=${GeminiSecretName}:latest" `
    --set-env-vars="ECOLOOP_GEMINI_MODEL=gemini-3.8-flash,ECOLOOP_SOURCE_BUCKET=$SourceBucket,ECOLOOP_ARTIFACT_BUCKET=$bucket,ECOLOOP_WORKER_GATEWAY_URL=$WorkerGatewayUrl,ECOLOOP_WORKER_AUDIENCE=$WorkerGatewayAudience" `
    --no-cpu-throttling `
    --quiet
if ($LASTEXITCODE -ne 0) {
    throw "Cloud Run deployment failed."
}

gcloud run services add-iam-policy-binding $ServiceName `
    --project=$ProjectId `
    --region=$Region `
    --member="serviceAccount:$TaskInvokerServiceAccount" `
    --role="roles/run.invoker"
if ($LASTEXITCODE -ne 0) {
    throw "Cloud Tasks invoker grant failed."
}

$queuePath = "projects/$ProjectId/locations/$Region/queues/$QueueName"
gcloud tasks queues describe $queuePath --project=$ProjectId *> $null
if ($LASTEXITCODE -ne 0) {
    gcloud tasks queues create $queuePath `
        --project=$ProjectId `
        --location=$Region `
        --max-concurrent-dispatches=1 `
        --max-attempts=3 `
        --max-retry-duration=300s `
        --min-backoff=5s `
        --max-backoff=30s
} else {
    gcloud tasks queues update $queuePath `
        --project=$ProjectId `
        --max-concurrent-dispatches=1 `
        --max-attempts=3 `
        --max-retry-duration=300s `
        --min-backoff=5s `
        --max-backoff=30s
}
if ($LASTEXITCODE -ne 0) {
    throw "Cloud Tasks queue configuration failed."
}

$deployedImage = (gcloud run services describe $ServiceName `
    --project=$ProjectId `
    --region=$Region `
    --format="value(spec.template.spec.containers[0].image)").Trim()
if ($deployedImage -ne $imageByDigest) {
    throw "Cloud Run is not serving the expected immutable image '$imageByDigest'."
}

$serviceUrl = (gcloud run services describe $ServiceName `
    --project=$ProjectId `
    --region=$Region `
    --format="value(status.url)").Trim()
if ($serviceUrl -notmatch '^https://') {
    throw "Cloud Run did not return a valid service URL."
}

Write-Output "Deployed private service '$ServiceName'."
Write-Output "Vision image digest: $imageByDigest"
Write-Output "Vision service URL: $serviceUrl"
