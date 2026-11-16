import type { ComponentType } from 'react'
import type { SectionId } from './ids.ts'
import { GuestListPage } from './guests/GuestListPage.tsx'
import { SettingsPage } from './settings/SettingsPage.tsx'

export interface AppSection {
  id: SectionId
  label: string
  Component: ComponentType
}

export const sections: readonly AppSection[] = [
  { id: 'guests', label: 'מוזמנים', Component: GuestListPage },
  { id: 'settings', label: 'הגדרות', Component: SettingsPage },
]
