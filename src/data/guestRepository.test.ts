import { describe, expect, it } from 'vitest'
import { makeDraft, makeGuest } from '../domain/makeGuest.ts'
import { createLocalGuestRepository, GUEST_STORAGE_KEY } from './guestRepository.ts'
import { createMemoryStorage } from './storage.ts'

describe('local guest repository', () => {
  it('creates, updates, removes and reloads guests from storage', async () => {
    const storage = createMemoryStorage()
    const repo = createLocalGuestRepository(storage)
    const seen: number[] = []
    repo.subscribe((guests) => seen.push(guests.length))

    const created = await repo.create(makeDraft({ fullName: 'דנה כהן', partySize: 2, side: 'bride' }))
    expect(created.id).toBeTruthy()
    expect(created.fullName).toBe('דנה כהן')

    await repo.update(created.id, makeDraft({ fullName: 'דנה לוי', partySize: 3, rsvp: 'attending', side: 'bride' }))
    await repo.remove(created.id)
    expect(seen).toEqual([0, 1, 1, 0])

    await repo.create(makeDraft({ fullName: 'יוסי לוי' }))
    const reloaded = createLocalGuestRepository(storage)
    expect((await reloaded.ready()).map((guest) => guest.fullName)).toEqual(['יוסי לוי'])
  })

  it('drops corrupt storage instead of throwing', async () => {
    const storage = createMemoryStorage({ [GUEST_STORAGE_KEY]: '{not json' })
    const repo = createLocalGuestRepository(storage)
    expect(await repo.ready()).toEqual([])
  })

  it('ignores invalid records and rejects an empty name', async () => {
    const storage = createMemoryStorage({
      [GUEST_STORAGE_KEY]: JSON.stringify([{ id: 'bad' }, makeGuest({ id: 'ok', fullName: 'אבי ברק' })]),
    })
    const repo = createLocalGuestRepository(storage)
    expect((await repo.ready()).map((guest) => guest.id)).toEqual(['ok'])
    await expect(repo.create(makeDraft({ fullName: '   ' }))).rejects.toMatchObject({ errors: ['name-required'] })
  })

  it('replaces the saved list', async () => {
    const repo = createLocalGuestRepository(createMemoryStorage())
    await repo.replaceAll([makeGuest({ id: 'a', fullName: 'נועה מזרחי' })])
    expect((await repo.ready()).map((guest) => guest.fullName)).toEqual(['נועה מזרחי'])
  })
})
