# dev.ps1 — start the TaskFlow backend (FastAPI, hot-reload) + web (Next.js) reliably.
# Frees stale ports, ensures env files exist, then launches each server in its own window.
$ErrorActionPreference = "Stop"

$root = $PSScriptRoot
$backend = Join-Path $root "backend"
$web = Join-Path $root "web"
$venvPy = Join-Path $backend ".venv\Scripts\python.exe"
$nodeDir = "C:\Program Files\nodejs"

# 1. Interpreters -----------------------------------------------------------
if (-not (Test-Path $venvPy)) {
    Write-Host "Backend venv not found at $venvPy" -ForegroundColor Red
    Write-Host "Create it first:" -ForegroundColor Yellow
    Write-Host "  python -m venv backend\.venv"
    Write-Host "  backend\.venv\Scripts\python -m pip install -r backend\requirements.txt"
    exit 1
}
if (-not (Get-Command node -ErrorAction SilentlyContinue) -and (Test-Path $nodeDir)) {
    $env:Path = "$nodeDir;$env:Path"
}

# 2. Env files (create local defaults if missing) ---------------------------
$backendEnv = Join-Path $backend ".env"
if (-not (Test-Path $backendEnv)) {
    @'
DATABASE_URL=sqlite+aiosqlite:///./dev.db
SECRET_KEY=dev-secret-change-me
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=30
ALLOWED_ORIGINS=http://localhost:3000
SEED_ON_STARTUP=true
SEED_PASSWORD=password123
ENVIRONMENT=development
'@ | Set-Content -Path $backendEnv -Encoding utf8
    Write-Host "Created backend\.env (SQLite dev config)"
}
$webEnv = Join-Path $web ".env.local"
if (-not (Test-Path $webEnv)) {
    "NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1" | Set-Content -Path $webEnv -Encoding utf8
    Write-Host "Created web\.env.local"
}

# 3. Free ports 8000 + 3000 (only node/python listeners) --------------------
function Stop-Port($port) {
    Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | ForEach-Object {
        $p = Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue
        if ($p -and ($p.ProcessName -eq "node" -or $p.ProcessName -eq "python")) {
            Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
            Write-Host "Freed port $port (stopped $($p.ProcessName) pid $($p.Id))"
        }
    }
}
Stop-Port 8000
Stop-Port 3000
Start-Sleep -Seconds 1

# 4. Backend window (hot-reload; reads backend\.env from its cwd) ------------
$backendCmd = "Set-Location '$backend'; & '$venvPy' -m uvicorn app.main:app --reload --port 8000"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCmd

# 5. Web window (Next.js dev on a fixed port) -------------------------------
$webCmd = "`$env:Path='$nodeDir;' + `$env:Path; Set-Location '$web'; npm run dev"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $webCmd

# 6. Info -------------------------------------------------------------------
Write-Host ""
Write-Host "TaskFlow dev starting (two windows opened)..." -ForegroundColor Green
Write-Host "  Web : http://localhost:3000"
Write-Host "  API : http://localhost:8000   (docs: http://localhost:8000/docs)"
Write-Host "  Backend auto-reloads on code changes; the web app has hot-reload (HMR)."
Write-Host ""
Write-Host "Logins (password: password123):" -ForegroundColor Cyan
Write-Host "  Assigners: ritik@curlohair.com, tanishk@curlohair.com, prakash@curlohair.com"
Write-Host "  Assignees: anmol@, pushpendra@, kunal@, saksham@, suraj@curlohair.com"
Write-Host ""
Write-Host "Stop both with:  .\stop-dev.ps1"
