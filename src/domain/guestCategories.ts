import { ValidationError } from './errors.ts'
import type { Category } from './types.ts'

export interface GuestCategory {
  id: string
  label: string
  /** Empty string means the category is at the root, beside the sides rather than under them. */
  parentId: string
}

const ID_PATTERN = /^[A-Za-z0-9_-]+$/

export function createGuestCategory(label = '', parentId = ''): GuestCategory {
  return { id: `c_${crypto.randomUUID()}`, label: label.trim(), parentId }
}

export function isGuestCategoryId(value: string): boolean {
  return ID_PATTERN.test(value) && value.length <= 80
}

export function normalizeGuestCategories(value: unknown): GuestCategory[] {
  if (!Array.isArray(value)) throw new ValidationError(['guest-categories'])
  const categories: GuestCategory[] = []
  const seen = new Set<string>()
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') throw new ValidationError(['guest-categories'])
    const record = entry as Record<string, unknown>
    const id = typeof record.id === 'string' ? record.id.trim() : ''
    const label = typeof record.label === 'string' ? record.label.trim().replace(/\s+/g, ' ') : ''
    const parentId = typeof record.parentId === 'string' ? record.parentId.trim() : ''
    if (!isGuestCategoryId(id) || !label || label.length > 60) throw new ValidationError(['guest-categories'])
    if (parentId && !isGuestCategoryId(parentId)) throw new ValidationError(['guest-categories'])
    if (parentId === id || seen.has(id)) throw new ValidationError(['guest-categories'])
    seen.add(id)
    categories.push({ id, label, parentId })
  }
  const ids = new Set(categories.map((category) => category.id))
  for (const category of categories) {
    if (category.parentId && !ids.has(category.parentId)) throw new ValidationError(['guest-categories'])
    if (category.parentId && createsCycle(categories, category.id, category.parentId)) {
      throw new ValidationError(['guest-categories'])
    }
  }
  return categories
}

export function readGuestCategories(value: unknown): GuestCategory[] {
  try {
    return normalizeGuestCategories(value)
  } catch {
    return []
  }
}

export function childrenOf(categories: readonly GuestCategory[], parentId: string): GuestCategory[] {
  return categories.filter((category) => category.parentId === parentId)
}

export function categoryById(categories: readonly GuestCategory[], id: string): GuestCategory | null {
  return categories.find((category) => category.id === id) ?? null
}

/** The category and everything nested under it. */
export function subtreeIds(categories: readonly GuestCategory[], id: string): string[] {
  const ids = [id]
  for (const child of childrenOf(categories, id)) ids.push(...subtreeIds(categories, child.id))
  return ids
}

export function ancestorChain(categories: readonly GuestCategory[], id: string): GuestCategory[] {
  const chain: GuestCategory[] = []
  const seen = new Set<string>()
  let current = categoryById(categories, id)
  while (current && !seen.has(current.id)) {
    seen.add(current.id)
    chain.unshift(current)
    current = current.parentId ? categoryById(categories, current.parentId) : null
  }
  return chain
}

export function pathLabel(categories: readonly GuestCategory[], id: string): string {
  return ancestorChain(categories, id).map((category) => category.label).join(' / ')
}

export function canParent(categories: readonly GuestCategory[], id: string, parentId: string): boolean {
  if (!parentId) return true
  if (parentId === id) return false
  return !subtreeIds(categories, id).includes(parentId)
}

export function flattenTree(
  categories: readonly GuestCategory[],
  parentId = '',
  depth = 0,
): Array<{ category: GuestCategory; depth: number }> {
  const rows: Array<{ category: GuestCategory; depth: number }> = []
  const siblings = childrenOf(categories, parentId)
  for (const category of siblings) {
    rows.push({ category, depth })
    rows.push(...flattenTree(categories, category.id, depth + 1))
  }
  return rows
}

/** Drop a category. Its children move up, and guests that pointed at it should point at the parent. */
export function removeGuestCategory(categories: readonly GuestCategory[], id: string): { categories: GuestCategory[]; moveGuestsTo: string } {
  const current = categoryById(categories, id)
  const parentId = current?.parentId ?? ''
  return {
    moveGuestsTo: parentId,
    categories: categories
      .filter((category) => category.id !== id)
      .map((category) => (category.parentId === id ? { ...category, parentId } : category)),
  }
}

/** Coarse legacy bucket so older filters still have a side-independent family/friends/work value. */
export function legacyCategory(categories: readonly GuestCategory[], id: string): Category {
  const labels = ancestorChain(categories, id).map((category) => category.label.replace(/\s+/g, ''))
  if (labels.some((label) => label.includes('משפחה'))) return 'family'
  if (labels.some((label) => label.includes('עבודה'))) return 'work'
  if (labels.some((label) => label.includes('חברים'))) return 'friends'
  return 'other'
}

function createsCycle(categories: readonly GuestCategory[], id: string, parentId: string): boolean {
  const seen = new Set<string>([id])
  let current = parentId
  while (current) {
    if (seen.has(current)) return true
    seen.add(current)
    current = categories.find((category) => category.id === current)?.parentId ?? ''
  }
  return false
}
