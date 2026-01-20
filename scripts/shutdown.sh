#!/usr/bin/env bash
# Graceful shutdown of the watchtower rig
# Usage: ./scripts/shutdown.sh [--all]
#   --all: Also stop daemon and deacon

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
STOP_ALL=false
while [[ $# -gt 0 ]]; do
    case $1 in
        --all)
            STOP_ALL=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [--all]"
            exit 1
            ;;
    esac
done

echo "=== Shutting Down Watchtower Rig ==="
echo

# Check for active polecats
POLECAT_OUTPUT=$(gt witness status "$RIG_NAME" 2>&1 || true)
if echo "$POLECAT_OUTPUT" | grep -q "•"; then
    log_warn "Active polecats detected. They should complete via 'gt done'."
    echo "$POLECAT_OUTPUT" | grep "•" || true
    echo
    read -p "Continue shutdown anyway? [y/N] " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Shutdown cancelled"
        exit 0
    fi
fi

# Check merge queue
MQ_OUTPUT=$(gt mq list "$RIG_NAME" 2>&1 || true)
if ! echo "$MQ_OUTPUT" | grep -q "(empty)"; then
    log_warn "Merge queue is not empty:"
    echo "$MQ_OUTPUT"
    echo
fi

# Stop refinery first (completes in-progress merge)
if check_refinery; then
    log_info "Stopping refinery (will complete any in-progress merge)..."
    gt refinery stop "$RIG_NAME" || log_warn "Failed to stop refinery cleanly"
    sleep 2
else
    log_info "Refinery not running"
fi

# Stop witness
if check_witness; then
    log_info "Stopping witness..."
    gt witness stop "$RIG_NAME" || log_warn "Failed to stop witness cleanly"
    sleep 1
else
    log_info "Witness not running"
fi

# Stop daemon and deacon if --all
if [[ "$STOP_ALL" == "true" ]]; then
    log_info "Stopping deacon..."
    gt deacon stop 2>/dev/null || log_warn "Failed to stop deacon"
    sleep 1

    log_info "Stopping daemon..."
    gt daemon stop 2>/dev/null || log_warn "Failed to stop daemon"
fi

echo
log_info "Watchtower rig shutdown complete"
