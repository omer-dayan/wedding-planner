# תכנון חתונה

אפליקציה לתכנון חתונה. בשלב הזה יש ניהול רשימת מוזמנים: הוספה, עריכה ומחיקה, חיפוש וסינון, סיכומי הגעה, ייצוא CSV, וייבוא מאנשי קשר. התפריט הצדדי מוכן להוספת חלקים נוספים (תקציב, ספקים, משימות, הושבה) בהמשך.

הממשק בעברית ובכיוון ימין־לשמאל. אם מוגדר Firebase, הרשימה נשמרת בענן ומסתנכרנת בין הטלפון למחשב, ואפשר לשתף אותה עם בן או בת הזוג לפי כתובת האימייל. בלי הגדרות Firebase הנתונים נשמרים רק בדפדפן (`localStorage`).

**אין להעלות לריפו רשימת מוזמנים אמיתית.** אתר GitHub Pages ציבורי.

## מה אפשר לעשות

- לנהל מוזמנים: שם מלא, טלפון, צד (חתן / כלה / משותף, או בלי צד), קבוצה (בחירה או טקסט חופשי), מספר אנשים כולל מלווים, סטטוס הגעה (ממתין / מגיע / לא מגיע / אולי) והערות.
- לחפש, לסנן לפי צד, קבוצה וסטטוס, ולמיין לפי שם.
- לראות למעלה כמה אנשים הוזמנו, כמה מגיעים, לא מגיעים וממתינים, כולל פירוק לפי צד.
- לייצא CSV של האפליקציה ב־UTF-8 עם BOM, כדי ש־Excel יפתח עברית כמו שצריך.
- לייבא מאנשי קשר: בחירה מהמכשיר כשזה נתמך, או קובץ vCard (באייפון: שיתוף איש קשר לקבצים). אנשי קשר שכבר ברשימה מסומנים ולא נבחרים כברירת מחדל.

## הרצה מקומית

```bash
npm install
npm run dev
```

פתחו את הכתובת ש־Vite מדפיס. בגלל הנתיב של GitHub Pages היא כוללת `/wedding-planner/` (למשל `http://localhost:5173/wedding-planner/`).

```bash
npm test
npm run build
npm run preview
```

## פרסום ל־GitHub Pages

האתר מיועד לכתובת [https://omer-dayan.github.io/wedding-planner/](https://omer-dayan.github.io/wedding-planner/).

ב־GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**. בלי זה ה־workflow לא יפרסם את האתר. דחיפה ל־`main` מריצה בדיקות, בונה ומפרסמת עם `actions/deploy-pages`. הניווט הפנימי הוא ב־hash (`#/guests`), כדי שרענון בדפדפן יעבוד בלי הגדרות שרת נוספות.

## חיבור Firebase (סנכרון בענן)

מסלול Spark החינמי מספיק. בלי המשתנים האלה האפליקציה נשארת במצב מקומי.

1. נכנסים ל־[Firebase Console](https://console.firebase.google.com/) ויוצרים פרויקט (אפשר בלי Google Analytics).
2. מוסיפים אפליקציית Web ושומרים את אובייקט ה־config.
3. ב־**Authentication → Sign-in method** מפעילים **Google**. אם Google מבקשת מסך הסכמה, מגדירים אותו ב־Google Cloud Console. במצב Testing מוסיפים את כתובות ה־Gmail שלכם, או מפרסמים את האפליקציה.
4. ב־**Authentication → Settings → Authorized domains** מוסיפים את `omer-dayan.github.io`. `localhost` כבר קיים להרצה מקומית.
5. ב־**Firestore Database** יוצרים מסד במצב **Production** ובוחרים אזור קרוב (למשל `europe-west1`).
6. מפרסמים את כללי האבטחה מהשורש של הריפו. הקובץ `firestore.rules` כבר מגדיר שרק משתמש מחובר ומאומת, שהאימייל שלו נמצא ב־`memberEmails` של מסמך החתונה, יכול לקרוא ולכתוב את המוזמנים. רק הבעלים יכולים לעדכן את רשימת השותפים.

   ```bash
   npx firebase-tools deploy --only firestore:rules --project <PROJECT_ID>
   ```

7. ב־GitHub: **Settings → Secrets and variables → Actions**. מוסיפים את הערכים כ־Secrets או כ־Variables (ה־workflow קורא קודם ל־secret ואז ל־variable):

   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`

   מפתח ה־API נחשף בדפדפן; ההגנה היא כללי Firestore והדומיינים המורשים, לא הסתרת המפתח. אחרי שמירה מריצים מחדש את ה־workflow, או דוחפים ל־`main`.

8. להרצה מקומית עם ענן: מעתיקים את `.env.example` ל־`.env.local` וממלאים את אותם ערכים. הקובץ הזה לא נכנס לגיט.

9. מתחברים עם Google, נכנסים ל**הגדרות**, ומוסיפים את כתובת ה־Google המדויקת של בן או בת הזוג (כפי שהיא מופיעה אצלו במסך ההגדרות). כשיתחברו, הם יראו את אותה חתונה.

## English

Hebrew, right-to-left wedding planner. This version manages the guest list (add, edit, delete, search, filters, RSVP summary, CSV export, and contact import). Navigation is ready for more sections later.

```bash
npm install
npm run dev
npm test
```

The dev server uses the GitHub Pages base path `/wedding-planner/`. Guest data stays in the browser unless Firebase env vars are set, in which case Google sign-in and Firestore sync the list per wedding for an allowlist of member emails. Deployed by GitHub Actions to GitHub Pages; in the repo settings, set Pages source to **GitHub Actions**. Do not commit a real guest list — the site is public.
