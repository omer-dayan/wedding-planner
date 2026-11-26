import { subtreeIds, type GuestCategory } from './guestCategories.ts'
import type { Guest, RsvpStatus, Side, SubSide } from './types.ts'

export type SideFilter = Side | 'unspecified' | 'all'
export type RsvpFilter = RsvpStatus | 'all'
export type SubSideFilter = SubSide | 'all'
export type CategoryFilter = string

export interface GuestQuery {
  search: string
  side: SideFilter
  subSide: SubSideFilter
  category: CategoryFilter
  rsvp: RsvpFilter
  sort: 'asc' | 'desc'
}

export const EMPTY_QUERY: GuestQuery = {
  search: '',
  side: 'all',
  subSide: 'all',
  category: 'all',
  rsvp: 'all',
  sort: 'asc',
}

export function queryGuests(
  guests: readonly Guest[],
  query: GuestQuery,
  categories: readonly GuestCategory[] = [],
): Guest[] {
  const search = query.search.trim().toLocaleLowerCase('he')
  const digits = search.replace(/\D/g, '')
  const branch = query.category === 'all' ? null : new Set(subtreeIds(categories, query.category))
  const filtered = guests.filter((guest) => {
    if (query.side !== 'all' && (guest.side ?? 'unspecified') !== query.side) return false
    if (query.subSide !== 'all' && guest.subSide !== query.subSide) return false
    if (branch && !branch.has(guest.categoryId)) return false
    if (query.rsvp !== 'all' && guest.rsvp !== query.rsvp) return false
    if (!search) return true
    const haystack = `${guest.fullName} ${guest.notes} ${guest.group} ${guest.phone}`.toLocaleLowerCase('he')
    if (haystack.includes(search)) return true
    return digits.length > 0 && guest.phone.replace(/\D/g, '').includes(digits)
  })

  const direction = query.sort === 'asc' ? 1 : -1
  return filtered.slice().sort((a, b) => {
    const byName = a.fullName.localeCompare(b.fullName, 'he', { sensitivity: 'base' })
    if (byName !== 0) return byName * direction
    return a.createdAt.localeCompare(b.createdAt)
  })
}

export function groupOptions(guests: readonly Guest[]): string[] {
  const groups = new Set<string>()
  for (const guest of guests) {
    if (guest.group) groups.add(guest.group)
  }
  return [...groups].sort((a, b) => a.localeCompare(b, 'he'))
}
