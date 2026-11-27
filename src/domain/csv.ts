import { RSVP_LABELS, SIDE_LABELS, UNSPECIFIED_SIDE_LABEL } from './labels.ts'
import { roleFromLabel, roleLabel } from './roles.ts'
import { isRsvp, isSide } from './types.ts'
import type { Guest, GuestDraft, RsvpStatus, Side } from './types.ts'

export const APP_CSV_HEADERS = [
  'מזהה',
  'שם מלא',
  'טלפון',
  'צד',
  'קבוצה',
  'מספר אנשים',
  'ילדים 0-3',
  'ילדים 4-10',
  'שותים',
  'מספר לא צוין',
  'סטטוס הגעה',
  'הערות',
  'תפקיד',
] as const

type CsvField =
  | 'id'
  | 'fullName'
  | 'phone'
  | 'side'
  | 'group'
  | 'partySize'
  | 'childrenSmall'
  | 'childrenOlder'
  | 'drinkerCount'
  | 'partySizeAssumed'
  | 'rsvp'
  | 'notes'
  | 'role'

const HEADER_ALIASES: Record<string, CsvField> = {
  מזהה: 'id',
  id: 'id',
  'שם מלא': 'fullName',
  שם: 'fullName',
  fullname: 'fullName',
  name: 'fullName',
  טלפון: 'phone',
  phone: 'phone',
  צד: 'side',
  side: 'side',
  קבוצה: 'group',
  group: 'group',
  'מספר אנשים': 'partySize',
  partysize: 'partySize',
  count: 'partySize',
  ילדים: 'childrenOlder',
  children: 'childrenOlder',
  'ילדים 0-3': 'childrenSmall',
  'ילדים 4-10': 'childrenOlder',
  שותים: 'drinkerCount',
  drinkers: 'drinkerCount',
  'מספר לא צוין': 'partySizeAssumed',
  'סטטוס הגעה': 'rsvp',
  rsvp: 'rsvp',
  status: 'rsvp',
  הערות: 'notes',
  notes: 'notes',
  תפקיד: 'role',
  role: 'role',
}

const SIDE_FROM_LABEL = new Map<string, Side | null>([
  [SIDE_LABELS.groom, 'groom'],
  [SIDE_LABELS.bride, 'bride'],
  [SIDE_LABELS.shared, 'shared'],
  [UNSPECIFIED_SIDE_LABEL, null],
  ['groom', 'groom'],
  ['bride', 'bride'],
  ['shared', 'shared'],
  ['', null],
])

const RSVP_FROM_LABEL = new Map<string, RsvpStatus>([
  [RSVP_LABELS.pending, 'pending'],
  [RSVP_LABELS.attending, 'attending'],
  [RSVP_LABELS.declined, 'declined'],
  [RSVP_LABELS.maybe, 'maybe'],
  ['pending', 'pending'],
  ['attending', 'attending'],
  ['declined', 'declined'],
  ['maybe', 'maybe'],
  ['yes', 'attending'],
  ['no', 'declined'],
])

export interface AppCsvRecord extends GuestDraft {
  id?: string
}

export interface CsvRowError {
  line: number
  code: string
}

export interface AppCsvParseResult {
  records: AppCsvRecord[]
  errors: CsvRowError[]
  fatal: 'missing-header' | null
}

export function guestsToAppCsv(guests: readonly Guest[]): string {
  const rows = [
    [...APP_CSV_HEADERS],
    ...guests.map((guest) => [
      guest.id,
      guest.fullName,
      guest.phone,
      guest.side ? SIDE_LABELS[guest.side] : '',
      guest.group,
      String(guest.partySize),
      String(guest.childrenSmall),
      String(guest.childrenOlder),
      String(guest.drinkerCount),
      guest.partySizeAssumed ? 'כן' : 'לא',
      RSVP_LABELS[guest.rsvp],
      guest.notes,
      guest.role ? roleLabel(guest.role) : '',
    ]),
  ]
  return serializeCsv(rows)
}

export function parseAppCsv(text: string): AppCsvParseResult {
  const rows = parseCsv(text)
  if (rows.length === 0) return { records: [], errors: [], fatal: 'missing-header' }

  const header = rows[0].map(normalizeHeader)
  const columns = new Map<CsvField, number>()
  header.forEach((cell, index) => {
    const field = HEADER_ALIASES[cell]
    if (field && !columns.has(field)) columns.set(field, index)
  })
  if (!columns.has('fullName') || !columns.has('partySize')) {
    return { records: [], errors: [], fatal: 'missing-header' }
  }

  const records: AppCsvRecord[] = []
  const errors: CsvRowError[] = []
  rows.slice(1).forEach((row, index) => {
    const line = index + 2
    if (row.every((cell) => cell.trim() === '')) return
    const cell = (field: CsvField) => {
      const position = columns.get(field)
      return position === undefined ? '' : (row[position] ?? '').trim()
    }

    const fullName = cell('fullName').replace(/\s+/g, ' ').trim()
    if (!fullName) {
      errors.push({ line, code: 'name-required' })
      return
    }

    const partySize = parsePartySize(cell('partySize'))
    if (partySize === null) {
      errors.push({ line, code: 'invalid-count' })
      return
    }
    const childrenSmall = parseChildCount(columns.has('childrenSmall') ? cell('childrenSmall') : '')
    const childrenOlder = parseChildCount(columns.has('childrenOlder') ? cell('childrenOlder') : '')
    if (childrenSmall === null || childrenOlder === null) {
      errors.push({ line, code: 'child-count' })
      return
    }
    const drinkerCount = parseChildCount(columns.has('drinkerCount') ? cell('drinkerCount') : '')
    if (drinkerCount === null || drinkerCount > partySize) {
      errors.push({ line, code: 'drinker-count' })
      return
    }

    const sideCell = cell('side')
    const side = SIDE_FROM_LABEL.get(sideCell)
    if (side === undefined && !isSide(sideCell)) {
      errors.push({ line, code: 'side' })
      return
    }

    const rsvpCell = cell('rsvp')
    const rsvp = rsvpCell === '' ? 'pending' : RSVP_FROM_LABEL.get(rsvpCell)
    if (!rsvp || !isRsvp(rsvp)) {
      errors.push({ line, code: 'rsvp' })
      return
    }

    const id = cell('id')
    records.push({
      id: id || undefined,
      fullName,
      phone: cell('phone'),
      side: side ?? null,
      group: cell('group'),
      partySize,
      childrenSmall,
      childrenOlder,
      drinkerCount,
      partySizeAssumed: parseYes(cell('partySizeAssumed')),
      rsvp,
      notes: columns.has('notes') ? (row[columns.get('notes') as number] ?? '').trim() : '',
      role: roleFromLabel(cell('role')),
      subSide: 'none',
      category: 'other',
      categoryId: '',
    })
  })

  return { records, errors, fatal: null }
}

export function parseCsv(text: string): string[][] {
  const source = text.replace(/^\uFEFF/, '')
  const delimiter = detectDelimiter(source)
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]
    if (inQuotes) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          field += '"'
          index += 1
        } else {
          inQuotes = false
        }
      } else {
        field += char
      }
      continue
    }

    if (char === '"') {
      inQuotes = true
      continue
    }
    if (char === delimiter) {
      row.push(field)
      field = ''
      continue
    }
    if (char === '\n' || char === '\r') {
      if (char === '\r' && source[index + 1] === '\n') index += 1
      row.push(field)
      field = ''
      if (row.some((cell) => cell.length > 0)) rows.push(row)
      row = []
      continue
    }
    field += char
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field)
    if (row.some((cell) => cell.length > 0)) rows.push(row)
  }
  return rows
}

export function serializeCsv(rows: readonly (readonly string[])[]): string {
  const body = rows.map((row) => row.map(escapeCell).join(',')).join('\r\n')
  return `\uFEFF${body}\r\n`
}

function escapeCell(value: string): string {
  if (/[",\r\n;]/.test(value)) return `"${value.replaceAll('"', '""')}"`
  return value
}

function normalizeHeader(value: string): string {
  return value.replace(/^\uFEFF/, '').trim().toLowerCase()
}

function parseChildCount(value: string): number | null {
  if (!value.trim()) return 0
  const count = Number(value)
  if (!Number.isInteger(count) || count < 0 || count > 100) return null
  return count
}

function parsePartySize(value: string): number | null {
  if (!/^\d+$/.test(value)) return null
  const partySize = Number(value)
  if (partySize < 1 || partySize > 100) return null
  return partySize
}

function parseYes(value: string): boolean {
  const normalized = value.trim().toLowerCase()
  return normalized === 'כן' || normalized === 'true' || normalized === 'yes' || normalized === '1'
}

function detectDelimiter(text: string): ',' | ';' | '\t' {
  const line = text.split(/\r?\n/).find((entry) => entry.trim().length > 0) ?? ''
  const counts: Record<',' | ';' | '\t', number> = { ',': 0, ';': 0, '\t': 0 }
  let inQuotes = false
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        index += 1
        continue
      }
      inQuotes = !inQuotes
      continue
    }
    if (!inQuotes && (char === ',' || char === ';' || char === '\t')) counts[char] += 1
  }
  let best: ',' | ';' | '\t' = ','
  if (counts[';'] > counts[best]) best = ';'
  if (counts['\t'] > counts[best]) best = '\t'
  return best
}
