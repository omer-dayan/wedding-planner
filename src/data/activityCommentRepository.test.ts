import { describe, expect, it } from 'vitest'
import { createLocalActivityCommentRepository } from './activityCommentRepository.ts'
import { createMemoryStorage } from './storage.ts'

describe('local activity comments', () => {
  it('adds, lists, and removes comments for a feed event', async () => {
    const repo = createLocalActivityCommentRepository(
      createMemoryStorage(),
      () => ({ email: 'a@example.com', name: 'אבי', role: 'groom', photoUrl: '' }),
    )
    let latest: { id: string; text: string }[] = []
    const stop = repo.subscribe((comments) => {
      latest = comments.map((comment) => ({ id: comment.id, text: comment.text }))
    })
    const first = await repo.add('event-1', 'יפה!')
    const second = await repo.add('event-1', 'גם אני')
    expect(latest.map((item) => item.text)).toEqual(['יפה!', 'גם אני'])
    await repo.remove(first.id)
    expect(latest.map((item) => item.id)).toEqual([second.id])
    stop()
  })
})
