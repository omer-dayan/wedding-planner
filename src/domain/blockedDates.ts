export interface BlockedDate {
  id: string
  /** YYYY-MM-DD. One entry per day. */
  date: string
  reason: string
}

export const MAX_BLOCKED_DATES = 400
const MAX_RANGE_DAYS = 60

export function isRealDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

export function formatDateHe(value: string): string {
  if (!isRealDate(value)) return value
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('he-IL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function normalizeBlockedDates(list: readonly BlockedDate[]): BlockedDate[] {
  const byDate = new Map<string, BlockedDate>()
  const ids = new Set<string>()
  for (const entry of list) {
    const id = typeof entry.id === 'string' ? entry.id.trim() : ''
    const date = typeof entry.date === 'string' ? entry.date.trim() : ''
    const reason = typeof entry.reason === 'string' ? entry.reason.trim().replace(/\s+/g, ' ') : ''
    if (!/^[A-Za-z0-9_-]+$/.test(id) || id.length > 80 || ids.has(id)) continue
    if (!isRealDate(date) || reason.length > 80 || byDate.has(date)) continue
    ids.add(id)
    byDate.set(date, { id, date, reason })
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(0, MAX_BLOCKED_DATES)
}

export function readBlockedDates(value: unknown): BlockedDate[] {
  if (!Array.isArray(value)) return []
  return normalizeBlockedDates(value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return []
    const record = entry as Record<string, unknown>
    return [{
      id: typeof record.id === 'string' ? record.id : '',
      date: typeof record.date === 'string' ? record.date : '',
      reason: typeof record.reason === 'string' ? record.reason : '',
    }]
  }))
}

/** The blocked entry for a day, or null when the day is free (or no day is given). */
export function blockedOn(list: readonly BlockedDate[], date: string): BlockedDate | null {
  if (!date) return null
  return list.find((entry) => entry.date === date) ?? null
}

/** Every day from start to end inclusive, as YYYY-MM-DD. Empty when the range is invalid or too long. */
export function daysInRange(start: string, end: string): string[] {
  if (!isRealDate(start)) return []
  const last = end && isRealDate(end) ? end : start
  if (last < start) return []
  const days: string[] = []
  const [year, month, day] = start.split('-').map(Number)
  const cursor = new Date(Date.UTC(year, month - 1, day))
  while (days.length <= MAX_RANGE_DAYS) {
    const text = cursor.toISOString().slice(0, 10)
    if (text > last) return days
    days.push(text)
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return []
}

/** Add days to the list, keeping existing reasons for days that are already blocked. */
export function addBlockedDays(list: readonly BlockedDate[], days: readonly string[], reason: string): BlockedDate[] {
  const existing = new Set(list.map((entry) => entry.date))
  const added = days
    .filter((day) => !existing.has(day))
    .map((date) => ({ id: `b_${crypto.randomUUID()}`, date, reason }))
  return normalizeBlockedDates([...list, ...added])
}
