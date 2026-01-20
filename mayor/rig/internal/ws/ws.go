package ws

import "github.com/gorilla/websocket"

// Server handles WebSocket connections and broadcasts pane updates.
type Server struct {
	upgrader websocket.Upgrader
}

// New creates a new WebSocket server.
func New() *Server {
	return &Server{
		upgrader: websocket.Upgrader{},
	}
}
