import { initializeApp } from 'firebase/app'
import {
  getAuth,
  getRedirectResult,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type Auth,
  type User,
} from 'firebase/auth'
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Firestore,
  type WriteBatch,
} from 'firebase/firestore'
import { type FirebaseWebConfig } from './firebaseConfig.ts'
import { isCommittedServerSnapshot, nextPermissionRetryDelay } from './firestoreListeners.ts'
import type { GuestRepository } from './guestRepository.ts'
import { DomainError, ValidationError } from '../domain/errors.ts'
import { emailVariants, normalizeWeddingName, type Wedding } from '../domain/members.ts'
import { cleanMemberRoles, type WeddingRoleId } from '../domain/roles.ts'
import { normalizeDraft, parseStoredGuest } from '../domain/validation.ts'
import type { Guest } from '../domain/types.ts'

export const AUTH_REDIRECT_KEY = 'wedding-planner.auth-redirect'

export interface WeddingRepository {
  subscribe(listener: (weddings: Wedding[]) => void, onError?: (error: unknown) => void): () => void
  create(ownerEmail: string, name?: string): Promise<Wedding>
  updateName(id: string, name: string): Promise<void>
  updateMembers(id: string, memberEmails: readonly string[], memberRoles: Record<string, WeddingRoleId>): Promise<void>
}

export interface FirebaseServices {
  auth: Auth
  db: Firestore
  createGuestRepository: (weddingId: string) => GuestRepository
  createWeddingRepository: (email: string) => WeddingRepository
}

let services: FirebaseServices | null = null

export function createFirebaseServices(config: FirebaseWebConfig): FirebaseServices {
  if (services) return services
  const app = initializeApp({
    apiKey: config.apiKey,
    authDomain: config.authDomain,
    projectId: config.projectId,
    appId: config.appId,
    storageBucket: config.storageBucket || undefined,
    messagingSenderId: config.messagingSenderId || undefined,
  })
  const auth = getAuth(app)
  const db = getFirestore(app)
  services = {
    auth,
    db,
    createGuestRepository: (weddingId) => createFirestoreGuestRepository(db, weddingId),
    createWeddingRepository: (email) => createFirestoreWeddingRepository(db, email),
  }
  return services
}

export async function signInWithGoogle(auth: Auth): Promise<void> {
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ prompt: 'select_account' })
  try {
    await signInWithPopup(auth, provider)
  } catch (error) {
    const code = firebaseErrorCode(error)
    if (code === 'auth/popup-blocked') {
      sessionStorage.setItem(AUTH_REDIRECT_KEY, '1')
      await signInWithRedirect(auth, provider)
      return
    }
    throw error
  }
}

export async function completeRedirectSignIn(auth: Auth): Promise<User | null> {
  if (sessionStorage.getItem(AUTH_REDIRECT_KEY) !== '1') return null
  sessionStorage.removeItem(AUTH_REDIRECT_KEY)
  const result = await getRedirectResult(auth)
  return result?.user ?? null
}

export async function signOutUser(auth: Auth): Promise<void> {
  await signOut(auth)
}

export function firebaseErrorCode(error: unknown): string {
  if (typeof error === 'object' && error && 'code' in error) return String((error as { code: unknown }).code)
  return ''
}

function createFirestoreWeddingRepository(db: Firestore, email: string): WeddingRepository {
  const weddings = collection(db, 'weddings')
  return {
    subscribe(listener, onError) {
      const membership = query(weddings, where('memberEmails', 'array-contains', email))
      return onSnapshot(
        membership,
        { includeMetadataChanges: true },
        (snapshot) => {
          if (!isCommittedServerSnapshot(snapshot.metadata)) return
          listener(
            snapshot.docs.flatMap((entry) => {
              const wedding = weddingFromData(entry.id, entry.data())
              return wedding ? [wedding] : []
            }),
          )
        },
        (error) => onError?.(error),
      )
    },
    async create(ownerEmail, name = 'החתונה שלנו') {
      const ref = doc(weddings)
      const timestamp = new Date().toISOString()
      const wedding: Wedding = {
        id: ref.id,
        name: normalizeWeddingName(name),
        ownerEmail,
        memberEmails: emailVariants(ownerEmail),
        memberRoles: { [ownerEmail.trim().toLowerCase()]: 'groom' },
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      await setDoc(ref, {
        name: wedding.name,
        ownerEmail: wedding.ownerEmail,
        memberEmails: wedding.memberEmails,
        memberRoles: wedding.memberRoles,
        createdAt: wedding.createdAt,
        updatedAt: wedding.updatedAt,
      })
      return wedding
    },
    async updateName(id, name) {
      await updateDoc(doc(weddings, id), {
        name: normalizeWeddingName(name),
        updatedAt: new Date().toISOString(),
      })
    },
    async updateMembers(id, memberEmails, memberRoles) {
      await updateDoc(doc(weddings, id), {
        memberEmails: [...memberEmails],
        memberRoles,
        updatedAt: new Date().toISOString(),
      })
    },
  }
}

function createFirestoreGuestRepository(db: Firestore, weddingId: string): GuestRepository {
  const guests = collection(db, 'weddings', weddingId, 'guests')

  function mapSnapshot(docs: Array<{ id: string; data: () => Record<string, unknown> }>): Guest[] {
    return docs.flatMap((entry) => {
      const guest = parseStoredGuest({ ...entry.data(), id: entry.id })
      return guest ? [guest] : []
    })
  }

  return {
    subscribe(listener, onError) {
      let cancelled = false
      let stop = () => {}
      let timer: ReturnType<typeof setTimeout> | undefined
      let failures = 0

      const listen = () => {
        stop = onSnapshot(
          guests,
          (snapshot) => {
            failures = 0
            listener(mapSnapshot(snapshot.docs))
          },
          (error) => {
            stop()
            const delay = nextPermissionRetryDelay(failures, error)
            if (cancelled || delay === null) {
              onError?.(error)
              return
            }
            failures += 1
            timer = setTimeout(() => {
              if (!cancelled) listen()
            }, delay)
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
    ready() {
      return new Promise((resolve, reject) => {
        let failures = 0
        const listen = () => {
          const unsubscribe = onSnapshot(
            guests,
            (snapshot) => {
              unsubscribe()
              resolve(mapSnapshot(snapshot.docs))
            },
            (error) => {
              unsubscribe()
              const delay = nextPermissionRetryDelay(failures, error)
              if (delay === null) {
                reject(error)
                return
              }
              failures += 1
              setTimeout(listen, delay)
            },
          )
        }
        listen()
      })
    },
    async create(draft) {
      const normalized = normalizeDraft(draft)
      const timestamp = new Date().toISOString()
      const guest: Guest = {
        id: crypto.randomUUID(),
        ...normalized,
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      await setDoc(doc(guests, guest.id), guestToDoc(guest))
      return guest
    },
    async update(id, draft) {
      const normalized = normalizeDraft(draft)
      const ref = doc(guests, id)
      const current = await getDoc(ref)
      if (!current.exists()) throw new DomainError('not-found')
      const createdAt = typeof current.data().createdAt === 'string' ? current.data().createdAt : new Date().toISOString()
      const guest: Guest = { id, ...normalized, createdAt, updatedAt: new Date().toISOString() }
      await updateDoc(ref, guestToDoc(guest))
      return guest
    },
    async remove(id) {
      const ref = doc(guests, id)
      const current = await getDoc(ref)
      if (!current.exists()) throw new DomainError('not-found')
      await deleteDoc(ref)
    },
    async replaceAll(next) {
      const clean: Guest[] = []
      for (const guest of next) {
        const parsed = parseStoredGuest(guest)
        if (!parsed) throw new ValidationError(['invalid-guest'])
        clean.push(parsed)
      }
      const current = await getDocs(guests)
      const nextIds = new Set(clean.map((guest) => guest.id))
      const ops: Array<(batch: WriteBatch) => void> = []
      for (const guest of clean) {
        ops.push((batch) => batch.set(doc(guests, guest.id), guestToDoc(guest)))
      }
      for (const entry of current.docs) {
        if (!nextIds.has(entry.id)) ops.push((batch) => batch.delete(entry.ref))
      }
      await commitOps(db, ops)
    },
  }
}

async function commitOps(db: Firestore, ops: Array<(batch: WriteBatch) => void>) {
  const size = 400
  for (let index = 0; index < ops.length; index += size) {
    const slice = ops.slice(index, index + size)
    if (slice.length === 0) continue
    const batch = writeBatch(db)
    for (const op of slice) op(batch)
    await batch.commit()
  }
}

function guestToDoc(guest: Guest): Record<string, string | number | boolean | null> {
  return {
    fullName: guest.fullName,
    phone: guest.phone,
    side: guest.side,
    role: guest.role,
    group: guest.group,
    partySize: guest.partySize,
    partySizeAssumed: guest.partySizeAssumed,
    rsvp: guest.rsvp,
    notes: guest.notes,
    createdAt: guest.createdAt,
    updatedAt: guest.updatedAt,
  }
}

function weddingFromData(id: string, data: Record<string, unknown>): Wedding | null {
  if (typeof data.name !== 'string' || typeof data.ownerEmail !== 'string' || !Array.isArray(data.memberEmails)) {
    return null
  }
  const memberEmails = data.memberEmails.filter((email): email is string => typeof email === 'string')
  const memberRoles = cleanMemberRoles(data.memberRoles)
  return {
    id,
    name: data.name,
    ownerEmail: data.ownerEmail,
    memberEmails,
    memberRoles,
    createdAt: typeof data.createdAt === 'string' ? data.createdAt : '',
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : '',
  }
}

