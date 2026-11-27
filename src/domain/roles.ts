import type { Side, SubSide } from './types.ts'

export const WEDDING_ROLES = [
  { id: 'groom', label: 'חתן', side: 'groom' },
  { id: 'groom_father', label: 'אבא של החתן', side: 'groom' },
  { id: 'groom_mother', label: 'אמא של החתן', side: 'groom' },
  { id: 'groom_brother', label: 'אח של חתן', side: 'groom' },
  { id: 'groom_sister', label: 'אחות של חתן', side: 'groom' },
  { id: 'bride', label: 'כלה', side: 'bride' },
  { id: 'bride_father', label: 'אבא של הכלה', side: 'bride' },
  { id: 'bride_mother', label: 'אמא של הכלה', side: 'bride' },
  { id: 'bride_brother', label: 'אח של כלה', side: 'bride' },
  { id: 'bride_sister', label: 'אחות של כלה', side: 'bride' },
] as const

export type WeddingRoleId = (typeof WEDDING_ROLES)[number]['id']

const ROLES_BY_ID = new Map(WEDDING_ROLES.map((role) => [role.id, role]))

export function isWeddingRole(value: unknown): value is WeddingRoleId {
  return typeof value === 'string' && ROLES_BY_ID.has(value as WeddingRoleId)
}

export function sideForRole(role: WeddingRoleId): Side {
  return ROLES_BY_ID.get(role)?.side ?? 'groom'
}

/** Side and sub-side stamped onto guests added by this member. */
export function placementForRole(role: WeddingRoleId | null): { side: 'groom' | 'bride'; subSide: SubSide } {
  const id = role ?? 'groom'
  const side = id.startsWith('bride') ? 'bride' : 'groom'
  if (id.endsWith('_father') || id.endsWith('_mother')) return { side, subSide: 'parents' }
  if (id.endsWith('_brother')) return { side, subSide: 'brother' }
  if (id.endsWith('_sister')) return { side, subSide: 'sister' }
  return { side, subSide: 'none' }
}

export function roleLabel(role: WeddingRoleId | null): string {
  if (!role) return 'ללא תפקיד'
  return ROLES_BY_ID.get(role)?.label ?? 'ללא תפקיד'
}

export interface RoleAssignment {
  ownerEmail: string
  memberRoles?: Readonly<Record<string, unknown>>
}

/** Stored role, with a missing owner role treated as groom. */
export function assignedRole(wedding: RoleAssignment | null, email: string | null): WeddingRoleId | null {
  if (!email) return 'groom'
  const key = email.trim().toLowerCase()
  const stored = wedding?.memberRoles?.[key]
  if (isWeddingRole(stored)) return stored
  if (wedding && wedding.ownerEmail.trim().toLowerCase() === key) return 'groom'
  if (!wedding) return 'groom'
  return null
}

/** Parents and siblings are limited to their own role. The owner and the couple are not. */
export function isRestrictedMember(wedding: RoleAssignment | null, email: string | null): boolean {
  if (!wedding || !email) return false
  if (wedding.ownerEmail.trim().toLowerCase() === email.trim().toLowerCase()) return false
  const stored = wedding.memberRoles?.[email.trim().toLowerCase()]
  return isWeddingRole(stored) && stored !== 'groom' && stored !== 'bride'
}

export function canEditGuest(
  wedding: RoleAssignment | null,
  email: string | null,
  guest: { side: Side | null; subSide?: SubSide | null },
): boolean {
  if (!isRestrictedMember(wedding, email)) return true
  const mine = placementForRole(assignedRole(wedding, email))
  return guest.side === mine.side && (guest.subSide ?? 'none') === mine.subSide
}

export function isCoupleOrOwner(wedding: RoleAssignment | null, email: string | null): boolean {
  if (!email || !wedding) return true
  const me = email.trim().toLowerCase()
  if (wedding.ownerEmail.trim().toLowerCase() === me) return true
  const stored = wedding.memberRoles?.[me]
  return stored === 'groom' || stored === 'bride'
}

export function cleanMemberRoles(value: unknown): Record<string, WeddingRoleId> {
  if (!value || typeof value !== 'object') return {}
  const roles: Record<string, WeddingRoleId> = {}
  for (const [email, role] of Object.entries(value as Record<string, unknown>)) {
    if (isWeddingRole(role)) roles[email.trim().toLowerCase()] = role
  }
  return roles
}
