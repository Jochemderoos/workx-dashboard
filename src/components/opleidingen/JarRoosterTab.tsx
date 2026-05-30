'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'
import { Icons } from '@/components/ui/Icons'
import { getPhotoUrl } from '@/lib/team-photos'

interface JarSession {
  id: string
  date: string
  name: string
  year: number
  notes: string | null
}

interface TeamMember {
  id: string
  name: string
  isActive?: boolean
}

interface JarRoosterTabProps {
  year: number
}

export default function JarRoosterTab({ year }: JarRoosterTabProps) {
  const { data: session } = useSession()
  const userName = session?.user?.name || ''

  const [sessions, setSessions] = useState<JarSession[]>([])
  const [team, setTeam] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [editingNameId, setEditingNameId] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const [sRes, tRes] = await Promise.all([
        fetch(`/api/jar-sessions?year=${year}`),
        fetch('/api/team'),
      ])
      if (sRes.ok) setSessions(await sRes.json())
      if (tRes.ok) {
        const teamData = await tRes.json()
        setTeam(teamData.filter((u: TeamMember) => u.isActive !== false))
      }
    } catch {
      toast.error('Kon data niet laden')
    } finally {
      setLoading(false)
    }
  }, [year])

  useEffect(() => { fetchData() }, [fetchData])

  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  const enriched = useMemo(() => {
    return sessions.map(s => {
      const d = new Date(s.date)
      d.setHours(0, 0, 0, 0)
      const diffDays = Math.floor((d.getTime() - today.getTime()) / 86400000)
      return { ...s, diffDays, dateObj: d }
    })
  }, [sessions, today])

  const nextSession = useMemo(() => {
    return enriched.find(s => s.diffDays >= 0) || null
  }, [enriched])

  // Volgende sessie waar huidige user verantwoordelijk is
  const userNextSession = useMemo(() => {
    if (!userName) return null
    const firstName = userName.split(' ')[0].toLowerCase()
    return enriched.find(s => {
      if (s.diffDays < 0) return false
      const sFirstName = s.name.split(' ')[0].toLowerCase()
      return sFirstName === firstName
    })
  }, [enriched, userName])

  const updateName = async (id: string, newName: string) => {
    setSessions(prev => prev.map(s => s.id === id ? { ...s, name: newName } : s))
    setEditingNameId(null)
    try {
      const res = await fetch(`/api/jar-sessions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName }),
      })
      if (!res.ok) throw new Error()
    } catch {
      toast.error('Kon niet opslaan')
      fetchData()
    }
  }

  const swap = async (sessionA: JarSession, swapWithName: string) => {
    if (!confirm(`'${sessionA.name}' ruilen met '${swapWithName}'?\n\nDan presenteert ${swapWithName} op ${new Date(sessionA.date).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' })}, en ${sessionA.name} neemt de eerstvolgende beurt van ${swapWithName} over.`)) return
    // Vind sessie waar swapWithName presenteert (eerstvolgende)
    const futureSwap = enriched.find(s => {
      if (s.id === sessionA.id) return false
      if (s.diffDays < 0) return false
      return s.name.split(' ')[0].toLowerCase() === swapWithName.split(' ')[0].toLowerCase()
    })
    if (!futureSwap) {
      toast.error(`Kan geen toekomstige sessie van ${swapWithName} vinden — gebruik 'bewerken' op de andere sessie zelf.`)
      return
    }
    // Wissel
    try {
      await Promise.all([
        fetch(`/api/jar-sessions/${sessionA.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: swapWithName }),
        }),
        fetch(`/api/jar-sessions/${futureSwap.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: sessionA.name }),
        }),
      ])
      toast.success('Geruild!')
      fetchData()
    } catch {
      toast.error('Kon niet ruilen')
      fetchData()
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: 'rgba(180, 185, 50, 0.3)', borderTopColor: 'rgb(180, 185, 50)' }} />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border p-6 sm:p-8" style={{
        borderColor: 'rgba(180, 185, 50, 0.35)',
        background: 'linear-gradient(135deg, rgba(249, 255, 133, 0.18), var(--color-bg-secondary) 70%)',
      }}>
        <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full blur-3xl pointer-events-none" style={{ background: 'rgba(249, 255, 133, 0.18)' }} />
        <div className="relative flex items-start gap-4 flex-wrap">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0" style={{
            background: 'rgba(249, 255, 133, 0.35)',
            border: '1px solid rgba(180, 185, 50, 0.4)',
          }}>
            ⚖️
          </div>
          <div className="flex-1 min-w-[260px]">
            <p className="text-[11px] uppercase tracking-widest font-bold mb-1" style={{ color: 'rgb(140, 150, 30)' }}>
              JAR Rooster · {year}
            </p>
            <h2 className="text-3xl font-bold leading-tight" style={{ color: 'var(--color-text-primary)' }}>
              Jurisprudentie Arbeidsrecht
            </h2>
            <p className="text-sm mt-2 max-w-2xl" style={{ color: 'var(--color-text-secondary)' }}>
              Elke 3 weken op donderdag, 16:00–17:15. Klik op een naam om te wijzigen of te ruilen.
            </p>
          </div>
        </div>
      </section>

      {/* Volgende beurt voor jou */}
      {userNextSession && (
        <div className="rounded-2xl p-5 border-2 flex items-start gap-4" style={{
          background: userNextSession.diffDays <= 14
            ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.15), var(--color-bg-secondary) 70%)'
            : 'linear-gradient(135deg, rgba(249, 255, 133, 0.15), var(--color-bg-secondary) 70%)',
          borderColor: userNextSession.diffDays <= 14 ? 'rgba(239, 68, 68, 0.4)' : 'rgba(180, 185, 50, 0.4)',
        }}>
          <div className="text-3xl shrink-0">
            {userNextSession.diffDays <= 14 ? '⏰' : '🎯'}
          </div>
          <div className="flex-1">
            <p className="text-[11px] uppercase tracking-widest font-bold mb-0.5" style={{
              color: userNextSession.diffDays <= 14 ? 'rgb(239, 68, 68)' : 'rgb(140, 150, 30)',
            }}>
              Jouw volgende JAR-beurt
            </p>
            <h3 className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>
              {new Date(userNextSession.date).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </h3>
            <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
              {userNextSession.diffDays === 0 && '🚨 Vandaag!'}
              {userNextSession.diffDays > 0 && userNextSession.diffDays <= 14 && `Nog ${userNextSession.diffDays} dagen — tijd om je voor te bereiden`}
              {userNextSession.diffDays > 14 && `Nog ${userNextSession.diffDays} dagen`}
            </p>
          </div>
        </div>
      )}

      {/* Eerstvolgende sessie (algemeen) */}
      {!userNextSession && nextSession && (
        <div className="rounded-2xl p-5 border" style={{
          background: 'var(--color-bg-card)',
          borderColor: 'var(--color-border-subtle)',
        }}>
          <div className="flex items-center gap-4">
            <div className="text-3xl shrink-0">📅</div>
            <div className="flex-1">
              <p className="text-[11px] uppercase tracking-widest font-bold mb-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
                Eerstvolgende JAR-bespreking
              </p>
              <h3 className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>
                <span style={{ color: 'rgb(140, 150, 30)' }}>{nextSession.name}</span>
                <span className="text-sm ml-2 font-normal" style={{ color: 'var(--color-text-secondary)' }}>
                  · {new Date(nextSession.date).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })}
                </span>
              </h3>
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
                {nextSession.diffDays === 0 ? 'Vandaag' : `Over ${nextSession.diffDays} ${nextSession.diffDays === 1 ? 'dag' : 'dagen'}`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Het volledige rooster */}
      <div className="rounded-2xl border overflow-hidden" style={{
        background: 'var(--color-bg-card)',
        borderColor: 'var(--color-border-subtle)',
      }}>
        <div className="px-5 py-3 flex items-center justify-between" style={{
          background: 'var(--color-bg-glass)',
          borderBottom: '1px solid var(--color-border-subtle)',
        }}>
          <h3 className="text-sm font-bold uppercase tracking-widest" style={{ color: 'rgb(140, 150, 30)' }}>
            Rooster {year}
          </h3>
          <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
            {sessions.length} sessies
          </span>
        </div>

        <ul className="divide-y" style={{ borderColor: 'var(--color-border-subtle)' }}>
          {enriched.map(s => {
            const isPast = s.diffDays < 0
            const isNext = nextSession?.id === s.id
            const isMine = userNextSession?.id === s.id
            const isEditing = editingNameId === s.id
            const photo = getPhotoUrl(s.name)
            return (
              <li
                key={s.id}
                className="px-5 py-3 flex items-center gap-4 group"
                style={{
                  background: isMine
                    ? 'rgba(249, 255, 133, 0.10)'
                    : isNext
                      ? 'rgba(249, 255, 133, 0.04)'
                      : 'transparent',
                  opacity: isPast ? 0.45 : 1,
                }}
              >
                {/* Datum-blok */}
                <div className="w-16 text-center shrink-0">
                  <p className="text-[10px] uppercase tracking-wider font-medium" style={{ color: 'var(--color-text-tertiary)' }}>
                    {new Date(s.date).toLocaleDateString('nl-NL', { month: 'short' })}
                  </p>
                  <p className={`text-2xl font-bold tabular-nums`} style={{
                    color: isMine ? 'rgb(140, 150, 30)' : isNext ? 'rgb(140, 150, 30)' : 'var(--color-text-primary)',
                  }}>
                    {new Date(s.date).getDate()}
                  </p>
                  <p className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>
                    {new Date(s.date).toLocaleDateString('nl-NL', { weekday: 'short' })}
                  </p>
                </div>

                {/* Naam / dropdown */}
                <div className="flex-1 min-w-0">
                  {isEditing ? (
                    <select
                      autoFocus
                      value={s.name}
                      onChange={(e) => updateName(s.id, e.target.value)}
                      onBlur={() => setEditingNameId(null)}
                      className="rounded-lg px-3 py-1.5 text-sm font-medium focus:outline-none"
                      style={{ background: 'var(--color-bg-glass)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
                    >
                      <option value={s.name}>{s.name}</option>
                      {team.filter(m => m.name !== s.name).map(m => (
                        <option key={m.id} value={m.name}>{m.name}</option>
                      ))}
                    </select>
                  ) : (
                    <button
                      onClick={() => setEditingNameId(s.id)}
                      className="flex items-center gap-2 text-left hover:opacity-80 transition-opacity"
                      title="Klik om te wijzigen"
                    >
                      {photo ? (
                        <img loading="lazy" src={photo} alt={s.name} className="w-9 h-9 rounded-xl object-cover ring-1 ring-workx-lime/30" />
                      ) : (
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold" style={{
                          background: 'rgba(249, 255, 133, 0.25)',
                          color: 'rgb(140, 150, 30)',
                        }}>
                          {s.name.charAt(0)}
                        </div>
                      )}
                      <span className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                        {s.name}
                      </span>
                      {isMine && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider" style={{
                          background: 'rgba(249, 255, 133, 0.35)', color: 'rgb(140, 150, 30)',
                        }}>
                          Jij
                        </span>
                      )}
                      {isPast && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full" style={{
                          background: 'var(--color-bg-glass)', color: 'var(--color-text-tertiary)',
                        }}>
                          ✓ Gehad
                        </span>
                      )}
                    </button>
                  )}
                </div>

                {/* Quick-swap dropdown */}
                {!isPast && !isEditing && (
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <select
                      defaultValue=""
                      onChange={(e) => {
                        if (e.target.value) {
                          swap(s, e.target.value)
                          e.target.value = ''
                        }
                      }}
                      className="text-xs rounded-lg px-2 py-1 focus:outline-none"
                      style={{ background: 'var(--color-bg-glass)', border: '1px solid var(--color-border-subtle)', color: 'var(--color-text-secondary)' }}
                      title="Ruil met andere collega"
                    >
                      <option value="">Ruil met…</option>
                      {team.filter(m => m.name !== s.name).map(m => (
                        <option key={m.id} value={m.name}>{m.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </div>

      <p className="text-[11px] italic" style={{ color: 'var(--color-text-tertiary)' }}>
        💡 Tip: klik op een naam om snel te wijzigen, of gebruik de "Ruil met…" dropdown om met een collega van beurt te ruilen. Iedereen krijgt 14 dagen voor zijn/haar JAR-beurt een belletje-melding.
      </p>
    </div>
  )
}
