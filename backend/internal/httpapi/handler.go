// Package httpapi exposes the calculator over a JSON REST API.
package httpapi

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"

	"github.com/omerfurkanipek/sezzle-calculator/backend/internal/calculator"
)

// maxBodyBytes caps request bodies; a calculation payload is a few dozen bytes.
const maxBodyBytes = 1 << 10

// CalculateRequest is the body accepted by POST /api/v1/{operation}.
// Pointers distinguish "missing" from an explicit zero.
type CalculateRequest struct {
	A *float64 `json:"a"`
	B *float64 `json:"b"`
}

// CalculateResponse is returned for a successful calculation.
type CalculateResponse struct {
	Operation string    `json:"operation"`
	Operands  []float64 `json:"operands"`
	Result    float64   `json:"result"`
}

// Handler serves the calculator API.
type Handler struct {
	calc *calculator.Calculator
}

// NewHandler builds a Handler backed by calc.
func NewHandler(calc *calculator.Calculator) *Handler {
	return &Handler{calc: calc}
}

// Register mounts the API routes on mux.
func (h *Handler) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /healthz", h.health)
	mux.HandleFunc("GET /api/v1/operations", h.listOperations)
	mux.HandleFunc("POST /api/v1/{operation}", h.calculate)
	mux.HandleFunc("/api/", h.notFound)
}

func (h *Handler) health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (h *Handler) listOperations(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"operations": h.calc.Operations()})
}

func (h *Handler) notFound(w http.ResponseWriter, r *http.Request) {
	writeError(w, newAPIError(http.StatusNotFound, CodeNotFound, fmt.Sprintf("No route for %s %s.", r.Method, r.URL.Path)))
}

func (h *Handler) calculate(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("operation")
	op, ok := h.calc.Lookup(name)
	if !ok {
		writeError(w, newAPIError(http.StatusNotFound, CodeUnknownOperation, fmt.Sprintf("Unknown operation %q.", name)))
		return
	}

	req, apiErr := decodeRequest(w, r)
	if apiErr != nil {
		writeError(w, apiErr)
		return
	}

	operands, apiErr := operandsFor(op, req)
	if apiErr != nil {
		writeError(w, apiErr)
		return
	}

	result, err := h.calc.Calculate(op.Name, operands...)
	if err != nil {
		writeError(w, fromCalculatorError(err))
		return
	}

	writeJSON(w, http.StatusOK, CalculateResponse{Operation: op.Name, Operands: operands, Result: result})
}

// decodeRequest strictly parses a single JSON object, rejecting unknown fields,
// trailing data, non-numeric operands and oversized bodies.
func decodeRequest(w http.ResponseWriter, r *http.Request) (CalculateRequest, *APIError) {
	var req CalculateRequest

	dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxBodyBytes))
	dec.DisallowUnknownFields()

	if err := dec.Decode(&req); err != nil {
		return req, decodeError(err)
	}
	if err := dec.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		return req, newAPIError(http.StatusBadRequest, CodeInvalidJSON, "Request body must contain a single JSON object.")
	}
	return req, nil
}

func decodeError(err error) *APIError {
	var (
		syntaxErr   *json.SyntaxError
		typeErr     *json.UnmarshalTypeError
		maxBytesErr *http.MaxBytesError
	)
	switch {
	case errors.Is(err, io.EOF):
		return newAPIError(http.StatusBadRequest, CodeInvalidJSON, "Request body is required.")
	case errors.As(err, &maxBytesErr):
		return newAPIError(http.StatusRequestEntityTooLarge, CodePayloadTooLarge,
			fmt.Sprintf("Request body must not exceed %d bytes.", maxBytesErr.Limit))
	case errors.As(err, &typeErr) && typeErr.Field == "":
		return newAPIError(http.StatusBadRequest, CodeInvalidJSON, "Request body must be a JSON object.")
	case errors.As(err, &typeErr):
		return newAPIError(http.StatusBadRequest, CodeInvalidOperand,
			fmt.Sprintf("Operand %q must be a finite number.", typeErr.Field))
	case errors.As(err, &syntaxErr), errors.Is(err, io.ErrUnexpectedEOF):
		return newAPIError(http.StatusBadRequest, CodeInvalidJSON, "Request body is not valid JSON.")
	default:
		// Covers unknown fields, which encoding/json reports as a plain error.
		return newAPIError(http.StatusBadRequest, CodeInvalidJSON, "Invalid request body: "+err.Error()+".")
	}
}

// operandsFor checks the request against the operation's arity.
func operandsFor(op calculator.Operation, req CalculateRequest) ([]float64, *APIError) {
	if req.A == nil {
		return nil, newAPIError(http.StatusBadRequest, CodeMissingOperand, `Operand "a" is required.`)
	}
	if op.Arity == 1 {
		if req.B != nil {
			return nil, newAPIError(http.StatusBadRequest, CodeUnexpectedOperand,
				fmt.Sprintf(`Operation %q takes a single operand "a".`, op.Name))
		}
		return []float64{*req.A}, nil
	}
	if req.B == nil {
		return nil, newAPIError(http.StatusBadRequest, CodeMissingOperand, `Operand "b" is required.`)
	}
	return []float64{*req.A, *req.B}, nil
}
