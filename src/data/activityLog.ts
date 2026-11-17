import type { WriteBatch } from 'firebase/firestore'
import type { ActivityActor, ActivityEvent, ActivityInput } from '../domain/activity.ts'

export function recordActivity(logger: ActivityLogger | undefined, inputs: readonly ActivityInput[], batch?: WriteBatch) {
  if (!logger || inputs.length === 0) return
  for (const input of inputs) {
    if (batch && logger.stage) logger.stage(batch, input)
    else logger.append(input)
  }
}

export interface ActivityPage {
  events: ActivityEvent[]
  hasMore: boolean
}

export interface ActivityLogger {
  actor(): ActivityActor
  append(input: ActivityInput): void
  stage?(batch: WriteBatch, input: ActivityInput): void
}

export interface ActivityRepository extends ActivityLogger {
  subscribe(listener: (page: ActivityPage) => void, onError?: (error: unknown) => void): () => void
  loadMore(): Promise<void>
}

export const ACTIVITY_PAGE_SIZE = 50
export const ACTIVITY_STORAGE_KEY = 'wedding-planner.activity.v1'
