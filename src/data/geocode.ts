export interface GeocodedPlace {
  name: string
  lat: number
  lng: number
}

const KNOWN: Record<string, GeocodedPlace> = {
  'קרית גת': { name: 'קרית גת', lat: 31.60998, lng: 34.76422 },
  'קריית גת': { name: 'קרית גת', lat: 31.60998, lng: 34.76422 },
  'ראש העין': { name: 'ראש העין', lat: 32.0956, lng: 34.9566 },
  'ראשון לציון': { name: 'ראשון לציון', lat: 31.973, lng: 34.7925 },
  'תל אביב': { name: 'תל אביב', lat: 32.0853, lng: 34.7818 },
  'ירושלים': { name: 'ירושלים', lat: 31.7683, lng: 35.2137 },
  'חיפה': { name: 'חיפה', lat: 32.794, lng: 34.9896 },
  'באר שבע': { name: 'באר שבע', lat: 31.2518, lng: 34.7913 },
  'אשדוד': { name: 'אשדוד', lat: 31.8044, lng: 34.6553 },
  'אשקלון': { name: 'אשקלון', lat: 31.6688, lng: 34.5743 },
  'נתניה': { name: 'נתניה', lat: 32.3215, lng: 34.8532 },
  'פתח תקווה': { name: 'פתח תקווה', lat: 32.084, lng: 34.8878 },
  'רחובות': { name: 'רחובות', lat: 31.8928, lng: 34.8113 },
  'מודיעין': { name: 'מודיעין', lat: 31.898, lng: 35.0104 },
}

interface PhotonFeature {
  geometry?: { coordinates?: [number, number] }
  properties?: { name?: string; countrycode?: string; osm_key?: string; city?: string }
}

export async function geocodeInIsrael(query: string): Promise<GeocodedPlace | null> {
  const trimmed = query.trim().replace(/\s+/g, ' ')
  if (!trimmed) return null
  const exact = KNOWN[trimmed]
  if (exact) return exact
  try {
    const url = new URL('https://photon.komoot.io/api/')
    url.searchParams.set('q', trimmed)
    url.searchParams.set('limit', '5')
    const response = await fetch(url)
    if (response.ok) {
      const body = await response.json() as { features?: PhotonFeature[] }
      const best = (body.features ?? [])
        .map((feature) => ({ feature, score: scoreFeature(feature, trimmed) }))
        .filter((item) => item.score >= 0)
        .sort((left, right) => right.score - left.score)[0]?.feature
      const point = best ? pointFrom(best) : null
      if (point) return point
    }
  } catch {
    // A known city inside the query is enough when the geocoder is unreachable.
  }
  return knownInside(trimmed)
}

function scoreFeature(feature: PhotonFeature, query: string): number {
  const props = feature.properties ?? {}
  if (props.countrycode !== 'IL') return -1
  const coordinates = feature.geometry?.coordinates
  if (!coordinates || coordinates.length < 2) return -1
  let score = 0
  if (props.osm_key === 'amenity' || props.osm_key === 'tourism' || props.osm_key === 'leisure') score += 5
  else if (props.osm_key === 'building') score += 4
  else if (props.osm_key === 'place') score += 3
  if (props.name && query.includes(props.name)) score += 2
  if (props.city && query.includes(props.city)) score += 1
  return score
}

function pointFrom(feature: PhotonFeature): GeocodedPlace | null {
  const coordinates = feature.geometry?.coordinates
  if (!coordinates) return null
  const [lng, lat] = coordinates
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return { name: feature.properties?.name || '', lat, lng }
}

function knownInside(query: string): GeocodedPlace | null {
  const names = Object.keys(KNOWN).filter((name) => query.includes(name)).sort((left, right) => right.length - left.length)
  return names[0] ? KNOWN[names[0]] : null
}
