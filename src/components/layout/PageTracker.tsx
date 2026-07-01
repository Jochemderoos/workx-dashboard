'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

// Stuurt bij elke paginawissel een anoniem bezoek-signaal naar /api/track.
// Gebruikt sendBeacon zodat het navigeren nooit vertraagt.
export default function PageTracker() {
  const pathname = usePathname()
  const last = useRef<string | null>(null)

  useEffect(() => {
    if (!pathname || !pathname.startsWith('/dashboard')) return
    if (last.current === pathname) return
    last.current = pathname
    try {
      const body = JSON.stringify({ path: pathname })
      if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        navigator.sendBeacon('/api/track', new Blob([body], { type: 'application/json' }))
      } else {
        fetch('/api/track', { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true })
      }
    } catch {
      // tracking mag nooit iets breken
    }
  }, [pathname])

  return null
}
