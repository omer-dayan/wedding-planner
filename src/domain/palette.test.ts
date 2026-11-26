import { describe, expect, it } from 'vitest'
import { DEFAULT_PALETTE, derivePalette, readPalette } from './palette.ts'

describe('palette', () => {
  it('builds the accent from the chosen green and a soft pink from the second color', () => {
    const derived = derivePalette({ green: '#226644', pink: '#e07090' })
    expect(derived['--accent']).toBe('#226644')
    expect(derived['--gold']).not.toBe(derived['--accent'])
    expect(derived['--accent-soft'].startsWith('#')).toBe(true)
    expect(derived['--ink']).not.toBe('#226644')
  })

  it('reads a saved pair and ignores anything else', () => {
    expect(readPalette({ green: '#3E6B54', pink: '#C4897B' })).toEqual(DEFAULT_PALETTE)
    expect(readPalette({ green: 'green', pink: '#c4897b' })).toBeNull()
    expect(readPalette(null)).toBeNull()
  })
})