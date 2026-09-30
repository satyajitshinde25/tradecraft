#!/usr/bin/env bash

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"

echo "Stopping TradeCraft online system..."

# Stop ngrok
pkill -f "ngrok" 2>/dev/null && echo "[✓] Stopped ngrok tunnel." || echo "[-] ngrok not running."

# Stop uvicorn
pkill -f "uvicorn app.main:app" 2>/dev/null && echo "[✓] Stopped FastAPI backend." || echo "[-] Backend not running."

echo "System stopped."
