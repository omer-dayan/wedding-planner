import { DomainError } from './errors.ts'
import { looksLikeAppCsv, parseCsv } from './csv.ts'

export interface SheetGuest {
  fullName: string
  group: string
  partySize: number
  partySizeAssumed: boolean
}

export interface SheetRowError {
  line: number
  code: string
}

export interface SheetParseResult {
  guests: SheetGuest[]
  skippedHeaderRows: number
  duplicateNames: number
  errors: SheetRowError[]
  fatal: 'app-csv' | null
}

export function parseGoogleSheetCsv(text: string): SheetParseResult {
  const rows = parseCsv(text)
  if (rows.length === 0) {
    return { guests: [], skippedHeaderRows: 0, duplicateNames: 0, errors: [], fatal: null }
  }
  if (looksLikeAppCsv(rows[0])) {
    return { guests: [], skippedHeaderRows: 0, duplicateNames: 0, errors: [], fatal: 'app-csv' }
  }

  let category = ''
  let subCategory = ''
  let skippedHeaderRows = 0
  let duplicateNames = 0
  const errors: SheetRowError[] = []
  const order: string[] = []
  const byName = new Map<string, SheetGuest>()

  rows.forEach((row, index) => {
    const line = index + 1
    const categoryCell = (row[0] ?? '').trim()
    const subCell = (row[1] ?? '').trim()
    const nameCell = (row[2] ?? '').trim().replace(/\s+/g, ' ')
    const countCell = (row[3] ?? '').trim()
    if (!categoryCell && !subCell && !nameCell && !countCell) return

    if (categoryCell) {
      category = categoryCell
      subCategory = ''
    }
    if (subCell) subCategory = subCell

    if (!nameCell) {
      skippedHeaderRows += 1
      return
    }

    const count = parseCount(countCell)
    if (!count) {
      errors.push({ line, code: 'invalid-count' })
      return
    }

    const key = nameCell.toLocaleLowerCase('he')
    if (byName.has(key)) duplicateNames += 1
    else order.push(key)
    byName.set(key, {
      fullName: nameCell,
      group: formatGroup(category, subCategory),
      partySize: count.partySize,
      partySizeAssumed: count.assumed,
    })
  })

  return {
    guests: order.map((key) => byName.get(key) as SheetGuest),
    skippedHeaderRows,
    duplicateNames,
    errors,
    fatal: null,
  }
}

export function formatGroup(category: string, subCategory: string): string {
  if (category && subCategory) return `${category} / ${subCategory}`
  return category || subCategory
}

export function toGoogleSheetsCsvExportUrl(shareUrl: string): string {
  const trimmed = shareUrl.trim()
  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    throw new DomainError('invalid-url')
  }

  const host = url.hostname.toLowerCase()
  if (host !== 'docs.google.com' && host !== 'drive.google.com') {
    throw new DomainError('invalid-url')
  }

  const match = url.pathname.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  if (!match) throw new DomainError('invalid-url')

  const exportUrl = new URL(`https://docs.google.com/spreadsheets/d/${match[1]}/export`)
  exportUrl.searchParams.set('format', 'csv')
  const gid = url.searchParams.get('gid') ?? readGid(url.hash)
  if (gid && /^\d+$/.test(gid)) exportUrl.searchParams.set('gid', gid)
  return exportUrl.toString()
}

export async function fetchGoogleSheetCsv(shareUrl: string, fetchImpl: typeof fetch = fetch): Promise<string> {
  const exportUrl = toGoogleSheetsCsvExportUrl(shareUrl)
  let response: Response
  try {
    response = await fetchImpl(exportUrl)
  } catch {
    throw new DomainError('network')
  }
  if (!response.ok) throw new DomainError('http')
  const text = await response.text()
  if (/<!doctype html/i.test(text) || /<html[\s>]/i.test(text)) throw new DomainError('not-csv')
  return text
}

function parseCount(value: string): { partySize: number; assumed: boolean } | null {
  if (value === '') return { partySize: 1, assumed: true }
  if (!/^\d+$/.test(value)) return null
  const partySize = Number(value)
  if (partySize < 1 || partySize > 100) return null
  return { partySize, assumed: false }
}

function readGid(hash: string): string | null {
  const match = /gid=(\d+)/.exec(hash)
  return match?.[1] ?? null
}
