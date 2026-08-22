$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$nextDir = Join-Path $repoRoot "apps\web\.next"

$portOwner = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($portOwner) {
  $process = Get-Process -Id $portOwner.OwningProcess -ErrorAction SilentlyContinue
  if ($process) {
    Write-Host "Stopping process $($process.Id) using port 3000 ($($process.ProcessName))..."
    Stop-Process -Id $process.Id -Force
  }
}

if (Test-Path $nextDir) {
  $resolvedNextDir = Resolve-Path $nextDir
  if ($resolvedNextDir.Path -like (Join-Path $repoRoot "*")) {
    Write-Host "Removing stale Next.js cache at $($resolvedNextDir.Path)..."
    Remove-Item -LiteralPath $resolvedNextDir.Path -Recurse -Force
  } else {
    throw "Refusing to remove path outside repo: $($resolvedNextDir.Path)"
  }
}

Set-Location $repoRoot
npm.cmd run dev:web
