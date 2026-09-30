#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$DIR"

echo "=========================================================="
echo "    TradeCraft / Market Sprint — Online Access Launcher   "
echo "=========================================================="

# 1. Ensure backend is running on port 8000
if curl -s http://localhost:8000/health >/dev/null 2>&1; then
    echo "[✓] Backend server is already running on http://localhost:8000"
else
    echo "[*] Starting backend FastAPI server on port 8000..."
    cd "$DIR/backend"
    nohup python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 > "$DIR/backend.log" 2>&1 &
    cd "$DIR"

    # Wait for backend to be ready
    for i in {1..15}; do
        if curl -s http://localhost:8000/health >/dev/null 2>&1; then
            echo "[✓] Backend started successfully!"
            break
        fi
        sleep 1
    done
fi

# 2. Check and start ngrok tunnel
NGROK_BIN="$DIR/ngrok"
if [ ! -f "$NGROK_BIN" ]; then
    ln -sf /snap/bin/ngrok "$NGROK_BIN"
fi

TUNNEL_RUNNING=false
if curl -s http://127.0.0.1:4040/api/tunnels >/dev/null 2>&1; then
    TUNNEL_INFO=$(curl -s http://127.0.0.1:4040/api/tunnels)
    if echo "$TUNNEL_INFO" | grep -q "localhost:8000"; then
        TUNNEL_RUNNING=true
        echo "[✓] ngrok tunnel is already active and routing to port 8000."
    else
        echo "[!] Existing ngrok process is routing to another port. Restarting..."
        pkill -f "ngrok" || true
        sleep 2
    fi
fi

if [ "$TUNNEL_RUNNING" = false ]; then
    echo "[*] Launching ngrok tunnel using $DIR/ngrok.yml..."
    nohup "$NGROK_BIN" start --config "$DIR/ngrok.yml" tradecraft > "$DIR/ngrok.log" 2>&1 &

    # Wait for ngrok API
    for i in {1..15}; do
        if curl -s http://127.0.0.1:4040/api/tunnels >/dev/null 2>&1; then
            break
        fi
        sleep 1
    done
fi

# 3. Retrieve and print public URL
PUBLIC_URL=$(curl -s http://127.0.0.1:4040/api/tunnels | grep -o 'https://[^"]*ngrok[^"]*' | head -n 1)

echo ""
echo "=========================================================="
echo "                   SYSTEM IS LIVE ONLINE                  "
echo "=========================================================="
if [ -n "$PUBLIC_URL" ]; then
    echo " 🌐 Public Online URL: $PUBLIC_URL"
    echo " 🔑 Participant Login: $PUBLIC_URL"
    echo " 🛡️ Admin Dashboard:   $PUBLIC_URL/admin"
else
    echo " [!] Could not automatically extract public URL from ngrok API."
    echo "     Check status at: http://127.0.0.1:4040"
fi
echo " 💻 Local Access:      http://localhost:8000"
echo " ⚙️ ngrok Web Console: http://127.0.0.1:4040"
echo "=========================================================="
echo " Credentials Reminder:"
echo " - Teams: TEAM-01 .. TEAM-25 (Password: sprint01 .. sprint25)"
echo " - Admin: admin / admin123"
echo "=========================================================="
