import { RSVP_LABELS } from './labels.ts'
import type { RsvpStatus } from './types.ts'
import { isRsvp } from './types.ts'
import { roleLabel, type WeddingRoleId } from './roles.ts'
import { isWeddingRole } from './roles.ts'
import { venueStatusLabel, type VenueStatusId, isVenueStatus } from './venues.ts'
import type { Guest } from './types.ts'
import type { Song } from './songs.ts'
import type { Venue } from './venues.ts'
import { formatShekels, type Expense } from './expenses.ts'
import type { VenueQuestion } from './venueQuestions.ts'

export const ACTIVITY_TYPES = [
  'guest_added',
  'guest_edited',
  'guest_deleted',
  'rsvp_changed',
  'guests_imported',
  'song_added',
  'song_deleted',
  'venue_added',
  'venue_status',
  'venue_video',
  'venue_questions',
  'venue_answers',
  'member_added',
  'role_changed',
  'expense_added',
  'expense_deleted',
] as const

export type ActivityType = (typeof ACTIVITY_TYPES)[number]
export type ActivityEntity = 'guest' | 'song' | 'venue' | 'member' | 'rsvp' | 'expense'

export interface ActivityDetails {
  from: string
  to: string
  count: number
  names: string[]
  fields: string[]
  artworkUrl: string
}

export interface ActivityInput {
  type: ActivityType
  entity: ActivityEntity
  entityId: string
  entityName: string
  details?: Partial<ActivityDetails>
}

export interface ActivityActor {
  email: string
  name: string
  role: WeddingRoleId | null
  photoUrl: string
}

export interface ActivityEvent {
  id: string
  type: ActivityType
  entity: ActivityEntity
  entityId: string
  entityName: string
  actorEmail: string
  actorName: string
  actorRole: WeddingRoleId | null
  actorPhotoUrl: string
  createdAt: string
  details: ActivityDetails
}

const FEMININE = new Set<WeddingRoleId>(['bride', 'bride_mother', 'bride_sister', 'groom_mother', 'groom_sister'])

const FIELD_LABELS: Record<string, string> = {
  fullName: 'שם',
  phone: 'טלפון',
  side: 'צד',
  role: 'תפקיד',
  group: 'קבוצה',
  subSide: 'קירבה',
  category: 'קטגוריה',
  partySize: 'מספר אנשים',
  childrenSmall: 'ילדים 0-3',
  childrenOlder: 'ילדים 4-10',
  drinkerCount: 'שותים',
  notes: 'הערה',
}

export function emptyDetails(partial: Partial<ActivityDetails> = {}): ActivityDetails {
  return {
    from: partial.from ?? '',
    to: partial.to ?? '',
    count: partial.count ?? 0,
    names: partial.names ?? [],
    fields: partial.fields ?? [],
    artworkUrl: partial.artworkUrl ?? '',
  }
}

const ENTITIES: readonly ActivityEntity[] = ['guest', 'song', 'venue', 'member', 'rsvp', 'expense']

const text = (value: unknown) => (typeof value === 'string' ? value : '')
const strings = (value: unknown, max: number) => (Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string').slice(0, max) : [])

/** A stored event, or null when it is not one this app knows how to show. */
export function parseActivityEvent(value: unknown): ActivityEvent | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  if (typeof record.id !== 'string' || !isActivityType(record.type)) return null
  if (!ENTITIES.includes(record.entity as ActivityEntity)) return null
  const details = record.details && typeof record.details === 'object' ? record.details as Record<string, unknown> : {}
  return {
    id: record.id,
    type: record.type,
    entity: record.entity as ActivityEntity,
    entityId: text(record.entityId),
    entityName: text(record.entityName),
    actorEmail: text(record.actorEmail),
    actorName: text(record.actorName),
    actorRole: isWeddingRole(record.actorRole) ? record.actorRole : null,
    actorPhotoUrl: text(record.actorPhotoUrl),
    createdAt: text(record.createdAt) || new Date(0).toISOString(),
    details: emptyDetails({
      from: text(details.from),
      to: text(details.to),
      count: typeof details.count === 'number' ? details.count : 0,
      names: strings(details.names, 8),
      fields: strings(details.fields, 12),
      artworkUrl: text(details.artworkUrl),
    }),
  }
}

export function isActivityType(value: unknown): value is ActivityType {
  return typeof value === 'string' && (ACTIVITY_TYPES as readonly string[]).includes(value)
}

export function roleIsFeminine(role: WeddingRoleId | null): boolean {
  return role !== null && FEMININE.has(role)
}

export function describeActivity(event: Pick<ActivityEvent, 'type' | 'entityName' | 'actorName' | 'actorRole' | 'details'>): string {
  const who = actorPhrase(event.actorName, event.actorRole)
  const name = event.entityName.trim() || 'פריט'
  const feminine = roleIsFeminine(event.actorRole)
  switch (event.type) {
    case 'guest_added':
      return `${who} ${verb('הוסיף', 'הוסיפה', feminine)} את ${name} לרשימת המוזמנים`
    case 'guest_edited':
      return `${who} ${verb('עדכן', 'עדכנה', feminine)} את ${name}${fieldSuffix(event.details.fields)}`
    case 'guest_deleted':
      return `${who} ${verb('מחק', 'מחקה', feminine)} את ${name} מרשימת המוזמנים`
    case 'rsvp_changed':
      return `${who} ${verb('שינה', 'שינתה', feminine)} את האישור של ${name} מ${rsvpText(event.details.from)} ל${rsvpText(event.details.to)}`
    case 'guests_imported':
      return `${who} ${verb('ייבא', 'ייבאה', feminine)} ${importPhrase(event.details)}`
    case 'song_added':
      return `${who} ${verb('הוסיף', 'הוסיפה', feminine)} את השיר ${name}`
    case 'song_deleted':
      return `${who} ${verb('מחק', 'מחקה', feminine)} את השיר ${name}`
    case 'venue_added':
      return `${who} ${verb('הוסיף', 'הוסיפה', feminine)} את האולם ${name}`
    case 'venue_status':
      return `${who} ${verb('שינה', 'שינתה', feminine)} את הסטטוס של ${name} ל${statusText(event.details.to)}`
    case 'venue_video':
      return `${who} ${verb('הוסיף', 'הוסיפה', feminine)} סרטון לאולם ${name}`
    case 'venue_questions':
      return `${who} ${verb('עדכן', 'עדכנה', feminine)} את שאלות האולמות`
    case 'venue_answers':
      return `${who} ${verb('ענה', 'ענתה', feminine)} על שאלות האולם ${name}`
    case 'member_added':
      return `${who} ${verb('הוסיף', 'הוסיפה', feminine)} את ${name} כשותף`
    case 'role_changed':
      return `${who} ${verb('שינה', 'שינתה', feminine)} את התפקיד של ${name} ל${roleText(event.details.to)}`
    case 'expense_added':
      return `${who} ${verb('הוסיף', 'הוסיפה', feminine)} הוצאה: ${name}${event.details.to ? ` (${event.details.to})` : ''}`
    case 'expense_deleted':
      return `${who} ${verb('מחק', 'מחקה', feminine)} את ההוצאה ${name}`
  }
}

export function relativeTime(iso: string, now = new Date()): string {
  const then = new Date(iso)
  if (Number.isNaN(then.getTime())) return ''
  const minutes = Math.round((now.getTime() - then.getTime()) / 60000)
  if (minutes < 1) return 'עכשיו'
  if (minutes < 60) return minutes === 1 ? 'לפני דקה' : `לפני ${minutes} דקות`
  const hours = Math.round(minutes / 60)
  if (hours < 24 && sameDay(then, now)) return hours === 1 ? 'לפני שעה' : `לפני ${hours} שעות`
  if (isYesterday(then, now)) return 'אתמול'
  const days = Math.round((startOfDay(now).getTime() - startOfDay(then).getTime()) / 86400000)
  if (days > 1 && days < 7) return `לפני ${days} ימים`
  return then.toLocaleDateString('he-IL', { day: 'numeric', month: 'long' })
}

export function groupActivityByDay(events: readonly ActivityEvent[], now = new Date()): Array<{ id: string; label: string; events: ActivityEvent[] }> {
  const groups: Array<{ id: string; label: string; events: ActivityEvent[] }> = []
  for (const event of events) {
    const when = new Date(event.createdAt)
    const id = Number.isNaN(when.getTime()) ? 'unknown' : startOfDay(when).toISOString()
    const label = dayLabel(when, now)
    const current = groups.find((group) => group.id === id)
    if (current) current.events.push(event)
    else groups.push({ id, label, events: [event] })
  }
  return groups
}

export function countdownLabel(date: string, now = new Date()): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  const target = new Date(`${date}T00:00:00`)
  if (Number.isNaN(target.getTime())) return null
  const days = Math.round((target.getTime() - startOfDay(now).getTime()) / 86400000)
  if (days > 1) return `בעוד ${days} ימים`
  if (days === 1) return 'מחר'
  if (days === 0) return 'היום'
  return `לפני ${Math.abs(days)} ימים`
}

export function guestActivity(before: Guest | null, after: Guest | null): ActivityInput[] {
  if (!before && after) {
    return [{ type: 'guest_added', entity: 'guest', entityId: after.id, entityName: after.fullName }]
  }
  if (before && !after) {
    return [{ type: 'guest_deleted', entity: 'guest', entityId: before.id, entityName: before.fullName }]
  }
  if (!before || !after) return []
  const inputs: ActivityInput[] = []
  if (before.rsvp !== after.rsvp) {
    inputs.push({
      type: 'rsvp_changed',
      entity: 'rsvp',
      entityId: after.id,
      entityName: after.fullName,
      details: { from: before.rsvp, to: after.rsvp },
    })
  }
  const fields = changedGuestFields(before, after)
  if (fields.length > 0) {
    inputs.push({
      type: 'guest_edited',
      entity: 'guest',
      entityId: after.id,
      entityName: after.fullName,
      details: { fields },
    })
  }
  return inputs
}

export function songAddedInput(song: Song): ActivityInput {
  return {
    type: 'song_added',
    entity: 'song',
    entityId: song.id,
    entityName: song.artist ? `${song.title} · ${song.artist}` : song.title,
    details: { artworkUrl: song.artworkUrl },
  }
}

export function expenseAddedInput(expense: Pick<Expense, 'id' | 'title' | 'amount'>): ActivityInput {
  return {
    type: 'expense_added',
    entity: 'expense',
    entityId: expense.id,
    entityName: expense.title,
    details: { to: formatShekels(expense.amount) },
  }
}

export function expenseDeletedInput(expense: Pick<Expense, 'id' | 'title'>): ActivityInput {
  return {
    type: 'expense_deleted',
    entity: 'expense',
    entityId: expense.id,
    entityName: expense.title,
  }
}

export function songDeletedInput(song: Pick<Song, 'id' | 'title' | 'artist' | 'artworkUrl'>): ActivityInput {
  return {
    type: 'song_deleted',
    entity: 'song',
    entityId: song.id,
    entityName: song.artist ? `${song.title} · ${song.artist}` : song.title,
    details: { artworkUrl: song.artworkUrl },
  }
}

export function venueActivity(before: Venue | null, after: Venue | null): ActivityInput[] {
  if (!before && after) {
    return [{ type: 'venue_added', entity: 'venue', entityId: after.id, entityName: after.name }]
  }
  if (!before || !after) return []
  const inputs: ActivityInput[] = []
  if (before.status !== after.status) {
    inputs.push({
      type: 'venue_status',
      entity: 'venue',
      entityId: after.id,
      entityName: after.name,
      details: { from: before.status, to: after.status },
    })
  }
  const addedVideo = after.tiktokUrls.some((url) => !before.tiktokUrls.includes(url))
  if (addedVideo) {
    inputs.push({ type: 'venue_video', entity: 'venue', entityId: after.id, entityName: after.name })
  }
  if (!sameAnswers(before.answers, after.answers) || !sameOffers(before.offers, after.offers)) {
    inputs.push({ type: 'venue_answers', entity: 'venue', entityId: after.id, entityName: after.name })
  }
  return inputs
}

export function venueQuestionsInput(questions: readonly VenueQuestion[]): ActivityInput {
  return {
    type: 'venue_questions',
    entity: 'venue',
    entityId: 'questions',
    entityName: 'שאלות אולמות',
    details: { count: questions.length, names: questions.slice(0, 5).map((question) => question.label) },
  }
}

function sameOffers(before: Venue['offers'], after: Venue['offers']): boolean {
  return JSON.stringify(before) === JSON.stringify(after)
}

function sameAnswers(before: Record<string, string>, after: Record<string, string>): boolean {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)])
  for (const key of keys) {
    if ((before[key] ?? '') !== (after[key] ?? '')) return false
  }
  return true
}

export function importActivity(guests: readonly { id: string; fullName: string }[]): ActivityInput {
  const names = guests.slice(0, 5).map((guest) => guest.fullName)
  return {
    type: 'guests_imported',
    entity: 'guest',
    entityId: guests[0]?.id ?? 'contacts',
    entityName: guests.length === 1 ? 'איש קשר אחד' : `${guests.length} אנשי קשר`,
    details: { count: guests.length, names },
  }
}

export function memberAddedInput(email: string): ActivityInput {
  return { type: 'member_added', entity: 'member', entityId: email.trim().toLowerCase(), entityName: email.trim() }
}

export function roleChangedInput(email: string, from: WeddingRoleId | null, to: WeddingRoleId): ActivityInput {
  return {
    type: 'role_changed',
    entity: 'member',
    entityId: email.trim().toLowerCase(),
    entityName: email.trim(),
    details: { from: from ?? '', to },
  }
}

export function unreadCount(events: readonly { createdAt: string }[], lastSeen: string | null): number {
  if (!lastSeen) return events.length
  return events.filter((event) => event.createdAt > lastSeen).length
}

function changedGuestFields(before: Guest, after: Guest): string[] {
  const fields: string[] = []
  if (before.fullName !== after.fullName) fields.push('fullName')
  if (before.phone !== after.phone) fields.push('phone')
  if (before.side !== after.side) fields.push('side')
  if (before.role !== after.role) fields.push('role')
  if (before.group !== after.group) fields.push('group')
  if (before.subSide !== after.subSide) fields.push('subSide')
  if (before.category !== after.category) fields.push('category')
  if (before.partySize !== after.partySize) fields.push('partySize')
  if (before.childrenSmall !== after.childrenSmall) fields.push('childrenSmall')
  if (before.childrenOlder !== after.childrenOlder) fields.push('childrenOlder')
  if (before.drinkerCount !== after.drinkerCount) fields.push('drinkerCount')
  if (before.notes !== after.notes) fields.push('notes')
  return fields
}

function actorPhrase(name: string, role: WeddingRoleId | null): string {
  const first = displayFirstName(name)
  if (role) return `${roleLabel(role)} (${first})`
  return first
}

function displayFirstName(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return 'מישהו'
  if (trimmed.includes('@')) return trimmed.split('@')[0] || trimmed
  return trimmed.split(/\s+/)[0] || trimmed
}

function verb(masculine: string, feminine: string, isFeminine: boolean): string {
  return isFeminine ? feminine : masculine
}

function fieldSuffix(fields: readonly string[]): string {
  if (fields.length === 0) return ''
  const labels = fields.map((field) => FIELD_LABELS[field] ?? field)
  return `: ${labels.join(', ')}`
}

function rsvpText(value: string): string {
  return isRsvp(value) ? RSVP_LABELS[value as RsvpStatus] : 'לא ידוע'
}

function statusText(value: string): string {
  return isVenueStatus(value) ? venueStatusLabel(value as VenueStatusId) : value || 'לא ידוע'
}

function roleText(value: string): string {
  return isWeddingRole(value) ? roleLabel(value) : 'ללא תפקיד'
}

function importPhrase(details: ActivityDetails): string {
  const count = details.count
  const lead = count === 1 ? 'איש קשר אחד' : `${count} אנשי קשר`
  if (details.names.length === 0) return lead
  return `${lead}, בהם ${details.names.join(', ')}`
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function sameDay(left: Date, right: Date): boolean {
  return startOfDay(left).getTime() === startOfDay(right).getTime()
}

function isYesterday(then: Date, now: Date): boolean {
  const yesterday = startOfDay(now)
  yesterday.setDate(yesterday.getDate() - 1)
  return sameDay(then, yesterday)
}

function dayLabel(when: Date, now: Date): string {
  if (Number.isNaN(when.getTime())) return 'מועד לא ידוע'
  if (sameDay(when, now)) return 'היום'
  if (isYesterday(when, now)) return 'אתמול'
  return when.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' })
}
