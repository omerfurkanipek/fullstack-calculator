package main

import (
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/omerfurkanipek/fullstack-calculator/backend/internal/config"
)

func TestNewHandlerServesAPIWithCORS(t *testing.T) {
	t.Parallel()

	h := newHandler(config.Config{AllowedOrigins: []string{"http://web.test"}}, slog.New(slog.NewTextHandler(io.Discard, nil)))

	req := httptest.NewRequest(http.MethodPost, "/api/v1/multiply", strings.NewReader(`{"a": 6, "b": 7}`))
	req.Header.Set("Origin", "http://web.test")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"result":42`) {
		t.Fatalf("got %d %s", rec.Code, rec.Body)
	}
	if rec.Header().Get("Access-Control-Allow-Origin") != "http://web.test" {
		t.Error("missing CORS header")
	}
}

func TestNewHandlerServesStaticFrontend(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "index.html"), []byte("<h1>calc</h1>"), 0o600); err != nil {
		t.Fatal(err)
	}
	h := newHandler(config.Config{StaticDir: dir}, slog.New(slog.NewTextHandler(io.Discard, nil)))

	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/", nil))
	if rec.Code != http.StatusOK || rec.Body.String() != "<h1>calc</h1>" {
		t.Fatalf("got %d %q", rec.Code, rec.Body)
	}

	// API routes still win over the SPA fallback.
	rec = httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/v1/operations", nil))
	if !strings.Contains(rec.Body.String(), `"operations"`) {
		t.Errorf("API shadowed by SPA: %s", rec.Body)
	}
}
