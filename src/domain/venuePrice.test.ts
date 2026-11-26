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
      total: null,
      heads: 0,
      adjusted: false,
      missingGuests: false,
    })
    expect(formatPortionPrice(350)).toBe('350 ₪ לאדם')
  })

  it('adds extras and then applies percents', () => {
    const quote = portionQuote([plate, extra, vat], { q_plate: '300', q_extra: '20', q_vat: '18' })
    expect(quote).toEqual({ amount: 377.6, total: null, heads: 0, adjusted: true, missingGuests: false })
    expect(formatPortionPrice(377.6)).toBe('377.60 ₪ לאדם')
  })

  it('splits a hall tax across the guest count instead of adding it to every head', () => {
    const hall: VenueQuestion = { id: 'q_hall', label: 'מס אולם', type: 'number', pricePart: 'add' }
    const quote = portionQuote([plate, hall], { q_plate: '480', q_hall: '1500' }, 100)
    expect(quote).toEqual({ amount: 495, total: 49500, heads: 100, adjusted: true, missingGuests: false })
  })

  it('prefers a guest-count answer on the venue over the wedding list', () => {
    const hall: VenueQuestion = { id: 'q_hall', label: 'מס אולם', type: 'number' }
    const heads: VenueQuestion = { id: 'q_heads', label: 'כמות אורחים', type: 'number' }
    const quote = portionQuote(
      [plate, hall, heads],
      { q_plate: '480', q_hall: '1500', q_heads: '300' },
      100,
    )
    expect(quote?.amount).toBe(485)
  })

  it('lets an explicit skip override a label that looks like a price', () => {
    const skipped: VenueQuestion = { ...plate, pricePart: 'skip' }
    expect(portionQuote([skipped], { q_plate: '350' })).toBeNull()
  })
})
