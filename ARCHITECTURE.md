# Watchtower Architecture

## Technology Stack

- **Server**: Go
- **Transport**: WebSocket
- **Client**: Browser with beamterm terminal components

## Components

### Server (Go)

```
┌────────────────────────────────────────────────────────┐
│                    watchtower server                   │
├──────────────────┬─────────────────────────────────────┤
│  tmux collector  │         websocket server            │
│                  │                                     │
│  - list sessions │  - /ws endpoint                     │
│  - capture panes │  - broadcast pane updates           │
│  - poll or pty   │  - handle client connections        │
└──────────────────┴─────────────────────────────────────┘
```

**Responsibilities:**
- Enumerate tmux sessions and panes via `tmux list-panes`
- Capture pane content via `tmux capture-pane -p -t <pane>`
- Stream updates to connected WebSocket clients
- Serve static files for the browser client

### Client (Browser)

```
┌─────────────────────────────────────────────────────────┐
│                     Browser Client                      │
├─────────────────────────────────────────────────────────┤
│  - Connect to WebSocket                                 │
│  - Receive pane updates (content + metadata)            │
│  - Render each pane as a beamterm instance              │
│  - Layout: grid or configurable arrangement             │
└─────────────────────────────────────────────────────────┘
```

## Protocol

### WebSocket Messages (Server → Client)

```json
{
  "type": "pane_update",
  "session": "main",
  "window": "0",
  "pane": "1",
  "content": "...",
  "cursor": { "x": 0, "y": 24 },
  "size": { "cols": 80, "rows": 24 }
}
```

```json
{
  "type": "pane_list",
  "panes": [
    { "session": "main", "window": "0", "pane": "0", "title": "vim" },
    { "session": "main", "window": "0", "pane": "1", "title": "zsh" }
  ]
}
```

## Data Flow

1. Server polls tmux panes at configurable interval (e.g., 100ms)
2. On change detection, server sends `pane_update` over WebSocket
3. Client receives update, routes to correct beamterm instance
4. beamterm renders terminal output

## Configuration

```yaml
# watchtower.yaml
server:
  port: 8080
  poll_interval_ms: 100

tmux:
  socket_path: ""  # default: tmux default
  sessions: []     # empty = all sessions
```

## Future Considerations

- PTY-level capture for lower latency (instead of polling)
- Input forwarding (optional, disabled by default)
- Session filtering and access control
- Multiple tmux server support
