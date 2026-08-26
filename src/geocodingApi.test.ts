import { describe, expect, it } from 'vitest'
import { normalizeSearch, searchLocalDestinations } from './geocodingApi'

describe('destination search', () => {
  it('normalizes Albanian road prefixes and diacritics', () => {
    expect(normalizeSearch('Rruga Nëna Terezë')).toBe('nena tereze')
  })

  it('keeps Biblioteka results relevant', () => {
    const names = searchLocalDestinations('biblioteka').map((result) => result.name)
    expect(names).toContain('Biblioteka Kombëtare')
    expect(names.some((name) => /QKUK/i.test(name))).toBe(false)
  })
})
