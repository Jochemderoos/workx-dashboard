'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

/**
 * Detects stale JavaScript after Vercel deployments.
 *
 * Three strategies:
 * 1. Chunk load error detection: force-refresh when old JS references missing chunks
 * 2. Tab-visibility check: shows banner when tab becomes visible after 5+ minutes
 * 3. Periodic build-ID check: polls /api/version every 5 minutes, shows banner
 *
 * Strategy 2 & 3 show a non-intrusive "Nieuwe versie" banner so the user can
 * refresh when ready — no disruptive auto-refreshes while someone has a page open
 * (e.g. notulen tijdens een overleg). Only chunk errors (strategy 1) force-refresh
 * because those make the page unusable.
 */
export default function StaleVersionGuard() {
  const pathname = usePathname()

  useEffect(() => {
    // On AI chat pages: NEVER auto-refresh — user has uploads and active conversations
    const isProtectedPage = pathname?.startsWith('/dashboard/ai')

    // Safe refresh with cooldown to prevent infinite loops
    function safeRefresh(storageKey: string, cooldownMs = 30000) {
      // Never refresh if a chat is actively loading (prevents killing in-progress requests)
      const lastActivity = parseInt(sessionStorage.getItem('workx-last-version-refresh') || '0')
      if (Date.now() - lastActivity < 600000) return // Active in last 10 minutes

      // Never auto-refresh on protected pages (AI chat) — show banner instead
      if (isProtectedPage) {
        showUpdateBanner()
        return
      }

      const lastRefresh = sessionStorage.getItem(storageKey)
      const now = Date.now()
      if (!lastRefresh || now - parseInt(lastRefresh) > cooldownMs) {
        sessionStorage.setItem(storageKey, now.toString())
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

    // Show a subtle banner instead of force-refreshing
    function showUpdateBanner() {
      if (document.getElementById('workx-update-banner')) return // Already showing
      const banner = document.createElement('div')
      banner.id = 'workx-update-banner'
      banner.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:9999;padding:8px 16px;background:rgba(249,255,133,0.95);color:rgba(30,30,30,0.9);font-size:13px;font-weight:500;display:flex;align-items:center;justify-content:center;gap:12px;box-shadow:0 -2px 12px rgba(0,0,0,0.15);'
      banner.innerHTML = `
        <span>Er is een nieuwe versie beschikbaar</span>
        <button onclick="window.location.reload()" style="padding:5px 14px;border-radius:8px;background:rgba(30,30,30,0.9);border:none;color:rgb(249,255,133);font-size:12px;font-weight:600;cursor:pointer;">Ververs pagina</button>
        <button onclick="this.parentElement.remove()" style="padding:2px 8px;border:none;background:none;color:rgba(30,30,30,0.4);cursor:pointer;font-size:16px;font-weight:bold;">&times;</button>
      `
      document.body.appendChild(banner)
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

    // --- Strategy 2: Tab-visibility check ---
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
        // Only check after 5+ minutes hidden
        if (hiddenDuration > 5 * 60 * 1000) {
          const stale = await checkBuildVersion()
          if (stale) showUpdateBanner()
        }
      }
    }

    // --- Strategy 3: Periodic build-ID version check (every 5 minutes) ---
    // Shows a banner immediately. After 1 hour stale, auto-refreshes
    // (unless on a protected page like AI chat).
    let staleDetectedAt: number | null = null

    const periodicCheck = setInterval(async () => {
      if (document.hidden) return
      const stale = await checkBuildVersion()
      if (stale) {
        showUpdateBanner()
        if (!staleDetectedAt) staleDetectedAt = Date.now()
        // Auto-refresh after 1 hour stale (unless protected page)
        if (!isProtectedPage && Date.now() - staleDetectedAt > 60 * 60 * 1000) {
          window.location.reload()
        }
      } else {
        staleDetectedAt = null
      }
    }, 300000) // 5 minutes

    window.addEventListener('error', handleError)
    window.addEventListener('unhandledrejection', handleRejection)
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      window.removeEventListener('error', handleError)
      window.removeEventListener('unhandledrejection', handleRejection)
      document.removeEventListener('visibilitychange', handleVisibility)
      clearInterval(periodicCheck)
    }
  }, [pathname])

  return null
}
