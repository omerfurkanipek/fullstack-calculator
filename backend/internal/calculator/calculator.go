// Package calculator implements the arithmetic domain: a registry of operations
// with their arity, validation rules and edge-case handling. It has no knowledge
// of HTTP or JSON so it can be tested and reused in isolation.
package calculator

import (
	"fmt"
	"math"
	"sort"
	"strconv"
)

// significantDigits is the number of decimal digits float64 can round-trip
// reliably. Rounding results to it hides binary representation artifacts such
// as 0.1 + 0.2 = 0.30000000000000004.
const significantDigits = 15

// Operation describes a single arithmetic operation.
type Operation struct {
	Name        string `json:"name"`
	Symbol      string `json:"symbol"`
	Arity       int    `json:"arity"`
	Description string `json:"description"`

	apply func(operands []float64) (float64, error)
}

// Calculator evaluates operations by name. The zero value is not usable; use New.
type Calculator struct {
	operations map[string]Operation
}

// New returns a Calculator with every supported operation registered.
func New() *Calculator {
	ops := []Operation{
		{Name: "add", Symbol: "+", Arity: 2, Description: "a + b", apply: add},
		{Name: "subtract", Symbol: "−", Arity: 2, Description: "a - b", apply: subtract},
		{Name: "multiply", Symbol: "×", Arity: 2, Description: "a × b", apply: multiply},
		{Name: "divide", Symbol: "÷", Arity: 2, Description: "a ÷ b", apply: divide},
		{Name: "power", Symbol: "^", Arity: 2, Description: "a raised to the power of b", apply: power},
		{Name: "percentage", Symbol: "%", Arity: 2, Description: "a percent of b (a × b / 100)", apply: percentage},
		{Name: "sqrt", Symbol: "√", Arity: 1, Description: "square root of a", apply: sqrt},
	}

	c := &Calculator{operations: make(map[string]Operation, len(ops))}
	for _, op := range ops {
		c.operations[op.Name] = op
	}
	return c
}

// Operations returns the supported operations sorted by name.
func (c *Calculator) Operations() []Operation {
	out := make([]Operation, 0, len(c.operations))
	for _, op := range c.operations {
		out = append(out, op)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	return out
}

// Lookup returns the operation registered under name.
func (c *Calculator) Lookup(name string) (Operation, bool) {
	op, ok := c.operations[name]
	return op, ok
}

// Calculate validates the operands and evaluates the named operation.
// Results that are not finite are rejected so callers never see NaN or ±Inf.
func (c *Calculator) Calculate(name string, operands ...float64) (float64, error) {
	op, ok := c.operations[name]
	if !ok {
		return 0, fmt.Errorf("%w: %q", ErrUnknownOperation, name)
	}
	if len(operands) != op.Arity {
		return 0, &OperandCountError{Operation: name, Want: op.Arity, Got: len(operands)}
	}
	for _, v := range operands {
		if math.IsNaN(v) || math.IsInf(v, 0) {
			return 0, ErrInvalidOperand
		}
	}

	result, err := op.apply(operands)
	if err != nil {
		return 0, err
	}
	switch {
	case math.IsNaN(result):
		return 0, ErrUndefinedResult
	case math.IsInf(result, 0):
		return 0, ErrResultOutOfRange
	case result == 0:
		// Normalise negative zero so clients never render "-0".
		return 0, nil
	}
	return roundSignificant(result), nil
}

func roundSignificant(v float64) float64 {
	rounded, err := strconv.ParseFloat(strconv.FormatFloat(v, 'g', significantDigits, 64), 64)
	if err != nil {
		// Rounding values near math.MaxFloat64 can overflow; keep them exact.
		return v
	}
	return rounded
}

func add(o []float64) (float64, error)      { return o[0] + o[1], nil }
func subtract(o []float64) (float64, error) { return o[0] - o[1], nil }
func multiply(o []float64) (float64, error) { return o[0] * o[1], nil }

func divide(o []float64) (float64, error) {
	if o[1] == 0 {
		return 0, ErrDivisionByZero
	}
	return o[0] / o[1], nil
}

func power(o []float64) (float64, error) {
	base, exp := o[0], o[1]
	if base == 0 && exp < 0 {
		// 0^-n is 1/0^n, i.e. a division by zero rather than "out of range".
		return 0, ErrDivisionByZero
	}
	// A negative base with a fractional exponent has no real result; math.Pow
	// returns NaN which Calculate reports as ErrUndefinedResult.
	return math.Pow(base, exp), nil
}

func percentage(o []float64) (float64, error) { return o[0] * o[1] / 100, nil }

func sqrt(o []float64) (float64, error) {
	if o[0] < 0 {
		return 0, ErrNegativeSquareRoot
	}
	return math.Sqrt(o[0]), nil
}
