#!/usr/bin/env bash
# Launch the watchtower rig (Witness + Refinery)
# Usage: ./scripts/launch.sh [--all]
#   --all: Also start daemon and deacon if not running

set -euo pipefail

RIG_NAME="watchtower"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

check_daemon() {
    if gt daemon status 2>&1 | grep -q "running"; then
        return 0
    fi
    return 1
}

check_deacon() {
    if gt deacon status 2>&1 | grep -q "running"; then
        return 0
    fi
    return 1
}

check_witness() {
    if gt witness status "$RIG_NAME" 2>&1 | grep -q "running"; then
        return 0
    fi
    return 1
}

check_refinery() {
    if gt refinery status "$RIG_NAME" 2>&1 | grep -q "running"; then
        return 0
    fi
    return 1
}

# Parse arguments
START_ALL=false
while [[ $# -gt 0 ]]; do
    case $1 in
        --all)
            START_ALL=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [--all]"
            exit 1
            ;;
    esac
done

echo "=== Launching Watchtower Rig ==="
echo

# Check/start daemon and deacon if --all
if [[ "$START_ALL" == "true" ]]; then
    if ! check_daemon; then
        log_info "Starting daemon..."
        gt daemon start
        sleep 1
    else
        log_info "Daemon already running"
    fi

    if ! check_deacon; then
        log_info "Starting deacon..."
        gt deacon start
        sleep 2
    else
        log_info "Deacon already running"
    fi
else
    # Just verify they're running
    if ! check_daemon; then
        log_warn "Daemon not running. Use --all to start it, or run: gt daemon start"
    fi
    if ! check_deacon; then
        log_warn "Deacon not running. Use --all to start it, or run: gt deacon start"
    fi
fi

# Start witness if not running
if ! check_witness; then
    log_info "Starting witness for $RIG_NAME..."
    gt witness start "$RIG_NAME"
    sleep 2
else
    log_info "Witness already running for $RIG_NAME"
fi

# Start refinery if not running
if ! check_refinery; then
    log_info "Starting refinery for $RIG_NAME..."
    gt refinery start "$RIG_NAME"
    sleep 2
else
    log_info "Refinery already running for $RIG_NAME"
fi

echo
echo "=== Status ==="
gt witness status "$RIG_NAME" 2>&1 || true
echo
gt refinery status "$RIG_NAME" 2>&1 || true
echo
log_info "Watchtower rig launch complete"
