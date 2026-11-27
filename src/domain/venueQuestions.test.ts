import { describe, expect, it } from 'vitest'
import {
  createVenueQuestion,
  normalizeVenueQuestions,
  type VenueQuestion,
} from './venueQuestions.ts'

const parking: VenueQuestion = { id: 'q_parking', label: 'חניה', type: 'yesno' }
const capacity: VenueQuestion = { id: 'q_capacity', label: 'כמה אנשים', type: 'number' }

describe('venue question template', () => {
  it('keeps stable ids when a label changes and rejects a duplicate id', () => {
    const created = createVenueQuestion('כשרות')
    expect(created.id.startsWith('q_')).toBe(true)
    const renamed = normalizeVenueQuestions([{ ...parking, label: 'יש חניה?' }, capacity])
    expect(renamed[0]).toEqual({ id: 'q_parking', label: 'יש חניה?', type: 'yesno' })
    expect(() => normalizeVenueQuestions([parking, { ...capacity, id: parking.id }])).toThrow(/venue-questions/)
  })
})
