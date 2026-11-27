import { RSVP_LABELS, SIDE_LABELS } from './labels.ts'
import { roleLabel } from './roles.ts'
import type { Guest } from './types.ts'

const HEADERS = ['מזהה', 'שם מלא', 'טלפון', 'צד', 'קבוצה', 'מספר אנשים', 'ילדים 0-3', 'ילדים 4-10', 'שותים', 'בוודאות', 'מספר לא צוין', 'סטטוס הגעה', 'הערות', 'תפקיד']

/** UTF-8 with a BOM, so Excel opens the Hebrew correctly. */
export function guestsToAppCsv(guests: readonly Guest[]): string {
  const rows = [
    HEADERS,
    ...guests.map((guest) => [
      guest.id,
      guest.fullName,
      guest.phone,
      guest.side ? SIDE_LABELS[guest.side] : '',
      guest.group,
      String(guest.partySize),
      String(guest.childrenSmall),
      String(guest.childrenOlder),
      String(guest.drinkerCount),
      String(guest.certainCount),
      guest.partySizeAssumed ? 'כן' : 'לא',
      RSVP_LABELS[guest.rsvp],
      guest.notes,
      guest.role ? roleLabel(guest.role) : '',
    ]),
  ]
  const escape = (value: string) => (/[",\r\n;]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value)
  return `﻿${rows.map((row) => row.map(escape).join(',')).join('\r\n')}\r\n`
}
