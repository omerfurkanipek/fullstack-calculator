import type { CalculatorAction, Digit, Operator } from '../calculatorReducer'

type KeyVariant = 'digit' | 'function' | 'operator' | 'equals'

interface KeyDef {
  label: string
  ariaLabel: string
  action: CalculatorAction
  variant: KeyVariant
  className?: string
}

const op = (operator: Operator, label: string, ariaLabel: string): KeyDef => ({
  label,
  ariaLabel,
  action: { type: 'operator', operator },
  variant: 'operator',
})

const digit = (d: Digit): KeyDef => ({
  label: d,
  ariaLabel: d,
  action: { type: 'digit', digit: d },
  variant: 'digit',
})

// Row-major order for a 4-column grid; "=" spans two rows and "0" two columns.
const KEYS: KeyDef[] = [
  { label: 'AC', ariaLabel: 'All clear', action: { type: 'clear' }, variant: 'function' },
  { label: '⌫', ariaLabel: 'Backspace', action: { type: 'backspace' }, variant: 'function' },
  { label: '%', ariaLabel: 'Percent', action: { type: 'percent' }, variant: 'function' },
  op('divide', '÷', 'Divide'),
  { label: '√', ariaLabel: 'Square root', action: { type: 'sqrt' }, variant: 'function' },
  { label: 'xʸ', ariaLabel: 'Power', action: { type: 'operator', operator: 'power' }, variant: 'operator' },
  { label: '±', ariaLabel: 'Toggle sign', action: { type: 'toggleSign' }, variant: 'function' },
  op('multiply', '×', 'Multiply'),
  digit('7'),
  digit('8'),
  digit('9'),
  op('subtract', '−', 'Subtract'),
  digit('4'),
  digit('5'),
  digit('6'),
  op('add', '+', 'Add'),
  digit('1'),
  digit('2'),
  digit('3'),
  { label: '=', ariaLabel: 'Equals', action: { type: 'equals' }, variant: 'equals', className: 'key--tall' },
  { ...digit('0'), className: 'key--wide' },
  { label: '.', ariaLabel: 'Decimal point', action: { type: 'decimal' }, variant: 'digit' },
]

interface KeypadProps {
  onAction: (action: CalculatorAction) => void
  activeOperator: Operator | null
}

export function Keypad({ onAction, activeOperator }: KeypadProps) {
  return (
    <div className="keypad" role="group" aria-label="Calculator keypad">
      {KEYS.map((key) => {
        const active = key.action.type === 'operator' && key.action.operator === activeOperator
        return (
          <button
            key={key.ariaLabel}
            type="button"
            className={`key key--${key.variant} ${key.className ?? ''} ${active ? 'key--active' : ''}`}
            aria-label={key.ariaLabel}
            aria-pressed={key.variant === 'operator' ? active : undefined}
            onClick={() => onAction(key.action)}
          >
            {key.label}
          </button>
        )
      })}
    </div>
  )
}
