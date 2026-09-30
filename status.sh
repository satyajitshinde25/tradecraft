#!/usr/bin/env bash

echo "=========================================================="
echo "          TradeCraft Online Access Status                 "
echo "=========================================================="

# Check Backend
if curl -s http://localhost:8000/health >/dev/null 2>&1; then
    echo " Backend (FastAPI):  [ONLINE] -> http://localhost:8000"
else
    echo " Backend (FastAPI):  [OFFLINE]"
fi

# Check ngrok
if curl -s http://127.0.0.1:4040/api/tunnels >/dev/null 2>&1; then
    PUBLIC_URL=$(curl -s http://127.0.0.1:4040/api/tunnels | grep -o 'https://[^"]*ngrok[^"]*' | head -n 1)
    echo " ngrok Tunnel:       [ONLINE] -> $PUBLIC_URL"
    echo " ngrok Web Inspect:  http://127.0.0.1:4040"
else
    echo " ngrok Tunnel:       [OFFLINE]"
fi
echo "=========================================================="
