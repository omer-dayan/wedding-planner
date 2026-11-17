import { useEffect, useRef, useState } from 'react'
import { useAppServices } from '../app/useAppServices.ts'
import { useHashSection } from '../app/useHashSection.ts'
import { unreadCount } from '../domain/activity.ts'
import { isCoupleOrOwner } from '../domain/roles.ts'
import { sections } from '../sections/registry.tsx'
import { readLastSeen } from '../sections/home/seen.ts'
import { Flower } from '../ui/Flower.tsx'

const TAB_IDS = ['home', 'guests', 'music', 'venues'] as const

export function AppShell() {
  const app = useAppServices()
  const section = useHashSection()
  const canSeeFeed = isCoupleOrOwner(app.wedding, app.user?.email ?? null)
  const tabs = sections.filter((item) => TAB_IDS.includes(item.id as (typeof TAB_IDS)[number]) && (item.id !== 'home' || canSeeFeed))
  const current = sections.find((item) => item.id === (section === 'home' && !canSeeFeed ? 'guests' : section)) ?? sections[0]
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    if (!window.location.hash) {
      window.location.hash = canSeeFeed ? '#/home' : '#/guests'
      return
    }
    if (section === 'home' && !canSeeFeed) window.location.hash = '#/guests'
  }, [canSeeFeed, section])

  useEffect(() => {
    if (!canSeeFeed) return
    const scope = app.wedding?.id ?? 'local'
    const email = app.user?.email ?? 'local'
    const refresh = (events: { createdAt: string }[]) => {
      if (window.location.hash.startsWith('#/home') || window.location.hash === '#home') {
        setUnread(0)
        return
      }
      setUnread(unreadCount(events, readLastSeen(scope, email)))
    }
    const stop = app.activity.subscribe((page) => refresh(page.events))
    const onSeen = () => refresh([])
    window.addEventListener('activity-seen', onSeen)
    return () => {
      stop()
      window.removeEventListener('activity-seen', onSeen)
    }
  }, [app.activity, app.user?.email, app.wedding?.id, canSeeFeed])

  if (!current) return null
  const Section = current.Component

  return (
    <div className="app-shell">
      <a className="skip-link" href="#content">דילוג לתוכן</a>
      <aside className="sidebar">
        <div className="sidebar-top">
          <div className="brand">
            <Flower />
            <p className="brand-title">{app.wedding?.name ?? 'החתונה שלנו'}</p>
          </div>
          <AccountMenu />
        </div>
        <nav className="nav" aria-label="ניווט ראשי">
          {sections.filter((item) => item.id !== 'home' || canSeeFeed).map((item) => (
            <a
              key={item.id}
              className={item.id === 'settings' ? 'nav-settings' : 'nav-section'}
              href={`#/${item.id}`}
              aria-current={item.id === current.id ? 'page' : undefined}
            >
              {item.label}
              {item.id === 'home' && unread > 0 && <span className="tab-badge">{unread > 9 ? '9+' : unread}</span>}
            </a>
          ))}
        </nav>
      </aside>
      <main className="content" id="content">
        <nav className="section-tabs" aria-label="מעבר בין חלקי האפליקציה" style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}>
          {tabs.map((item) => (
            <a key={item.id} href={`#/${item.id}`} aria-current={item.id === current.id ? 'page' : undefined}>
              <TabIcon id={item.id} />
              <span>{item.label}</span>
              {item.id === 'home' && unread > 0 && <span className="tab-badge">{unread > 9 ? '9+' : unread}</span>}
            </a>
          ))}
        </nav>
        <Section />
      </main>
    </div>
  )
}

function AccountMenu() {
  const app = useAppServices()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const name = app.user?.displayName || 'ח'
  const initials = name.includes('@')
    ? name.slice(0, 1).toUpperCase()
    : name.trim().split(/\s+/).slice(0, 2).map((part) => part.slice(0, 1)).join('')

  useEffect(() => {
    if (!open) return
    const close = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])

  return (
    <div className="account" ref={ref}>
      <button type="button" className="avatar-button" aria-label="תפריט חשבון" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        {app.user?.photoUrl ? <img src={app.user.photoUrl} alt="" /> : <span>{initials || 'ח'}</span>}
      </button>
      {open && (
        <div className="account-menu" role="menu">
          <a href="#/settings" role="menuitem" onClick={() => setOpen(false)}>הגדרות</a>
          <p className="account-email">{app.mode === 'local' ? 'שמירה מקומית במכשיר זה' : app.user?.email}</p>
          {app.onSignOut && (
            <button type="button" role="menuitem" onClick={() => void app.onSignOut?.()}>התנתקות</button>
          )}
        </div>
      )}
    </div>
  )
}

function TabIcon({ id }: { id: string }) {
  if (id === 'home') return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z" fill="currentColor" /></svg>
  if (id === 'music') return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 17.5a2.5 2.5 0 1 1-2-2.45V6.2l10-2v9.35a2.5 2.5 0 1 1-2-2.45V6.8l-6 1.2v9.5z" fill="currentColor" /></svg>
  if (id === 'venues') return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V9l8-5 8 5v11h-5v-6H9v6z" fill="currentColor" /></svg>
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm8 1a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5zM3 19c0-2.5 2.2-4 5-4s5 1.5 5 4v1H3zm11 .5c.2-1.6 1.4-3 3.2-3.5 1.6.3 2.8 1.5 2.8 3.5V20h-6z" fill="currentColor" /></svg>
}
