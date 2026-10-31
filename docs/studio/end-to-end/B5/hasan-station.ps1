# B5 — Hasan's by-ear station for the Transcript tab (see HASAN-STEP.md next to this file).
# Starts THIS checkout's dev build (the Transcript tab is on in dev builds) on the isolated scratch profile
#   C:\Users\hasan\AppData\Local\vidtsx-e2e\profiles\B5-station\profile
# whose Studio root is the scratch M2 copy
#   C:\Users\hasan\AppData\Local\vidtsx-e2e\B5-station-root
# Never your own profile (%APPDATA%\VidTSX Studio) and never your projects. The raw DJI clips are read in place.
#
#   powershell -ExecutionPolicy Bypass -File docs\studio\end-to-end\B5\hasan-station.ps1
#   ... -Reset          put the station back at its start state (app must be closed; your current
#                       project.json is saved first under ...\vidtsx-e2e\B5\station-runs)
#   ... -CdpPort 9325   also open a DevTools port (automation only)
param(
  [switch]$Reset,
  [int]$CdpPort = 0
)
$ErrorActionPreference = 'Stop'

$Repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..\..')).Path
$E = 'C:\Users\hasan\AppData\Local\vidtsx-e2e'
$UserData = Join-Path $E 'profiles\B5-station\profile'
$Root = Join-Path $E 'B5-station-root'
$Project = Join-Path $Root 'projects\video-14-raw\project.json'
$Start = Join-Path $E 'B5\station-start\project.json'

foreach ($p in @($UserData, $Project, $Start, (Join-Path $Repo 'node_modules'))) {
  if (-not (Test-Path $p)) { Write-Host "Missing: $p" -ForegroundColor Red; exit 1 }
}
if (-not (Test-Path (Join-Path $Repo 'src\features\studio\services\autosave.ts'))) {
  Write-Host "This checkout has no B5 code (src\features\studio\services\autosave.ts). Run: git switch end-to-end-p0" -ForegroundColor Red
  exit 1
}
$running = @(Get-CimInstance Win32_Process -Filter "Name='electron.exe'" | Where-Object { $_.CommandLine -like "*$UserData*" })
if ($running.Count -gt 0) {
  Write-Host "The station is already open (electron pid $($running[0].ProcessId)). Use that window, or close it first." -ForegroundColor Yellow
  exit 1
}

Set-Location $Repo
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue

if ($Reset) {
  $runs = Join-Path $E 'B5\station-runs'
  New-Item -ItemType Directory -Force $runs | Out-Null
  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $backup = Join-Path $runs "project.$stamp.json"
  Copy-Item $Project $backup
  Write-Host "Saved the current project to $backup. Resetting the station..."
  Copy-Item $Start $Project -Force
  if ((Get-FileHash $Start).Hash -ne (Get-FileHash $Project).Hash) { Write-Host 'Reset failed: the project file did not match the start state.' -ForegroundColor Red; exit 1 }
  Write-Host 'Station reset: video-14-raw = the nine raw clips on V1 (/ 21:23.09), nothing deleted.' -ForegroundColor Green
  exit 0
}

$appArgs = @("--user-data-dir=$UserData")
if ($CdpPort -gt 0) { $appArgs += "--remote-debugging-port=$CdpPort" }
Write-Host "VidTSX Studio (dev build of $Repo) on the B5 station profile. First start takes about a minute."
Write-Host 'Close the window when you are done; this console then returns.'
& npx.cmd electron-vite dev -- @appArgs
