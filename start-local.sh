#!/bin/sh
set -eu

cd "$(dirname "$0")"

PORT="${PORT:-5173}"
HOST="${HOST:-0.0.0.0}"

echo "SpeakBetter starting on ${HOST}:${PORT}"
echo "Computer: http://localhost:${PORT}"
echo "Phone on same Wi-Fi: http://<your-mac-lan-ip>:${PORT}"

HOST="$HOST" PORT="$PORT" node server.js
