export interface GeoPoint {
  lat: number
  lng: number
}

export interface FamilyPlace extends GeoPoint {
  id: string
  name: string
}

export function distanceKm(from: GeoPoint, to: GeoPoint): number {
  const earth = 6371
  const lat = toRadians(to.lat - from.lat)
  const lng = toRadians(to.lng - from.lng)
  const a = Math.sin(lat / 2) ** 2
    + Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(lng / 2) ** 2
  return earth * 2 * Math.asin(Math.sqrt(a))
}

export function formatDistance(km: number): string {
  const rounded = km < 10 ? Math.round(km * 10) / 10 : Math.round(km)
  return `${rounded.toLocaleString('he-IL')} ק״מ`
}

export function isGeoPoint(lat: unknown, lng: unknown): lat is number {
  return typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng)
    && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
}

export function normalizeFamilyPlaces(places: readonly FamilyPlace[]): FamilyPlace[] {
  const next: FamilyPlace[] = []
  const seen = new Set<string>()
  for (const place of places) {
    const name = place.name.trim().replace(/\s+/g, ' ')
    const id = place.id.trim()
    if (!name || name.length > 80 || !/^[A-Za-z0-9_-]+$/.test(id) || seen.has(id) || !isGeoPoint(place.lat, place.lng)) continue
    seen.add(id)
    next.push({ id, name, lat: place.lat, lng: place.lng })
    if (next.length >= 12) break
  }
  return next
}

export function readFamilyPlaces(value: unknown): FamilyPlace[] {
  if (!Array.isArray(value)) return []
  const places: FamilyPlace[] = []
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue
    const record = entry as Record<string, unknown>
    places.push({
      id: typeof record.id === 'string' ? record.id : '',
      name: typeof record.name === 'string' ? record.name : '',
      lat: typeof record.lat === 'number' ? record.lat : Number.NaN,
      lng: typeof record.lng === 'number' ? record.lng : Number.NaN,
    })
  }
  return normalizeFamilyPlaces(places)
}

function toRadians(degrees: number): number {
  return degrees * Math.PI / 180
}
