import { normalizeName } from './validation.ts'

export interface ParsedContact {
  fullName: string
  phone: string
}

/** Digits only, with Israeli +972 / 00972 rewritten to a local 0 prefix. */
export function normalizePhone(phone: string): string {
  let digits = phone.replace(/\D/g, '')
  if (digits.startsWith('00972')) digits = `0${digits.slice(5)}`
  else if (digits.startsWith('972')) digits = `0${digits.slice(3)}`
  return digits
}

export function contactsMatch(
  existing: { fullName: string; phone: string },
  incoming: { fullName: string; phone: string },
): boolean {
  const existingPhone = normalizePhone(existing.phone)
  const incomingPhone = normalizePhone(incoming.phone)
  if (existingPhone && incomingPhone) return existingPhone === incomingPhone
  const name = normalizeName(incoming.fullName)
  return name.length > 0 && name === normalizeName(existing.fullName)
}

export function parseVCards(text: string): ParsedContact[] {
  const contacts: ParsedContact[] = []
  for (const card of splitCards(unfold(text))) {
    const contact = contactFromCard(card)
    if (contact) contacts.push(contact)
  }
  return contacts
}

function unfold(text: string): string[] {
  const lines = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  const unfolded: string[] = []
  for (const line of lines) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && unfolded.length > 0) {
      unfolded[unfolded.length - 1] += line.slice(1)
    } else {
      unfolded.push(line)
    }
  }
  return unfolded
}

function splitCards(lines: readonly string[]): string[][] {
  const cards: string[][] = []
  let current: string[] | null = null
  for (const line of lines) {
    if (/^BEGIN:VCARD$/i.test(line.trim())) {
      current = []
      continue
    }
    if (/^END:VCARD$/i.test(line.trim())) {
      if (current) cards.push(current)
      current = null
      continue
    }
    if (current && line.trim()) current.push(line)
  }
  return cards
}

function contactFromCard(lines: readonly string[]): ParsedContact | null {
  let fullName = ''
  let structuredName = ''
  const tels: Array<{ value: string; rank: number }> = []

  for (const line of lines) {
    const property = parseProperty(line)
    if (!property) continue
    if (property.name === 'FN' && !fullName) fullName = cleanName(property.value)
    else if (property.name === 'N' && !structuredName) structuredName = nameFromN(property.value)
    else if (property.name === 'TEL') {
      const phone = cleanTel(property.value)
      if (phone) tels.push({ value: phone, rank: telRank(property.params) })
    }
  }

  const name = fullName || structuredName
  if (!name) return null
  const best = tels.reduce<{ value: string; rank: number } | null>((chosen, tel) => {
    if (!chosen || tel.rank > chosen.rank) return tel
    return chosen
  }, null)
  return { fullName: name, phone: best?.value ?? '' }
}

function parseProperty(line: string): { name: string; params: string[]; value: string } | null {
  const separator = line.indexOf(':')
  if (separator <= 0) return null
  const left = line.slice(0, separator)
  const rawValue = line.slice(separator + 1)
  const pieces = splitParams(left)
  const name = propertyName(pieces[0] ?? '')
  if (!name) return null
  const params = pieces.slice(1)
  const quotedPrintable = params.some((param) => param.toLowerCase().replace(/\s/g, '') === 'encoding=quoted-printable')
  const value = quotedPrintable ? decodeQuotedPrintable(rawValue) : unescapeValue(rawValue)
  return { name, params, value }
}

function propertyName(raw: string): string {
  const dot = raw.lastIndexOf('.')
  return (dot >= 0 ? raw.slice(dot + 1) : raw).trim().toUpperCase()
}

function splitParams(raw: string): string[] {
  const parts: string[] = []
  let current = ''
  let quoted = false
  for (const char of raw) {
    if (char === '"') quoted = !quoted
    else if (char === ';' && !quoted) {
      parts.push(current)
      current = ''
    } else current += char
  }
  parts.push(current)
  return parts
}

function nameFromN(value: string): string {
  const [family = '', given = '', additional = '', prefix = '', suffix = ''] = value.split(';').map((part) => part.trim())
  return [prefix, given, additional, family, suffix].filter(Boolean).join(' ')
}

function cleanName(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

function cleanTel(value: string): string {
  return value.trim().replace(/^tel:/i, '').trim()
}

function telRank(params: readonly string[]): number {
  const tokens = params.flatMap((param) => param.toLowerCase().split(/[=,]/)).map((token) => token.trim())
  let rank = 0
  if (tokens.includes('pref')) rank += 100
  if (tokens.some((token) => token === 'cell' || token === 'mobile' || token === 'iphone')) rank += 50
  return rank
}

function unescapeValue(value: string): string {
  return value.replace(/\\([,;nN\\])/g, (_, char: string) => (char === 'n' || char === 'N' ? ' ' : char))
}

function decodeQuotedPrintable(value: string): string {
  const folded = value.replace(/=\r?\n/g, '')
  const bytes: number[] = []
  for (let index = 0; index < folded.length; index += 1) {
    if (folded[index] === '=' && /^[0-9A-Fa-f]{2}$/.test(folded.slice(index + 1, index + 3))) {
      bytes.push(Number.parseInt(folded.slice(index + 1, index + 3), 16))
      index += 2
    } else {
      bytes.push(folded.charCodeAt(index) & 0xff)
    }
  }
  return new TextDecoder('utf-8').decode(new Uint8Array(bytes)).replace(/\s+/g, ' ').trim()
}
