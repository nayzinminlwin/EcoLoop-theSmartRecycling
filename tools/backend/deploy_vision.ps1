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
    [string]$ServiceName = "ecoloop-vision"
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

Write-Output "Deployed private service '$ServiceName' with image '$image'."
