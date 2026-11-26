import { initializeApp, type FirebaseApp } from 'firebase/app'
import {
  browserLocalPersistence,
  browserPopupRedirectResolver,
  getAuth,
  getRedirectResult,
  GoogleAuthProvider,
  indexedDBLocalPersistence,
  initializeAuth,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type Auth,
  type User,
} from 'firebase/auth'
import { clearAuthFlow, markAuthPending, markAuthRedirect } from '../app/authPending.ts'
import {
  collection,
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
import type { SongRepository } from './songRepository.ts'
import { createFirestoreSongRepository } from './firestoreSongs.ts'
import { createFirestoreVenueRepository } from './firestoreVenues.ts'
import { createFirestoreExpenseRepository } from './firestoreExpenses.ts'
import type { ExpenseRepository } from './expenseRepository.ts'
import type { VenueRepository } from './venueRepository.ts'
import { createFirestoreActivityRepository } from './firestoreActivity.ts'
import { createFirestoreActivityCommentRepository } from './firestoreActivityComments.ts'
import type { ActivityCommentRepository } from './activityCommentRepository.ts'
import type { ActivityLogger, ActivityRepository } from './activityLog.ts'
import { recordActivity } from './activityLog.ts'
import type { ActivityActor, ActivityInput } from '../domain/activity.ts'
import { guestActivity, importActivity } from '../domain/activity.ts'
import { normalizeVenueQuestions, readVenueQuestions } from '../domain/venueQuestions.ts'
import type { VenueQuestion } from '../domain/venueQuestions.ts'
import { normalizeGuestCategories, readGuestCategories } from '../domain/guestCategories.ts'
import type { GuestCategory } from '../domain/guestCategories.ts'
import { normalizeFamilyPlaces, readFamilyPlaces } from '../domain/geo.ts'
import type { FamilyPlace } from '../domain/geo.ts'
import { readPalette, type PaletteChoice } from '../domain/palette.ts'
import { DomainError, ValidationError } from '../domain/errors.ts'
import { emailVariants, normalizeWeddingDate, normalizeWeddingName, type Wedding } from '../domain/members.ts'
import { cleanMemberRoles, type WeddingRoleId } from '../domain/roles.ts'
import { normalizeDraft, parseStoredGuest } from '../domain/validation.ts'
import type { Guest } from '../domain/types.ts'

export interface WeddingRepository {
  subscribe(listener: (weddings: Wedding[]) => void, onError?: (error: unknown) => void): () => void
  create(ownerEmail: string, name?: string): Promise<Wedding>
  updateName(id: string, name: string): Promise<void>
  updateDate(id: string, weddingDate: string): Promise<void>
  updateQuestions(
    id: string,
    questions: readonly VenueQuestion[],
    activity?: { logger: ActivityLogger; inputs: readonly ActivityInput[] },
  ): Promise<void>
  updateCategories(id: string, categories: readonly GuestCategory[]): Promise<void>
  updatePlaces(id: string, places: readonly FamilyPlace[]): Promise<void>
  updatePalette(id: string, palette: PaletteChoice | null): Promise<void>
  updateMembers(
    id: string,
    memberEmails: readonly string[],
    memberRoles: Record<string, WeddingRoleId>,
    activity?: { logger: ActivityLogger; inputs: readonly ActivityInput[] },
  ): Promise<void>
}

export interface FirebaseServices {
  auth: Auth
  db: Firestore
  createGuestRepository: (weddingId: string, logger?: ActivityLogger) => GuestRepository
  createSongRepository: (weddingId: string, logger?: ActivityLogger) => SongRepository
  createVenueRepository: (weddingId: string, logger?: ActivityLogger) => VenueRepository
  createExpenseRepository: (weddingId: string, logger?: ActivityLogger) => ExpenseRepository
  createActivityRepository: (weddingId: string, actor: () => ActivityActor) => ActivityRepository
  createActivityCommentRepository: (weddingId: string, actor: () => ActivityActor) => ActivityCommentRepository
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
  const auth = createAuth(app)
  const db = getFirestore(app)
  services = {
    auth,
    db,
    createGuestRepository: (weddingId, logger) => createFirestoreGuestRepository(db, weddingId, logger),
    createSongRepository: (weddingId, logger) => createFirestoreSongRepository(db, weddingId, logger),
    createVenueRepository: (weddingId, logger) => createFirestoreVenueRepository(db, weddingId, logger),
    createExpenseRepository: (weddingId, logger) => createFirestoreExpenseRepository(db, weddingId, logger),
    createActivityRepository: (weddingId, actor) => createFirestoreActivityRepository(db, weddingId, actor),
    createActivityCommentRepository: (weddingId, actor) => createFirestoreActivityCommentRepository(db, weddingId, actor),
    createWeddingRepository: (email) => createFirestoreWeddingRepository(db, email),
  }
  return services
}

export function createAuth(app: FirebaseApp): Auth {
  try {
    return initializeAuth(app, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence],
      popupRedirectResolver: browserPopupRedirectResolver,
    })
  } catch (error) {
    if (firebaseErrorCode(error) === 'auth/already-initialized') return getAuth(app)
    throw error
  }
}

export function shouldUseRedirect(code: string): boolean {
  return code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment'
}

export function isQuietAuthError(code: string): boolean {
  return code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request'
}

export function signInWithGoogle(
  auth: Auth,
  impl: {
    popup: (auth: Auth, provider: GoogleAuthProvider) => Promise<unknown>
    redirect: (auth: Auth, provider: GoogleAuthProvider) => Promise<unknown>
  } = { popup: signInWithPopup, redirect: signInWithRedirect },
): Promise<void> {
  markAuthPending()
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ prompt: 'select_account' })
  return impl.popup(auth, provider).then(
    () => {
      clearAuthFlow()
    },
    (error: unknown) => {
      const code = firebaseErrorCode(error)
      if (shouldUseRedirect(code)) {
        markAuthRedirect()
        return impl.redirect(auth, provider).then(() => undefined)
      }
      clearAuthFlow()
      if (isQuietAuthError(code)) return
      throw error
    },
  )
}

export async function completeRedirectSignIn(auth: Auth): Promise<User | null> {
  try {
    const result = await getRedirectResult(auth)
    clearAuthFlow()
    return result?.user ?? null
  } catch (error) {
    clearAuthFlow()
    throw error
  }
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
        weddingDate: '',
        venueQuestions: [],
        guestCategories: [],
        familyPlaces: [],
        palette: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      await setDoc(ref, {
        name: wedding.name,
        ownerEmail: wedding.ownerEmail,
        memberEmails: wedding.memberEmails,
        memberRoles: wedding.memberRoles,
        weddingDate: wedding.weddingDate,
        venueQuestions: wedding.venueQuestions,
        guestCategories: wedding.guestCategories,
        familyPlaces: wedding.familyPlaces,
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
    async updateDate(id, weddingDate) {
      await updateDoc(doc(weddings, id), {
        weddingDate: normalizeWeddingDate(weddingDate),
        updatedAt: new Date().toISOString(),
      })
    },
    async updateQuestions(id, questions, activity) {
      const batch = writeBatch(db)
      batch.update(doc(weddings, id), {
        venueQuestions: normalizeVenueQuestions(questions),
        updatedAt: new Date().toISOString(),
      })
      if (activity) recordActivity(activity.logger, activity.inputs, batch)
      await batch.commit()
    },
    async updateCategories(id, categories) {
      await updateDoc(doc(weddings, id), {
        guestCategories: normalizeGuestCategories(categories),
        updatedAt: new Date().toISOString(),
      })
    },
    async updatePlaces(id, places) {
      await updateDoc(doc(weddings, id), {
        familyPlaces: normalizeFamilyPlaces(places),
        updatedAt: new Date().toISOString(),
      })
    },
    async updatePalette(id, palette) {
      await updateDoc(doc(weddings, id), {
        palette: palette ? { green: palette.green, pink: palette.pink } : null,
        updatedAt: new Date().toISOString(),
      })
    },
    async updateMembers(id, memberEmails, memberRoles, activity) {
      const batch = writeBatch(db)
      batch.update(doc(weddings, id), {
        memberEmails: [...memberEmails],
        memberRoles,
        updatedAt: new Date().toISOString(),
      })
      if (activity) recordActivity(activity.logger, activity.inputs, batch)
      await batch.commit()
    },
  }
}

function createFirestoreGuestRepository(db: Firestore, weddingId: string, logger?: ActivityLogger): GuestRepository {
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
      const batch = writeBatch(db)
      batch.set(doc(guests, guest.id), guestToDoc(guest))
      recordActivity(logger, guestActivity(null, guest), batch)
      await batch.commit()
      return guest
    },
    async update(id, draft) {
      const normalized = normalizeDraft(draft)
      const ref = doc(guests, id)
      const current = await getDoc(ref)
      if (!current.exists()) throw new DomainError('not-found')
      const stored = parseStoredGuest({ ...current.data(), id })
      const createdAt = typeof current.data().createdAt === 'string' ? current.data().createdAt : new Date().toISOString()
      const guest: Guest = { id, ...normalized, createdAt, updatedAt: new Date().toISOString() }
      const batch = writeBatch(db)
      batch.update(ref, guestToDoc(guest))
      recordActivity(logger, guestActivity(stored, guest), batch)
      await batch.commit()
      return guest
    },
    async remove(id) {
      const ref = doc(guests, id)
      const current = await getDoc(ref)
      if (!current.exists()) throw new DomainError('not-found')
      const stored = parseStoredGuest({ ...current.data(), id })
      const batch = writeBatch(db)
      batch.delete(ref)
      recordActivity(logger, guestActivity(stored, null), batch)
      await batch.commit()
    },
    async importContacts(drafts) {
      const created: Guest[] = []
      const timestamp = new Date().toISOString()
      for (const draft of drafts) {
        const normalized = normalizeDraft(draft)
        created.push({ id: crypto.randomUUID(), ...normalized, createdAt: timestamp, updatedAt: timestamp })
      }
      if (created.length === 0) return []
      const ops: Array<(batch: WriteBatch) => void> = created.map((guest) => (batch) => batch.set(doc(guests, guest.id), guestToDoc(guest)))
      const activity = importActivity(created)
      ops.push((batch) => recordActivity(logger, [activity], batch))
      await commitOps(db, ops)
      return created
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
    subSide: guest.subSide,
    category: guest.category,
    categoryId: guest.categoryId,
    role: guest.role,
    group: guest.group,
    partySize: guest.partySize,
    childCount: guest.childCount,
    drinkerCount: guest.drinkerCount,
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
    weddingDate: typeof data.weddingDate === 'string' ? data.weddingDate : '',
    venueQuestions: readVenueQuestions(data.venueQuestions),
    guestCategories: readGuestCategories(data.guestCategories),
    familyPlaces: readFamilyPlaces(data.familyPlaces),
    palette: readPalette(data.palette),
    createdAt: typeof data.createdAt === 'string' ? data.createdAt : '',
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : '',
  }
}

