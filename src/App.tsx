import { useEffect, useState } from 'react'
import type { ComponentType } from 'react'
import { readFirebaseConfig, type FirebaseWebConfig } from './data/firebaseConfig.ts'
import { LocalApp } from './app/LocalApp.tsx'
import { Splash } from './ui/Splash.tsx'

export default function App() {
  const config = readFirebaseConfig()
  if (!config) return <LocalApp />
  return <CloudLoader config={config} />
}

function CloudLoader({ config }: { config: FirebaseWebConfig }) {
  const [CloudApp, setCloudApp] = useState<ComponentType<{ config: FirebaseWebConfig }> | null>(null)

  useEffect(() => {
    let cancelled = false
    void import('./app/CloudApp.tsx').then((mod) => {
      if (!cancelled) setCloudApp(() => mod.CloudApp)
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (!CloudApp) return <Splash label="טוען…" />
  return <CloudApp config={config} />
}
