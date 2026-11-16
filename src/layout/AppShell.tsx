import { useAppServices } from '../app/useAppServices.ts'
import { useHashSection } from '../app/useHashSection.ts'
import { sections } from '../sections/registry.tsx'
import { Rings } from '../ui/Rings.tsx'

export function AppShell() {
  const app = useAppServices()
  const section = useHashSection()
  const current = sections.find((item) => item.id === section) ?? sections[0]
  if (!current) return null
  const Section = current.Component

  return (
    <div className="app-shell">
      <a className="skip-link" href="#content">
        דילוג לתוכן
      </a>
      <aside className="sidebar">
        <div className="brand">
          <Rings />
          <div>
            <p className="brand-kicker">{app.wedding?.name ?? 'החתונה שלנו'}</p>
            <p className="brand-title">תכנון חתונה</p>
          </div>
        </div>
        <nav className="nav" aria-label="ניווט ראשי">
          {sections.map((item) => (
            <a key={item.id} href={`#/${item.id}`} aria-current={item.id === current.id ? 'page' : undefined}>
              {item.label}
            </a>
          ))}
        </nav>
        <div className="sidebar-foot">
          <p className="sidebar-note">{app.mode === 'local' ? 'שמירה מקומית במכשיר זה' : app.user?.email}</p>
          {app.onSignOut && (
            <button type="button" className="btn btn-ghost btn-small" onClick={() => void app.onSignOut?.()}>
              התנתקות
            </button>
          )}
        </div>
      </aside>
      <main className="content" id="content">
        <Section />
      </main>
    </div>
  )
}
