import type { ReactNode } from 'react'
import { AppContext } from './appContext.ts'
import type { ActivityCommentRepository } from '../data/activityCommentRepository.ts'
import type { ActivityRepository } from '../data/activityLog.ts'
import type { GuestRepository } from '../data/guestRepository.ts'
import type { SongRepository } from '../data/songRepository.ts'
import type { VenueRepository } from '../data/venueRepository.ts'
import type { ExpenseRepository } from '../data/expenseRepository.ts'
import type { Wedding } from '../domain/members.ts'
import type { WeddingRoleId } from '../domain/roles.ts'
import type { FamilyPlace } from '../domain/geo.ts'
import type { PaletteChoice } from '../domain/palette.ts'
import type { GuestCategory } from '../domain/guestCategories.ts'
import type { VenueQuestion } from '../domain/venueQuestions.ts'

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
  expenses: ExpenseRepository
  activity: ActivityRepository
  activityComments: ActivityCommentRepository
  user: SessionUser | null
  wedding: Wedding | null
  weddings: readonly Wedding[]
  weddingDate: string
  venueQuestions: VenueQuestion[]
  guestCategories: GuestCategory[]
  familyPlaces: FamilyPlace[]
  palette: PaletteChoice | null
  onSetWeddingDate: ((date: string) => Promise<void>) | null
  onSetPalette: ((palette: PaletteChoice | null) => Promise<void>) | null
  onSetVenueQuestions: ((questions: VenueQuestion[]) => Promise<void>) | null
  onSetGuestCategories: ((categories: GuestCategory[]) => Promise<void>) | null
  onSetFamilyPlaces: ((places: FamilyPlace[]) => Promise<void>) | null
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
