import { describe, expect, it } from 'vitest'
import { formatPortionPrice, portionQuote } from './venuePrice.ts'
import type { VenueQuestion } from './venueQuestions.ts'

const plate: VenueQuestion = { id: 'q_plate', label: 'מחיר מנה', type: 'number' }
const extra: VenueQuestion = { id: 'q_extra', label: 'תוספת שדרוג', type: 'number' }
const vat: VenueQuestion = { id: 'q_vat', label: 'מע״מ', type: 'number' }
const parking: VenueQuestion = { id: 'q_parking', label: 'חניה', type: 'yesno' }

describe('portion price', () => {
  it('uses a plate-price question as the closed-card summary', () => {
    expect(portionQuote([plate, parking], { q_plate: '350', q_parking: 'yes' })).toEqual({
      amount: 350,
      adjusted: false,
    })
    expect(formatPortionPrice(350)).toBe('350 ₪ למנה')
  })

  it('adds extras and then applies percents', () => {
    const quote = portionQuote([plate, extra, vat], { q_plate: '300', q_extra: '20', q_vat: '18' })
    expect(quote).toEqual({ amount: 377.6, adjusted: true })
    expect(formatPortionPrice(377.6)).toBe('377.60 ₪ למנה')
  })

  it('lets an explicit skip override a label that looks like a price', () => {
    const skipped: VenueQuestion = { ...plate, pricePart: 'skip' }
    expect(portionQuote([skipped], { q_plate: '350' })).toBeNull()
  })
})
