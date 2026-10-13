import { formatForDisplay } from '../format'

interface DisplayProps {
  expression: string
  entry: string
  error: string | null
  loading: boolean
}

/** Shrinks the main value so long numbers stay on one line. */
function sizeClass(text: string): string {
  if (text.length > 16) return 'display__value--xs'
  if (text.length > 12) return 'display__value--sm'
  if (text.length > 9) return 'display__value--md'
  return ''
}

/** Applies thousands separators to every plain number inside the expression. */
const formatExpression = (expression: string) => expression.replace(/\d+(\.\d+)?(?!\d*e)/g, formatForDisplay)

export function Display({ expression, entry, error, loading }: DisplayProps) {
  const value = error ?? formatForDisplay(entry)

  return (
    <div className="display" aria-busy={loading}>
      <div className="display__expression" data-testid="expression">
        {formatExpression(expression) || ' '}
      </div>
      <output
        className={`display__value ${sizeClass(value)} ${error ? 'display__value--error' : ''}`}
        aria-live="polite"
        aria-label={error ? `Error: ${error}` : `Result ${entry}`}
        data-testid="display-value"
      >
        {value}
      </output>
      <div className={`display__progress ${loading ? 'display__progress--active' : ''}`} aria-hidden="true" />
    </div>
  )
}
