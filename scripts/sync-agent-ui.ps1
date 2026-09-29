param(
  [string]$Branch = 'feat/daon-master-code-lock'
)

$ErrorActionPreference = 'Stop'

function Write-Step([string]$Message) {
  Write-Host "`n[DA:ON] $Message" -ForegroundColor Cyan
}

function Stop-PortIfNode([int]$Port) {
  $connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  foreach ($connection in $connections) {
    $pid = $connection.OwningProcess
    if (-not $pid) { continue }
    $process = Get-Process -Id $pid -ErrorAction SilentlyContinue
    if ($process -and $process.ProcessName -match 'node|npm|pwsh|powershell|cmd') {
      Write-Host "Stopping stale localhost:$Port process $($process.ProcessName) PID=$pid"
      Stop-Process -Id $pid -Force
    } else {
      throw "localhost:$Port is occupied by a non-Node process (PID=$pid). Stop it manually and run this script again."
    }
  }
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $repoRoot

if (-not (Test-Path '.git')) {
  throw "This script must be run inside the real-estate-report Git repository."
}

Write-Step 'Preserving local browser data and checking repository state'
$status = git status --porcelain
if ($LASTEXITCODE -ne 0) { throw 'git status failed.' }
if ($status) {
  Write-Host 'Local changes detected. They will NOT be reset or cleaned.' -ForegroundColor Yellow
  $status | ForEach-Object { Write-Host "  $_" }
}

Write-Step "Fetching origin/$Branch"
git fetch origin $Branch
if ($LASTEXITCODE -ne 0) { throw 'git fetch failed.' }

$currentBranch = git branch --show-current
if ($currentBranch -ne $Branch) {
  Write-Step "Switching from $currentBranch to $Branch"
  git switch $Branch
  if ($LASTEXITCODE -ne 0) {
    throw "Could not switch to $Branch. Resolve local tracked-file conflicts first. No reset was performed."
  }
}

Write-Step 'Fast-forwarding only; destructive reset is intentionally disabled'
git pull --ff-only origin $Branch
if ($LASTEXITCODE -ne 0) { throw 'Fast-forward pull failed. No reset/clean was attempted.' }

$head = git rev-parse HEAD
$remote = git rev-parse "origin/$Branch"
Write-Host "Local HEAD : $head"
Write-Host "Remote HEAD: $remote"
if ($head -ne $remote) { throw 'Local and remote HEAD do not match.' }

Write-Step 'Installing exact npm dependencies'
npm ci
if ($LASTEXITCODE -ne 0) { throw 'npm ci failed.' }

Write-Step 'Stopping only stale DA:ON dev listeners on ports 5174 and 5175'
Stop-PortIfNode 5174
Stop-PortIfNode 5175

Write-Step 'Starting the latest DA:ON frontend + proxy'
$logDir = Join-Path $repoRoot '.daon-runtime'
New-Item -ItemType Directory -Path $logDir -Force | Out-Null
$outLog = Join-Path $logDir 'dev.out.log'
$errLog = Join-Path $logDir 'dev.err.log'
$process = Start-Process -FilePath 'cmd.exe' -ArgumentList '/c','npm run dev' -WorkingDirectory $repoRoot -RedirectStandardOutput $outLog -RedirectStandardError $errLog -PassThru

$ready = $false
for ($i = 0; $i -lt 40; $i++) {
  Start-Sleep -Milliseconds 500
  try {
    $response = Invoke-WebRequest -Uri 'http://localhost:5174/control-center' -UseBasicParsing -TimeoutSec 2
    if ($response.StatusCode -eq 200) { $ready = $true; break }
  } catch { }
  if ($process.HasExited) { break }
}

if (-not $ready) {
  Write-Host "Frontend did not become ready. Logs:" -ForegroundColor Red
  if (Test-Path $outLog) { Get-Content $outLog -Tail 80 }
  if (Test-Path $errLog) { Get-Content $errLog -Tail 80 }
  throw 'DA:ON dev server startup failed.'
}

Write-Step 'Latest Agent UI is live'
Write-Host "HEAD: $head" -ForegroundColor Green
Write-Host 'Frontend: http://localhost:5174/' -ForegroundColor Green
Write-Host 'Control Center: http://localhost:5174/control-center' -ForegroundColor Green
Write-Host 'Existing IndexedDB property data is preserved because no browser storage reset is performed.' -ForegroundColor Green
