import { useEffect, useRef } from 'react'
import * as L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { FamilyPlace } from '../../domain/geo.ts'
import { distanceKm, formatDistance } from '../../domain/geo.ts'
import { venueStatusLabel, type Venue } from '../../domain/venues.ts'

const STATUS_COLOR: Record<Venue['status'], string> = {
  want: '#3e6b54',
  scheduled: '#b08968',
  visited: '#5d6e7e',
  chosen: '#1d6b43',
  rejected: '#8d877e',
}

export function VenueMap({
  venues,
  places,
  manage,
  onMove,
}: {
  venues: readonly Venue[]
  places: readonly FamilyPlace[]
  manage: boolean
  onMove: (venue: Venue, lat: number, lng: number) => void
}) {
  const node = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)

  useEffect(() => {
    const element = node.current
    if (!element || mapRef.current) return
    const map = L.map(element, { scrollWheelZoom: false }).setView([31.7, 34.9], 8)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 18,
    }).addTo(map)
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const layer = L.layerGroup().addTo(map)
    const bounds: L.LatLngExpression[] = []
    for (const place of places) {
      bounds.push([place.lat, place.lng])
      L.marker([place.lat, place.lng], {
        icon: L.divIcon({
          className: 'gravity-pin',
          html: `<span>${escapeHtml(place.name)}</span>`,
          iconSize: [128, 32],
          iconAnchor: [64, 32],
        }),
        interactive: false,
        keyboard: false,
      }).addTo(layer)
    }
    for (const venue of venues) {
      if (venue.lat == null || venue.lng == null) continue
      const point = { lat: venue.lat, lng: venue.lng }
      bounds.push([point.lat, point.lng])
      const distances = places.map((place) => `${escapeHtml(place.name)} ${formatDistance(distanceKm(point, place))}`).join('<br>')
      const marker = L.marker([point.lat, point.lng], {
        draggable: manage,
        icon: L.divIcon({
          className: 'venue-pin',
          html: `<span style="background:${STATUS_COLOR[venue.status]}"></span>`,
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        }),
      })
      marker.bindPopup(`<strong>${escapeHtml(venue.name)}</strong><br>${escapeHtml(venueStatusLabel(venue.status))}${distances ? `<br>${distances}` : ''}`)
      marker.on('dragend', () => {
        const next = marker.getLatLng()
        onMove(venue, next.lat, next.lng)
      })
      marker.addTo(layer)
    }
    if (bounds.length > 0) map.fitBounds(L.latLngBounds(bounds), { padding: [36, 36], maxZoom: 11 })
    map.invalidateSize()
    return () => { layer.remove() }
  }, [venues, places, manage, onMove])

  return <div ref={node} className="venue-map" />
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char)
}
