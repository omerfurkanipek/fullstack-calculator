package config

import (
	"slices"
	"testing"
)

func env(vars map[string]string) func(string) string {
	return func(key string) string { return vars[key] }
}

func TestLoadDefaults(t *testing.T) {
	t.Parallel()

	cfg, err := Load(env(nil))
	if err != nil {
		t.Fatal(err)
	}
	if cfg.Port != 8080 {
		t.Errorf("Port = %d, want 8080", cfg.Port)
	}
	if !slices.Equal(cfg.AllowedOrigins, []string{"http://localhost:5173"}) {
		t.Errorf("AllowedOrigins = %v", cfg.AllowedOrigins)
	}
	if cfg.StaticDir != "" {
		t.Errorf("StaticDir = %q, want empty", cfg.StaticDir)
	}
}

func TestLoadOverrides(t *testing.T) {
	t.Parallel()

	cfg, err := Load(env(map[string]string{
		"PORT":            "9090",
		"ALLOWED_ORIGINS": " http://a.test, ,http://b.test ",
		"STATIC_DIR":      "/srv/web",
	}))
	if err != nil {
		t.Fatal(err)
	}
	if cfg.Port != 9090 {
		t.Errorf("Port = %d", cfg.Port)
	}
	if !slices.Equal(cfg.AllowedOrigins, []string{"http://a.test", "http://b.test"}) {
		t.Errorf("AllowedOrigins = %v", cfg.AllowedOrigins)
	}
	if cfg.StaticDir != "/srv/web" {
		t.Errorf("StaticDir = %q", cfg.StaticDir)
	}
}

func TestLoadInvalidPort(t *testing.T) {
	t.Parallel()

	for _, port := range []string{"abc", "0", "70000"} {
		if _, err := Load(env(map[string]string{"PORT": port})); err == nil {
			t.Errorf("PORT=%q should fail", port)
		}
	}
}
