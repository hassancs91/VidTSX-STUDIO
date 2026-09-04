<#
.SYNOPSIS
  Re-lock scripts/ai-runtime/requirements.in for both runtime variants.

.DESCRIPTION
  Produces requirements.cu126.lock and requirements.cpu.lock with uv. Both locks are
  self-contained (--emit-index-url) so `uv pip sync` never needs the index flags again,
  and hashed (--generate-hashes) so a tampered wheel cannot slip into a build.
  --index-strategy unsafe-best-match is REQUIRED: without it uv only looks at the first
  index that has "torch" (PyPI) and the +cu126 / +cpu local versions are unresolvable.

  The resolution is pinned to the stack's target (CPython 3.11, x86_64 Windows) rather than
  to whatever interpreter runs uv, so the locks are identical on any build box.

.EXAMPLE
  powershell -File scripts\ai-runtime\compile-locks.ps1
  powershell -File scripts\ai-runtime\compile-locks.ps1 -Variant cpu
#>
[CmdletBinding()]
param(
  [ValidateSet('cu126', 'cpu', 'both')]
  [string]$Variant = 'both',
  [switch]$Upgrade
)
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$uv = Get-Command uv -ErrorAction SilentlyContinue
if (-not $uv) { throw 'uv not found on PATH (https://docs.astral.sh/uv/). The lab used uv 0.12.3.' }

$variants = if ($Variant -eq 'both') { @('cu126', 'cpu') } else { @($Variant) }
foreach ($v in $variants) {
  $lock = Join-Path $here "requirements.$v.lock"
  $args = @(
    'pip', 'compile', (Join-Path $here 'requirements.in'),
    '--python-version', '3.11',
    '--python-platform', 'x86_64-pc-windows-msvc',
    '--extra-index-url', "https://download.pytorch.org/whl/$v",
    '--index-strategy', 'unsafe-best-match',
    '--generate-hashes',
    '--emit-index-url',
    '--custom-compile-command', "scripts/ai-runtime/compile-locks.ps1 -Variant $v",
    '-o', $lock
  )
  if ($Upgrade) { $args += '--upgrade' }
  Write-Host "== uv $($args -join ' ')"
  $sw = [Diagnostics.Stopwatch]::StartNew()
  & uv @args
  if ($LASTEXITCODE -ne 0) { throw "uv pip compile failed for $v (exit $LASTEXITCODE)" }
  $count = (Select-String -Path $lock -Pattern '^[a-z0-9_.-]+==' ).Count
  Write-Host ("== {0}: {1} packages, {2:n1} s" -f (Split-Path -Leaf $lock), $count, $sw.Elapsed.TotalSeconds)
}
