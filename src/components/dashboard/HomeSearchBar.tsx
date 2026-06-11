'use client'

// Prominente zoekbalk bovenaan dashboard-home. Klikken / typen / Ctrl+K
// opent de bestaande CommandPalette met de zoekterm erin geladen.

import { useEffect, useState } from 'react'
import { Icons } from '@/components/ui/Icons'

export const SEARCH_OPEN_EVENT = 'workx:open-search'

export default function HomeSearchBar() {
  const [isMac, setIsMac] = useState(false)

  useEffect(() => {
    setIsMac(/Mac|iPod|iPhone|iPad/.test(navigator.platform))
  }, [])

  const openSearch = (initial?: string) => {
    window.dispatchEvent(new CustomEvent(SEARCH_OPEN_EVENT, { detail: initial || '' }))
  }

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={() => openSearch()}
        className="
          group w-full flex items-center gap-3 px-5 py-4 rounded-2xl
          bg-white/[0.04] hover:bg-white/[0.07]
          border border-white/[0.08] hover:border-workx-lime/30
          transition-all duration-200
          text-left
          shadow-[0_2px_20px_-5px_rgba(0,0,0,0.3)]
          hover:shadow-[0_4px_30px_-5px_rgba(249,255,133,0.15)]
        "
        aria-label="Open zoekvenster"
      >
        <div className="w-9 h-9 rounded-xl bg-workx-lime/10 group-hover:bg-workx-lime/20 flex items-center justify-center flex-shrink-0 transition-colors">
          <Icons.search size={16} className="text-workx-lime" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white/90 font-medium">
            Zoek in alles van Workx
          </p>
          <p className="text-xs text-white/40 mt-0.5 truncate">
            Pagina&apos;s, kantoorgegevens, IBAN, hr-docs, mensen…
          </p>
        </div>
        <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white/[0.06] border border-white/[0.08] text-[10px] font-mono text-white/40 flex-shrink-0">
          {isMac ? '⌘' : 'Ctrl'} K
        </kbd>
      </button>
    </div>
  )
}
