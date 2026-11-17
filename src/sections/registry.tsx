import type { ComponentType } from 'react'
import type { SectionId } from './ids.ts'
import { HomePage } from './home/HomePage.tsx'
import { GuestListPage } from './guests/GuestListPage.tsx'
import { MusicPage } from './music/MusicPage.tsx'
import { VenuesPage } from './venues/VenuesPage.tsx'
import { SettingsPage } from './settings/SettingsPage.tsx'

export interface AppSection {
  id: SectionId
  label: string
  Component: ComponentType
}

export const sections: readonly AppSection[] = [
  { id: 'home', label: 'בית', Component: HomePage },
  { id: 'guests', label: 'מוזמנים', Component: GuestListPage },
  { id: 'music', label: 'מוזיקה', Component: MusicPage },
  { id: 'venues', label: 'אולמות', Component: VenuesPage },
  { id: 'settings', label: 'הגדרות', Component: SettingsPage },
]
