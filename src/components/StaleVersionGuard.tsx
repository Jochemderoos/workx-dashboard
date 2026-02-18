'use client'

import { useEffect } from 'react'

/**
 * Detects stale JavaScript after Vercel deployments and auto-refreshes.
 *
 * Three strategies:
 * 1. Chunk load error detection: catches errors when old JS references missing chunks
 * 2. Tab-visibility refresh: checks build ID when tab becomes visible after 30s+,
 *    or auto-refreshes after 5+ minutes hidden
 * 3. Periodic build-ID check: polls /api/version every 2 minutes to detect deploys
 */
export default function StaleVersionGuard() {
  useEffect(() => {
    // Safe refresh with cooldown to prevent infinite loops
    function safeRefresh(storageKey: string, cooldownMs = 30000) {
      // Never refresh if a chat is actively loading (prevents killing in-progress requests)
      const lastVersionRefresh = parseInt(sessionStorage.getItem('workx-last-version-refresh') || '0')
      if (Date.now() - lastVersionRefresh < 300000) return // Chat active in last 5 minutes

      const lastRefresh = sessionStorage.getItem(storageKey)
      const now = Date.now()
      if (!lastRefresh || now - parseInt(lastRefresh) > cooldownMs) {
        sessionStorage.setItem(storageKey, now.toString())
        // Cache-busting refresh: clear caches + navigate to unique URL
        // This ensures fresh code even when service worker is active
        if ('caches' in self) {
          caches.keys().then(names => Promise.all(names.map(name => caches.delete(name)))).then(() => {
            const url = new URL(window.location.href)
            url.searchParams.set('_v', Date.now().toString())
            window.location.replace(url.toString())
          })
        } else {
          window.location.reload()
        }
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
    const clientBuildId = process.env.NEXT_PUBLIC_BUILD_ID

    const checkBuildVersion = async (): Promise<boolean> => {
      if (!clientBuildId) return false
      try {
        const res = await fetch('/api/version', { cache: 'no-store' })
        if (!res.ok) return false
        const { buildId } = await res.json()
        if (buildId && buildId !== clientBuildId) {
          console.log(`[StaleVersionGuard] Version mismatch: client=${clientBuildId} server=${buildId}`)
          return true
        }
      } catch { /* ignore network errors */ }
      return false
    }

    const handleVisibility = async () => {
      if (document.hidden) {
        hiddenAt = Date.now()
      } else if (hiddenAt) {
        const hiddenDuration = Date.now() - hiddenAt
        hiddenAt = null
        // If tab was hidden for more than 5 minutes, auto-refresh
        if (hiddenDuration > 5 * 60 * 1000) {
          safeRefresh('workx-stale-refresh', 60000)
          return
        }
        // If tab was hidden for more than 30 seconds, check build ID
        if (hiddenDuration > 30000) {
          const stale = await checkBuildVersion()
          if (stale) safeRefresh('workx-version-refresh', 120000)
        }
      }
    }

    // --- Strategy 3: Periodic build-ID version check (every 2 minutes) ---
    const periodicCheck = setInterval(async () => {
      if (document.hidden) return
      const stale = await checkBuildVersion()
      if (stale) safeRefresh('workx-version-refresh', 120000)
    }, 120000)

    window.addEventListener('error', handleError)
    window.addEventListener('unhandledrejection', handleRejection)
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      window.removeEventListener('error', handleError)
      window.removeEventListener('unhandledrejection', handleRejection)
      document.removeEventListener('visibilitychange', handleVisibility)
      clearInterval(periodicCheck)
    }
  }, [])

  return null
}
