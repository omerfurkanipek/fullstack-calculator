package httpapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/omerfurkanipek/fullstack-calculator/backend/internal/calculator"
)

func newTestServer(t *testing.T) http.Handler {
	t.Helper()
	mux := http.NewServeMux()
	NewHandler(calculator.New()).Register(mux)
	return mux
}

func do(t *testing.T, h http.Handler, method, path, body string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func decodeBody[T any](t *testing.T, rec *httptest.ResponseRecorder) T {
	t.Helper()
	var v T
	if err := json.NewDecoder(rec.Body).Decode(&v); err != nil {
		t.Fatalf("decode response: %v (body=%q)", err, rec.Body.String())
	}
	return v
}

func TestCalculateSuccess(t *testing.T) {
	t.Parallel()

	tests := []struct {
		path         string
		body         string
		wantOperands []float64
		wantResult   float64
	}{
		{"/api/v1/add", `{"a": 2, "b": 3}`, []float64{2, 3}, 5},
		{"/api/v1/subtract", `{"a": 2, "b": 3}`, []float64{2, 3}, -1},
		{"/api/v1/multiply", `{"a": 1.5, "b": 4}`, []float64{1.5, 4}, 6},
		{"/api/v1/divide", `{"a": 7, "b": 2}`, []float64{7, 2}, 3.5},
		{"/api/v1/power", `{"a": 2, "b": 8}`, []float64{2, 8}, 256},
		{"/api/v1/percentage", `{"a": 10, "b": 250}`, []float64{10, 250}, 25},
		{"/api/v1/sqrt", `{"a": 81}`, []float64{81}, 9},
		{"/api/v1/add", `{"a": 0, "b": 0}`, []float64{0, 0}, 0},
	}

	h := newTestServer(t)
	for _, tt := range tests {
		t.Run(tt.path, func(t *testing.T) {
			t.Parallel()
			rec := do(t, h, http.MethodPost, tt.path, tt.body)
			if rec.Code != http.StatusOK {
				t.Fatalf("status = %d, want 200 (body=%s)", rec.Code, rec.Body)
			}
			if ct := rec.Header().Get("Content-Type"); !strings.HasPrefix(ct, "application/json") {
				t.Errorf("Content-Type = %q", ct)
			}
			got := decodeBody[CalculateResponse](t, rec)
			if got.Result != tt.wantResult {
				t.Errorf("result = %v, want %v", got.Result, tt.wantResult)
			}
			if len(got.Operands) != len(tt.wantOperands) {
				t.Fatalf("operands = %v, want %v", got.Operands, tt.wantOperands)
			}
			for i := range got.Operands {
				if got.Operands[i] != tt.wantOperands[i] {
					t.Errorf("operands = %v, want %v", got.Operands, tt.wantOperands)
				}
			}
		})
	}
}

func TestCalculateErrors(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name       string
		path       string
		body       string
		wantStatus int
		wantCode   string
	}{
		{"division by zero", "/api/v1/divide", `{"a": 1, "b": 0}`, 422, CodeDivisionByZero},
		{"negative sqrt", "/api/v1/sqrt", `{"a": -4}`, 422, CodeNegativeSquareRoot},
		{"undefined power", "/api/v1/power", `{"a": -8, "b": 0.5}`, 422, CodeUndefinedResult},
		{"overflow", "/api/v1/power", `{"a": 10, "b": 400}`, 422, CodeResultOutOfRange},
		{"unknown operation", "/api/v1/modulo", `{"a": 1, "b": 2}`, 404, CodeUnknownOperation},
		{"missing a", "/api/v1/add", `{"b": 2}`, 400, CodeMissingOperand},
		{"missing b", "/api/v1/add", `{"a": 2}`, 400, CodeMissingOperand},
		{"null operand", "/api/v1/add", `{"a": null, "b": 2}`, 400, CodeMissingOperand},
		{"unexpected b for sqrt", "/api/v1/sqrt", `{"a": 4, "b": 2}`, 400, CodeUnexpectedOperand},
		{"string operand", "/api/v1/add", `{"a": "1", "b": 2}`, 400, CodeInvalidOperand},
		{"number too large for float64", "/api/v1/add", `{"a": 1e400, "b": 2}`, 400, CodeInvalidOperand},
		{"unknown field", "/api/v1/add", `{"a": 1, "b": 2, "c": 3}`, 400, CodeInvalidJSON},
		{"malformed json", "/api/v1/add", `{"a": 1,`, 400, CodeInvalidJSON},
		{"syntax error", "/api/v1/add", `{"a": 1 "b": 2}`, 400, CodeInvalidJSON},
		{"empty body", "/api/v1/add", ``, 400, CodeInvalidJSON},
		{"trailing data", "/api/v1/add", `{"a": 1, "b": 2}{"a": 3}`, 400, CodeInvalidJSON},
		{"array body", "/api/v1/add", `[1, 2]`, 400, CodeInvalidJSON},
		{"oversized body", "/api/v1/add", `{"a": 1, "b": 2` + strings.Repeat(" ", maxBodyBytes) + `}`, 413, CodePayloadTooLarge},
		{"unknown api route", "/api/v2/add", `{}`, 404, CodeNotFound},
	}

	h := newTestServer(t)
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			rec := do(t, h, http.MethodPost, tt.path, tt.body)
			if rec.Code != tt.wantStatus {
				t.Fatalf("status = %d, want %d (body=%s)", rec.Code, tt.wantStatus, rec.Body)
			}
			got := decodeBody[errorEnvelope](t, rec)
			if got.Error == nil || got.Error.Code != tt.wantCode {
				t.Fatalf("error = %+v, want code %s", got.Error, tt.wantCode)
			}
			if got.Error.Message == "" {
				t.Error("error message should not be empty")
			}
		})
	}
}

func TestGetOnCalculationRouteIsJSONNotFound(t *testing.T) {
	t.Parallel()

	rec := do(t, newTestServer(t), http.MethodGet, "/api/v1/add", "")
	// GET on a calculation route falls through to the JSON 404 handler for /api/.
	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", rec.Code)
	}
}

func TestHealth(t *testing.T) {
	t.Parallel()

	rec := do(t, newTestServer(t), http.MethodGet, "/healthz", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
	if got := decodeBody[map[string]string](t, rec); got["status"] != "ok" {
		t.Errorf("body = %v", got)
	}
}

func TestListOperations(t *testing.T) {
	t.Parallel()

	rec := do(t, newTestServer(t), http.MethodGet, "/api/v1/operations", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
	got := decodeBody[struct {
		Operations []calculator.Operation `json:"operations"`
	}](t, rec)
	if len(got.Operations) != 7 {
		t.Fatalf("got %d operations, want 7", len(got.Operations))
	}
	if got.Operations[0].Name != "add" || got.Operations[0].Arity != 2 {
		t.Errorf("first operation = %+v", got.Operations[0])
	}
}

func TestFromCalculatorErrorFallsBackToInternal(t *testing.T) {
	t.Parallel()

	got := fromCalculatorError(errUnexpected{})
	if got.Status != http.StatusInternalServerError || got.Code != CodeInternal {
		t.Errorf("got %+v", got)
	}
	if got.Error() != got.Message {
		t.Errorf("Error() = %q, want message", got.Error())
	}
}

func TestFromCalculatorErrorMapsDomainErrors(t *testing.T) {
	t.Parallel()

	tests := []struct {
		err      error
		wantCode string
	}{
		{calculator.ErrInvalidOperand, CodeInvalidOperand},
		{calculator.ErrUnknownOperation, CodeUnknownOperation},
		{&calculator.OperandCountError{Operation: "add", Want: 2, Got: 1}, CodeInvalidOperand},
	}
	for _, tt := range tests {
		if got := fromCalculatorError(tt.err); got.Code != tt.wantCode {
			t.Errorf("fromCalculatorError(%v) = %s, want %s", tt.err, got.Code, tt.wantCode)
		}
	}
}

type errUnexpected struct{}

func (errUnexpected) Error() string { return "boom" }
