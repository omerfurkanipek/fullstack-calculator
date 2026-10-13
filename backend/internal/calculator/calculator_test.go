package calculator

import (
	"errors"
	"math"
	"testing"
)

func TestCalculate(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name      string
		operation string
		operands  []float64
		want      float64
	}{
		{"add integers", "add", []float64{2, 3}, 5},
		{"add negatives", "add", []float64{-2.5, -0.5}, -3},
		{"add hides float artifacts", "add", []float64{0.1, 0.2}, 0.3},
		{"multiply hides float artifacts", "multiply", []float64{1.1, 3}, 3.3},
		{"divide keeps 15 significant digits", "divide", []float64{1, 3}, 0.333333333333333},
		{"subtract", "subtract", []float64{10, 4}, 6},
		{"subtract to negative", "subtract", []float64{4, 10}, -6},
		{"multiply", "multiply", []float64{6, 7}, 42},
		{"multiply by zero", "multiply", []float64{123.45, 0}, 0},
		{"divide", "divide", []float64{10, 4}, 2.5},
		{"divide negative", "divide", []float64{-9, 3}, -3},
		{"power", "power", []float64{2, 10}, 1024},
		{"power fractional exponent", "power", []float64{9, 0.5}, 3},
		{"power negative exponent", "power", []float64{2, -2}, 0.25},
		{"power zero to zero", "power", []float64{0, 0}, 1},
		{"negative base integer exponent", "power", []float64{-2, 3}, -8},
		{"percentage", "percentage", []float64{15, 200}, 30},
		{"percentage of negative", "percentage", []float64{50, -10}, -5},
		{"sqrt", "sqrt", []float64{16}, 4},
		{"sqrt zero", "sqrt", []float64{0}, 0},
	}

	calc := New()
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			got, err := calc.Calculate(tt.operation, tt.operands...)
			if err != nil {
				t.Fatalf("Calculate(%q, %v) unexpected error: %v", tt.operation, tt.operands, err)
			}
			if got != tt.want {
				t.Errorf("Calculate(%q, %v) = %v, want %v", tt.operation, tt.operands, got, tt.want)
			}
		})
	}
}

func TestCalculateErrors(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name      string
		operation string
		operands  []float64
		wantErr   error
	}{
		{"unknown operation", "modulo", []float64{1, 2}, ErrUnknownOperation},
		{"division by zero", "divide", []float64{1, 0}, ErrDivisionByZero},
		{"zero divided by zero", "divide", []float64{0, 0}, ErrDivisionByZero},
		{"zero to negative power", "power", []float64{0, -1}, ErrDivisionByZero},
		{"negative base fractional exponent", "power", []float64{-8, 0.5}, ErrUndefinedResult},
		{"power overflow", "power", []float64{10, 400}, ErrResultOutOfRange},
		{"multiply overflow", "multiply", []float64{math.MaxFloat64, 2}, ErrResultOutOfRange},
		{"sqrt negative", "sqrt", []float64{-1}, ErrNegativeSquareRoot},
		{"NaN operand", "add", []float64{math.NaN(), 1}, ErrInvalidOperand},
		{"infinite operand", "add", []float64{math.Inf(1), 1}, ErrInvalidOperand},
	}

	calc := New()
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			_, err := calc.Calculate(tt.operation, tt.operands...)
			if !errors.Is(err, tt.wantErr) {
				t.Errorf("Calculate(%q, %v) error = %v, want %v", tt.operation, tt.operands, err, tt.wantErr)
			}
		})
	}
}

func TestCalculateOperandCount(t *testing.T) {
	t.Parallel()

	calc := New()
	_, err := calc.Calculate("sqrt", 4, 2)

	var countErr *OperandCountError
	if !errors.As(err, &countErr) {
		t.Fatalf("expected *OperandCountError, got %v", err)
	}
	if countErr.Want != 1 || countErr.Got != 2 {
		t.Errorf("got want=%d got=%d, expected want=1 got=2", countErr.Want, countErr.Got)
	}
	if countErr.Error() != "sqrt expects 1 operand(s), got 2" {
		t.Errorf("unexpected message: %q", countErr.Error())
	}
}

func TestCalculateNormalisesNegativeZero(t *testing.T) {
	t.Parallel()

	got, err := New().Calculate("multiply", -5, 0)
	if err != nil {
		t.Fatal(err)
	}
	if math.Signbit(got) {
		t.Errorf("expected positive zero, got %v", got)
	}
}

func TestOperationsAreSortedAndComplete(t *testing.T) {
	t.Parallel()

	ops := New().Operations()
	want := []string{"add", "divide", "multiply", "percentage", "power", "sqrt", "subtract"}
	if len(ops) != len(want) {
		t.Fatalf("got %d operations, want %d", len(ops), len(want))
	}
	for i, name := range want {
		if ops[i].Name != name {
			t.Errorf("ops[%d] = %q, want %q", i, ops[i].Name, name)
		}
	}
}

func TestLookup(t *testing.T) {
	t.Parallel()

	calc := New()
	if op, ok := calc.Lookup("sqrt"); !ok || op.Arity != 1 {
		t.Errorf("Lookup(sqrt) = %+v, %v", op, ok)
	}
	if _, ok := calc.Lookup("nope"); ok {
		t.Error("Lookup(nope) should not be found")
	}
}

func TestCalculateKeepsValueWhenRoundingWouldOverflow(t *testing.T) {
	t.Parallel()

	// Rounding MaxFloat64 to 15 digits overflows, so the exact value is kept.
	got, err := New().Calculate("multiply", math.MaxFloat64, 1)
	if err != nil {
		t.Fatal(err)
	}
	if got != math.MaxFloat64 {
		t.Errorf("got %v, want MaxFloat64", got)
	}
}
