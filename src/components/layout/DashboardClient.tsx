'use client'

import { ReactNode } from 'react'
import dynamic from 'next/dynamic'
const CommandPalette = dynamic(() => import('@/components/ui/CommandPalette'), { ssr: false })
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
