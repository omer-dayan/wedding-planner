import type { AppCsvRecord } from './csv.ts'
import type { SheetGuest } from './googleSheet.ts'
import { normalizeDraft, normalizeName } from './validation.ts'
import type { Guest } from './types.ts'

export interface ImportOutcome {
  guests: Guest[]
  created: number
  updated: number
  assumed: number
}

interface Clock {
  now?: () => string
  createId?: () => string
}

export function applySheetImport(
  existing: readonly Guest[],
  incoming: readonly SheetGuest[],
  clock: Clock = {},
): ImportOutcome {
  const now = clock.now ?? (() => new Date().toISOString())
  const createId = clock.createId ?? (() => crypto.randomUUID())
  const next = existing.map((guest) => ({ ...guest }))
  const indexByName = new Map<string, number>()
  next.forEach((guest, index) => indexByName.set(normalizeName(guest.fullName), index))

  let created = 0
  let updated = 0
  for (const row of incoming) {
    const key = normalizeName(row.fullName)
    const found = indexByName.get(key)
    if (found === undefined) {
      const timestamp = now()
      const guest: Guest = {
        id: createId(),
        ...normalizeDraft({
          fullName: row.fullName,
          phone: '',
          side: null,
          group: row.group,
          partySize: row.partySize,
          partySizeAssumed: row.partySizeAssumed,
          rsvp: 'pending',
          notes: '',
        }),
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      indexByName.set(key, next.length)
      next.push(guest)
      created += 1
    } else {
      const current = next[found]
      next[found] = {
        ...current,
        fullName: normalizeDraft({ ...current, fullName: row.fullName }).fullName,
        group: row.group,
        partySize: row.partySize,
        partySizeAssumed: row.partySizeAssumed,
        updatedAt: now(),
      }
      updated += 1
    }
  }

  return {
    guests: next,
    created,
    updated,
    assumed: incoming.filter((row) => row.partySizeAssumed).length,
  }
}

export function applyAppCsvImport(
  existing: readonly Guest[],
  incoming: readonly AppCsvRecord[],
  clock: Clock = {},
): ImportOutcome {
  const now = clock.now ?? (() => new Date().toISOString())
  const createId = clock.createId ?? (() => crypto.randomUUID())
  const next = existing.map((guest) => ({ ...guest }))
  const indexById = new Map(next.map((guest, index) => [guest.id, index]))
  const indexByName = new Map<string, number>()
  next.forEach((guest, index) => {
    if (!indexByName.has(normalizeName(guest.fullName))) indexByName.set(normalizeName(guest.fullName), index)
  })

  let created = 0
  let updated = 0
  for (const row of incoming) {
    const draft = normalizeDraft(row)
    const byId = row.id ? indexById.get(row.id) : undefined
    const byName = row.id ? undefined : indexByName.get(normalizeName(draft.fullName))
    const found = byId ?? byName
    if (found === undefined) {
      const timestamp = now()
      const id = row.id || createId()
      const guest: Guest = { id, ...draft, createdAt: timestamp, updatedAt: timestamp }
      indexById.set(id, next.length)
      indexByName.set(normalizeName(draft.fullName), next.length)
      next.push(guest)
      created += 1
    } else {
      const current = next[found]
      next[found] = { ...current, ...draft, updatedAt: now() }
      indexByName.set(normalizeName(draft.fullName), found)
      updated += 1
    }
  }

  return {
    guests: next,
    created,
    updated,
    assumed: incoming.filter((row) => row.partySizeAssumed).length,
  }
}
