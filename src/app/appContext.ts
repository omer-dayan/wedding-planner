import { createContext } from 'react'
import type { AppServices } from './context.tsx'

export const AppContext = createContext<AppServices | null>(null)
