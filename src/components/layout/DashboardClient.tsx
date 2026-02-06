'use client'

import { ReactNode } from 'react'
import CommandPalette from '@/components/ui/CommandPalette'
import PageTransition from '@/components/ui/PageTransition'

interface DashboardClientProps {
  children: ReactNode
}

export default function DashboardClient({ children }: DashboardClientProps) {
  return (
    <>
      <PageTransition>
        {children}
      </PageTransition>

      <CommandPalette />
    </>
  )
}
