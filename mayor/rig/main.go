package main

import (
	"fmt"
	"log"

	"watchtower/internal/config"
	"watchtower/internal/tmux"
	"watchtower/internal/ws"
)

func main() {
	cfg := config.Default()

	_ = tmux.New()
	_ = ws.New()

	log.Printf("watchtower starting on port %d", cfg.Port)
	log.Printf("poll interval: %v, session filter: %s", cfg.PollInterval, cfg.SessionFilter)
	fmt.Println("watchtower server placeholder")
}
