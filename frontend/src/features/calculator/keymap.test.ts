import { describe, expect, it } from 'vitest'
import { keyToAction } from './keymap'

describe('keyToAction', () => {
  it.each([
    ['7', { type: 'digit', digit: '7' }],
    ['+', { type: 'operator', operator: 'add' }],
    ['-', { type: 'operator', operator: 'subtract' }],
    ['*', { type: 'operator', operator: 'multiply' }],
    ['x', { type: 'operator', operator: 'multiply' }],
    ['/', { type: 'operator', operator: 'divide' }],
    ['^', { type: 'operator', operator: 'power' }],
    ['.', { type: 'decimal' }],
    [',', { type: 'decimal' }],
    ['Enter', { type: 'equals' }],
    ['=', { type: 'equals' }],
    ['%', { type: 'percent' }],
    ['r', { type: 'sqrt' }],
    ['n', { type: 'toggleSign' }],
    ['Backspace', { type: 'backspace' }],
    ['Escape', { type: 'clear' }],
    ['Delete', { type: 'clear' }],
    ['c', { type: 'clear' }],
  ])('maps %s', (key, action) => {
    expect(keyToAction(key)).toEqual(action)
  })

  it('returns null for unbound keys', () => {
    expect(keyToAction('a')).toBeNull()
    expect(keyToAction('Tab')).toBeNull()
  })
})
