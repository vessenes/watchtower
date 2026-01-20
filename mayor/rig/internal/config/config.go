package config

import "time"

type Config struct {
	Port          int
	PollInterval  time.Duration
	SessionFilter string
}

func Default() Config {
	return Config{
		Port:          8080,
		PollInterval:  100 * time.Millisecond,
		SessionFilter: "gt-*",
	}
}
