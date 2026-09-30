# ==========================================================
#     TradeCraft / Market Sprint — Online Access Launcher
#     (Windows PowerShell)
# ==========================================================

$ErrorActionPreference = "Stop"
$DIR = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "    TradeCraft / Market Sprint — Online Access Launcher   " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Start backend if not already running
$backendUp = $false
try {
    $r = Invoke-WebRequest -Uri "http://localhost:8000/health" -UseBasicParsing -TimeoutSec 2 -ErrorAction SilentlyContinue
    if ($r.StatusCode -eq 200) { $backendUp = $true }
} catch {}

if ($backendUp) {
    Write-Host "[OK] Backend server is already running on http://localhost:8000" -ForegroundColor Green
} else {
    Write-Host "[*] Starting backend FastAPI server on port 8000..." -ForegroundColor Yellow
    Start-Process -FilePath "$DIR\backend\venv\Scripts\python.exe" `
        -ArgumentList "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000" `
        -WorkingDirectory "$DIR\backend" `
        -WindowStyle Hidden `
        -RedirectStandardOutput "$DIR\backend.log" `
        -RedirectStandardError "$DIR\backend_err.log"

    # Wait for backend to be ready
    for ($i = 1; $i -le 15; $i++) {
        Start-Sleep -Seconds 1
        try {
            $r = Invoke-WebRequest -Uri "http://localhost:8000/health" -UseBasicParsing -TimeoutSec 2 -ErrorAction SilentlyContinue
            if ($r.StatusCode -eq 200) {
                Write-Host "[OK] Backend started successfully!" -ForegroundColor Green
                break
            }
        } catch {}
        if ($i -eq 15) {
            Write-Host "[!] Backend did not start in time. Check backend.log for errors." -ForegroundColor Red
        }
    }
}

# 2. Start ngrok tunnel
$ngrokUp = $false
try {
    $r = Invoke-WebRequest -Uri "http://127.0.0.1:4040/api/tunnels" -UseBasicParsing -TimeoutSec 2 -ErrorAction SilentlyContinue
    if ($r.StatusCode -eq 200) {
        $tunnels = $r.Content
        if ($tunnels -match "localhost:8000") {
            $ngrokUp = $true
            Write-Host "[OK] ngrok tunnel is already active and routing to port 8000." -ForegroundColor Green
        } else {
            Write-Host "[!] Existing ngrok is routing elsewhere. Restarting..." -ForegroundColor Yellow
            Get-Process -Name "ngrok" -ErrorAction SilentlyContinue | Stop-Process -Force
            Start-Sleep -Seconds 2
        }
    }
} catch {}

if (-not $ngrokUp) {
    Write-Host "[*] Launching ngrok tunnel using $DIR\ngrok.yml..." -ForegroundColor Yellow
    Start-Process -FilePath "ngrok" `
        -ArgumentList "start", "--config", "$DIR\ngrok.yml", "tradecraft" `
        -WindowStyle Hidden

    # Wait for ngrok API
    for ($i = 1; $i -le 15; $i++) {
        Start-Sleep -Seconds 1
        try {
            $r = Invoke-WebRequest -Uri "http://127.0.0.1:4040/api/tunnels" -UseBasicParsing -TimeoutSec 2 -ErrorAction SilentlyContinue
            if ($r.StatusCode -eq 200) { break }
        } catch {}
    }
}

# 3. Retrieve and print public URL
Start-Sleep -Seconds 2
$publicUrl = ""
try {
    $r = Invoke-WebRequest -Uri "http://127.0.0.1:4040/api/tunnels" -UseBasicParsing -TimeoutSec 5
    $json = $r.Content | ConvertFrom-Json
    foreach ($t in $json.tunnels) {
        if ($t.public_url -match "https://") {
            $publicUrl = $t.public_url
            break
        }
    }
} catch {}

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "                   SYSTEM IS LIVE ONLINE                  " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
if ($publicUrl) {
    Write-Host " Public Online URL: $publicUrl" -ForegroundColor White
    Write-Host " Participant Login: $publicUrl" -ForegroundColor White
    Write-Host " Admin Dashboard:   $publicUrl/admin" -ForegroundColor White
} else {
    Write-Host " [!] Could not extract public URL from ngrok API." -ForegroundColor Yellow
    Write-Host "     Check status at: http://127.0.0.1:4040" -ForegroundColor Yellow
}
Write-Host " Local Access:      http://localhost:8000" -ForegroundColor White
Write-Host " ngrok Web Console: http://127.0.0.1:4040" -ForegroundColor White
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " Credentials Reminder:" -ForegroundColor Cyan
Write-Host " - Teams: TEAM-01 .. TEAM-25 (Password: sprint01 .. sprint25)" -ForegroundColor Cyan
Write-Host " - Admin: ADMIN / admin123" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
