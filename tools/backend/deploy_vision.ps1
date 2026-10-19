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
    [string]$QueueName = "vision-processing"
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
Set-Location $repoRoot

if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
    throw "gcloud is required"
}

gcloud config set project $ProjectId | Out-Host
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

gcloud run deploy $ServiceName `
    --project=$ProjectId `
    --region=$Region `
    --image=$image `
    --service-account=$RuntimeServiceAccount `
    --no-allow-unauthenticated `
    --concurrency=1 `
    --cpu=2 `
    --memory=4Gi `
    --min=0 `
    --max=1 `
    --timeout=300s `
    --set-secrets="ROBOFLOW_API_KEY=${RoboflowSecretName}:latest,GEMINI_API_KEY=${GeminiSecretName}:latest" `
    --set-env-vars="ECOLOOP_GEMINI_MODEL=gemini-3.8-flash"
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

Write-Output "Deployed private service '$ServiceName' with image '$image'."
