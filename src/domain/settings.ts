import { normalizeBlockedDates, readBlockedDates } from './blockedDates.ts'
import { normalizeFamilyPlaces, readFamilyPlaces } from './geo.ts'
import { normalizeGuestCategories, readGuestCategories } from './guestCategories.ts'
import { normalizeWeddingDate } from './members.ts'
import { readPalette } from './palette.ts'
import { normalizeVenueQuestions, readVenueQuestions } from './venueQuestions.ts'

/** Wedding-wide settings the couple edits. `read` accepts anything stored; `normalize` validates a new value. */
export const SETTINGS = {
  weddingDate: { read: (value: unknown) => (typeof value === 'string' ? value : ''), normalize: normalizeWeddingDate },
  venueQuestions: { read: readVenueQuestions, normalize: normalizeVenueQuestions },
  guestCategories: { read: readGuestCategories, normalize: normalizeGuestCategories },
  familyPlaces: { read: readFamilyPlaces, normalize: normalizeFamilyPlaces },
  blockedDates: { read: readBlockedDates, normalize: normalizeBlockedDates },
  palette: { read: readPalette, normalize: readPalette },
}

export type SettingKey = keyof typeof SETTINGS
export type WeddingSettings = { [K in SettingKey]: ReturnType<(typeof SETTINGS)[K]['read']> }
export type SettingValue<K extends SettingKey> = Parameters<(typeof SETTINGS)[K]['normalize']>[0]

export const SETTING_KEYS = Object.keys(SETTINGS) as SettingKey[]

export function normalizeSetting<K extends SettingKey>(key: K, value: SettingValue<K>): WeddingSettings[K] {
  return (SETTINGS[key].normalize as (value: SettingValue<K>) => WeddingSettings[K])(value)
}

export function readSettings(source: (key: SettingKey) => unknown): WeddingSettings {
  return Object.fromEntries(SETTING_KEYS.map((key) => [key, SETTINGS[key].read(source(key) as never)])) as WeddingSettings
}

export type SaveSetting = <K extends SettingKey>(key: K, value: SettingValue<K>) => Promise<void>

/** The page-facing setters, all routed through one save function (null when the viewer cannot edit). */
export function settingSetters(save: SaveSetting | null) {
  const setter = <K extends SettingKey>(key: K) => (save ? (value: SettingValue<K>) => save(key, value) : null)
  return {
    onSetWeddingDate: setter('weddingDate'),
    onSetVenueQuestions: setter('venueQuestions'),
    onSetGuestCategories: setter('guestCategories'),
    onSetFamilyPlaces: setter('familyPlaces'),
    onSetBlockedDates: setter('blockedDates'),
    onSetPalette: setter('palette'),
  }
}
