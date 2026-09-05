<#
.SYNOPSIS
  Build one downloadable AI-runtime variant: relocatable Python 3.11 + PyTorch + the pinned
  model libraries, pruned, licence-flattened, self-tested, zipped and hashed.

.DESCRIPTION
  Implements docs/ai-runtime-implementation-plan.md §2 step 2 with every Stage 0 "MUST change":
    1. uv python install 3.11  -> copy the python-build-standalone interpreter (relocatable, no venv)
    2. delete Lib\EXTERNALLY-MANAGED (uv-managed builds ship it; sync refuses otherwise)
    3. uv pip sync requirements.<variant>.lock --index-strategy unsafe-best-match
       (the lock is self-contained thanks to --emit-index-url; hashes are verified), then
       uninstall the interpreter's seed pip so the content equals the lock
    4. prune torch\include, torch\lib\*.lib, every */tests dir, every __pycache__
    5. flatten *.dist-info\licenses\** into licenses\<package>\ (size AND path depth: 145 -> ~110)
    6. --selftest both pipelines in place (resources/pipelines/{triposr,rembg}/runner.py)
    7. manifest.json { version, variant, python, torch, cuda, minDriver, lockSha256,
                       maxRelativePathLength, bytesOnDisk, files, ... }
    8. deflate zip64 (reproducible: sorted entries, fixed timestamp) -> sha256 -> sidecars
    9. print the TypeScript catalogue entry to paste into src/main/services/ai-runtime/catalogue.ts

  Output (default <repo>\.vidtsx-temp\ai-runtime\):
    <version>-<variant>\            the runtime folder exactly as it will be extracted
    <version>-<variant>.zip         upload this
    <version>-<variant>.zip.sha256  sha256sum-format sidecar (verify-stack.mjs reads it)
    <version>-<variant>.manifest.json, .build-report.json, .catalogue.ts

  Needs: uv on PATH, ~12 GB free (cu126) / ~3 GB (cpu), the wheels in uv's cache or bandwidth
  for ~2.5 GB (cu126). No compiler, no CUDA toolkit: everything is a wheel except the pure-Python
  antlr4-python3-runtime sdist, which uv builds in seconds.

.EXAMPLE
  powershell -File scripts\ai-runtime\build-stack.ps1 cu126 2026.09.1
  powershell -File scripts\ai-runtime\build-stack.ps1 cpu   2026.09.1 -BaseUrl https://dl.example.com
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true, Position = 0)]
  [ValidateSet('cu126', 'cpu')]
  [string]$Variant,

  [Parameter(Position = 1)]
  [ValidatePattern('^\d{4}\.\d{2}\.\d+$')]
  [string]$Version = '2026.09.1',

  # Where the runtime folder, zip and sidecars land.
  [string]$OutDir,

  # Public base of the R2 bucket. Default: $env:VIDTSX_R2_PUBLIC_BASE, else the bucket's custom
  # domain https://cdn.vidtsx.com (bucket vidtsx-cdn, prefix ai-runtime/).
  [string]$BaseUrl,

  [ValidateRange(1, 9)]
  [int]$ZipLevel = 6,

  [switch]$SkipZip,
  [switch]$SkipSelftest
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2

# ---------------------------------------------------------------------------------------------
# Layout and constants
# ---------------------------------------------------------------------------------------------
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$repo = (Resolve-Path (Join-Path $here '..\..')).Path
if (-not $OutDir) { $OutDir = Join-Path $repo '.vidtsx-temp\ai-runtime' }
if (-not $BaseUrl) {
  if ($env:VIDTSX_R2_PUBLIC_BASE) { $BaseUrl = $env:VIDTSX_R2_PUBLIC_BASE } else { $BaseUrl = 'https://cdn.vidtsx.com' }
}
$BaseUrl = $BaseUrl.TrimEnd('/')

$lock = Join-Path $here "requirements.$Variant.lock"
$tools = Join-Path $here 'stack-tools.py'
$pipelinesDir = Join-Path $repo 'resources\pipelines'
$name = "$Version-$Variant"

# CUDA 12.x minor-version compatibility floor (docs/local-python-runtime-plan.md decision 6).
$minDriver = $null
if ($Variant -eq 'cu126') { $minDriver = '525.60' }
$requiredFreeGb = 3
if ($Variant -eq 'cu126') { $requiredFreeGb = 12 }

$script:timings = [ordered]@{}
$script:stepClock = [Diagnostics.Stopwatch]::StartNew()

function Step([string]$label) {
  Write-Host ""
  Write-Host ("== [{0}] {1}" -f $name, $label) -ForegroundColor Cyan
}
function EndStep([string]$label) {
  $s = [math]::Round($script:stepClock.Elapsed.TotalSeconds, 1)
  $script:timings[$label] = $s
  Write-Host ("   done in {0} s" -f $s) -ForegroundColor DarkGray
  $script:stepClock.Restart()
}
function Fail([string]$msg) { throw "build-stack: $msg" }
function Sum-Bytes($items) {
  $sum = [int64]0
  foreach ($i in @($items)) { if ($i) { $sum += [int64]$i.Length } }
  return $sum
}
function Tree-Bytes([string]$dir) {
  if (-not (Test-Path -LiteralPath $dir)) { return [int64]0 }
  return Sum-Bytes (Get-ChildItem -LiteralPath $dir -Recurse -File -Force)
}
function Remove-Tree([string]$dir) {
  # cmd's rmdir is the reliable way to drop 30k-file trees on Windows (Remove-Item races).
  if (Test-Path -LiteralPath $dir) { & cmd /c rmdir /s /q "$dir" | Out-Null }
  if (Test-Path -LiteralPath $dir) { Fail "could not remove $dir" }
}
function Write-Utf8NoBom([string]$path, [string]$text) {
  [IO.File]::WriteAllText($path, $text, (New-Object Text.UTF8Encoding $false))
}
function Sha256-Text([string]$text) {
  $sha = [Security.Cryptography.SHA256]::Create()
  try { return ([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($text))) -replace '-', '').ToLower() }
  finally { $sha.Dispose() }
}
function Run-Selftest([string]$pipeline, [string]$pyExe) {
  $runner = Join-Path $pipelinesDir "$pipeline\runner.py"
  if (-not (Test-Path -LiteralPath $runner)) { Fail "runner not found: $runner" }
  $sw = [Diagnostics.Stopwatch]::StartNew()
  $lines = @(& $pyExe $runner --selftest)
  $code = $LASTEXITCODE
  $ms = [int]$sw.ElapsedMilliseconds
  $ready = $null
  foreach ($l in $lines) {
    if (($l -is [string]) -and $l.StartsWith('{')) {
      $evt = $l | ConvertFrom-Json
      if ($evt.type -eq 'ready') { $ready = $evt; break }
      if ($evt.type -eq 'error') { Fail ("{0} selftest reported {1}: {2}" -f $pipeline, $evt.code, $evt.message) }
    }
  }
  if (($code -ne 0) -or (-not $ready)) { Fail ("{0} selftest failed (exit {1}); stdout: {2}" -f $pipeline, $code, ($lines -join ' | ')) }
  Write-Host ("   {0}: ready in {1} ms  {2}" -f $pipeline, $ms, ($lines -join ' '))
  return [ordered]@{ ready = $ready; ms = $ms }
}

# ---------------------------------------------------------------------------------------------
# 0. Preconditions
# ---------------------------------------------------------------------------------------------
Step 'Preconditions'
if (-not (Get-Command uv -ErrorAction SilentlyContinue)) { Fail 'uv not found on PATH (https://docs.astral.sh/uv/)' }
foreach ($p in @($lock, $tools, (Join-Path $pipelinesDir 'common\protocol.py'), (Join-Path $pipelinesDir 'triposr\runner.py'), (Join-Path $pipelinesDir 'rembg\runner.py'))) {
  if (-not (Test-Path -LiteralPath $p)) { Fail "missing input: $p" }
}
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$OutDir = (Resolve-Path $OutDir).Path
$stage = Join-Path $OutDir $name
$pyDir = Join-Path $stage 'python'
$pyExe = Join-Path $pyDir 'python.exe'
$sitePackages = Join-Path $pyDir 'Lib\site-packages'
$licRoot = Join-Path $stage 'licenses'
$zipPath = Join-Path $OutDir "$name.zip"
$drive = Get-PSDrive -Name ((Get-Item $OutDir).PSDrive.Name)
$freeGb = [math]::Round($drive.Free / 1GB, 1)
if ($freeGb -lt $requiredFreeGb) { Fail "only $freeGb GB free on $($drive.Name): (need ~$requiredFreeGb GB)" }
# The stage path itself must leave room for the deepest file (Stage 0: 145 chars before flattening).
if (($stage.Length + 150) -gt 259) { Fail "OutDir is too deep ($($stage.Length) chars); pick a shorter -OutDir" }
$uvVersion = (& uv --version | Select-Object -First 1).Trim()
Write-Host "   uv: $uvVersion   out: $OutDir   free: $freeGb GB   base URL: $BaseUrl"
$env:PYTHONDONTWRITEBYTECODE = '1'
$env:PYTHONUTF8 = '1'
$env:HF_HUB_OFFLINE = '1'
$env:TRANSFORMERS_OFFLINE = '1'
$env:UV_NO_PROGRESS = '1'
EndStep 'preconditions'

# ---------------------------------------------------------------------------------------------
# 1. Interpreter: uv-managed python-build-standalone 3.11 (relocatable by design)
# ---------------------------------------------------------------------------------------------
Step 'Interpreter (uv python install 3.11)'
& uv python install 3.11 --quiet
if ($LASTEXITCODE -ne 0) { Fail "uv python install 3.11 failed ($LASTEXITCODE)" }
$srcExe = ([string](& uv python find 3.11 | Select-Object -Last 1)).Trim()
if (($LASTEXITCODE -ne 0) -or (-not (Test-Path -LiteralPath $srcExe))) { Fail "uv python find 3.11 failed: $srcExe" }
$srcDir = Split-Path -Parent $srcExe
$srcItem = Get-Item -LiteralPath $srcDir
if ($srcItem.LinkType) {
  # uv exposes cpython-3.11-... as a junction to the real cpython-3.11.15-... folder.
  $target = $srcItem.Target
  if ($target -is [array]) { $target = $target[0] }
  $srcDir = [string]$target
  $srcExe = Join-Path $srcDir 'python.exe'
}
$pythonVersion = ([string](& $srcExe -c "import sys;print('%d.%d.%d' % sys.version_info[:3])")).Trim()
$pythonBuild = 'unknown'
$buildMarker = Join-Path $srcDir 'BUILD'
if (Test-Path -LiteralPath $buildMarker) { $pythonBuild = ([string](Get-Content -LiteralPath $buildMarker -TotalCount 1)).Trim() }
if (-not $pythonVersion.StartsWith('3.11.')) { Fail "expected CPython 3.11.x, got $pythonVersion" }
Write-Host "   source: $srcDir  (CPython $pythonVersion, python-build-standalone $pythonBuild)"
EndStep 'interpreter'

# ---------------------------------------------------------------------------------------------
# 2. Copy the interpreter into the stage; drop the externally-managed marker
# ---------------------------------------------------------------------------------------------
Step "Copy interpreter -> $pyDir"
Remove-Tree $stage
New-Item -ItemType Directory -Force -Path $stage | Out-Null
& robocopy $srcDir $pyDir /E /XD __pycache__ /NFL /NDL /NJH /NJS /NP | Out-Null
if ($LASTEXITCODE -ge 8) { Fail "robocopy failed ($LASTEXITCODE)" }
$marker = Join-Path $pyDir 'Lib\EXTERNALLY-MANAGED'
$hadMarker = Test-Path -LiteralPath $marker
if ($hadMarker) { Remove-Item -LiteralPath $marker -Force }
Write-Host ("   EXTERNALLY-MANAGED removed: {0}" -f $hadMarker)
EndStep 'copy-interpreter'

# ---------------------------------------------------------------------------------------------
# 3. uv pip sync from the hashed lock (index-strategy is REQUIRED for the +cu126/+cpu pins)
# ---------------------------------------------------------------------------------------------
Step "uv pip sync $(Split-Path -Leaf $lock)"
& uv pip sync $lock --python $pyExe --index-strategy unsafe-best-match --verify-hashes
if ($LASTEXITCODE -ne 0) { Fail "uv pip sync failed ($LASTEXITCODE)" }
# uv keeps the interpreter's bundled pip as a seed package even though it is not in the lock.
# Users never run pip (decision 1) and the manifest claims "content == lock", so drop it cleanly
# (RECORD-driven: also removes Scripts\pip*.exe). 6 MB / ~900 files.
$pipRemoved = $false
if (Test-Path -LiteralPath (Join-Path $sitePackages 'pip')) {
  & uv pip uninstall pip --python $pyExe
  if ($LASTEXITCODE -ne 0) { Fail "uv pip uninstall pip failed ($LASTEXITCODE)" }
  $pipRemoved = $true
}
$distInfos = @(Get-ChildItem -LiteralPath $sitePackages -Directory -Filter '*.dist-info')
$lockCount = @(Select-String -Path $lock -Pattern '^[a-z0-9_.-]+==').Count
if ($distInfos.Count -ne $lockCount) { Fail ("{0} dist-infos installed but the lock has {1} packages" -f $distInfos.Count, $lockCount) }
Write-Host ("   {0} distributions installed (= lock), pip removed: {1}" -f $distInfos.Count, $pipRemoved)
EndStep 'uv-pip-sync'

# ---------------------------------------------------------------------------------------------
# 4. Prune (Stage 0 numbers: include 64 MB, .lib 47 MB, tests 47 MB, __pycache__ 92 MB)
# ---------------------------------------------------------------------------------------------
Step 'Prune torch\include, torch\lib\*.lib, */tests, __pycache__'
$pruned = [ordered]@{}
$torchInclude = Join-Path $sitePackages 'torch\include'
$pruned['torch/include bytes'] = Tree-Bytes $torchInclude
Remove-Tree $torchInclude

$libFiles = @(Get-ChildItem -LiteralPath (Join-Path $sitePackages 'torch\lib') -Filter '*.lib' -File)
$pruned['torch/lib/*.lib bytes'] = Sum-Bytes $libFiles
$libFiles | Remove-Item -Force

$testDirs = @(Get-ChildItem -LiteralPath $sitePackages -Recurse -Directory -Force | Where-Object { $_.Name -eq 'tests' } |
  Sort-Object { $_.FullName.Length } -Descending)
$testBytes = [int64]0
foreach ($d in $testDirs) { if (Test-Path -LiteralPath $d.FullName) { $testBytes += Tree-Bytes $d.FullName; Remove-Tree $d.FullName } }
$pruned['*/tests bytes'] = $testBytes
$pruned['*/tests dirs'] = $testDirs.Count

$pycDirs = @(Get-ChildItem -LiteralPath $pyDir -Recurse -Directory -Force | Where-Object { $_.Name -eq '__pycache__' })
$pycBytes = [int64]0
foreach ($d in $pycDirs) { if (Test-Path -LiteralPath $d.FullName) { $pycBytes += Tree-Bytes $d.FullName; Remove-Tree $d.FullName } }
$pruned['__pycache__ bytes'] = $pycBytes
$pruned['__pycache__ dirs'] = $pycDirs.Count
foreach ($k in $pruned.Keys) { Write-Host ("   {0,-24} {1,14:n0}" -f $k, $pruned[$k]) }
EndStep 'prune'

# ---------------------------------------------------------------------------------------------
# 5. Flatten licences: *.dist-info\licenses\** -> licenses\<package>\**  (+ interpreter licence)
# ---------------------------------------------------------------------------------------------
Step 'Flatten licences into licenses\<package>\'
New-Item -ItemType Directory -Force -Path $licRoot | Out-Null
$flattened = 0
$copiedTopLevel = 0
foreach ($di in @(Get-ChildItem -LiteralPath $sitePackages -Directory -Filter '*.dist-info')) {
  $pkg = ($di.Name -replace '\.dist-info$', '').Split('-')[0]
  $dest = Join-Path $licRoot $pkg
  $licDir = Join-Path $di.FullName 'licenses'
  if (Test-Path -LiteralPath $licDir) {
    & robocopy $licDir $dest /E /MOVE /NFL /NDL /NJH /NJS /NP | Out-Null
    if ($LASTEXITCODE -ge 8) { Fail "robocopy /MOVE failed for $licDir ($LASTEXITCODE)" }
    $flattened++
  }
  # Older metadata keeps LICENSE/COPYING/NOTICE at the dist-info root: copy (not move) so the
  # dist-info RECORD stays truthful for those.
  foreach ($f in @(Get-ChildItem -LiteralPath $di.FullName -File | Where-Object { $_.Name -match '^(LICEN[CS]E|COPYING|NOTICE|AUTHORS)' })) {
    New-Item -ItemType Directory -Force -Path $dest | Out-Null
    Copy-Item -LiteralPath $f.FullName -Destination (Join-Path $dest $f.Name) -Force
    $copiedTopLevel++
  }
}
New-Item -ItemType Directory -Force -Path (Join-Path $licRoot 'python') | Out-Null
Copy-Item -LiteralPath (Join-Path $pyDir 'LICENSE.txt') -Destination (Join-Path $licRoot 'python\LICENSE.txt') -Force
$builtAt = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
$licReadme = @(
  "VidTSX Studio AI runtime $name - third-party notices",
  "",
  "This folder collects the licence files of every Python distribution in python\Lib\site-packages",
  "(moved here from each *.dist-info\licenses\ folder at build time so the deepest path in the",
  "runtime stays short on Windows) plus the CPython licence (python\).",
  "",
  "Notable components: CPython $pythonVersion (PSF-2.0), PyTorch (BSD-3-Clause; in the cu126 variant",
  "torch\lib also carries NVIDIA CUDA / cuDNN / cuBLAS redistributable libraries under the NVIDIA EULA),",
  "transformers (Apache-2.0), rembg (MIT), onnxruntime (MIT), scikit-image (BSD-3-Clause).",
  "",
  "Built $builtAt by scripts/ai-runtime/build-stack.ps1."
) -join "`n"
Write-Utf8NoBom (Join-Path $licRoot 'README.txt') ($licReadme + "`n")
Write-Host ("   {0} licence folders flattened, {1} root-level licence files copied" -f $flattened, $copiedTopLevel)
EndStep 'flatten-licences'

# ---------------------------------------------------------------------------------------------
# 6. Self-test in place (the pruned, flattened tree is what ships)
# ---------------------------------------------------------------------------------------------
Step 'torch / cuda versions'
$verLines = @(& $pyExe -c "import torch;print(torch.__version__);print(torch.version.cuda or '')")
if ($LASTEXITCODE -ne 0) { Fail 'import torch failed in the built stack' }
$torchVersion = ([string]$verLines[0]).Trim()
$cudaVersion = $null
if ($verLines.Count -gt 1) { $cudaVersion = ([string]$verLines[1]).Trim() }
if (-not $cudaVersion) { $cudaVersion = $null }
if (-not $torchVersion.EndsWith("+$Variant")) { Fail "torch build $torchVersion does not match variant $Variant" }
if (($Variant -eq 'cu126') -and (-not $cudaVersion)) { Fail 'cu126 build reports no CUDA version' }
if (($Variant -eq 'cpu') -and $cudaVersion) { Fail "cpu build unexpectedly reports CUDA $cudaVersion" }
Write-Host "   torch $torchVersion   cuda $cudaVersion"
EndStep 'torch-version'

$selftest = [ordered]@{}
if (-not $SkipSelftest) {
  Step 'Selftest: resources/pipelines/{triposr,rembg}/runner.py --selftest'
  $selftest['triposr'] = Run-Selftest 'triposr' $pyExe
  $selftest['rembg'] = Run-Selftest 'rembg' $pyExe
  if ($selftest['triposr'].ready.torch -ne $torchVersion) { Fail 'triposr ready.torch differs from the stack torch' }
  if (($Variant -eq 'cu126') -and (-not $selftest['triposr'].ready.cuda)) {
    Write-Warning 'cu126 stack built, but this box reports cuda=false (no NVIDIA GPU here?). The zip is still valid.'
  }
  EndStep 'selftest'
}

# ---------------------------------------------------------------------------------------------
# 7. manifest.json
# ---------------------------------------------------------------------------------------------
Step 'manifest.json'
$statsJson = [string](& $srcExe $tools stats $stage | Select-Object -Last 1)
if ($LASTEXITCODE -ne 0) { Fail 'stack-tools stats failed' }
$stats = $statsJson | ConvertFrom-Json
# Hash the lock with LF line endings so the value is identical on CRLF and LF checkouts.
$lockText = [IO.File]::ReadAllText($lock) -replace "`r`n", "`n"
$lockSha = Sha256-Text $lockText
$manifest = [ordered]@{
  schema                = 1
  name                  = $name
  version               = $Version
  variant               = $Variant
  python                = $pythonVersion
  pythonBuild           = $pythonBuild
  torch                 = $torchVersion
  cuda                  = $cudaVersion
  minDriver             = $minDriver
  lockFile              = (Split-Path -Leaf $lock)
  lockSha256            = $lockSha
  maxRelativePathLength = [int]$stats.maxRelativePathLength
  deepestPath           = [string]$stats.deepestPath
  bytesOnDisk           = [int64]$stats.bytes
  files                 = [int]$stats.files
  pythonDir             = 'python'
  pipelines             = @('triposr', 'rembg')
  builtAt               = $builtAt
  builtWith             = [ordered]@{ uv = $uvVersion; script = 'scripts/ai-runtime/build-stack.ps1' }
}
$manifestJson = ($manifest | ConvertTo-Json -Depth 5)
Write-Utf8NoBom (Join-Path $stage 'manifest.json') $manifestJson
Write-Utf8NoBom (Join-Path $OutDir "$name.manifest.json") $manifestJson
Write-Host ("   files {0:n0}   bytesOnDisk {1:n0}   maxRelativePathLength {2}" -f $manifest.files, $manifest.bytesOnDisk, $manifest.maxRelativePathLength)
Write-Host ("   deepest: {0}" -f $manifest.deepestPath)
# Path-length budget the app's preflight will enforce: len(root) + maxRel + 1 <= 259.
$rootBudget = 259 - $manifest.maxRelativePathLength - 1
Write-Host ("   -> install root may be up to {0} chars on a default Windows (LongPathsEnabled off)" -f $rootBudget)
EndStep 'manifest'

# ---------------------------------------------------------------------------------------------
# 8. Zip (reproducible deflate zip64) + sha256 + sidecars
# ---------------------------------------------------------------------------------------------
$zipBytes = $null
$sha256 = $null
$zipInfo = $null
if (-not $SkipZip) {
  Step "Zip -> $zipPath (deflate level $ZipLevel, zip64)"
  $stampDate = ('{0}-{1}-01' -f $Version.Split('.')[0], $Version.Split('.')[1])
  $zipJson = [string](& $srcExe $tools zip $stage $zipPath --level $ZipLevel --date $stampDate | Select-Object -Last 1)
  if ($LASTEXITCODE -ne 0) { Fail 'stack-tools zip failed' }
  $zipInfo = $zipJson | ConvertFrom-Json
  $zipBytes = [int64](Get-Item -LiteralPath $zipPath).Length
  Write-Host ("   {0:n0} files, raw {1:n0} -> zip {2:n0} bytes in {3} s" -f $zipInfo.files, $zipInfo.rawBytes, $zipBytes, $zipInfo.seconds)
  EndStep 'zip'

  Step 'sha256'
  $sha256 = (Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash.ToLower()
  Write-Utf8NoBom "$zipPath.sha256" ("{0} *{1}`n" -f $sha256, "$name.zip")
  Write-Host "   $sha256"
  EndStep 'sha256'
}

# ---------------------------------------------------------------------------------------------
# 9. Catalogue entry + build report
# ---------------------------------------------------------------------------------------------
Step 'Catalogue entry'
function TsStr($v) { if ($null -eq $v) { return 'null' } return "'" + ([string]$v).Replace("'", "\'") + "'" }
function TsNum($v) { if ($null -eq $v) { return 'null' } return [string]$v }
$entryLines = @(
  "  // Generated by scripts/ai-runtime/build-stack.ps1 $Variant $Version on $builtAt",
  "  {",
  "    version: $(TsStr $Version),",
  "    variant: $(TsStr $Variant),",
  "    urls: [$(TsStr "$BaseUrl/ai-runtime/$name.zip")],",
  "    sha256: $(TsStr $sha256),",
  "    bytes: $(TsNum $zipBytes),",
  "    bytesOnDisk: $(TsNum $manifest.bytesOnDisk),",
  "    files: $(TsNum $manifest.files),",
  "    extractedDir: 'python',",
  "    python: $(TsStr $pythonVersion),",
  "    torch: $(TsStr $torchVersion),",
  "    cuda: $(TsStr $cudaVersion),",
  "    minDriver: $(TsStr $minDriver),",
  "    maxRelativePathLength: $(TsNum $manifest.maxRelativePathLength),",
  "    lockSha256: $(TsStr $lockSha),",
  "    licence: 'PSF-2.0 (CPython), BSD-3-Clause (PyTorch), NVIDIA EULA (CUDA redistributables, cu126 only); per-package notices in licenses/',",
  "  },"
)
$entry = ($entryLines -join "`n") + "`n"
Write-Utf8NoBom (Join-Path $OutDir "$name.catalogue.ts") $entry
Write-Host $entry -ForegroundColor Green

$totalSeconds = [math]::Round((($script:timings.Values | Measure-Object -Sum).Sum), 1)
$report = [ordered]@{
  name           = $name
  builtAt        = $builtAt
  host           = [ordered]@{ os = [Environment]::OSVersion.VersionString; machine = $env:COMPUTERNAME; uv = $uvVersion }
  interpreter    = [ordered]@{ source = $srcDir; python = $pythonVersion; pythonBuild = $pythonBuild; externallyManagedRemoved = $hadMarker; pipRemoved = $pipRemoved }
  distributions  = $distInfos.Count
  pruned         = $pruned
  licences       = [ordered]@{ flattenedFolders = $flattened; rootLevelFilesCopied = $copiedTopLevel }
  selftest       = $selftest
  manifest       = $manifest
  zip            = $zipInfo
  zipBytes       = $zipBytes
  sha256         = $sha256
  timingsSeconds = $script:timings
  totalSeconds   = $totalSeconds
}
Write-Utf8NoBom (Join-Path $OutDir "$name.build-report.json") ($report | ConvertTo-Json -Depth 6)
Write-Host ""
Write-Host ("== [{0}] BUILD OK in {1} s  ->  {2}" -f $name, $totalSeconds, $OutDir) -ForegroundColor Green
foreach ($k in $script:timings.Keys) { Write-Host ("   {0,-20} {1,8} s" -f $k, $script:timings[$k]) }
