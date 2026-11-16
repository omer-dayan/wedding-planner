import { useContext } from 'react'
import { AppContext } from './appContext.ts'
import type { AppServices } from './context.tsx'

export function useAppServices(): AppServices {
  const value = useContext(AppContext)
  if (!value) throw new Error('missing app services')
  return value
}
