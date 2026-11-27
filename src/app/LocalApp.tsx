import { useMemo, useState } from 'react'
import { createLocalActivityCommentRepository } from '../data/activityCommentRepository.ts'
import { createLocalActivityRepository } from '../data/activityRepository.ts'
import { createLocalGuestRepository } from '../data/guestRepository.ts'
import { createLocalSongRepository } from '../data/songRepository.ts'
import { createLocalVenueRepository } from '../data/venueRepository.ts'
import { createLocalExpenseRepository } from '../data/expenseRepository.ts'
import { browserStorage } from '../data/storage.ts'
import { venueQuestionsInput, type ActivityActor } from '../domain/activity.ts'
import { normalizeSetting, readSettings, settingSetters, type SaveSetting, type SettingKey } from '../domain/settings.ts'
import type { VenueQuestion } from '../domain/venueQuestions.ts'
import { AppShell } from '../layout/AppShell.tsx'
import { AppServicesProvider, type AppServices } from './context.tsx'

const settingKey = (key: SettingKey) => `wedding-planner.${key}`
const localActor: ActivityActor = { email: '', name: 'מכשיר זה', role: 'groom', photoUrl: '' }

export function LocalApp() {
  const storage = useMemo(() => browserStorage(), [])
  const activity = useMemo(() => createLocalActivityRepository(storage, () => localActor), [storage])
  const activityComments = useMemo(() => createLocalActivityCommentRepository(storage, () => localActor), [storage])
  const guests = useMemo(() => createLocalGuestRepository(storage, undefined, activity), [storage, activity])
  const songs = useMemo(() => createLocalSongRepository(storage, undefined, activity), [storage, activity])
  const venues = useMemo(() => createLocalVenueRepository(storage, undefined, activity), [storage, activity])
  const expenses = useMemo(() => createLocalExpenseRepository(storage, undefined, activity), [storage, activity])
  // The wedding date was stored as a plain string; the other settings are JSON.
  const [settings, setSettings] = useState(() => readSettings((key) => {
    const raw = storage.getItem(settingKey(key))
    if (key === 'weddingDate') return raw
    try {
      return JSON.parse(raw ?? 'null')
    } catch {
      return null
    }
  }))
  const value = useMemo<AppServices>(() => {
    const save: SaveSetting = async (key, input) => {
      const next = normalizeSetting(key, input)
      if (next === null) storage.removeItem(settingKey(key))
      else storage.setItem(settingKey(key), typeof next === 'string' ? next : JSON.stringify(next))
      setSettings((current) => ({ ...current, [key]: next }))
      if (key === 'venueQuestions') activity.append(venueQuestionsInput(next as VenueQuestion[]))
    }
    return {
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
      ...settings,
      ...settingSetters(save),
      onSignOut: null,
      onSelectWedding: null,
      onRenameWedding: null,
      onAddMember: null,
      onSetMemberRole: null,
      onRemoveMember: null,
    }
  }, [activity, activityComments, guests, songs, venues, expenses, storage, settings])

  return (
    <AppServicesProvider value={value}>
      <AppShell />
    </AppServicesProvider>
  )
}
