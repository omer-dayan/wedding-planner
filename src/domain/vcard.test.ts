import { describe, expect, it } from 'vitest'
import { contactsMatch, normalizePhone, parseVCards } from './vcard.ts'

describe('parseVCards', () => {
  it('reads FN, prefers a mobile number, and keeps several cards', () => {
    const parsed = parseVCards(`BEGIN:VCARD
VERSION:3.0
FN:דנה כהן
TEL;TYPE=HOME:03-1111111
TEL;TYPE=CELL:+972-50-123-4567
END:VCARD
BEGIN:VCARD
VERSION:4.0
FN:יוסי לוי
TEL;TYPE=work;PREF=1:tel:+972-54-000-0000
TEL;TYPE=home:02-2222222
END:VCARD
`)
    expect(parsed).toEqual([
      { fullName: 'דנה כהן', phone: '+972-50-123-4567' },
      { fullName: 'יוסי לוי', phone: '+972-54-000-0000' },
    ])
  })

  it('falls back to N, unfolds lines, and decodes quoted-printable UTF-8', () => {
    const parsed = parseVCards(`BEGIN:VCARD
VERSION:2.1
N;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:=D7=9B=D7=94=D7=9F;=D7=93=D7=A0=D7=94
FN;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:=D7=93=D7=A0=D7=94=20=D7=9B=D7=94=D7=9F
TEL;CELL;PREF:+972501112233
END:VCARD
BEGIN:VCARD
VERSION:3.0
N:לוי;נועה;;;
TEL;TYPE=VOICE:09-999
END:VCARD
BEGIN:VCARD
VERSION:3.0
FN:אורח 
 עם רווח
TEL;TYPE=CELL:050-0000001
END:VCARD
`)
    expect(parsed.map((contact) => contact.fullName)).toEqual(['דנה כהן', 'נועה לוי', 'אורח עם רווח'])
    expect(parsed[0]?.phone).toBe('+972501112233')
    expect(parsed[1]?.phone).toBe('09-999')
  })
})

describe('contact matching', () => {
  it('normalizes +972 to a local number and matches that before the name', () => {
    expect(normalizePhone('+972-50-123-4567')).toBe('0501234567')
    expect(normalizePhone('050-123-4567')).toBe('0501234567')
    expect(contactsMatch({ fullName: 'אחר', phone: '0501234567' }, { fullName: 'דנה כהן', phone: '+972501234567' })).toBe(true)
    expect(contactsMatch({ fullName: 'דנה כהן', phone: '0501111111' }, { fullName: 'דנה כהן', phone: '0522222222' })).toBe(false)
    expect(contactsMatch({ fullName: 'דנה כהן', phone: '' }, { fullName: 'דנה  כהן', phone: '' })).toBe(true)
  })
})
