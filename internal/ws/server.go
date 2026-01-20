package ws

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"

	"github.com/gorilla/websocket"
	"watchtower/internal/tmux"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for development
	},
}

// Message types sent to clients.
type PaneListMessage struct {
	Type  string          `json:"type"`
	Panes []tmux.PaneInfo `json:"panes"`
}

type PaneUpdateMessage struct {
	Type    string `json:"type"`
	Session string `json:"session"`
	Window  string `json:"window"`
	Pane    string `json:"pane"`
	Content string `json:"content"`
	Size    struct {
		Cols int `json:"cols"`
		Rows int `json:"rows"`
	} `json:"size"`
}

// Client represents a connected WebSocket client.
type Client struct {
	hub  *Hub
	conn *websocket.Conn
	send chan []byte
}

// Hub maintains active clients and broadcasts messages.
type Hub struct {
	clients    map[*Client]bool
	broadcast  chan []byte
	register   chan *Client
	unregister chan *Client
	mu         sync.RWMutex
	collector  *tmux.Collector
}

// NewHub creates a new WebSocket hub.
func NewHub(collector *tmux.Collector) *Hub {
	return &Hub{
		clients:    make(map[*Client]bool),
		broadcast:  make(chan []byte, 256),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		collector:  collector,
	}
}

// Run starts the hub's main loop.
func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client] = true
			h.mu.Unlock()

			// Send pane list to newly connected client
			go h.sendPaneList(client)

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.send)
			}
			h.mu.Unlock()

		case message := <-h.broadcast:
			h.mu.RLock()
			for client := range h.clients {
				select {
				case client.send <- message:
				default:
					// Client buffer full, close connection
					close(client.send)
					delete(h.clients, client)
				}
			}
			h.mu.RUnlock()
		}
	}
}

// sendPaneList sends the current pane list to a client.
func (h *Hub) sendPaneList(client *Client) {
	panes := h.collector.Panes()
	msg := PaneListMessage{
		Type:  "pane_list",
		Panes: panes,
	}

	data, err := json.Marshal(msg)
	if err != nil {
		log.Printf("Error marshaling pane list: %v", err)
		return
	}

	select {
	case client.send <- data:
	default:
		// Client buffer full
	}
}

// BroadcastPaneUpdate broadcasts a pane update to all clients.
func (h *Hub) BroadcastPaneUpdate(update tmux.PaneUpdate) {
	msg := PaneUpdateMessage{
		Type:    "pane_update",
		Session: update.Session,
		Window:  update.Window,
		Pane:    update.Pane,
		Content: update.Content,
	}
	msg.Size.Cols = update.Cols
	msg.Size.Rows = update.Rows

	data, err := json.Marshal(msg)
	if err != nil {
		log.Printf("Error marshaling pane update: %v", err)
		return
	}

	h.broadcast <- data
}

// StartUpdateForwarder forwards collector updates to clients.
func (h *Hub) StartUpdateForwarder() {
	go func() {
		for update := range h.collector.Updates() {
			h.BroadcastPaneUpdate(update)
		}
	}()
}

// ServeWs handles WebSocket connection requests.
func (h *Hub) ServeWs(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade failed: %v", err)
		return
	}

	client := &Client{
		hub:  h,
		conn: conn,
		send: make(chan []byte, 256),
	}

	h.register <- client

	go client.writePump()
	go client.readPump()
}

// writePump pumps messages from the hub to the WebSocket connection.
func (c *Client) writePump() {
	defer func() {
		c.conn.Close()
	}()

	for message := range c.send {
		if err := c.conn.WriteMessage(websocket.TextMessage, message); err != nil {
			return
		}
	}
}

// readPump pumps messages from the WebSocket connection to the hub.
// Currently just handles connection closure detection.
func (c *Client) readPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()

	for {
		_, _, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket error: %v", err)
			}
			break
		}
		// For now, we don't process incoming messages from clients
	}
}

// Server wraps the HTTP server with WebSocket and static file handling.
type Server struct {
	hub        *Hub
	staticPath string
}

// NewServer creates a new WebSocket server.
func NewServer(hub *Hub, staticPath string) *Server {
	return &Server{
		hub:        hub,
		staticPath: staticPath,
	}
}

// Handler returns the HTTP handler for the server.
func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()

	// WebSocket endpoint
	mux.HandleFunc("/ws", s.hub.ServeWs)

	// Serve static files from ./web/dist
	fs := http.FileServer(http.Dir(s.staticPath))
	mux.Handle("/", fs)

	return mux
}
