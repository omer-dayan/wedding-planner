import { collection, doc, getDoc, onSnapshot, writeBatch, type Firestore, type WriteBatch } from 'firebase/firestore'
import type { ActivityInput } from '../domain/activity.ts'
import { DomainError } from '../domain/errors.ts'
import { recordActivity, type ActivityLogger } from './activityLog.ts'
import { nextPermissionRetryDelay } from './firestoreListeners.ts'
import type { KeyValueStorage } from './storage.ts'

export interface Stamped {
  id: string
  createdAt: string
  updatedAt: string
}

type Parse<T> = (value: unknown) => T | null

/** A list kept as JSON in browser storage, shared with other tabs through the storage event. */
export function createLocalList<T>(storage: KeyValueStorage, key: string, parse: Parse<T>) {
  const listeners = new Set<(items: T[]) => void>()
  let items = read()

  function read(): T[] {
    try {
      const parsed = JSON.parse(storage.getItem(key) || '[]') as unknown
      return Array.isArray(parsed) ? parsed.flatMap((entry) => parse(entry) ?? []) : []
    } catch {
      return []
    }
  }

  function publish() {
    for (const listener of listeners) listener(items)
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (event) => {
      if (event.key !== key) return
      items = read()
      publish()
    })
  }

  return {
    items: () => items,
    save(next: T[]) {
      try {
        storage.setItem(key, JSON.stringify(next))
      } catch {
        throw new DomainError('storage-full')
      }
      items = next
      publish()
    },
    subscribe(listener: (items: T[]) => void) {
      listener(items)
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

/** Where a record repository keeps its items. `commit` writes items and activity together. */
export interface RecordStore<T extends Stamped> {
  subscribe(listener: (items: T[]) => void, onError?: (error: unknown) => void): () => void
  get(id: string): Promise<T>
  commit(set: readonly T[], remove: readonly string[], activity: readonly ActivityInput[]): Promise<void>
}

export function localStore<T extends Stamped>(storage: KeyValueStorage, key: string, parse: Parse<T>, logger?: ActivityLogger): RecordStore<T> {
  const list = createLocalList(storage, key, parse)
  return {
    subscribe: list.subscribe,
    async get(id) {
      const found = list.items().find((item) => item.id === id)
      if (!found) throw new DomainError('not-found')
      return found
    },
    async commit(set, remove, activity) {
      const changed = new Map(set.map((item) => [item.id, item]))
      const kept = list.items().filter((item) => !remove.includes(item.id))
      const next = kept.map((item) => changed.get(item.id) ?? item)
      for (const item of set) if (!kept.some((existing) => existing.id === item.id)) next.push(item)
      list.save(next)
      recordActivity(logger, activity)
    },
  }
}

export function firestoreStore<T extends Stamped>(db: Firestore, path: string, parse: Parse<T>, logger?: ActivityLogger): RecordStore<T> {
  const ref = collection(db, path)
  const parseDoc = (id: string, data: Record<string, unknown>) => parse({ ...data, id })
  return {
    subscribe(listener, onError) {
      // Right after sign-in the security rules can briefly deny the read, so retry a few times.
      let cancelled = false
      let failures = 0
      let timer: ReturnType<typeof setTimeout> | undefined
      let stop = () => {}
      const listen = () => {
        stop = onSnapshot(
          ref,
          (snapshot) => {
            failures = 0
            listener(snapshot.docs.flatMap((entry) => parseDoc(entry.id, entry.data()) ?? []))
          },
          (error) => {
            stop()
            const delay = nextPermissionRetryDelay(failures, error)
            if (cancelled || delay === null) return onError?.(error)
            failures += 1
            timer = setTimeout(() => !cancelled && listen(), delay)
          },
        )
      }
      listen()
      return () => {
        cancelled = true
        clearTimeout(timer)
        stop()
      }
    },
    async get(id) {
      const current = await getDoc(doc(ref, id))
      const stored = current.exists() ? parseDoc(id, current.data()) : null
      if (!stored) throw new DomainError('not-found')
      return stored
    },
    async commit(set, remove, activity) {
      const ops: Array<(batch: WriteBatch) => void> = [
        ...set.map((item) => (batch: WriteBatch) => {
          const { id, ...data } = item
          batch.set(doc(ref, id), data)
        }),
        ...remove.map((id) => (batch: WriteBatch) => batch.delete(doc(ref, id))),
      ]
      ops.push((batch) => recordActivity(logger, activity, batch))
      for (let index = 0; index < ops.length; index += 400) {
        const batch = writeBatch(db)
        for (const op of ops.slice(index, index + 400)) op(batch)
        await batch.commit()
      }
    },
  }
}

export interface RecordSpec<T extends Stamped, D, A> {
  /** Validates a draft and returns its clean fields. */
  normalize(draft: D): Partial<T>
  /** Fields set once from whoever adds the record. */
  author(author: A): Partial<T>
  created?(item: T): ActivityInput[]
  updated?(before: T, after: T): ActivityInput[]
  removed?(item: T): ActivityInput[]
  createdMany?(items: T[]): ActivityInput[]
}

export interface RecordRepository<T, D, A = void> {
  subscribe(listener: (items: T[]) => void, onError?: (error: unknown) => void): () => void
  create(draft: D, author: A): Promise<T>
  createMany(drafts: readonly D[], author: A): Promise<T[]>
  update(id: string, draft: D): Promise<T>
  remove(id: string): Promise<void>
}

export function createRecordRepository<T extends Stamped, D, A>(store: RecordStore<T>, spec: RecordSpec<T, D, A>): RecordRepository<T, D, A> {
  function build(draft: D, author: A, now: string): T {
    return { id: crypto.randomUUID(), ...spec.normalize(draft), ...spec.author(author), createdAt: now, updatedAt: now } as T
  }
  return {
    subscribe: store.subscribe,
    async create(draft, author) {
      const item = build(draft, author, new Date().toISOString())
      await store.commit([item], [], spec.created?.(item) ?? [])
      return item
    },
    async createMany(drafts, author) {
      const now = new Date().toISOString()
      const items = drafts.map((draft) => build(draft, author, now))
      if (items.length > 0) await store.commit(items, [], spec.createdMany?.(items) ?? [])
      return items
    },
    async update(id, draft) {
      const normalized = spec.normalize(draft)
      const current = await store.get(id)
      const item = { ...current, ...normalized, updatedAt: new Date().toISOString() } as T
      await store.commit([item], [], spec.updated?.(current, item) ?? [])
      return item
    },
    async remove(id) {
      const current = await store.get(id)
      await store.commit([], [id], spec.removed?.(current) ?? [])
    },
  }
}
