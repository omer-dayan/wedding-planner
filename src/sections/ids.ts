export const SECTION_IDS = ['home', 'guests', 'music', 'venues', 'expenses', 'settings'] as const
export type SectionId = (typeof SECTION_IDS)[number]

export function isSectionId(value: string): value is SectionId {
  return (SECTION_IDS as readonly string[]).includes(value)
}
