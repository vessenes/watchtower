package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"watchtower/internal/config"
	"watchtower/internal/tmux"
	"watchtower/internal/ws"
)

func main() {
	cfg := config.Default()

	// Create tmux collector
	collector := tmux.NewCollector(cfg.SocketPath, cfg.SessionFilter, cfg.PollInterval)

	// Create WebSocket hub
	hub := ws.NewHub(collector)
	go hub.Run()

	// Start forwarding tmux updates to WebSocket clients
	hub.StartUpdateForwarder()

	// Start tmux polling
	collector.Start()

	// Create HTTP server
	server := ws.NewServer(hub, "./web/dist")
	addr := fmt.Sprintf(":%d", cfg.Port)

	// Handle graceful shutdown
	go func() {
		sigChan := make(chan os.Signal, 1)
		signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
		<-sigChan

		log.Println("Shutting down...")
		collector.Stop()
		os.Exit(0)
	}()

	log.Printf("Watchtower server starting on %s", addr)
	log.Printf("WebSocket endpoint: ws://localhost%s/ws", addr)
	log.Printf("Polling tmux sessions matching: %s", cfg.SessionFilter)

	if err := http.ListenAndServe(addr, server.Handler()); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
