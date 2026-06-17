'use client'

import { ReactNode, useEffect } from 'react'
import dynamic from 'next/dynamic'
const CommandPalette = dynamic(() => import('@/components/ui/CommandPalette'), { ssr: false })
import PageTransition from '@/components/ui/PageTransition'

interface DashboardClientProps {
  children: ReactNode
}

// Voorkom legacy browser-gedrag waarbij Backspace buiten een tekstveld
// terugnavigeert in de geschiedenis. Op de bonus-pagina ging zo een net
// aangemaakte bonus 'verloren' omdat de page reloadde.
function useBlockBackspaceNavigation() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Backspace') return
      const t = e.target as HTMLElement | null
      if (!t) { e.preventDefault(); return }
      const tag = t.tagName
      const editable =
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        t.isContentEditable
      if (!editable) e.preventDefault()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])
}

export default function DashboardClient({ children }: DashboardClientProps) {
  useBlockBackspaceNavigation()
  return (
    <>
      <PageTransition>
        {children}
      </PageTransition>

      <CommandPalette />
    </>
  )
}
