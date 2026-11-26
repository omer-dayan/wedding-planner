export interface PaletteChoice {
  green: string
  pink: string
}

const HEX = /^#[0-9a-fA-F]{6}$/

export const DEFAULT_PALETTE: PaletteChoice = { green: '#3e6b54', pink: '#c4897b' }

export function readPalette(value: unknown): PaletteChoice | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  const green = typeof record.green === 'string' ? record.green.trim() : ''
  const pink = typeof record.pink === 'string' ? record.pink.trim() : ''
  if (!HEX.test(green) || !HEX.test(pink)) return null
  return { green: green.toLowerCase(), pink: pink.toLowerCase() }
}

export function derivePalette(choice: PaletteChoice): Record<string, string> {
  const green = choice.green.toLowerCase()
  const pink = choice.pink.toLowerCase()
  const ink = mix(green, '#101814', 0.78)
  return {
    '--accent': green,
    '--accent-strong': mix(green, '#000000', 0.22),
    '--accent-soft': mix(green, '#ffffff', 0.84),
    '--on-accent': luminance(green) > 0.42 ? ink : '#fbf8f2',
    '--ok': mix(green, '#000000', 0.16),
    '--ok-soft': mix(green, '#ffffff', 0.88),
    '--bg': mix(mix('#f7f4ee', green, 0.07), pink, 0.04),
    '--bg-deep': mix(green, '#ffffff', 0.8),
    '--surface': mix('#fffdf8', green, 0.04),
    '--ink': ink,
    '--muted': mix(green, '#66756c', 0.62),
    '--line': mix(mix('#efe8de', green, 0.1), pink, 0.08),
    '--blush': mix(pink, '#ffffff', 0.42),
    '--gold': mix(pink, '#000000', 0.08),
    '--gold-soft': mix(pink, '#ffffff', 0.84),
    '--no': mix(pink, '#4a1020', 0.5),
    '--no-soft': mix(pink, '#ffffff', 0.84),
    '--wait': mix(pink, '#3a2810', 0.58),
    '--wait-soft': mix(pink, '#fff6e8', 0.78),
    '--maybe': mix(pink, '#241838', 0.42),
    '--maybe-soft': mix(pink, '#f6f1fa', 0.78),
    '--shadow': `0 12px 32px ${rgba(green, 0.16)}`,
    '--wash': rgba(green, 0.28),
    '--wash-pink': rgba(pink, 0.34),
  }
}

export function applyPalette(choice: PaletteChoice | null) {
  const root = document.documentElement
  const next = choice ? derivePalette(choice) : {}
  for (const key of Object.keys(derivePalette(DEFAULT_PALETTE))) {
    if (next[key]) root.style.setProperty(key, next[key])
    else root.style.removeProperty(key)
  }
}

function rgb(hex: string) {
  const value = Number.parseInt(hex.slice(1), 16)
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 }
}

function channel(value: number) {
  return Math.round(Math.min(255, Math.max(0, value))).toString(16).padStart(2, '0')
}

function mix(from: string, to: string, amount: number) {
  const left = rgb(from)
  const right = rgb(to)
  return `#${channel(left.r + (right.r - left.r) * amount)}${channel(left.g + (right.g - left.g) * amount)}${channel(left.b + (right.b - left.b) * amount)}`
}

function rgba(hexColor: string, alpha: number) {
  const { r, g, b } = rgb(hexColor)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function luminance(hexColor: string) {
  const { r, g, b } = rgb(hexColor)
  const part = (value: number) => {
    const scaled = value / 255
    return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * part(r) + 0.7152 * part(g) + 0.0722 * part(b)
}
