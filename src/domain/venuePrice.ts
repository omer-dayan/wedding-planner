import { pricePartOf, type VenueQuestion } from './venueQuestions.ts'

export interface PortionQuote {
  amount: number
  /** True when an add-on or a percent changed the base price. */
  adjusted: boolean
}

export function portionQuote(
  questions: readonly VenueQuestion[],
  answers: Record<string, string>,
): PortionQuote | null {
  let base = 0
  let add = 0
  let percent = 0
  let sawBase = false
  for (const question of questions) {
    const part = pricePartOf(question)
    if (!part) continue
    const amount = Number(answers[question.id])
    if (!Number.isFinite(amount)) continue
    if (part === 'base') {
      base += amount
      sawBase = true
    } else if (part === 'add') {
      add += amount
    } else {
      percent += amount
    }
  }
  if (!sawBase) return null
  const raw = (base + add) * (1 + percent / 100)
  const amount = Math.round(raw * 100) / 100
  return { amount, adjusted: add !== 0 || percent !== 0 }
}

export function formatPortionPrice(amount: number): string {
  const digits = Number.isInteger(amount) ? 0 : 2
  const formatted = new Intl.NumberFormat('he-IL', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(amount)
  return `${formatted} ₪ למנה`
}
