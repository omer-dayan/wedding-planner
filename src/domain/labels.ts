import type { Category, RsvpStatus, Side, SubSide } from './types.ts'

export const PRESET_GROUPS = ['משפחה', 'חברים', 'עבודה']

export const SIDE_LABELS: Record<Side, string> = {
  groom: 'חתן',
  bride: 'כלה',
  shared: 'משותף',
}

export const UNSPECIFIED_SIDE_LABEL = 'לא צוין'

export const SUB_SIDE_LABELS: Record<SubSide, string> = {
  none: 'ריק',
  parents: 'הורים',
  brother: 'אח',
  sister: 'אחות',
}

export const CATEGORY_LABELS: Record<Category, string> = {
  family: 'משפחה',
  friends: 'חברים',
  work: 'עבודה',
  other: 'אחר',
}

export const RSVP_LABELS: Record<RsvpStatus, string> = {
  pending: 'ממתין',
  attending: 'מגיע',
  declined: 'לא מגיע',
  maybe: 'אולי',
}

const ERROR_TEXT: Record<string, string> = {
  'name-required': 'יש להזין שם מלא.',
  'name-length': 'השם ארוך מדי.',
  'phone-length': 'מספר הטלפון ארוך מדי.',
  'group-length': 'שם הקבוצה ארוך מדי.',
  'notes-length': 'ההערה ארוכה מדי.',
  'party-size': 'מספר האנשים צריך להיות מספר שלם בין 1 ל-100.',
  'child-count': 'מספר הילדים צריך להיות מספר שלם בין 0 ל-100.',
  'drinker-count': 'מספר שותי האלכוהול לא יכול להיות גדול ממספר האנשים.',
  side: 'הצד שנבחר אינו תקין.',
  rsvp: 'סטטוס ההגעה אינו תקין.',
  assumed: 'סימון מספר האנשים אינו תקין.',
  'not-found': 'המוזמן לא נמצא. רעננו את הרשימה.',
  'invalid-guest': 'אחת הרשומות אינה תקינה.',
  'invalid-email': 'הזינו כתובת אימייל תקינה.',
  'already-member': 'האימייל הזה כבר ברשימה.',
  'cannot-remove-owner': 'אי אפשר להסיר את בעלי החתונה.',
  'too-many-members': 'אפשר לשתף עד 20 אנשים.',
  'invalid-date': 'תאריך החתונה אינו תקין.',
  'invalid-name': 'שם החתונה צריך להכיל לפחות תו אחד.',
  'name-too-long': 'שם החתונה ארוך מדי.',
  'title-required': 'יש להזין שם שיר.',
  'title-length': 'שם השיר ארוך מדי.',
  'artist-length': 'שם האמן ארוך מדי.',
  moment: 'הרגע שנבחר אינו תקין.',
  'invalid-url': 'הקישור חייב להתחיל ב-http:// או https://.',
  'venue-name-required': 'יש להזין שם אולם.',
  'invalid-place': 'המיקום על המפה לא תקין.',
  'city-length': 'שם האזור ארוך מדי.',
  'price-length': 'הערת המחיר ארוכה מדי.',
  'visit-date': 'תאריך הביקור אינו תקין.',
  'venue-status': 'הסטטוס שנבחר אינו תקין.',
  'too-many-videos': 'אפשר לשמור עד 20 סרטונים לאולם.',
  'too-many-offers': 'אפשר עד 12 הצעות לאולם.',
  'venue-questions': 'רשימת השאלות אינה תקינה.',
  'question-label': 'לכל שאלה צריך ניסוח קצר.',
  'question-type': 'סוג השאלה אינו תקין.',
  'question-price': 'סימון החישוב של השאלה אינו תקין.',
  'too-many-questions': 'אפשר עד 20 שאלות לאולמות.',
  'guest-categories': 'עץ הקטגוריות אינו תקין.',
  'too-many-categories': 'אפשר עד 40 קטגוריות.',
  network: 'לא הצלחנו להתחבר לגיליון. בדקו שהוא ציבורי, או העלו את קובץ ה-CSV.',
  http: 'הגיליון לא נפתח. ודאו שהוא משותף לכל מי שיש לו את הקישור, או העלו CSV.',
  'not-csv': 'הקישור החזיר דף ולא קובץ CSV. ודאו שהגיליון ציבורי, או העלו את הקובץ.',
  'app-csv': 'זהו קובץ הייצוא של האפליקציה. השתמשו בכפתור «ייבוא CSV».',
  'missing-header': 'בקובץ אין שורת כותרות של הרשימה. לייבוא מגיליון השתמשו ב«ייבוא מ-Google Sheets».',
  'invalid-count': 'מספר האנשים אינו תקין.',
  'permission-denied': 'הפעולה נחסמה. רעננו את האפליקציה ונסו שוב.',
  'unauthorized-domain': 'הדומיין לא מורשה ב-Firebase. יש להוסיף את omer-dayan.github.io לדומיינים המורשים.',
  'popup-blocked': 'הדפדפן חסם את חלון ההתחברות. אפשרו חלונות קופצים ונסו שוב.',
  'network-auth': 'אין חיבור לרשת. נסו שוב.',
  'auth-failed': 'ההתחברות נכשלה. נסו שוב.',
  'auth-storage': 'ההתחברות לא הושלמה. הדפדפן חסם את המעבר לחשבון Google.',
  'create-failed': 'לא הצלחנו ליצור את החתונה. נסו לרענן.',
  'missing-email': 'לחשבון Google אין כתובת אימייל זמינה.',
  'storage-full': 'הדפדפן חסם את השמירה. פנו מקום או התחברו לענן.',
  'comment-empty': 'כתבו תגובה לפני השליחה.',
  'comment-length': 'התגובה ארוכה מדי.',
  'comment-event': 'לא נמצא העדכון לתגובה.',
  unknown: 'משהו השתבש. נסו שוב.',
}

export function errorText(code: string): string {
  return ERROR_TEXT[code] ?? ERROR_TEXT.unknown
}

export function sideLabel(side: Side | null): string {
  return side ? SIDE_LABELS[side] : UNSPECIFIED_SIDE_LABEL
}
