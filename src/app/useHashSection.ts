import { useEffect, useState } from 'react'
import { isSectionId, type SectionId } from '../sections/ids.ts'

function readSection(): SectionId {
  const id = window.location.hash.replace(/^#\/?/, '').split(/[/?#]/)[0] ?? ''
  if (!id) return 'home'
  return isSectionId(id) ? id : 'guests'
}

export function useHashSection(): SectionId {
  const [section, setSection] = useState<SectionId>(readSection)

  useEffect(() => {
    const onChange = () => setSection(readSection())
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  return section
}
