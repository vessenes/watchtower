# Watchtower Architecture

## Technology Stack

- **Server**: Go
- **Transport**: WebSocket
- **Client**:
  - Three.js for 3D rendering
  - beamterm for terminal emulation
  - Terminals rendered to canvas, mapped as Three.js textures

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
│  WebSocket Layer                                        │
│  - Connect to server                                    │
│  - Receive pane updates                                 │
├─────────────────────────────────────────────────────────┤
│  Terminal Layer                                         │
│  - beamterm instances (one per pane)                    │
│  - Render to offscreen canvas                           │
├─────────────────────────────────────────────────────────┤
│  3D Layer (Three.js)                                    │
│  - Map terminal canvases as textures                    │
│  - Render to 3D scene                                   │
│  - Camera controls (orbit, zoom)                        │
├─────────────────────────────────────────────────────────┤
│  View Modes                                             │
│  - Sphere (default): terminals on inner sphere surface  │
│  - Grid: flat 2D grid layout                            │
│  - (future views)                                       │
└─────────────────────────────────────────────────────────┘
```

### Sphere View

```
        ╭───────────────────────╮
      ╱   ┌───┐ ┌───┐ ┌───┐     ╲
     │    │ T │ │ T │ │ T │      │
     │    └───┘ └───┘ └───┘      │
     │  ┌───┐    👁    ┌───┐     │  ← camera at center
     │  │ T │  (you)   │ T │     │
     │  └───┘          └───┘     │
     │    ┌───┐ ┌───┐ ┌───┐      │
      ╲   │ T │ │ T │ │ T │     ╱
        ╰───────────────────────╯
```

- Terminals arranged on inner surface of sphere
- User camera at center, looking outward
- Orbit controls to look around
- Click terminal to focus/zoom

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
4. beamterm renders terminal output to offscreen canvas
5. Three.js samples canvas as texture, updates 3D scene

## Rendering Pipeline

```
tmux pane → WebSocket → beamterm (offscreen canvas) → Three.js texture → sphere panel
```

Each frame:
1. beamterm instances update their canvases (only on new data)
2. Three.js `texture.needsUpdate = true` for changed terminals
3. Three.js renders scene with camera at sphere center

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
