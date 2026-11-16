import { useMemo } from 'react'
import { createLocalGuestRepository } from '../data/guestRepository.ts'
import { createLocalSongRepository } from '../data/songRepository.ts'
import { createLocalVenueRepository } from '../data/venueRepository.ts'
import { browserStorage } from '../data/storage.ts'
import { AppShell } from '../layout/AppShell.tsx'
import { AppServicesProvider, type AppServices } from './context.tsx'

export function LocalApp() {
  const guests = useMemo(() => createLocalGuestRepository(browserStorage()), [])
  const songs = useMemo(() => createLocalSongRepository(browserStorage()), [])
  const venues = useMemo(() => createLocalVenueRepository(browserStorage()), [])
  const value = useMemo<AppServices>(
    () => ({
      mode: 'local',
      guests,
      songs,
      venues,
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
    [guests, songs, venues],
  )

  return (
    <AppServicesProvider value={value}>
      <AppShell />
    </AppServicesProvider>
  )
}
