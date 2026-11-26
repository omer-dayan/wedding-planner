import { ValidationError } from './errors.ts'
import { isCoupleOrOwner, type RoleAssignment } from './roles.ts'
import { sanitizeAnswers } from './venueQuestions.ts'

export const VENUE_STATUSES = [
  { id: 'want', label: 'רוצים לראות' },
  { id: 'scheduled', label: 'קבענו פגישה' },
  { id: 'visited', label: 'ראינו' },
  { id: 'rejected', label: 'פסלנו' },
  { id: 'chosen', label: 'נבחר' },
] as const

export type VenueStatusId = (typeof VENUE_STATUSES)[number]['id']

export const WEEKDAYS = [
  { id: 'sunday', label: 'יום ראשון' },
  { id: 'monday', label: 'יום שני' },
  { id: 'tuesday', label: 'יום שלישי' },
  { id: 'wednesday', label: 'יום רביעי' },
  { id: 'thursday', label: 'יום חמישי' },
  { id: 'friday', label: 'יום שישי' },
  { id: 'saturday', label: 'שבת' },
] as const

export const MONTHS = [
  { id: 1, label: 'ינואר' },
  { id: 2, label: 'פברואר' },
  { id: 3, label: 'מרץ' },
  { id: 4, label: 'אפריל' },
  { id: 5, label: 'מאי' },
  { id: 6, label: 'יוני' },
  { id: 7, label: 'יולי' },
  { id: 8, label: 'אוגוסט' },
  { id: 9, label: 'ספטמבר' },
  { id: 10, label: 'אוקטובר' },
  { id: 11, label: 'נובמבר' },
  { id: 12, label: 'דצמבר' },
] as const

export type WeekdayId = (typeof WEEKDAYS)[number]['id']

export interface VenueOffer {
  id: string
  month: number
  weekday: WeekdayId | ''
  answers: Record<string, string>
}

export interface VenueDraft {
  name: string
  city: string
  phone: string
  website: string
  priceNotes: string
  status: VenueStatusId
  visitDate: string
  notes: string
  tiktokUrls: string[]
  answers: Record<string, string>
  offers: VenueOffer[]
  imageUrl: string
}

export interface Venue extends VenueDraft {
  id: string
  addedByEmail: string
  createdAt: string
  updatedAt: string
}

export function isVenueStatus(value: unknown): value is VenueStatusId {
  return typeof value === 'string' && VENUE_STATUSES.some((status) => status.id === value)
}

export function venueStatusLabel(status: VenueStatusId): string {
  return VENUE_STATUSES.find((item) => item.id === status)?.label ?? 'רוצים לראות'
}

const STATUS_ORDER: Record<VenueStatusId, number> = {
  chosen: 0,
  scheduled: 1,
  visited: 2,
  want: 3,
  rejected: 4,
}

export function compareVenues(left: Venue, right: Venue): number {
  const rank = STATUS_ORDER[left.status] - STATUS_ORDER[right.status]
  if (rank !== 0) return rank
  if (left.visitDate !== right.visitDate) {
    if (!left.visitDate) return 1
    if (!right.visitDate) return -1
    return left.visitDate.localeCompare(right.visitDate)
  }
  return left.name.localeCompare(right.name, 'he')
}

export function normalizeWebsite(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    throw new ValidationError(['invalid-url'])
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new ValidationError(['invalid-url'])
  return url.toString()
}

/** Video id from a full tiktok.com/@user/video/<id> link. Short links return null. */
export function tiktokVideoId(value: string): string | null {
  const trimmed = value.trim()
  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    return null
  }
  const host = url.hostname.replace(/^www\./, '')
  if (host !== 'tiktok.com' && host !== 'm.tiktok.com') return null
  const match = url.pathname.match(/\/video\/(\d+)/)
  return match?.[1] ?? null
}

export function normalizeTikTokUrl(value: string): string {
  const trimmed = value.trim()
  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    throw new ValidationError(['invalid-url'])
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new ValidationError(['invalid-url'])
  const host = url.hostname.replace(/^www\./, '')
  const allowed = host === 'tiktok.com' || host === 'm.tiktok.com' || host === 'vm.tiktok.com' || host === 'vt.tiktok.com'
  if (!allowed) throw new ValidationError(['invalid-url'])
  return url.toString()
}

export function venueVideoQuery(name: string, city: string): string {
  const cleanName = name.replace(/\s+/g, ' ').trim()
  const cleanCity = city.replace(/\s+/g, ' ').trim()
  const base = [cleanName, cleanCity].filter(Boolean).join(' ')
  if (cleanName.includes('אולם')) return base
  return `${base} אולם`.trim()
}

/** iOS registers tiktok://. keyword= asks the app to open search results, not a blank box. */
export function tiktokAppSearchUrl(query: string): string {
  return `tiktok://search?keyword=${encodeURIComponent(query)}`
}

/** Mobile web /search?q= ignores the query. The video tab URL is the fallback. */
export function tiktokWebVideoSearchUrl(query: string): string {
  return `https://www.tiktok.com/search/video?q=${encodeURIComponent(query)}`
}

export function googleTikTokVideoSearchUrl(name: string, city: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(`${venueVideoQuery(name, city)} site:tiktok.com`)}`
}

export function mapsSearchUrl(name: string, city: string): string {
  const query = `${name} ${city}`.replace(/\s+/g, ' ').trim()
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}

export function normalizeVenue(input: VenueDraft): VenueDraft {
  const name = input.name.trim().replace(/\s+/g, ' ')
  const city = input.city.trim().replace(/\s+/g, ' ')
  const phone = input.phone.trim()
  const priceNotes = input.priceNotes.trim()
  const notes = input.notes.trim()
  const visitDate = input.visitDate.trim()
  const errors: string[] = []
  if (!name) errors.push('venue-name-required')
  if (name.length > 200) errors.push('name-length')
  if (city.length > 120) errors.push('city-length')
  if (phone.length > 40) errors.push('phone-length')
  if (priceNotes.length > 500) errors.push('price-length')
  if (notes.length > 2000) errors.push('notes-length')
  if (visitDate && !/^\d{4}-\d{2}-\d{2}$/.test(visitDate)) errors.push('visit-date')
  if (!isVenueStatus(input.status)) errors.push('venue-status')
  let website = ''
  try {
    website = normalizeWebsite(input.website)
  } catch {
    errors.push('invalid-url')
  }
  const tiktokUrls: string[] = []
  for (const raw of input.tiktokUrls) {
    try {
      const url = normalizeTikTokUrl(raw)
      if (!tiktokUrls.includes(url)) tiktokUrls.push(url)
    } catch {
      errors.push('invalid-url')
    }
  }
  if (tiktokUrls.length > 20) errors.push('too-many-videos')
  let imageUrl = ''
  try {
    imageUrl = normalizeImage(input.imageUrl)
  } catch {
    errors.push('invalid-url')
  }
  const offers = normalizeOffers(input.offers, sanitizeAnswers(input.answers))
  if (offers.length > 12) errors.push('too-many-offers')
  if (errors.length > 0) throw new ValidationError(errors)
  return {
    name,
    city,
    phone,
    website,
    priceNotes,
    status: input.status,
    visitDate,
    notes,
    tiktokUrls,
    answers: offers[0]?.answers ?? sanitizeAnswers(input.answers),
    offers,
    imageUrl,
  }
}

export function createVenueOffer(): VenueOffer {
  return { id: `o_${crypto.randomUUID()}`, month: 0, weekday: '', answers: {} }
}

export function offerTitle(offer: Pick<VenueOffer, 'month' | 'weekday'>): string {
  const day = WEEKDAYS.find((item) => item.id === offer.weekday)?.label
  const month = MONTHS.find((item) => item.id === offer.month)?.label
  if (day && month) return `${day} ב${month}`
  if (month) return month
  if (day) return day
  return 'הצעה חדשה'
}

function normalizeOffers(value: unknown, fallbackAnswers: Record<string, string>): VenueOffer[] {
  const raw = Array.isArray(value) ? value : []
  const offers: VenueOffer[] = []
  const seen = new Set<string>()
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue
    const record = entry as Record<string, unknown>
    const id = typeof record.id === 'string' ? record.id.trim() : ''
    if (!/^[A-Za-z0-9_-]+$/.test(id) || id.length > 80 || seen.has(id)) continue
    const month = typeof record.month === 'number' && record.month >= 1 && record.month <= 12 ? record.month : 0
    const weekday = WEEKDAYS.some((item) => item.id === record.weekday) ? record.weekday as WeekdayId : ''
    seen.add(id)
    offers.push({ id, month, weekday, answers: sanitizeAnswers(record.answers) })
  }
  if (offers.length === 0 && Object.keys(fallbackAnswers).length > 0) {
    offers.push({ id: 'o_current', month: 0, weekday: '', answers: fallbackAnswers })
  }
  return offers
}

const MAX_IMAGE_CHARS = 170_000

export function normalizeImage(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (trimmed.startsWith('data:image/')) {
    if (trimmed.length > MAX_IMAGE_CHARS || !trimmed.includes(',')) throw new ValidationError(['invalid-url'])
    return trimmed
  }
  return normalizeWebsite(trimmed)
}

export function parseStoredVenue(value: unknown): Venue | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  if (typeof record.id !== 'string' || !record.id) return null
  const urls = Array.isArray(record.tiktokUrls) ? record.tiktokUrls.filter((item): item is string => typeof item === 'string') : []
  let draft: VenueDraft
  try {
    draft = normalizeVenue({
      name: typeof record.name === 'string' ? record.name : '',
      city: typeof record.city === 'string' ? record.city : '',
      phone: typeof record.phone === 'string' ? record.phone : '',
      website: typeof record.website === 'string' ? record.website : '',
      priceNotes: typeof record.priceNotes === 'string' ? record.priceNotes : '',
      status: isVenueStatus(record.status) ? record.status : 'want',
      visitDate: typeof record.visitDate === 'string' ? record.visitDate : '',
      notes: typeof record.notes === 'string' ? record.notes : '',
      tiktokUrls: urls,
      answers: sanitizeAnswers(record.answers),
      offers: Array.isArray(record.offers) ? record.offers as VenueOffer[] : [],
      imageUrl: typeof record.imageUrl === 'string' ? record.imageUrl : '',
    })
  } catch {
    return null
  }
  return {
    id: record.id,
    ...draft,
    addedByEmail: typeof record.addedByEmail === 'string' ? record.addedByEmail.trim().toLowerCase() : '',
    createdAt: typeof record.createdAt === 'string' ? record.createdAt : new Date(0).toISOString(),
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : new Date(0).toISOString(),
  }
}

export function canManageVenues(wedding: RoleAssignment | null, email: string | null): boolean {
  return isCoupleOrOwner(wedding, email)
}
