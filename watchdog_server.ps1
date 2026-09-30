# ==========================================================
#  TradeCraft / Market Sprint — Crash-Proof Server Watchdog
#  Continuously monitors uvicorn & auto-restarts on any exit.
#  State and clock resume at the exact tick!
# ==========================================================

$DIR = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " TradeCraft Server Watchdog (Auto-Recovery Supervisor)    " -ForegroundColor Yellow
Write-Host " - Port: 8000" -ForegroundColor Gray
Write-Host " - Single-Session Enforcement: Active (1 screen/team)" -ForegroundColor Gray
Write-Host " - Auto-Resumes simulation at exact tick on restart" -ForegroundColor Gray
Write-Host "==========================================================" -ForegroundColor Cyan

Set-Location -Path "$DIR\backend"

while ($true) {
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Starting FastAPI server..." -ForegroundColor Green
    & ".\venv\Scripts\python.exe" -m uvicorn app.main:app --host 0.0.0.0 --port 8000

    $code = $LASTEXITCODE
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] ⚠️ Server stopped (Exit code: $code). Auto-restarting in 2 seconds..." -ForegroundColor Red
    Start-Sleep -Seconds 2
}
