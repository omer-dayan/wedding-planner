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
  getFirestore,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Firestore,
} from 'firebase/firestore'
import { type FirebaseWebConfig } from './firebaseConfig.ts'
import { isCommittedServerSnapshot } from './firestoreListeners.ts'
import type { GuestRepository } from './guestRepository.ts'
import type { SongRepository } from './songRepository.ts'
import { createRecordRepository, firestoreStore } from './records.ts'
import { guestSpec } from './guestRepository.ts'
import { songSpec } from './songRepository.ts'
import { venueSpec } from './venueRepository.ts'
import { expenseSpec } from './expenseRepository.ts'
import { parseStoredSong } from '../domain/songs.ts'
import { parseStoredVenue } from '../domain/venues.ts'
import { parseStoredExpense } from '../domain/expenses.ts'
import type { ExpenseRepository } from './expenseRepository.ts'
import type { VenueRepository } from './venueRepository.ts'
import { createFirestoreActivityRepository } from './firestoreActivity.ts'
import { createFirestoreActivityCommentRepository } from './firestoreActivityComments.ts'
import type { ActivityCommentRepository } from './activityCommentRepository.ts'
import type { ActivityLogger, ActivityRepository } from './activityLog.ts'
import { recordActivity } from './activityLog.ts'
import { venueQuestionsInput, type ActivityActor, type ActivityInput } from '../domain/activity.ts'
import type { VenueQuestion } from '../domain/venueQuestions.ts'
import { normalizeSetting, readSettings, type SettingKey, type SettingValue } from '../domain/settings.ts'
import { emailVariants, normalizeWeddingName, type Wedding } from '../domain/members.ts'
import { cleanMemberRoles, type WeddingRoleId } from '../domain/roles.ts'
import { parseStoredGuest } from '../domain/validation.ts'

export interface WeddingRepository {
  subscribe(listener: (weddings: Wedding[]) => void, onError?: (error: unknown) => void): () => void
  create(ownerEmail: string, name?: string): Promise<Wedding>
  updateName(id: string, name: string): Promise<void>
  updateSetting<K extends SettingKey>(id: string, key: K, value: SettingValue<K>, logger?: ActivityLogger): Promise<void>
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
    createGuestRepository: (weddingId, logger) => createRecordRepository(firestoreStore(db, `weddings/${weddingId}/guests`, parseStoredGuest, logger), guestSpec),
    createSongRepository: (weddingId, logger) => createRecordRepository(firestoreStore(db, `weddings/${weddingId}/songs`, parseStoredSong, logger), songSpec),
    createVenueRepository: (weddingId, logger) => createRecordRepository(firestoreStore(db, `weddings/${weddingId}/venues`, parseStoredVenue, logger), venueSpec),
    createExpenseRepository: (weddingId, logger) => createRecordRepository(firestoreStore(db, `weddings/${weddingId}/expenses`, parseStoredExpense, logger), expenseSpec),
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
        ...readSettings(() => undefined),
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
    async updateSetting(id, key, value, logger) {
      const normalized = normalizeSetting(key, value)
      const batch = writeBatch(db)
      batch.update(doc(weddings, id), { [key]: normalized, updatedAt: new Date().toISOString() })
      if (key === 'venueQuestions') recordActivity(logger, [venueQuestionsInput(normalized as VenueQuestion[])], batch)
      await batch.commit()
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
    ...readSettings((key) => data[key]),
    createdAt: typeof data.createdAt === 'string' ? data.createdAt : '',
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : '',
  }
}

