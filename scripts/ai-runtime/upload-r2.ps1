<#
.SYNOPSIS
  Upload one runtime version (both variants) to the Cloudflare R2 bucket with rclone.

.DESCRIPTION
  Uploads <version>-<variant>.zip plus its .sha256 and .manifest.json sidecars to
  r2:<bucket>/<prefix>/ and prints the public URLs + a block to paste into the plan's §10 log.
  R2 is reached over its S3 API; rclone does multipart uploads, so the 2.6 GB cu126 zip is fine
  (wrangler's `r2 object put` caps single objects around 300 MB and is NOT an option for it).

  One-time setup (credentials never live in the repo — .gitignore already covers
  scripts/.aws-r2-config and .env*; rclone keeps its own config under %APPDATA%\rclone):

    winget install Rclone.Rclone            # or https://rclone.org/downloads/
    rclone config create r2 s3 provider=Cloudflare `
      access_key_id=<R2 access key id> secret_access_key=<R2 secret> `
      endpoint=https://<account id>.r2.cloudflarestorage.com acl=private no_check_bucket=true
    rclone lsd r2:                          # lists buckets -> credentials work

  Alternatively set the environment variables instead of a config file:
    $env:RCLONE_CONFIG_R2_TYPE='s3'; $env:RCLONE_CONFIG_R2_PROVIDER='Cloudflare'
    $env:RCLONE_CONFIG_R2_ACCESS_KEY_ID='...'; $env:RCLONE_CONFIG_R2_SECRET_ACCESS_KEY='...'
    $env:RCLONE_CONFIG_R2_ENDPOINT='https://<account id>.r2.cloudflarestorage.com'
    $env:RCLONE_CONFIG_R2_NO_CHECK_BUCKET='true'

  The bucket needs a public custom domain (R2 -> bucket -> Settings -> Custom Domains) so the app
  can download without credentials; pass it as -BaseUrl (or $env:VIDTSX_R2_PUBLIC_BASE).

.EXAMPLE
  powershell -File scripts\ai-runtime\upload-r2.ps1 -Version 2026.09.1 -Bucket vidtsx-downloads -BaseUrl https://dl.vidtsx.com
  powershell -File scripts\ai-runtime\upload-r2.ps1 -Version 2026.09.1 -Variants cpu -DryRun
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^\d{4}\.\d{2}\.\d+$')]
  [string]$Version,

  [ValidateSet('cu126', 'cpu')]
  [string[]]$Variants = @('cu126', 'cpu'),

  # Folder holding the zips (build-stack.ps1's -OutDir).
  [string]$ZipDir,

  # rclone remote name, bucket, and key prefix inside the bucket.
  [string]$Remote = 'r2',
  [Parameter(Mandatory = $true)]
  [string]$Bucket,
  [string]$Prefix = 'ai-runtime',

  # Public base URL of the bucket's custom domain, for the printed catalogue URLs and the HEAD check.
  [string]$BaseUrl,

  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$repo = (Resolve-Path (Join-Path $here '..\..')).Path
if (-not $ZipDir) { $ZipDir = Join-Path $repo '.vidtsx-temp\ai-runtime' }
if (-not $BaseUrl) { $BaseUrl = $env:VIDTSX_R2_PUBLIC_BASE }
if ($BaseUrl) { $BaseUrl = $BaseUrl.TrimEnd('/') }

function Fail([string]$msg) { throw "upload-r2: $msg" }

if (-not (Get-Command rclone -ErrorAction SilentlyContinue)) {
  Fail 'rclone not found on PATH. Install it (winget install Rclone.Rclone) and create the remote — see the header of this script.'
}
if (-not $DryRun) {
  & rclone lsd "${Remote}:" | Out-Null
  if ($LASTEXITCODE -ne 0) { Fail "rclone cannot list '${Remote}:' — configure the remote first (see header)" }
}

$records = @()
foreach ($variant in $Variants) {
  $name = "$Version-$variant"
  $zip = Join-Path $ZipDir "$name.zip"
  $sha = "$zip.sha256"
  $manifest = Join-Path $ZipDir "$name.manifest.json"
  foreach ($f in @($zip, $sha, $manifest)) { if (-not (Test-Path -LiteralPath $f)) { Fail "missing $f (run build-stack.ps1 $variant $Version first)" } }
  $bytes = (Get-Item -LiteralPath $zip).Length
  $hash = ((Get-Content -LiteralPath $sha -TotalCount 1) -split '\s+')[0]
  $key = "$Prefix/$name.zip"
  $dest = "${Remote}:$Bucket/$key"

  Write-Host ""
  Write-Host ("== {0}  ({1:n0} bytes, sha256 {2})" -f $name, $bytes, $hash) -ForegroundColor Cyan
  $copyArgs = @('copyto', $zip, $dest, '--s3-chunk-size', '64M', '--s3-upload-concurrency', '4', '--s3-no-check-bucket', '--progress', '--stats-one-line')
  if ($DryRun) {
    Write-Host "   rclone $($copyArgs -join ' ')"
    Write-Host "   rclone copyto $sha ${Remote}:$Bucket/$key.sha256"
    Write-Host "   rclone copyto $manifest ${Remote}:$Bucket/$Prefix/$name.manifest.json"
  } else {
    $sw = [Diagnostics.Stopwatch]::StartNew()
    & rclone @copyArgs
    if ($LASTEXITCODE -ne 0) { Fail "rclone copyto failed for $zip ($LASTEXITCODE)" }
    & rclone copyto $sha "${Remote}:$Bucket/$key.sha256" --s3-no-check-bucket
    & rclone copyto $manifest "${Remote}:$Bucket/$Prefix/$name.manifest.json" --s3-no-check-bucket
    $seconds = [math]::Round($sw.Elapsed.TotalSeconds, 1)
    # Size check against the bucket listing; R2 does not expose a sha256 we could compare.
    $listing = (& rclone lsjson $dest | ConvertFrom-Json)
    $remoteBytes = [int64]$listing[0].Size
    if ($remoteBytes -ne $bytes) { Fail "remote size $remoteBytes != local $bytes for $key" }
    Write-Host ("   uploaded in {0} s, remote size verified" -f $seconds)
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
        Write-Warning "HEAD $url failed: $($_.Exception.Message) (custom domain not attached yet?)"
      }
    }
  }
  $records += [ordered]@{ name = $name; key = $key; url = $url; bytes = $bytes; sha256 = $hash }
}

Write-Host ""
Write-Host '== Paste into docs/ai-runtime-implementation-plan.md §10 and into the catalogue urls[]:' -ForegroundColor Green
foreach ($r in $records) {
  $u = $r.url
  if (-not $u) { $u = "<BaseUrl>/$($r.key)" }
  Write-Host ("- {0}: {1}  ({2:n0} bytes, sha256 {3})" -f $r.name, $u, $r.bytes, $r.sha256)
}
