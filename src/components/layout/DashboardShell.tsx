'use client'

import { ReactNode } from 'react'
import { SidebarProvider, useSidebar } from '@/lib/sidebar-context'
import { Icons } from '@/components/ui/Icons'

function SidebarExpandButton() {
  const { collapsed, setCollapsed } = useSidebar()
  if (!collapsed) return null

  return (
    <button
      onClick={() => setCollapsed(false)}
      className="fixed left-0 top-1/2 -translate-y-1/2 z-30 flex items-center gap-1 pl-1.5 pr-2.5 py-3 rounded-r-xl bg-white/[0.06] border border-l-0 border-white/10 text-white/40 hover:text-workx-lime hover:bg-workx-lime/10 hover:border-workx-lime/20 hover:shadow-[0_0_15px_rgba(249,255,133,0.15)] backdrop-blur-sm transition-all duration-300 group"
      title="Sidebar uitklappen"
    >
      <Icons.chevronRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
    </button>
  )
}

function ShellInner({ sidebar, children }: { sidebar: ReactNode; children: ReactNode }) {
  const { collapsed } = useSidebar()

  return (
    <div className="flex h-screen bg-workx-dark overflow-hidden">
      {/* Sidebar wrapper — smooth collapse */}
      <div className={`hidden md:flex h-full transition-all duration-300 ease-in-out overflow-hidden flex-shrink-0 ${
        collapsed ? 'w-0 opacity-0' : 'w-72 opacity-100'
      }`}>
        {sidebar}
      </div>

      {/* Expand button when collapsed */}
      <SidebarExpandButton />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 relative w-full">
        {children}
      </div>
    </div>
  )
}

export default function DashboardShell({ sidebar, children }: { sidebar: ReactNode; children: ReactNode }) {
  return (
    <SidebarProvider>
      <ShellInner sidebar={sidebar} children={children} />
    </SidebarProvider>
  )
}
