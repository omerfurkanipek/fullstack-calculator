package httpapi

import (
	"bytes"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"testing/fstest"
)

func discardLogger() *slog.Logger { return slog.New(slog.NewTextHandler(io.Discard, nil)) }

func okHandler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusTeapot)
	})
}

func TestChainOrder(t *testing.T) {
	t.Parallel()

	var order []string
	mark := func(name string) Middleware {
		return func(next http.Handler) http.Handler {
			return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				order = append(order, name)
				next.ServeHTTP(w, r)
			})
		}
	}

	h := Chain(okHandler(), mark("outer"), mark("inner"))
	h.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/", nil))

	if strings.Join(order, ",") != "outer,inner" {
		t.Errorf("order = %v", order)
	}
}

func TestRecover(t *testing.T) {
	t.Parallel()

	panicking := http.HandlerFunc(func(http.ResponseWriter, *http.Request) { panic("boom") })
	rec := httptest.NewRecorder()
	Recover(discardLogger())(panicking).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/", nil))

	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), CodeInternal) {
		t.Errorf("body = %s", rec.Body)
	}
}

func TestLoggerRecordsStatus(t *testing.T) {
	t.Parallel()

	var buf bytes.Buffer
	logger := slog.New(slog.NewTextHandler(&buf, nil))
	rec := httptest.NewRecorder()
	Logger(logger)(okHandler()).ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/api/v1/add", nil))

	out := buf.String()
	for _, want := range []string{"method=POST", "path=/api/v1/add", "status=418"} {
		if !strings.Contains(out, want) {
			t.Errorf("log %q missing %q", out, want)
		}
	}
}

func TestCORS(t *testing.T) {
	t.Parallel()

	mw := CORS([]string{"http://allowed.test"})

	t.Run("allowed origin gets header", func(t *testing.T) {
		t.Parallel()
		req := httptest.NewRequest(http.MethodPost, "/", nil)
		req.Header.Set("Origin", "http://allowed.test")
		rec := httptest.NewRecorder()
		mw(okHandler()).ServeHTTP(rec, req)

		if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "http://allowed.test" {
			t.Errorf("Allow-Origin = %q", got)
		}
		if rec.Code != http.StatusTeapot {
			t.Errorf("request should reach the next handler, status = %d", rec.Code)
		}
	})

	t.Run("disallowed origin gets no header", func(t *testing.T) {
		t.Parallel()
		req := httptest.NewRequest(http.MethodPost, "/", nil)
		req.Header.Set("Origin", "http://evil.test")
		rec := httptest.NewRecorder()
		mw(okHandler()).ServeHTTP(rec, req)

		if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "" {
			t.Errorf("Allow-Origin = %q, want empty", got)
		}
	})

	t.Run("preflight short-circuits", func(t *testing.T) {
		t.Parallel()
		req := httptest.NewRequest(http.MethodOptions, "/api/v1/add", nil)
		req.Header.Set("Origin", "http://allowed.test")
		req.Header.Set("Access-Control-Request-Method", http.MethodPost)
		rec := httptest.NewRecorder()
		mw(okHandler()).ServeHTTP(rec, req)

		if rec.Code != http.StatusNoContent {
			t.Fatalf("status = %d, want 204", rec.Code)
		}
		if got := rec.Header().Get("Access-Control-Allow-Methods"); !strings.Contains(got, http.MethodPost) {
			t.Errorf("Allow-Methods = %q", got)
		}
	})

	t.Run("wildcard allows any origin", func(t *testing.T) {
		t.Parallel()
		req := httptest.NewRequest(http.MethodPost, "/", nil)
		req.Header.Set("Origin", "http://anything.test")
		rec := httptest.NewRecorder()
		CORS([]string{"*"})(okHandler()).ServeHTTP(rec, req)

		if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "http://anything.test" {
			t.Errorf("Allow-Origin = %q", got)
		}
	})
}

func TestSPA(t *testing.T) {
	t.Parallel()

	fsys := fstest.MapFS{
		"index.html":    {Data: []byte("<html>app</html>")},
		"assets/app.js": {Data: []byte("console.log('hi')")},
	}
	h := SPA(fsys)

	tests := []struct {
		path string
		want string
	}{
		{"/", "<html>app</html>"},
		{"/assets/app.js", "console.log('hi')"},
		{"/some/client/route", "<html>app</html>"},
	}
	for _, tt := range tests {
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, tt.path, nil))
		if rec.Code != http.StatusOK || rec.Body.String() != tt.want {
			t.Errorf("GET %s = %d %q, want 200 %q", tt.path, rec.Code, rec.Body, tt.want)
		}
	}
}
