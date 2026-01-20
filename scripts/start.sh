#!/bin/bash
# Start the watchtower server

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

# Build the server
echo "Building watchtower..."
go build -o watchtower .

# Create pid file directory
mkdir -p "$PROJECT_DIR/.run"

# Check if already running
PID_FILE="$PROJECT_DIR/.run/watchtower.pid"
if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if kill -0 "$PID" 2>/dev/null; then
        echo "Watchtower is already running (PID: $PID)"
        exit 1
    fi
    rm "$PID_FILE"
fi

# Start the server
echo "Starting watchtower server..."
./watchtower &
PID=$!
echo $PID > "$PID_FILE"
echo "Watchtower started (PID: $PID)"
echo "WebSocket endpoint: ws://localhost:8080/ws"
