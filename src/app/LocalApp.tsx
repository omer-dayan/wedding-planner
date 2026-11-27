import { useMemo, useState } from 'react'
import { createLocalActivityCommentRepository } from '../data/activityCommentRepository.ts'
import { createLocalActivityRepository } from '../data/activityRepository.ts'
import { createLocalGuestRepository, GUEST_STORAGE_KEY } from '../data/guestRepository.ts'
import { createLocalSongRepository, SONG_STORAGE_KEY } from '../data/songRepository.ts'
import { createLocalVenueRepository, VENUE_STORAGE_KEY } from '../data/venueRepository.ts'
import { createLocalExpenseRepository, EXPENSE_STORAGE_KEY } from '../data/expenseRepository.ts'
import { browserStorage } from '../data/storage.ts'
import type { ActivityActor } from '../domain/activity.ts'
import { normalizeWeddingDate } from '../domain/members.ts'
import { normalizeBlockedDates, readBlockedDates, type BlockedDate } from '../domain/blockedDates.ts'
import { normalizeFamilyPlaces, readFamilyPlaces, type FamilyPlace } from '../domain/geo.ts'
import { readPalette, type PaletteChoice } from '../domain/palette.ts'
import { normalizeGuestCategories, readGuestCategories, type GuestCategory } from '../domain/guestCategories.ts'
import { normalizeVenueQuestions, readVenueQuestions, type VenueQuestion } from '../domain/venueQuestions.ts'
import { venueQuestionsInput } from '../domain/activity.ts'
import { AppShell } from '../layout/AppShell.tsx'
import { AppServicesProvider, type AppServices } from './context.tsx'

const DATE_KEY = 'wedding-planner.weddingDate'
const QUESTIONS_KEY = 'wedding-planner.venueQuestions'
const CATEGORIES_KEY = 'wedding-planner.guestCategories'
const PLACES_KEY = 'wedding-planner.familyPlaces'
const BLOCKED_KEY = 'wedding-planner.blockedDates'
const PALETTE_KEY = 'wedding-planner.palette'

const localActor: ActivityActor = { email: '', name: 'מכשיר זה', role: 'groom', photoUrl: '' }

export function LocalApp() {
  const storage = useMemo(() => browserStorage(), [])
  const activity = useMemo(() => createLocalActivityRepository(storage, () => localActor), [storage])
  const activityComments = useMemo(() => createLocalActivityCommentRepository(storage, () => localActor), [storage])
  const guests = useMemo(() => createLocalGuestRepository(storage, GUEST_STORAGE_KEY, activity), [storage, activity])
  const songs = useMemo(() => createLocalSongRepository(storage, SONG_STORAGE_KEY, activity), [storage, activity])
  const venues = useMemo(() => createLocalVenueRepository(storage, VENUE_STORAGE_KEY, activity), [storage, activity])
  const expenses = useMemo(() => createLocalExpenseRepository(storage, EXPENSE_STORAGE_KEY, activity), [storage, activity])
  const [weddingDate, setWeddingDate] = useState(() => storage.getItem(DATE_KEY) ?? '')
  const [venueQuestions, setVenueQuestions] = useState<VenueQuestion[]>(() => {
    try {
      return readVenueQuestions(JSON.parse(storage.getItem(QUESTIONS_KEY) || '[]'))
    } catch {
      return []
    }
  })
  const [guestCategories, setGuestCategories] = useState<GuestCategory[]>(() => {
    try {
      return readGuestCategories(JSON.parse(storage.getItem(CATEGORIES_KEY) || '[]'))
    } catch {
      return []
    }
  })
  const [palette, setPalette] = useState<PaletteChoice | null>(() => {
    try {
      return readPalette(JSON.parse(storage.getItem(PALETTE_KEY) || 'null'))
    } catch {
      return null
    }
  })
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>(() => {
    try {
      return readBlockedDates(JSON.parse(storage.getItem(BLOCKED_KEY) || '[]'))
    } catch {
      return []
    }
  })
  const [familyPlaces, setFamilyPlaces] = useState<FamilyPlace[]>(() => {
    try {
      return readFamilyPlaces(JSON.parse(storage.getItem(PLACES_KEY) || '[]'))
    } catch {
      return []
    }
  })
  const value = useMemo<AppServices>(
    () => ({
      mode: 'local',
      guests,
      songs,
      venues,
      expenses,
      activity,
      activityComments,
      user: null,
      wedding: null,
      weddings: [],
      weddingDate,
      venueQuestions,
      guestCategories,
      familyPlaces,
      blockedDates,
      palette,
      onSetWeddingDate: async (date) => {
        const next = normalizeWeddingDate(date)
        storage.setItem(DATE_KEY, next)
        setWeddingDate(next)
      },
      onSetVenueQuestions: async (questions) => {
        const next = normalizeVenueQuestions(questions)
        storage.setItem(QUESTIONS_KEY, JSON.stringify(next))
        setVenueQuestions(next)
        activity.append(venueQuestionsInput(next))
      },
      onSetGuestCategories: async (categories) => {
        const next = normalizeGuestCategories(categories)
        storage.setItem(CATEGORIES_KEY, JSON.stringify(next))
        setGuestCategories(next)
      },
      onSetBlockedDates: async (dates) => {
        const next = normalizeBlockedDates(dates)
        storage.setItem(BLOCKED_KEY, JSON.stringify(next))
        setBlockedDates(next)
      },
      onSetFamilyPlaces: async (places) => {
        const next = normalizeFamilyPlaces(places)
        storage.setItem(PLACES_KEY, JSON.stringify(next))
        setFamilyPlaces(next)
      },
      onSetPalette: async (next) => {
        const palette = readPalette(next)
        if (palette) storage.setItem(PALETTE_KEY, JSON.stringify(palette))
        else storage.removeItem(PALETTE_KEY)
        setPalette(palette)
      },
      onSignOut: null,
      onSelectWedding: null,
      onRenameWedding: null,
      onAddMember: null,
      onSetMemberRole: null,
      onRemoveMember: null,
    }),
    [activity, activityComments, guests, songs, venues, expenses, storage, weddingDate, venueQuestions, guestCategories, familyPlaces, blockedDates, palette],
  )

  return (
    <AppServicesProvider value={value}>
      <AppShell />
    </AppServicesProvider>
  )
}
