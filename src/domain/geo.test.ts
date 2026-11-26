import { describe, expect, it } from 'vitest'
import { distanceKm, formatDistance } from './geo.ts'

describe('distance', () => {
  it('measures Kiryat Gat to Rosh HaAyin in kilometres', () => {
    const km = distanceKm({ lat: 31.61, lng: 34.764 }, { lat: 32.0956, lng: 34.9566 })
    expect(km).toBeGreaterThan(50)
    expect(km).toBeLessThan(70)
    expect(formatDistance(km)).toMatch(/ק״מ/)
  })
})
