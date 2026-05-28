'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { Icons } from '@/components/ui/Icons'

interface JarSession {
  id: string
  date: string
  name: string
}

export default function JarReminderWidget() {
  const { data: session } = useSession()
  const userName = session?.user?.name || ''
  const [next, setNext] = useState<JarSession | null>(null)
  const [loaded, setLoaded] = useState(false)

  const fetchData = useCallback(async () => {
    if (!userName) {
      setLoaded(true)
      return
    }
    try {
      const year = new Date().getFullYear()
      const res = await fetch(`/api/jar-sessions?year=${year}`)
      if (!res.ok) {
        setLoaded(true)
        return
      }
      const sessions: JarSession[] = await res.json()
      const firstName = userName.split(' ')[0].toLowerCase()
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const upcoming = sessions
        .map(s => {
          const d = new Date(s.date)
          d.setHours(0, 0, 0, 0)
          return { ...s, diff: Math.floor((d.getTime() - today.getTime()) / 86400000) }
        })
        .filter(s => s.diff >= 0 && s.name.split(' ')[0].toLowerCase() === firstName)
        .sort((a, b) => a.diff - b.diff)
      setNext(upcoming[0] || null)
    } catch {
      // silent
    } finally {
      setLoaded(true)
    }
  }, [userName])

  useEffect(() => { fetchData() }, [fetchData])

  if (!loaded || !next) return null

  const sessionDate = new Date(next.date)
  const diff = Math.floor((sessionDate.getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000)
  // Toon alleen als binnen 30 dagen
  if (diff > 30) return null

  const isUrgent = diff <= 14
  const isVeryUrgent = diff <= 7

  return (
    <div className="rounded-2xl border p-5" style={{
      background: isVeryUrgent
        ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.15), var(--color-bg-secondary) 70%)'
        : isUrgent
          ? 'linear-gradient(135deg, rgba(249, 255, 133, 0.18), var(--color-bg-secondary) 70%)'
          : 'var(--color-bg-card)',
      borderColor: isVeryUrgent
        ? 'rgba(239, 68, 68, 0.4)'
        : isUrgent
          ? 'rgba(180, 185, 50, 0.4)'
          : 'var(--color-border-subtle)',
    }}>
      <div className="flex items-start gap-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 ${isVeryUrgent ? 'animate-pulse' : ''}`} style={{
          background: isVeryUrgent ? 'rgba(239, 68, 68, 0.20)' : 'rgba(249, 255, 133, 0.30)',
          border: `1px solid ${isVeryUrgent ? 'rgba(239, 68, 68, 0.5)' : 'rgba(180, 185, 50, 0.4)'}`,
        }}>
          ⚖️
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] uppercase tracking-widest font-bold mb-0.5" style={{
            color: isVeryUrgent ? 'rgb(239, 68, 68)' : 'rgb(140, 150, 30)',
          }}>
            Jouw JAR-beurt
          </p>
          <h3 className="text-base font-bold" style={{ color: 'var(--color-text-primary)' }}>
            {sessionDate.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })}
          </h3>
          <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
            {diff === 0 && '🚨 Vandaag — 16:00 in de bibliotheek'}
            {diff > 0 && isVeryUrgent && `Over ${diff} ${diff === 1 ? 'dag' : 'dagen'} — tijd om je voor te bereiden!`}
            {diff > 7 && diff <= 14 && `Nog ${diff} dagen — begin met voorbereiden`}
            {diff > 14 && `Nog ${diff} dagen tot je JAR-beurt`}
          </p>
        </div>
        <Link
          href="/dashboard/opleidingen"
          className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors shrink-0"
          style={{
            background: isVeryUrgent ? 'rgba(239, 68, 68, 0.20)' : 'rgba(249, 255, 133, 0.25)',
            color: isVeryUrgent ? 'rgb(239, 68, 68)' : 'rgb(140, 150, 30)',
          }}
        >
          Bekijk rooster
        </Link>
      </div>
    </div>
  )
}
