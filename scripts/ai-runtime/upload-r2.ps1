<#
.SYNOPSIS
  Upload one runtime version (both variants) to the Cloudflare R2 bucket with rclone.

.DESCRIPTION
  Uploads <version>-<variant>.zip plus its .sha256 and .manifest.json sidecars to
  r2:<bucket>/<prefix>/ and prints the public URLs + a block to paste into the plan's §10 log.
  R2 is reached over its S3 API; rclone does multipart uploads, so the 2.6 GB cu126 zip is fine
  (wrangler's `r2 object put` caps single objects around 300 MB and is NOT an option for it).

  Credentials come from the repo's git-ignored .env (never from the repo, never from the app):
    R2_ACCOUNT_ID             -> endpoint https://<id>.r2.cloudflarestorage.com
    R2_BUCKET_NAME            -> default -Bucket
    R2_ACCESS_KEY_ID_RW / R2_SECRET_ACCESS_KEY_RW   read-write key used for the upload
    R2_ACCESS_KEY_ID_R  / R2_SECRET_ACCESS_KEY_R    read-only key, used only for the post-upload
                                                    listing check (-CheckReadOnly)
  They are handed to rclone as RCLONE_CONFIG_R2_* environment variables for this process only,
  so no rclone config file with secrets is written anywhere.

  rclone: uses `rclone` on PATH if present, else a portable copy under
  %LOCALAPPDATA%\vidtsx-tools\rclone\rclone.exe, which it downloads from downloads.rclone.org
  on first use (-NoDownload to refuse).

  The bucket needs public access (a custom domain, or the r2.dev public URL) so the app can
  download without credentials; pass it as -BaseUrl (or $env:VIDTSX_R2_PUBLIC_BASE). The read-only
  key is NOT for the app: CLAUDE.md forbids shipping any credential in the bundle.

.EXAMPLE
  powershell -File scripts\ai-runtime\upload-r2.ps1 -Version 2026.09.1
  powershell -File scripts\ai-runtime\upload-r2.ps1 -Version 2026.09.1 -BaseUrl https://cdn.vidtsx.com -CheckReadOnly
  powershell -File scripts\ai-runtime\upload-r2.ps1 -Version 2026.09.1 -Variants cpu -DryRun
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^\d{4}\.\d{2}\.\d+$')]
  [string]$Version,

  [ValidateSet('cu126', 'cpu')]
  [string[]]$Variants = @('cpu', 'cu126'),

  # Folder holding the zips (build-stack.ps1's -OutDir).
  [string]$ZipDir,

  # Bucket (default: R2_BUCKET_NAME from .env) and key prefix inside it.
  [string]$Bucket,
  [string]$Prefix = 'ai-runtime',

  # Public base URL of the bucket (default https://cdn.vidtsx.com), for the printed URLs and the HEAD check.
  [string]$BaseUrl,

  # Path to .env (default <repo>\.env) and to rclone.exe (default: PATH, then the portable copy).
  [string]$EnvFile,
  [string]$RcloneExe,
  [switch]$NoDownload,

  # After uploading, list the objects again with the READ-ONLY key and confirm it cannot write.
  [switch]$CheckReadOnly,

  # Skip the copy step (objects already uploaded); still verifies remote sizes and public URLs.
  [switch]$SkipUpload,

  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$repo = (Resolve-Path (Join-Path $here '..\..')).Path
if (-not $ZipDir) { $ZipDir = Join-Path $repo '.vidtsx-temp\ai-runtime' }
if (-not $EnvFile) { $EnvFile = Join-Path $repo '.env' }
if (-not $BaseUrl) { if ($env:VIDTSX_R2_PUBLIC_BASE) { $BaseUrl = $env:VIDTSX_R2_PUBLIC_BASE } else { $BaseUrl = 'https://cdn.vidtsx.com' } }
$BaseUrl = $BaseUrl.TrimEnd('/')

function Fail([string]$msg) { throw "upload-r2: $msg" }

# ---- .env ------------------------------------------------------------------------------------
function Read-DotEnv([string]$path) {
  $map = @{}
  if (-not (Test-Path -LiteralPath $path)) { Fail ".env not found at $path" }
  foreach ($line in Get-Content -LiteralPath $path) {
    $t = $line.Trim()
    if (-not $t -or $t.StartsWith('#')) { continue }
    $eq = $t.IndexOf('=')
    if ($eq -lt 1) { continue }
    $k = $t.Substring(0, $eq).Trim()
    $v = $t.Substring($eq + 1).Trim()
    if ($v.Length -ge 2 -and (($v[0] -eq '"' -and $v[-1] -eq '"') -or ($v[0] -eq "'" -and $v[-1] -eq "'"))) { $v = $v.Substring(1, $v.Length - 2) }
    $map[$k] = $v
  }
  return $map
}
$dotenv = Read-DotEnv $EnvFile
function Need([string]$key) {
  if (-not $dotenv.ContainsKey($key) -or -not $dotenv[$key]) { Fail "$key missing in $EnvFile" }
  return $dotenv[$key]
}
$accountId = Need 'R2_ACCOUNT_ID'
if (-not $Bucket) { $Bucket = Need 'R2_BUCKET_NAME' }
$endpoint = "https://$accountId.r2.cloudflarestorage.com"

function Use-R2Key([string]$keyId, [string]$secret) {
  # Remote "r2" defined entirely through the environment of this process.
  $env:RCLONE_CONFIG_R2_TYPE = 's3'
  $env:RCLONE_CONFIG_R2_PROVIDER = 'Cloudflare'
  $env:RCLONE_CONFIG_R2_ACCESS_KEY_ID = $keyId
  $env:RCLONE_CONFIG_R2_SECRET_ACCESS_KEY = $secret
  $env:RCLONE_CONFIG_R2_ENDPOINT = $endpoint
  $env:RCLONE_CONFIG_R2_ACL = 'private'
  $env:RCLONE_CONFIG_R2_NO_CHECK_BUCKET = 'true'
  $env:RCLONE_CONFIG_R2_REGION = 'auto'
}

# ---- rclone ----------------------------------------------------------------------------------
function Resolve-Rclone() {
  if ($RcloneExe) { if (Test-Path -LiteralPath $RcloneExe) { return $RcloneExe } Fail "rclone not found at $RcloneExe" }
  $onPath = Get-Command rclone -ErrorAction SilentlyContinue
  if ($onPath) { return $onPath.Source }
  $dir = Join-Path $env:LOCALAPPDATA 'vidtsx-tools\rclone'
  $exe = Join-Path $dir 'rclone.exe'
  if (Test-Path -LiteralPath $exe) { return $exe }
  if ($NoDownload) { Fail "rclone not on PATH and not at $exe (-NoDownload given)" }
  Write-Host "== rclone not found; downloading the portable build to $dir"
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
  $zip = Join-Path $dir 'rclone.zip'
  Invoke-WebRequest -Uri 'https://downloads.rclone.org/rclone-current-windows-amd64.zip' -OutFile $zip -UseBasicParsing
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $archive = [IO.Compression.ZipFile]::OpenRead($zip)
  try {
    $entry = $archive.Entries | Where-Object { $_.Name -eq 'rclone.exe' } | Select-Object -First 1
    if (-not $entry) { Fail 'rclone.exe not found inside the downloaded zip' }
    [IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $exe, $true)
  } finally { $archive.Dispose() }
  Remove-Item -LiteralPath $zip -Force
  return $exe
}
$rclone = Resolve-Rclone
$rcloneVersion = ([string](& $rclone version | Select-Object -First 1)).Trim()
Write-Host "== $rcloneVersion   endpoint $endpoint   bucket $Bucket   prefix $Prefix"

Use-R2Key (Need 'R2_ACCESS_KEY_ID_RW') (Need 'R2_SECRET_ACCESS_KEY_RW')
if (-not $DryRun) {
  & $rclone lsd "r2:$Bucket" | Out-Null
  if ($LASTEXITCODE -ne 0) { Fail "the read-write key cannot list r2:$Bucket (check R2_ACCOUNT_ID / bucket / key permissions)" }
}

# ---- upload ----------------------------------------------------------------------------------
$records = @()
foreach ($variant in $Variants) {
  $name = "$Version-$variant"
  $zip = Join-Path $ZipDir "$name.zip"
  $sha = "$zip.sha256"
  $manifest = Join-Path $ZipDir "$name.manifest.json"
  foreach ($f in @($zip, $sha, $manifest)) { if (-not (Test-Path -LiteralPath $f)) { Fail "missing $f (run build-stack.ps1 $variant $Version first)" } }
  $bytes = (Get-Item -LiteralPath $zip).Length
  $hash = ([string](Get-Content -LiteralPath $sha -TotalCount 1) -split '\s+')[0]
  $key = "$Prefix/$name.zip"
  $dest = "r2:$Bucket/$key"

  Write-Host ""
  Write-Host ("== {0}  ({1:n0} bytes, sha256 {2})" -f $name, $bytes, $hash) -ForegroundColor Cyan
  # Serial 32 MB parts with generous per-part (low-level) retries: a short network blip must cost one
  # part, not a restart of the whole 2.6 GB file. (First attempt with 4x64M parts died at 43 % when the
  # S3 SDK's retry quota ran dry during a ~20 s outage and every whole-file retry restarted from zero.)
  $copyArgs = @('copyto', $zip, $dest,
    '--s3-chunk-size', '32M', '--s3-upload-concurrency', '1',
    '--low-level-retries', '60', '--retries', '6', '--retries-sleep', '30s', '--timeout', '5m', '--contimeout', '1m',
    '--stats', '60s', '--stats-one-line', '-v')
  $seconds = $null
  if ($DryRun) {
    Write-Host "   rclone $($copyArgs -join ' ')"
    Write-Host "   rclone copyto $sha r2:$Bucket/$key.sha256"
    Write-Host "   rclone copyto $manifest r2:$Bucket/$Prefix/$name.manifest.json"
  } else {
    $sw = [Diagnostics.Stopwatch]::StartNew()
    if (-not $SkipUpload) {
      & $rclone @copyArgs
      if ($LASTEXITCODE -ne 0) { Fail "rclone copyto failed for $zip ($LASTEXITCODE)" }
      & $rclone copyto $sha "r2:$Bucket/$key.sha256"
      if ($LASTEXITCODE -ne 0) { Fail "rclone copyto failed for $sha ($LASTEXITCODE)" }
      & $rclone copyto $manifest "r2:$Bucket/$Prefix/$name.manifest.json"
      if ($LASTEXITCODE -ne 0) { Fail "rclone copyto failed for $manifest ($LASTEXITCODE)" }
    }
    $seconds = [math]::Round($sw.Elapsed.TotalSeconds, 1)
    # Size check against the bucket listing; R2 does not expose a sha256 we could compare.
    $listing = ([string](& $rclone lsjson $dest)) | ConvertFrom-Json
    $remoteBytes = [int64]$listing[0].Size
    if ($remoteBytes -ne $bytes) { Fail "remote size $remoteBytes != local $bytes for $key" }
    Write-Host ("   uploaded in {0} s ({1:n1} MB/s), remote size verified" -f $seconds, ($bytes / 1MB / [math]::Max($seconds, 0.1)))
  }

  $url = $null
  if ($BaseUrl) {
    $url = "$BaseUrl/$key"
    if (-not $DryRun) {
      try {
        $head = Invoke-WebRequest -Uri $url -Method Head -UseBasicParsing -TimeoutSec 30
        $len = [int64]$head.Headers['Content-Length']
        if ($len -ne $bytes) { Write-Warning "HEAD $url returned Content-Length $len, expected $bytes" } else { Write-Host "   HEAD $url -> 200, Content-Length OK" }
      } catch {
        Write-Warning "HEAD $url failed: $($_.Exception.Message) (public access / custom domain not attached yet?)"
      }
    }
  }
  $records += [ordered]@{ name = $name; key = $key; url = $url; bytes = $bytes; sha256 = $hash; seconds = $seconds }
}

# ---- read-only key check -----------------------------------------------------------------------
if ($CheckReadOnly -and -not $DryRun) {
  Write-Host ""
  Write-Host '== Read-only key: list + attempt a write (must fail)' -ForegroundColor Cyan
  Use-R2Key (Need 'R2_ACCESS_KEY_ID_R') (Need 'R2_SECRET_ACCESS_KEY_R')
  $listed = @(& $rclone lsf "r2:$Bucket/$Prefix/")
  if ($LASTEXITCODE -ne 0) { Fail 'read-only key cannot list the prefix' }
  Write-Host ("   lists {0} objects under {1}/" -f $listed.Count, $Prefix)
  $probe = Join-Path $env:TEMP 'vidtsx-r2-ro-probe.txt'
  Set-Content -LiteralPath $probe -Value 'probe' -Encoding ascii
  # No 2>$null here: under $ErrorActionPreference = 'Stop', PowerShell 5.1 turns a native
  # command's redirected stderr into a terminating NativeCommandError. -q silences rclone instead.
  & $rclone copyto $probe "r2:$Bucket/$Prefix/.ro-probe" -q --retries 1 --low-level-retries 1 | Out-Null
  $writeExit = $LASTEXITCODE
  Remove-Item -LiteralPath $probe -Force
  if ($writeExit -eq 0) {
    Write-Warning 'the READ-ONLY key was able to write - fix its permissions in the Cloudflare dashboard'
    Use-R2Key (Need 'R2_ACCESS_KEY_ID_RW') (Need 'R2_SECRET_ACCESS_KEY_RW')
    & $rclone deletefile "r2:$Bucket/$Prefix/.ro-probe" | Out-Null
  } else {
    Write-Host ('   write refused (exit {0}) - key is read-only as intended' -f $writeExit)
  }
}

Write-Host ""
Write-Host '== Paste into docs/ai-runtime-implementation-plan.md §10 and into the catalogue urls[]:' -ForegroundColor Green
foreach ($r in $records) {
  $u = $r.url
  if (-not $u) { $u = "<public base URL>/$($r.key)" }
  Write-Host ("- {0}: {1}  ({2:n0} bytes, sha256 {3}, upload {4} s)" -f $r.name, $u, $r.bytes, $r.sha256, $r.seconds)
}
