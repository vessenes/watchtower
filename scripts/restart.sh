#!/usr/bin/env bash
# Restart the watchtower rig components
# Usage: ./scripts/restart.sh [witness|refinery|all]
#   witness: Restart only the witness
#   refinery: Restart only the refinery
#   all (default): Restart both witness and refinery

set -euo pipefail

RIG_NAME="watchtower"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

restart_witness() {
    log_info "Restarting witness..."
    if gt witness status "$RIG_NAME" 2>&1 | grep -q "running"; then
        gt witness stop "$RIG_NAME" || true
        sleep 2
    fi
    gt witness start "$RIG_NAME"
    sleep 2
    log_info "Witness restarted"
}

restart_refinery() {
    log_info "Restarting refinery..."
    if gt refinery status "$RIG_NAME" 2>&1 | grep -q "running"; then
        gt refinery stop "$RIG_NAME" || true
        sleep 2
    fi
    gt refinery start "$RIG_NAME"
    sleep 2
    log_info "Refinery restarted"
}

# Parse arguments
COMPONENT="${1:-all}"

echo "=== Restarting Watchtower Rig Components ==="
echo

case "$COMPONENT" in
    witness)
        restart_witness
        ;;
    refinery)
        restart_refinery
        ;;
    all)
        restart_refinery
        restart_witness
        ;;
    *)
        echo "Unknown component: $COMPONENT"
        echo "Usage: $0 [witness|refinery|all]"
        exit 1
        ;;
esac

echo
echo "=== Status ==="
gt witness status "$RIG_NAME" 2>&1 || true
echo
gt refinery status "$RIG_NAME" 2>&1 || true
echo
log_info "Restart complete"
