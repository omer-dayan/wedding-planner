import type { ReactNode } from 'react'
import { AppContext } from './appContext.ts'
import type { ActivityRepository } from '../data/activityLog.ts'
import type { GuestRepository } from '../data/guestRepository.ts'
import type { SongRepository } from '../data/songRepository.ts'
import type { VenueRepository } from '../data/venueRepository.ts'
import type { Wedding } from '../domain/members.ts'
import type { WeddingRoleId } from '../domain/roles.ts'

export interface SessionUser {
  email: string
  displayName: string
  photoUrl: string
}

export interface AppServices {
  mode: 'local' | 'cloud'
  guests: GuestRepository
  songs: SongRepository
  venues: VenueRepository
  activity: ActivityRepository
  user: SessionUser | null
  wedding: Wedding | null
  weddings: readonly Wedding[]
  weddingDate: string
  onSetWeddingDate: ((date: string) => Promise<void>) | null
  onSignOut: (() => Promise<void>) | null
  onSelectWedding: ((id: string) => void) | null
  onRenameWedding: ((name: string) => Promise<void>) | null
  onAddMember: ((email: string, role: WeddingRoleId) => Promise<void>) | null
  onSetMemberRole: ((email: string, role: WeddingRoleId) => Promise<void>) | null
  onRemoveMember: ((email: string) => Promise<void>) | null
}

export function AppServicesProvider({ value, children }: { value: AppServices; children: ReactNode }) {
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
