'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

/**
 * Detects stale JavaScript after Vercel deployments and auto-refreshes.
 *
 * Three strategies:
 * 1. Chunk load error detection: catches errors when old JS references missing chunks
 * 2. Tab-visibility refresh: checks build ID when tab becomes visible after 5+ minutes
 * 3. Periodic build-ID check: polls /api/version every 5 minutes to detect deploys
 *
 * IMPORTANT: Never auto-refreshes on the AI chat page (/dashboard/ai) to prevent
 * losing uploads, conversations, and in-progress work. Shows a non-intrusive
 * notification banner instead.
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
      banner.style.cssText = 'position:fixed;top:12px;right:12px;z-index:9999;padding:10px 16px;border-radius:12px;background:rgba(30,30,30,0.95);border:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.7);font-size:12px;display:flex;align-items:center;gap:10px;backdrop-filter:blur(8px);box-shadow:0 4px 20px rgba(0,0,0,0.3);'
      banner.innerHTML = `
        <span>Nieuwe versie beschikbaar</span>
        <button onclick="window.location.reload()" style="padding:4px 12px;border-radius:8px;background:rgba(249,255,133,0.15);border:1px solid rgba(249,255,133,0.3);color:rgb(249,255,133);font-size:11px;font-weight:600;cursor:pointer;">Ververs</button>
        <button onclick="this.parentElement.remove()" style="padding:2px 6px;border:none;background:none;color:rgba(255,255,255,0.3);cursor:pointer;font-size:14px;">&times;</button>
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
        // Only check after 5+ minutes hidden (was 30s — too aggressive)
        if (hiddenDuration > 5 * 60 * 1000) {
          const stale = await checkBuildVersion()
          if (stale) safeRefresh('workx-version-refresh', 120000)
        }
      }
    }

    // --- Strategy 3: Periodic build-ID version check (every 5 minutes, was 2) ---
    const periodicCheck = setInterval(async () => {
      if (document.hidden) return
      const stale = await checkBuildVersion()
      if (stale) safeRefresh('workx-version-refresh', 120000)
    }, 300000) // 5 minutes (was 2 minutes)

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
