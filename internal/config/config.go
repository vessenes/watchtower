package config

import "time"

// Config holds the watchtower configuration.
type Config struct {
	Port          int
	PollInterval  time.Duration
	SessionFilter string
	SocketPath    string
}

// Default returns the default configuration.
func Default() Config {
	return Config{
		Port:          8080,
		PollInterval:  100 * time.Millisecond,
		SessionFilter: "gt-*",
		SocketPath:    "", // empty = tmux default
	}
}
