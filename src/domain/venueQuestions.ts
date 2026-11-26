import { ValidationError } from './errors.ts'

export const VENUE_QUESTION_TYPES = ['text', 'number', 'yesno', 'long'] as const
export type VenueQuestionType = (typeof VENUE_QUESTION_TYPES)[number]

export const VENUE_QUESTION_TYPE_LABELS: Record<VenueQuestionType, string> = {
  text: 'טקסט',
  number: 'מספר',
  yesno: 'כן/לא',
  long: 'טקסט ארוך',
}

/** How a number question changes the per-portion price. Missing means infer from the label. */
export const PRICE_PARTS = ['base', 'add', 'split', 'percent', 'guests', 'skip'] as const
export type PricePart = (typeof PRICE_PARTS)[number]

export const PRICE_PART_LABELS: Record<PricePart, string> = {
  base: 'מחיר בסיס לראש',
  add: 'תוספת לראש',
  split: 'סכום קבוע לחלק לאורחים',
  percent: 'אחוז על המחיר',
  guests: 'כמות אורחים',
  skip: 'לא נכנס לחישוב',
}

export interface VenueQuestion {
  id: string
  label: string
  type: VenueQuestionType
  pricePart?: PricePart
}

const MAX_QUESTIONS = 20
const MAX_LABEL = 80
const MAX_ANSWER = 2000
const ID_PATTERN = /^[A-Za-z0-9_-]+$/

export function isVenueQuestionType(value: unknown): value is VenueQuestionType {
  return typeof value === 'string' && (VENUE_QUESTION_TYPES as readonly string[]).includes(value)
}

export function isPricePart(value: unknown): value is PricePart {
  return typeof value === 'string' && (PRICE_PARTS as readonly string[]).includes(value)
}

/** Guess the price role from a Hebrew label when the question was not tagged explicitly. */
export function inferredPricePart(label: string): PricePart | null {
  const text = label.replace(/[״"]/g, '').replace(/\s+/g, '')
  if (/אחוז|מעמ|שירות|%|ויאט/.test(text)) return 'percent'
  if (/מסאולם|אגרה|אגרת/.test(text)) return 'split'
  if (/אורח|מוזמן|מינימום/.test(text) && !text.includes('מנה')) return 'guests'
  if (/תוספת|שדרוג/.test(text)) return 'add'
  if (text.includes('מנה')) return 'base'
  return null
}

export function pricePartOf(question: VenueQuestion): PricePart | null {
  if (question.type !== 'number') return null
  if (question.pricePart === 'skip') return null
  const inferred = inferredPricePart(question.label)
  // Hall tax was often saved as a flat add-on before it could be split across guests.
  if (inferred === 'split' && (!question.pricePart || question.pricePart === 'add')) return 'split'
  if (question.pricePart) return question.pricePart
  return inferred
}

export function createVenueQuestion(label = '', type: VenueQuestionType = 'text'): VenueQuestion {
  return { id: `q_${crypto.randomUUID()}`, label: label.trim(), type }
}

export function normalizeVenueQuestions(value: unknown): VenueQuestion[] {
  if (!Array.isArray(value)) throw new ValidationError(['venue-questions'])
  if (value.length > MAX_QUESTIONS) throw new ValidationError(['too-many-questions'])
  const questions: VenueQuestion[] = []
  const seen = new Set<string>()
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') throw new ValidationError(['venue-questions'])
    const record = entry as Record<string, unknown>
    const id = typeof record.id === 'string' ? record.id.trim() : ''
    const label = typeof record.label === 'string' ? record.label.trim().replace(/\s+/g, ' ') : ''
    if (!ID_PATTERN.test(id) || id.length > 80) throw new ValidationError(['venue-questions'])
    if (!label || label.length > MAX_LABEL) throw new ValidationError(['question-label'])
    if (!isVenueQuestionType(record.type)) throw new ValidationError(['question-type'])
    if (seen.has(id)) throw new ValidationError(['venue-questions'])
    seen.add(id)
    const question: VenueQuestion = { id, label, type: record.type }
    if (record.type === 'number' && record.pricePart !== undefined && record.pricePart !== '') {
      if (!isPricePart(record.pricePart)) throw new ValidationError(['question-price'])
      question.pricePart = record.pricePart
    }
    questions.push(question)
  }
  return questions
}

export function readVenueQuestions(value: unknown): VenueQuestion[] {
  try {
    return normalizeVenueQuestions(value)
  } catch {
    return []
  }
}

export function sanitizeAnswers(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const answers: Record<string, string> = {}
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!ID_PATTERN.test(key) || key.length > 80) continue
    if (typeof raw !== 'string') continue
    const trimmed = raw.trim()
    if (!trimmed) continue
    answers[key] = trimmed.slice(0, MAX_ANSWER)
    if (Object.keys(answers).length >= 40) break
  }
  return answers
}

export function answerValue(question: VenueQuestion, raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  if (question.type === 'yesno') return trimmed === 'yes' || trimmed === 'no' ? trimmed : ''
  if (question.type === 'number') {
    const normalized = trimmed.replace(/,/g, '')
    if (!/^-?\d+(\.\d+)?$/.test(normalized)) return ''
    return normalized.slice(0, 40)
  }
  return trimmed.slice(0, question.type === 'long' ? MAX_ANSWER : 500)
}

/** Keep answers for questions that were removed, and replace answers for the current template. */
export function mergeAnswers(
  existing: Record<string, string>,
  questions: readonly VenueQuestion[],
  incoming: Record<string, string>,
): Record<string, string> {
  const next = sanitizeAnswers(existing)
  for (const question of questions) {
    const value = answerValue(question, incoming[question.id] ?? '')
    if (value) next[question.id] = value
    else delete next[question.id]
  }
  return next
}

export function answerProgress(
  questions: readonly VenueQuestion[],
  answers: Record<string, string>,
): { answered: number; total: number } {
  const answered = questions.filter((question) => (answers[question.id] ?? '').trim() !== '').length
  return { answered, total: questions.length }
}

export function formatAnswer(question: VenueQuestion, value: string): string {
  if (question.type === 'yesno') return value === 'yes' ? 'כן' : value === 'no' ? 'לא' : ''
  return value
}
