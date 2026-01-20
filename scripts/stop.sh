#!/bin/bash
# Stop the watchtower server

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

PID_FILE="$PROJECT_DIR/.run/watchtower.pid"

if [ ! -f "$PID_FILE" ]; then
    echo "Watchtower is not running (no pid file)"
    exit 0
fi

PID=$(cat "$PID_FILE")

if ! kill -0 "$PID" 2>/dev/null; then
    echo "Watchtower is not running (stale pid file)"
    rm "$PID_FILE"
    exit 0
fi

echo "Stopping watchtower (PID: $PID)..."
kill "$PID"
rm "$PID_FILE"
echo "Watchtower stopped"
