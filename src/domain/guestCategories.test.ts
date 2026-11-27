import { describe, expect, it } from 'vitest'
import {
  canParent,
  flattenTree,
  legacyCategory,
  normalizeGuestCategories,
  pathLabel,
  removeGuestCategory,
  subtreeIds,
  type GuestCategory,
} from './guestCategories.ts'

const friends: GuestCategory = { id: 'c_friends', label: 'חברים', parentId: '' }
const work: GuestCategory = { id: 'c_work', label: 'עבודה', parentId: 'c_friends' }
const family: GuestCategory = { id: 'c_family', label: 'משפחה', parentId: '' }
const nuclear: GuestCategory = { id: 'c_nuclear', label: 'משפחה גרעינית', parentId: 'c_family' }
const tree = [friends, work, family, nuclear]

describe('guest category tree', () => {
  it('nests work under friends and keeps family across both sides as one branch', () => {
    expect(subtreeIds(tree, 'c_friends')).toEqual(['c_friends', 'c_work'])
    expect(subtreeIds(tree, 'c_family')).toEqual(['c_family', 'c_nuclear'])
    expect(pathLabel(tree, 'c_work')).toBe('חברים / עבודה')
    const school: GuestCategory = { id: 'c_school', label: 'חברי בית ספר יסודי', parentId: 'c_childhood' }
    const childhood: GuestCategory = { id: 'c_childhood', label: 'חברי ילדות', parentId: 'c_friends' }
    expect(pathLabel([friends, childhood, school], 'c_school')).toBe('חברים / חברי ילדות / חברי בית ספר יסודי')
    expect(normalizeGuestCategories(Array.from({ length: 41 }, (_, index) => ({
      id: `c_${index}`,
      label: `קטגוריה ${index}`,
      parentId: '',
    }))).length).toBe(41)
    expect(legacyCategory(tree, 'c_nuclear')).toBe('family')
    expect(legacyCategory(tree, 'c_work')).toBe('work')
  })

  it('refuses to put a category under its own descendant', () => {
    expect(canParent(tree, 'c_friends', 'c_work')).toBe(false)
    expect(canParent(tree, 'c_work', 'c_family')).toBe(true)
    expect(() => normalizeGuestCategories([
      friends,
      { ...work, parentId: 'c_work' },
    ])).toThrow(/guest-categories/)
  })

  it('moves children up when a category is removed', () => {
    const removed = removeGuestCategory(tree, 'c_family')
    expect(removed.moveGuestsTo).toBe('')
    expect(removed.categories.find((category) => category.id === 'c_nuclear')?.parentId).toBe('')
    expect(flattenTree(removed.categories).map((row) => row.category.label)).toContain('משפחה גרעינית')
  })
})
