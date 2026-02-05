'use client'

import { useState, useEffect, ReactNode } from 'react'
import CommandPalette from '@/components/ui/CommandPalette'
import PageTransition from '@/components/ui/PageTransition'

interface DashboardClientProps {
  children: ReactNode
}

export default function DashboardClient({ children }: DashboardClientProps) {
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)

  // Global keyboard shortcut for Command Palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K to open command palette
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCommandPaletteOpen(prev => !prev)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <>
      <PageTransition>
        {children}
      </PageTransition>

      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
      />
    </>
  )
}
