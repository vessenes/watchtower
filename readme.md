# Watchtower

A web-based viewer for monitoring multiple tmux sessions simultaneously.

## Overview

Watchtower streams read-only output from tmux sessions over WebSockets to a browser, rendering each tmux pane as a separate [beamterm](https://github.com/anthropics/beamterm) terminal component.

## Architecture

```
┌─────────────┐     WebSocket      ┌─────────────┐
│ tmux server │ ─────────────────▶ │   Browser   │
│  (panes)    │    (read-only)     │  (beamterm) │
└─────────────┘                    └─────────────┘
```

- **Server**: Captures output from tmux panes and streams via WebSocket
- **Client**: Renders each pane as an independent beamterm terminal instance
- **Read-only**: No input is sent back to tmux—purely for observation

## Use Case

Monitor multiple concurrent processes, agent sessions, or build pipelines from a single browser view.
