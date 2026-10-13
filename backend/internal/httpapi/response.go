package httpapi

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	"github.com/omerfurkanipek/sezzle-calculator/backend/internal/calculator"
)

// Machine-readable error codes returned in the "error.code" field. Clients
// should branch on these rather than on the human-readable message.
const (
	CodeInvalidJSON        = "INVALID_JSON"
	CodeInvalidOperand     = "INVALID_OPERAND"
	CodeMissingOperand     = "MISSING_OPERAND"
	CodeUnexpectedOperand  = "UNEXPECTED_OPERAND"
	CodePayloadTooLarge    = "PAYLOAD_TOO_LARGE"
	CodeUnknownOperation   = "UNKNOWN_OPERATION"
	CodeNotFound           = "NOT_FOUND"
	CodeDivisionByZero     = "DIVISION_BY_ZERO"
	CodeNegativeSquareRoot = "NEGATIVE_SQUARE_ROOT"
	CodeUndefinedResult    = "UNDEFINED_RESULT"
	CodeResultOutOfRange   = "RESULT_OUT_OF_RANGE"
	CodeInternal           = "INTERNAL_ERROR"
)

// APIError is the error payload sent to clients and doubles as a Go error so
// handlers can return it directly.
type APIError struct {
	Status  int    `json:"-"`
	Code    string `json:"code"`
	Message string `json:"message"`
}

func (e *APIError) Error() string { return e.Message }

type errorEnvelope struct {
	Error *APIError `json:"error"`
}

func newAPIError(status int, code, message string) *APIError {
	return &APIError{Status: status, Code: code, Message: message}
}

// fromCalculatorError maps domain errors to HTTP semantics. Mathematically
// invalid but well-formed requests use 422 so they are distinguishable from
// malformed input (400).
func fromCalculatorError(err error) *APIError {
	var countErr *calculator.OperandCountError
	switch {
	case errors.Is(err, calculator.ErrDivisionByZero):
		return newAPIError(http.StatusUnprocessableEntity, CodeDivisionByZero, "Division by zero is not allowed.")
	case errors.Is(err, calculator.ErrNegativeSquareRoot):
		return newAPIError(http.StatusUnprocessableEntity, CodeNegativeSquareRoot, "Cannot take the square root of a negative number.")
	case errors.Is(err, calculator.ErrUndefinedResult):
		return newAPIError(http.StatusUnprocessableEntity, CodeUndefinedResult, "The result is not a real number.")
	case errors.Is(err, calculator.ErrResultOutOfRange):
		return newAPIError(http.StatusUnprocessableEntity, CodeResultOutOfRange, "The result is too large to represent.")
	case errors.Is(err, calculator.ErrInvalidOperand):
		return newAPIError(http.StatusBadRequest, CodeInvalidOperand, "Operands must be finite numbers.")
	case errors.Is(err, calculator.ErrUnknownOperation):
		return newAPIError(http.StatusNotFound, CodeUnknownOperation, err.Error())
	case errors.As(err, &countErr):
		return newAPIError(http.StatusBadRequest, CodeInvalidOperand, countErr.Error())
	default:
		return newAPIError(http.StatusInternalServerError, CodeInternal, "An unexpected error occurred.")
	}
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(body); err != nil {
		slog.Error("failed to encode response", "err", err)
	}
}

func writeError(w http.ResponseWriter, apiErr *APIError) {
	writeJSON(w, apiErr.Status, errorEnvelope{Error: apiErr})
}
