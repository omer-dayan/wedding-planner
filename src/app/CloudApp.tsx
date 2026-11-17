import { useEffect, useMemo, useRef, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import {
  completeRedirectSignIn,
  createFirebaseServices,
  signInWithGoogle,
  signOutUser,
  type FirebaseServices,
  type WeddingRepository,
} from '../data/firebaseBackend.ts'
import type { FirebaseWebConfig } from '../data/firebaseConfig.ts'
import { memberAddedInput, roleChangedInput, type ActivityActor } from '../domain/activity.ts'
import { addMemberEmail, chooseWedding, removeMemberEmail, type Wedding } from '../domain/members.ts'
import { assignedRole, cleanMemberRoles, isCoupleOrOwner } from '../domain/roles.ts'
import type { WeddingRoleId } from '../domain/roles.ts'
import { SignInScreen } from '../auth/SignInScreen.tsx'
import { AppShell } from '../layout/AppShell.tsx'
import { firebaseCode, mapFirebaseCode, messageFrom } from '../ui/messageFrom.ts'
import { Rings } from '../ui/Rings.tsx'
import { Splash } from '../ui/Splash.tsx'
import { AppServicesProvider, type AppServices, type SessionUser } from './context.tsx'

const ACTIVE_WEDDING_KEY = 'wedding-planner.activeWeddingId'
const creates = new Map<string, Promise<void>>()

function ensureOnce(email: string, create: () => Promise<unknown>): Promise<void> {
  const existing = creates.get(email)
  if (existing) return existing
  const promise = create()
    .then(() => undefined)
    .catch((error: unknown) => {
      creates.delete(email)
      throw error
    })
  creates.set(email, promise)
  return promise
}

function readPreferred(): string | null {
  try {
    return localStorage.getItem(ACTIVE_WEDDING_KEY)
  } catch {
    return null
  }
}

export function CloudApp({ config }: { config: FirebaseWebConfig }) {
  const services = useMemo(() => createFirebaseServices(config), [config])
  const [user, setUser] = useState<SessionUser | null>(null)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [errorCode, setErrorCode] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void completeRedirectSignIn(services.auth).catch((error: unknown) => {
      if (!active) return
      const code = mapFirebaseCode(firebaseCode(error))
      if (code !== 'popup-closed') setErrorCode(code)
    })
    const unsubscribe = onAuthStateChanged(
      services.auth,
      (next) => {
        if (!active) return
        setUser(next?.email ? { email: next.email, displayName: next.displayName || next.email, photoUrl: next.photoURL || '' } : null)
        if (next && !next.email) setErrorCode('missing-email')
        setReady(true)
      },
      () => {
        if (!active) return
        setReady(true)
        setErrorCode('auth-failed')
      },
    )
    return () => {
      active = false
      unsubscribe()
    }
  }, [services.auth])

  async function onGoogle() {
    setBusy(true)
    setErrorCode(null)
    try {
      await signInWithGoogle(services.auth)
    } catch (error) {
      const code = mapFirebaseCode(firebaseCode(error))
      if (code !== 'popup-closed') setErrorCode(code)
    } finally {
      setBusy(false)
    }
  }

  if (!ready) return <Splash label="טוען…" />
  if (!user) return <SignInScreen busy={busy} errorCode={errorCode} onGoogle={onGoogle} />
  return <WeddingGate services={services} user={user} />
}

function WeddingGate({ services, user }: { services: FirebaseServices; user: SessionUser }) {
  const weddingsRepo = useMemo(() => services.createWeddingRepository(user.email), [services, user.email])
  const [weddings, setWeddings] = useState<Wedding[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [preferredId, setPreferredId] = useState<string | null>(readPreferred)

  useEffect(() => {
    return weddingsRepo.subscribe(
      (next) => {
        setWeddings(next)
        setError(null)
      },
      (failure) => setError(messageFrom(failure)),
    )
  }, [weddingsRepo])

  useEffect(() => {
    if (!weddings || weddings.length > 0) return
    let cancelled = false
    ensureOnce(user.email, () => weddingsRepo.create(user.email)).catch((failure: unknown) => {
      if (!cancelled) setError(messageFrom(failure))
    })
    return () => {
      cancelled = true
    }
  }, [weddings, user.email, weddingsRepo])

  if (error) {
    return (
      <div className="sign-in">
        <div className="sign-in-card">
          <Rings />
          <p className="form-error" role="alert">{error}</p>
          <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
            נסו שוב
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => void signOutUser(services.auth)}>
            התנתקות
          </button>
        </div>
      </div>
    )
  }

  if (!weddings || weddings.length === 0) {
    return <Splash label={weddings ? 'מכינים את החתונה…' : 'טוען את החתונה…'} />
  }

  const active = chooseWedding(weddings, preferredId, user.email)
  if (!active) return <Splash label="טוען את החתונה…" />

  return (
    <WeddingSession
      services={services}
      user={user}
      wedding={active}
      weddings={weddings}
      weddingsRepo={weddingsRepo}
      onSelectWedding={(id) => {
        try {
          localStorage.setItem(ACTIVE_WEDDING_KEY, id)
        } catch {
          // The choice still applies for this visit.
        }
        setPreferredId(id)
      }}
    />
  )
}

function WeddingSession({
  services,
  user,
  wedding,
  weddings,
  weddingsRepo,
  onSelectWedding,
}: {
  services: FirebaseServices
  user: SessionUser
  wedding: Wedding
  weddings: readonly Wedding[]
  weddingsRepo: WeddingRepository
  onSelectWedding: (id: string) => void
}) {
  const actorRef = useRef<ActivityActor>({ email: user.email, name: user.displayName, role: assignedRole(wedding, user.email), photoUrl: user.photoUrl })
  actorRef.current = { email: user.email, name: user.displayName, role: assignedRole(wedding, user.email), photoUrl: user.photoUrl }
  const activity = useMemo(() => services.createActivityRepository(wedding.id, () => actorRef.current), [services, wedding.id])
  const guests = useMemo(() => services.createGuestRepository(wedding.id, activity), [services, wedding.id, activity])
  const songs = useMemo(() => services.createSongRepository(wedding.id, activity), [services, wedding.id, activity])
  const venues = useMemo(() => services.createVenueRepository(wedding.id, activity), [services, wedding.id, activity])
  const canEditDate = isCoupleOrOwner(wedding, user.email)
  const value: AppServices = {
    mode: 'cloud',
    guests,
    songs,
    venues,
    activity,
    user,
    wedding,
    weddings,
    weddingDate: wedding.weddingDate,
    onSetWeddingDate: canEditDate ? (date) => weddingsRepo.updateDate(wedding.id, date) : null,
    onSignOut: () => signOutUser(services.auth),
    onSelectWedding,
    onRenameWedding: (name) => weddingsRepo.updateName(wedding.id, name),
    onAddMember: async (memberEmail, role) => {
      const memberRoles = withRole(wedding, memberEmail, role)
      await weddingsRepo.updateMembers(
        wedding.id,
        addMemberEmail(wedding.memberEmails, wedding.ownerEmail, memberEmail),
        memberRoles,
        { logger: activity, inputs: [memberAddedInput(memberEmail)] },
      )
    },
    onSetMemberRole: async (memberEmail, role) => {
      await weddingsRepo.updateMembers(
        wedding.id,
        wedding.memberEmails,
        withRole(wedding, memberEmail, role),
        { logger: activity, inputs: [roleChangedInput(memberEmail, assignedRole(wedding, memberEmail), role)] },
      )
    },
    onRemoveMember: async (memberEmail) => {
      const memberRoles = { ...cleanMemberRoles(wedding.memberRoles) }
      delete memberRoles[memberEmail.trim().toLowerCase()]
      await weddingsRepo.updateMembers(
        wedding.id,
        removeMemberEmail(wedding.memberEmails, wedding.ownerEmail, memberEmail),
        memberRoles,
      )
    },
  }

  return (
    <AppServicesProvider value={value}>
      <AppShell />
    </AppServicesProvider>
  )
}

function withRole(wedding: Wedding, email: string, role: WeddingRoleId): Record<string, WeddingRoleId> {
  const roles = cleanMemberRoles(wedding.memberRoles)
  roles[email.trim().toLowerCase()] = role
  const ownerKey = wedding.ownerEmail.trim().toLowerCase()
  if (!roles[ownerKey]) roles[ownerKey] = 'groom'
  return roles
}
