// Package config loads server settings from environment variables.
package config

import (
	"fmt"
	"strconv"
	"strings"
)

// Config holds runtime settings for the server.
type Config struct {
	// Port the HTTP server listens on.
	Port int
	// AllowedOrigins lists origins permitted by CORS; "*" allows any.
	AllowedOrigins []string
	// StaticDir, when set, is served as the frontend SPA (used by the Docker image).
	StaticDir string
}

// Load reads configuration using getenv (os.Getenv in production) so it can be
// tested without mutating the process environment.
func Load(getenv func(string) string) (Config, error) {
	cfg := Config{
		Port:           8080,
		AllowedOrigins: []string{"http://localhost:5173"},
		StaticDir:      strings.TrimSpace(getenv("STATIC_DIR")),
	}

	if raw := strings.TrimSpace(getenv("PORT")); raw != "" {
		port, err := strconv.Atoi(raw)
		if err != nil || port < 1 || port > 65535 {
			return Config{}, fmt.Errorf("invalid PORT %q: must be an integer between 1 and 65535", raw)
		}
		cfg.Port = port
	}

	if raw := getenv("ALLOWED_ORIGINS"); strings.TrimSpace(raw) != "" {
		var origins []string
		for _, o := range strings.Split(raw, ",") {
			if o = strings.TrimSpace(o); o != "" {
				origins = append(origins, o)
			}
		}
		cfg.AllowedOrigins = origins
	}

	return cfg, nil
}
