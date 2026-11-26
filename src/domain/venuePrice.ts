import { pricePartOf, type VenueQuestion } from './venueQuestions.ts'

export interface PortionQuote {
  amount: number
  /** True when something other than the base price changed the result. */
  adjusted: boolean
  /** A fixed sum such as hall tax is waiting because there is no guest count to divide by. */
  missingGuests: boolean
}

export function portionQuote(
  questions: readonly VenueQuestion[],
  answers: Record<string, string>,
  guestCount = 0,
): PortionQuote | null {
  let base = 0
  let add = 0
  let split = 0
  let percent = 0
  let sawBase = false
  let answeredGuests = 0
  for (const question of questions) {
    const part = pricePartOf(question)
    if (!part || part === 'skip') continue
    const amount = Number(answers[question.id])
    if (!Number.isFinite(amount)) continue
    if (part === 'base') {
      base += amount
      sawBase = true
    } else if (part === 'add') {
      add += amount
    } else if (part === 'split') {
      split += amount
    } else if (part === 'guests') {
      if (amount > 0) answeredGuests = amount
    } else {
      percent += amount
    }
  }
  if (!sawBase) return null
  const heads = answeredGuests > 0 ? answeredGuests : guestCount
  const missingGuests = split !== 0 && heads <= 0
  const perHead = missingGuests ? 0 : split / (heads || 1)
  const raw = (base + add + perHead) * (1 + percent / 100)
  const amount = Math.round(raw * 100) / 100
  return { amount, adjusted: add !== 0 || percent !== 0 || (split !== 0 && !missingGuests), missingGuests }
}

export function formatPortionPrice(amount: number): string {
  const digits = Number.isInteger(amount) ? 0 : 2
  const formatted = new Intl.NumberFormat('he-IL', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(amount)
  return `${formatted} ₪ לראש`
}
