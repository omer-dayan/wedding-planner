import { describe, expect, it } from 'vitest'
import {
  answerProgress,
  answerValue,
  createVenueQuestion,
  mergeAnswers,
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

  it('preserves answers for a removed question and leaves a new question empty', () => {
    const merged = mergeAnswers(
      { q_parking: 'yes', q_old: 'שמור' },
      [parking, capacity],
      { q_parking: 'no', q_capacity: '' },
    )
    expect(merged).toEqual({ q_parking: 'no', q_old: 'שמור' })
    expect(answerProgress([parking, capacity], merged)).toEqual({ answered: 1, total: 2 })
    expect(answerValue(capacity, '1,200')).toBe('1200')
    expect(answerValue(parking, 'maybe')).toBe('')
  })
})
