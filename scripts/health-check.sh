#!/usr/bin/env bash
# Health check for the watchtower rig
# Usage: ./scripts/health-check.sh [--json]

set -euo pipefail

RIG_NAME="watchtower"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

JSON_OUTPUT=false
if [[ "${1:-}" == "--json" ]]; then
    JSON_OUTPUT=true
fi

# Health check functions
check_daemon() {
    if gt daemon status 2>&1 | grep -q "running"; then
        echo "ok"
    else
        echo "down"
    fi
}

check_deacon() {
    if gt deacon status 2>&1 | grep -q "running"; then
        echo "ok"
    else
        echo "down"
    fi
}

check_witness() {
    if gt witness status "$RIG_NAME" 2>&1 | grep -q "running"; then
        echo "ok"
    else
        echo "down"
    fi
}

check_refinery() {
    if gt refinery status "$RIG_NAME" 2>&1 | grep -q "running"; then
        echo "ok"
    else
        echo "down"
    fi
}

get_mq_depth() {
    local output
    output=$(gt mq list "$RIG_NAME" 2>&1)
    if echo "$output" | grep -q "(empty)"; then
        echo "0"
    else
        # Count lines that look like MR entries
        echo "$output" | grep -c "^  " 2>/dev/null || echo "0"
    fi
}

get_polecat_count() {
    local output
    output=$(gt witness status "$RIG_NAME" 2>&1)
    echo "$output" | grep -c "•" 2>/dev/null || echo "0"
}

# Collect health data
DAEMON_STATUS=$(check_daemon)
DEACON_STATUS=$(check_deacon)
WITNESS_STATUS=$(check_witness)
REFINERY_STATUS=$(check_refinery)
MQ_DEPTH=$(get_mq_depth)
POLECAT_COUNT=$(get_polecat_count)

# Determine overall health
OVERALL="healthy"
if [[ "$DAEMON_STATUS" != "ok" ]] || [[ "$DEACON_STATUS" != "ok" ]]; then
    OVERALL="critical"
elif [[ "$WITNESS_STATUS" != "ok" ]] || [[ "$REFINERY_STATUS" != "ok" ]]; then
    OVERALL="degraded"
fi

# Output
if [[ "$JSON_OUTPUT" == "true" ]]; then
    cat <<EOF
{
  "rig": "$RIG_NAME",
  "overall": "$OVERALL",
  "timestamp": "$(date -Iseconds)",
  "components": {
    "daemon": "$DAEMON_STATUS",
    "deacon": "$DEACON_STATUS",
    "witness": "$WITNESS_STATUS",
    "refinery": "$REFINERY_STATUS"
  },
  "metrics": {
    "mq_depth": $MQ_DEPTH,
    "polecat_count": $POLECAT_COUNT
  }
}
EOF
else
    echo "=== Watchtower Rig Health Check ==="
    echo "Timestamp: $(date)"
    echo

    # Status indicators
    status_icon() {
        case $1 in
            ok) echo -e "${GREEN}✓${NC}" ;;
            down) echo -e "${RED}✗${NC}" ;;
            *) echo -e "${YELLOW}?${NC}" ;;
        esac
    }

    echo "Components:"
    echo "  $(status_icon $DAEMON_STATUS) Daemon: $DAEMON_STATUS"
    echo "  $(status_icon $DEACON_STATUS) Deacon: $DEACON_STATUS"
    echo "  $(status_icon $WITNESS_STATUS) Witness: $WITNESS_STATUS"
    echo "  $(status_icon $REFINERY_STATUS) Refinery: $REFINERY_STATUS"
    echo
    echo "Metrics:"
    echo "  Merge Queue Depth: $MQ_DEPTH"
    echo "  Active Polecats: $POLECAT_COUNT"
    echo

    case $OVERALL in
        healthy)
            echo -e "Overall: ${GREEN}HEALTHY${NC}"
            ;;
        degraded)
            echo -e "Overall: ${YELLOW}DEGRADED${NC}"
            ;;
        critical)
            echo -e "Overall: ${RED}CRITICAL${NC}"
            ;;
    esac
fi

# Exit code based on health
case $OVERALL in
    healthy) exit 0 ;;
    degraded) exit 1 ;;
    critical) exit 2 ;;
esac
