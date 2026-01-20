# Watchtower Scripts

Scripts for managing the watchtower server.

## Usage

### Start the server

```bash
./scripts/start.sh
```

Builds and starts the watchtower Go server. The server runs in the background and its PID is stored in `.run/watchtower.pid`.

### Stop the server

```bash
./scripts/stop.sh
```

Stops the running watchtower server using the stored PID.

## Server Details

- **Port**: 8080 (default)
- **WebSocket endpoint**: `ws://localhost:8080/ws`
- **Static files**: Served from `./web/dist`

The server polls tmux sessions and streams pane content to connected WebSocket clients.
