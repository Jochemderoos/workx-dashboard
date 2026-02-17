'use client'

import { useEffect } from 'react'

/**
 * Detects stale JavaScript after Vercel deployments and auto-refreshes.
 * When a new deployment happens, old JS chunks in the browser tab become invalid.
 * This component catches those chunk load errors and refreshes the page once.
 */
export default function StaleVersionGuard() {
  useEffect(() => {
    // Catch chunk load errors (happens when old JS references chunks that no longer exist)
    const handleError = (event: ErrorEvent) => {
      const msg = event.message || ''
      if (
        msg.includes('Loading chunk') ||
        msg.includes('ChunkLoadError') ||
        msg.includes('Loading CSS chunk') ||
        msg.includes('Failed to fetch dynamically imported module') ||
        msg.includes('Importing a module script failed')
      ) {
        // Only auto-refresh once to avoid infinite loops
        const lastRefresh = sessionStorage.getItem('workx-chunk-refresh')
        const now = Date.now()
        if (!lastRefresh || now - parseInt(lastRefresh) > 30000) {
          sessionStorage.setItem('workx-chunk-refresh', now.toString())
          window.location.reload()
        }
      }
    }

    // Also catch unhandled promise rejections (dynamic imports fail as rejected promises)
    const handleRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason?.message || event.reason?.toString() || ''
      if (
        reason.includes('Loading chunk') ||
        reason.includes('ChunkLoadError') ||
        reason.includes('Failed to fetch dynamically imported module') ||
        reason.includes('Importing a module script failed') ||
        reason.includes('error loading dynamically imported module')
      ) {
        const lastRefresh = sessionStorage.getItem('workx-chunk-refresh')
        const now = Date.now()
        if (!lastRefresh || now - parseInt(lastRefresh) > 30000) {
          sessionStorage.setItem('workx-chunk-refresh', now.toString())
          window.location.reload()
        }
      }
    }

    window.addEventListener('error', handleError)
    window.addEventListener('unhandledrejection', handleRejection)

    return () => {
      window.removeEventListener('error', handleError)
      window.removeEventListener('unhandledrejection', handleRejection)
    }
  }, [])

  return null
}
