param(
  [Parameter(Mandatory = $true)]
  [string]$VapidKey,
  [string]$BaseHref = "/"
)

if ($VapidKey -notmatch '^[A-Za-z0-9_-]{20,}$') {
  throw "VapidKey must be a non-empty public Web Push key."
}

$env:ECOLOOP_WEB_VAPID_KEY = $VapidKey
flutter build web --release --base-href $BaseHref `
  --dart-define=ECOLOOP_FIREBASE_MODE=firebase `
  --dart-define=ECOLOOP_WEB_VAPID_KEY=$VapidKey
