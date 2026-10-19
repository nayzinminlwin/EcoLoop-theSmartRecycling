[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectId,
    [Parameter(Mandatory = $true)]
    [string]$RuntimeServiceAccount,
    [Parameter(Mandatory = $true)]
    [string]$TaskInvokerServiceAccount,
    [Parameter(Mandatory = $true)]
    [string]$ArtifactBucket,
    [string]$RoboflowSecretName = "roboflow-api-key",
    [string]$GeminiSecretName = "gemini-api-key",
    [string]$Region = "asia-southeast1",
    [string]$ServiceName = "ecoloop-vision",
    [string]$QueueName = "vision-processing",
    [string]$VapidKey,
    [switch]$AppCheckConfigured,
    [switch]$SkipWeb,
    [switch]$SkipAndroid
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
Set-Location $repoRoot

function Require-Command([string]$Name) {
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "$Name is required."
    }
}

Require-Command "gcloud"
Require-Command "firebase"
Require-Command "flutter"
Require-Command "npm"

if ($ProjectId -notmatch '^[a-z][a-z0-9-]{4,28}[a-z0-9]$') {
    throw "ProjectId must be an explicit Google Cloud project ID."
}
if (-not $SkipWeb -and [string]::IsNullOrWhiteSpace($VapidKey)) {
    throw "VapidKey is required for Firebase-mode web deployment; do not use a debug key."
}
if (-not $AppCheckConfigured) {
    throw "Confirm production App Check is configured for the registered Android and web apps before deployment."
}

$envFile = Join-Path $repoRoot "functions\.env.$ProjectId"
if (-not (Test-Path $envFile)) {
    throw "Missing Functions environment contract: $envFile"
}
$envText = Get-Content $envFile -Raw
foreach ($name in @(
    "ECOLOOP_TASKS_REGION",
    "ECOLOOP_FIRESTORE_DATABASE",
    "ECOLOOP_TASKS_QUEUE",
    "ECOLOOP_WORKER_SERVICE_URL",
    "ECOLOOP_WORKER_AUDIENCE",
    "ECOLOOP_TASK_INVOKER_SERVICE_ACCOUNT"
)) {
    if ($envText -notmatch "(?m)^$name=.+$") {
        throw "Functions environment contract is missing $name."
    }
}

gcloud config set project $ProjectId --quiet | Out-Host
gcloud projects describe $ProjectId --format="value(projectId)" | Out-Host

& (Join-Path $repoRoot "tools\backend\deploy_vision.ps1") `
    -ProjectId $ProjectId `
    -Region $Region `
    -ServiceName $ServiceName `
    -RuntimeServiceAccount $RuntimeServiceAccount `
    -TaskInvokerServiceAccount $TaskInvokerServiceAccount `
    -RoboflowSecretName $RoboflowSecretName `
    -GeminiSecretName $GeminiSecretName `
    -ArtifactBucket $ArtifactBucket `
    -QueueName $QueueName
if ($LASTEXITCODE -ne 0) {
    throw "Vision deployment failed."
}

$workerUrl = (gcloud run services describe $ServiceName `
    --project=$ProjectId `
    --region=$Region `
    --format="value(status.url)").Trim()
if ($envText -notmatch "(?m)^ECOLOOP_WORKER_SERVICE_URL=$([regex]::Escape($workerUrl))$" -or
    $envText -notmatch "(?m)^ECOLOOP_WORKER_AUDIENCE=$([regex]::Escape($workerUrl))$") {
    throw "functions/.env.$ProjectId must contain the deployed worker URL as both URL and audience."
}

firebase deploy `
    --project $ProjectId `
    --only functions,firestore:rules,firestore:indexes,storage `
    --non-interactive
if ($LASTEXITCODE -ne 0) {
    throw "Firebase backend deployment failed."
}

if (-not $SkipWeb) {
    & (Join-Path $repoRoot "tools\backend\build_web_config.ps1") -VapidKey $VapidKey
    if ($LASTEXITCODE -ne 0) {
        throw "Firebase-mode web build failed."
    }
    firebase deploy --project $ProjectId --only hosting:resident --non-interactive
    if ($LASTEXITCODE -ne 0) {
        throw "Firebase Hosting deployment failed."
    }
}

if (-not $SkipAndroid) {
    flutter build apk --release --dart-define=ECOLOOP_FIREBASE_MODE=firebase
    if ($LASTEXITCODE -ne 0) {
        throw "Firebase-mode Android artifact build failed."
    }
}

Write-Output "PoC deployment completed for project '$ProjectId'."
Write-Output "App Check confirmation was explicitly supplied for Android Play Integrity and web reCAPTCHA Enterprise."
