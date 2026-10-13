import { createCalculatorApi } from './api/calculatorApi'
import { Calculator } from './features/calculator/components/Calculator'

// Created once at module level so the hook's effect dependency stays stable.
const api = createCalculatorApi({ baseUrl: import.meta.env.VITE_API_BASE_URL ?? '' })

export function App() {
  return (
    <main className="app">
      <header className="app__header">
        <h1 className="app__title">Calculator</h1>
        <p className="app__subtitle">React + TypeScript, computed by a Go API</p>
      </header>
      <Calculator api={api} />
      <p className="app__hint">
        Keyboard: digits, <kbd>+</kbd> <kbd>-</kbd> <kbd>*</kbd> <kbd>/</kbd> <kbd>^</kbd> <kbd>%</kbd>, <kbd>r</kbd> √,{' '}
        <kbd>n</kbd> ±, <kbd>Enter</kbd> =, <kbd>Esc</kbd> clear
      </p>
    </main>
  )
}
