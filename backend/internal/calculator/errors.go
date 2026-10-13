package calculator

import (
	"errors"
	"fmt"
)

// Sentinel errors describing why a calculation could not be performed.
// Callers should match them with errors.Is.
var (
	ErrUnknownOperation   = errors.New("unknown operation")
	ErrDivisionByZero     = errors.New("division by zero")
	ErrNegativeSquareRoot = errors.New("square root of a negative number")
	ErrInvalidOperand     = errors.New("operand must be a finite number")
	ErrUndefinedResult    = errors.New("result is undefined")
	ErrResultOutOfRange   = errors.New("result is out of range")
)

// OperandCountError reports that an operation received the wrong number of operands.
type OperandCountError struct {
	Operation string
	Want      int
	Got       int
}

func (e *OperandCountError) Error() string {
	return fmt.Sprintf("%s expects %d operand(s), got %d", e.Operation, e.Want, e.Got)
}
