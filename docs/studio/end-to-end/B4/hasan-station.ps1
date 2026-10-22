# B4 — Hasan's learning station (see HASAN-STEP.md next to this file).
# Starts THIS checkout's dev build on the isolated scratch profile
#   C:\Users\hasan\AppData\Local\vidtsx-e2e\profiles\B1-verify\profile
# whose Studio root is the scratch M2 copy
#   C:\Users\hasan\AppData\Local\vidtsx-e2e\B1-verify-root
# Never your own profile (%APPDATA%\VidTSX Studio) and never your projects.
#
#   powershell -ExecutionPolicy Bypass -File docs\studio\end-to-end\B4\hasan-station.ps1
#   ... -Reset          put the station back at its start state (app must be closed; your last
#                       project.json + preset.json are saved first under ...\vidtsx-e2e\B4\station-runs)
#   ... -CdpPort 9311   also open a DevTools port (automation only)
param(
  [switch]$Reset,
  [int]$CdpPort = 0
)
$ErrorActionPreference = 'Stop'

$Repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..\..')).Path
$E = 'C:\Users\hasan\AppData\Local\vidtsx-e2e'
$UserData = Join-Path $E 'profiles\B1-verify\profile'
$Root = Join-Path $E 'B1-verify-root'
$Project = Join-Path $Root 'projects\video-14-raw\project.json'
$Preset = Join-Path $UserData 'assets\presets\b4-start-old-tight\preset.json'
$Kit = Join-Path $Repo '.vidtsx-temp\end-to-end\B4'

foreach ($p in @($UserData, $Project, (Join-Path $Repo 'node_modules'))) {
  if (-not (Test-Path $p)) { Write-Host "Missing: $p" -ForegroundColor Red; exit 1 }
}
if (-not (Test-Path (Join-Path $Repo 'src\shared\studio\cut-learn.ts'))) {
  Write-Host "This checkout has no B4 code (src\shared\studio\cut-learn.ts). Run: git switch end-to-end-p0" -ForegroundColor Red
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
  $runs = Join-Path $E 'B4\station-runs'
  New-Item -ItemType Directory -Force $runs | Out-Null
  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  Copy-Item $Project (Join-Path $runs "project.$stamp.json")
  if (Test-Path $Preset) { Copy-Item $Preset (Join-Path $runs "preset.$stamp.json") }
  Write-Host "Saved the current project + preset to $runs (*.$stamp.json). Resetting the station..."
  $env:B4_STATION = '1'
  & npx.cmd vitest run --config .vidtsx-temp/end-to-end/B4/vitest.b4.config.ts station
  if ($LASTEXITCODE -ne 0) { Write-Host 'Reset failed (see above).' -ForegroundColor Red; exit 1 }
  Write-Host 'Station reset: 36 untagged clips on V1, preset "B4 start - old tight", no pending card.' -ForegroundColor Green
  exit 0
}

$appArgs = @("--user-data-dir=$UserData")
if ($CdpPort -gt 0) { $appArgs += "--remote-debugging-port=$CdpPort" }
Write-Host "VidTSX Studio (dev build of $Repo) on the B4 station profile. First start takes about a minute."
Write-Host 'Close the window when you are done; this console then returns.'
& npx.cmd electron-vite dev -- @appArgs
