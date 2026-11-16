import { useMemo } from 'react'
import { createLocalGuestRepository } from '../data/guestRepository.ts'
import { browserStorage } from '../data/storage.ts'
import { AppShell } from '../layout/AppShell.tsx'
import { AppServicesProvider, type AppServices } from './context.tsx'

export function LocalApp() {
  const guests = useMemo(() => createLocalGuestRepository(browserStorage()), [])
  const value = useMemo<AppServices>(
    () => ({
      mode: 'local',
      guests,
      user: null,
      wedding: null,
      weddings: [],
      onSignOut: null,
      onSelectWedding: null,
      onRenameWedding: null,
      onAddMember: null,
      onSetMemberRole: null,
      onRemoveMember: null,
    }),
    [guests],
  )

  return (
    <AppServicesProvider value={value}>
      <AppShell />
    </AppServicesProvider>
  )
}
