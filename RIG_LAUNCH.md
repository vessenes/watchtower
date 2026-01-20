# Watchtower Rig Launch Guide

This document covers launching and operating the watchtower **rig** - the Gas Town infrastructure that manages the watchtower project development.

## Overview

The watchtower rig is a Gas Town multi-agent workspace. It coordinates AI agents working on the watchtower codebase:

```
watchtower/                    ← Rig root
├── .beads/                    ← Issue tracking (local runtime state)
├── config.json                ← Rig configuration
├── polecats/                  ← Worker worktrees
│   └── <name>/watchtower/     ← Git worktree for each polecat
├── refinery/                  ← Merge queue processor
│   └── rig/                   ← Refinery's git worktree
└── witness/                   ← Health monitor
    └── state.json             ← Patrol state
```

## Prerequisites

1. **Gas Town CLI** (`gt`) installed and configured
2. **tmux** installed (for agent sessions)
3. **Claude Code** (`claude`) available
4. Git repository cloned and accessible

## Component Hierarchy

Gas Town has a hierarchical agent structure:

```
Daemon (Go process)           ← Mechanical heartbeats, lifecycle
    │
    └── Deacon                ← Town-level watchdog
            │
            ├── Witness       ← Per-rig polecat health monitor
            │       │
            │       └── Polecats (workers)
            │
            └── Refinery      ← Per-rig merge queue processor
```

## Launch Sequence

### 1. Start the Daemon (Town-Level)

The daemon is a background Go process that sends heartbeats and processes lifecycle requests.

```bash
gt daemon start
```

Verify:
```bash
gt daemon status
```

### 2. Start the Deacon (Town-Level)

The Deacon monitors all Witnesses across all rigs.

```bash
gt deacon start
```

Verify:
```bash
gt deacon status
```

### 3. Start the Witness (Rig-Level)

The Witness monitors polecat health for this rig:

```bash
gt witness start watchtower
```

Options:
```bash
gt witness start watchtower --foreground    # Run in foreground
gt witness start watchtower --agent codex   # Use specific agent alias
```

Verify:
```bash
gt witness status watchtower
```

### 4. Start the Refinery (Rig-Level)

The Refinery processes the merge queue:

```bash
gt refinery start watchtower
```

Or from within the rig directory:
```bash
cd ~/gt/watchtower
gt refinery start  # Infers rig from cwd
```

Verify:
```bash
gt refinery status watchtower
gt mq list watchtower  # Check merge queue
```

## Quick Launch (All Components)

To launch everything for the watchtower rig:

```bash
# Town-level (if not already running)
gt daemon start
gt deacon start

# Rig-level
gt witness start watchtower
gt refinery start watchtower
```

## Shutdown Sequence

Stop in reverse order to ensure clean handoffs:

### 1. Stop Polecats (if any are running)

Polecats should complete via `gt done`. For emergency cleanup:
```bash
# Check for running polecats
gt witness status watchtower

# If stuck, the witness will handle cleanup
```

### 2. Stop the Refinery

```bash
gt refinery stop watchtower
```

This completes any in-progress merge before stopping.

### 3. Stop the Witness

```bash
gt witness stop watchtower
```

### 4. Stop Deacon and Daemon (if shutting down entirely)

```bash
gt deacon stop
gt daemon stop
```

## Health Checks

### Quick Status

```bash
# All statuses at once
gt daemon status
gt deacon status
gt witness status watchtower
gt refinery status watchtower
```

### Merge Queue

```bash
gt mq list watchtower      # Show queue
gt mq next watchtower      # Show highest priority MR
gt refinery ready          # List MRs ready for processing
gt refinery blocked        # List blocked MRs
```

### Polecat Activity

```bash
gt trail                   # Show recent agent activity
gt ready                   # Show work ready across town
```

## Common Operations

### Assign Work to a Polecat

```bash
gt sling <bead-id> watchtower   # Assign work to rig
```

### Check Hook Status

From within a polecat session:
```bash
gt hook                    # Show hooked work
gt mol status              # Show molecule (workflow) status
```

### View Merge Queue

```bash
gt mq list watchtower      # All MRs
gt mq status <mr-id>       # Detailed MR status
```

### Retry Failed Merge

```bash
gt mq retry <mr-id>
```

## Troubleshooting

### Witness Patrol Check-Refinery Gap

**Issue**: The witness patrol's check-refinery step only verifies:
1. Refinery session is alive
2. There are pending MRs

It does NOT check if the MQ backlog is actually being processed.

**Symptoms**:
- MRs pile up in queue
- Refinery shows "running" but work isn't moving

**Diagnosis**:
```bash
gt mq list watchtower      # Check queue depth
gt refinery status watchtower  # Check last activity
```

**Resolution**:
```bash
gt refinery restart watchtower
```

### Stuck Polecat

**Symptoms**: Polecat shows as running but isn't progressing

**Diagnosis**:
```bash
gt witness status watchtower   # Check monitored polecats
gt trail                       # Check recent activity
```

**Resolution**: The witness should detect and handle stuck polecats. If not:
```bash
# Attach to witness and investigate
gt witness attach watchtower
```

### Zombie Polecat

**Issue**: Polecat finished but didn't run `gt done`

**Symptoms**:
- Work complete but sandbox still exists
- No MR in queue

**Resolution**: The witness handles zombie cleanup. Force if needed:
```bash
# From witness: escalate for cleanup
```

### Merge Conflicts

**Symptoms**: MR stuck in "conflict" state

**Resolution**:
```bash
gt mq status <mr-id>           # View conflict details
# Refinery spawns fresh polecat to re-implement
```

### Session Crashes

**Issue**: tmux session died mid-work

**Resolution**: Witness detects and restarts with hooked work:
```bash
gt witness status watchtower   # Should show recovery in progress
```

## Configuration

### Rig Config (`config.json`)

```json
{
  "type": "rig",
  "version": 1,
  "name": "watchtower",
  "git_url": "git@github.com:vessenes/watchtower.git",
  "default_branch": "main",
  "beads": {
    "prefix": "wa"
  }
}
```

### Witness State (`witness/state.json`)

```json
{
  "patrol_count": 0,
  "extraordinary_action": false,
  "last_patrol": "2026-01-19",
  "notes": "Fresh cycle after handoff"
}
```

## Logs

### Daemon Logs

```bash
gt daemon logs
# Or directly:
cat ~/gt/daemon/daemon.log
```

### Agent Session Logs

Attach to view live output:
```bash
gt witness attach watchtower
gt refinery attach watchtower
gt deacon attach
```

## Environment Variables

Common overrides when starting components:

```bash
# Use different model
gt witness start watchtower --env ANTHROPIC_MODEL=claude-3-haiku

# Multiple env vars
gt refinery start watchtower \
  --env ANTHROPIC_MODEL=claude-3-opus \
  --env DEBUG=true
```

## See Also

- `ARCHITECTURE.md` - Watchtower application architecture
- `readme.md` - Project overview
- `gt --help` - Full CLI reference
