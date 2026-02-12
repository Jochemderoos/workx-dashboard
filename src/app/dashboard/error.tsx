'use client'

import { useEffect } from 'react'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Dashboard error:', error)
  }, [error])

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="card max-w-md w-full p-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-4">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-400">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-white mb-2">Er ging iets mis</h2>
        <p className="text-sm text-gray-400 mb-6">
          Er is een onverwachte fout opgetreden. Probeer de pagina opnieuw te laden.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="btn-primary px-6 py-2.5"
          >
            Opnieuw proberen
          </button>
          <a
            href="/dashboard"
            className="btn-secondary px-6 py-2.5"
          >
            Naar dashboard
          </a>
        </div>
      </div>
    </div>
  )
}
