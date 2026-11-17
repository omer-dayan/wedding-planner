import { useMemo, useState } from 'react'
import { createLocalActivityRepository } from '../data/activityRepository.ts'
import { createLocalGuestRepository, GUEST_STORAGE_KEY } from '../data/guestRepository.ts'
import { createLocalSongRepository, SONG_STORAGE_KEY } from '../data/songRepository.ts'
import { createLocalVenueRepository, VENUE_STORAGE_KEY } from '../data/venueRepository.ts'
import { browserStorage } from '../data/storage.ts'
import type { ActivityActor } from '../domain/activity.ts'
import { normalizeWeddingDate } from '../domain/members.ts'
import { AppShell } from '../layout/AppShell.tsx'
import { AppServicesProvider, type AppServices } from './context.tsx'

const DATE_KEY = 'wedding-planner.weddingDate'

const localActor: ActivityActor = { email: '', name: 'מכשיר זה', role: 'groom', photoUrl: '' }

export function LocalApp() {
  const storage = useMemo(() => browserStorage(), [])
  const activity = useMemo(() => createLocalActivityRepository(storage, () => localActor), [storage])
  const guests = useMemo(() => createLocalGuestRepository(storage, GUEST_STORAGE_KEY, activity), [storage, activity])
  const songs = useMemo(() => createLocalSongRepository(storage, SONG_STORAGE_KEY, activity), [storage, activity])
  const venues = useMemo(() => createLocalVenueRepository(storage, VENUE_STORAGE_KEY, activity), [storage, activity])
  const [weddingDate, setWeddingDate] = useState(() => storage.getItem(DATE_KEY) ?? '')
  const value = useMemo<AppServices>(
    () => ({
      mode: 'local',
      guests,
      songs,
      venues,
      activity,
      user: null,
      wedding: null,
      weddings: [],
      weddingDate,
      onSetWeddingDate: async (date) => {
        const next = normalizeWeddingDate(date)
        storage.setItem(DATE_KEY, next)
        setWeddingDate(next)
      },
      onSignOut: null,
      onSelectWedding: null,
      onRenameWedding: null,
      onAddMember: null,
      onSetMemberRole: null,
      onRemoveMember: null,
    }),
    [activity, guests, songs, venues, storage, weddingDate],
  )

  return (
    <AppServicesProvider value={value}>
      <AppShell />
    </AppServicesProvider>
  )
}
