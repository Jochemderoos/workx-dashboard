'use client'

import { useEffect } from 'react'

/**
 * Detects stale JavaScript after Vercel deployments and auto-refreshes.
 *
 * Two strategies:
 * 1. Chunk load error detection: catches errors when old JS references missing chunks
 * 2. Tab-visibility refresh: when user returns after 5+ minutes away, auto-refresh
 *    to ensure fresh code after a deploy that happened while tab was inactive
 */
export default function StaleVersionGuard() {
  useEffect(() => {
    // Safe refresh with cooldown to prevent infinite loops
    function safeRefresh(storageKey: string, cooldownMs = 30000) {
      const lastRefresh = sessionStorage.getItem(storageKey)
      const now = Date.now()
      if (!lastRefresh || now - parseInt(lastRefresh) > cooldownMs) {
        sessionStorage.setItem(storageKey, now.toString())
        window.location.reload()
      }
    }

    // --- Strategy 1: Chunk load error detection ---
    const handleError = (event: ErrorEvent) => {
      const msg = event.message || ''
      if (
        msg.includes('Loading chunk') ||
        msg.includes('ChunkLoadError') ||
        msg.includes('Loading CSS chunk') ||
        msg.includes('Failed to fetch dynamically imported module') ||
        msg.includes('Importing a module script failed')
      ) {
        safeRefresh('workx-chunk-refresh')
      }
    }

    const handleRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason?.message || event.reason?.toString() || ''
      if (
        reason.includes('Loading chunk') ||
        reason.includes('ChunkLoadError') ||
        reason.includes('Failed to fetch dynamically imported module') ||
        reason.includes('Importing a module script failed') ||
        reason.includes('error loading dynamically imported module')
      ) {
        safeRefresh('workx-chunk-refresh')
      }
    }

    // --- Strategy 2: Tab-visibility auto-refresh ---
    let hiddenAt: number | null = null

    const handleVisibility = () => {
      if (document.hidden) {
        hiddenAt = Date.now()
      } else if (hiddenAt) {
        const hiddenDuration = Date.now() - hiddenAt
        hiddenAt = null
        // If tab was hidden for more than 5 minutes, auto-refresh to get fresh code
        // This catches the case where a Vercel deploy happened while the tab was inactive
        if (hiddenDuration > 5 * 60 * 1000) {
          safeRefresh('workx-stale-refresh', 60000)
        }
      }
    }

    window.addEventListener('error', handleError)
    window.addEventListener('unhandledrejection', handleRejection)
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      window.removeEventListener('error', handleError)
      window.removeEventListener('unhandledrejection', handleRejection)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])

  return null
}
