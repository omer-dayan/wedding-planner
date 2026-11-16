import type { ReactNode } from 'react'
import { AppContext } from './appContext.ts'
import type { GuestRepository } from '../data/guestRepository.ts'
import type { Wedding } from '../domain/members.ts'

export interface SessionUser {
  email: string
  displayName: string
}

export interface AppServices {
  mode: 'local' | 'cloud'
  guests: GuestRepository
  user: SessionUser | null
  wedding: Wedding | null
  weddings: readonly Wedding[]
  onSignOut: (() => Promise<void>) | null
  onSelectWedding: ((id: string) => void) | null
  onRenameWedding: ((name: string) => Promise<void>) | null
  onAddMember: ((email: string) => Promise<void>) | null
  onRemoveMember: ((email: string) => Promise<void>) | null
}

export function AppServicesProvider({ value, children }: { value: AppServices; children: ReactNode }) {
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
