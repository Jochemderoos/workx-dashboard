'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Icons } from '@/components/ui/Icons'
import { CLIENT_RATES, type ClientRate } from '@/lib/client-rates'

interface SalaryScale {
  id: string
  experienceYear: number
  label: string
  salary: number
  hourlyRateBase: number
  hourlyRateMin: number | null
  hourlyRateMax: number | null
}

type Tab = 'standaard' | 'afwijkend'

const formatEur = (v: number, fractionDigits = 0) =>
  new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: 2,
  }).format(v)

export default function TarievenView() {
  const [tab, setTab] = useState<Tab>('standaard')
  const [scales, setScales] = useState<SalaryScale[]>([])
  const [loaded, setLoaded] = useState(false)
  const [filter, setFilter] = useState('')

  const fetchScales = useCallback(async () => {
    try {
      const res = await fetch('/api/financien/salary-scales')
      if (res.ok) setScales(await res.json())
    } catch {
      // silent
    } finally {
      setLoaded(true)
    }
  }, [])

  useEffect(() => { fetchScales() }, [fetchScales])

  const filteredClients = useMemo<ClientRate[]>(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return CLIENT_RATES
    return CLIENT_RATES.filter(c =>
      c.klant.toLowerCase().includes(q) ||
      c.tarieven.some(t => t.rol.toLowerCase().includes(q))
    )
  }, [filter])

  return (
    <section className="relative overflow-hidden rounded-3xl border" style={{
      borderColor: 'rgba(180, 185, 50, 0.35)',
      background: 'linear-gradient(135deg, rgba(249, 255, 133, 0.18), var(--color-bg-secondary) 70%)',
    }}>
      <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full blur-3xl pointer-events-none" style={{ background: 'rgba(249, 255, 133, 0.18)' }} />

      <div className="relative p-6 sm:p-10">
        {/* Header */}
        <div className="flex items-start gap-4 mb-6">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0" style={{
            background: 'rgba(249, 255, 133, 0.35)',
            border: '1px solid rgba(180, 185, 50, 0.4)',
          }}>
            💰
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-widest font-bold mb-1" style={{ color: 'rgb(140, 150, 30)' }}>
              Tarieven
            </p>
            <h2 className="text-3xl font-bold leading-tight" style={{ color: 'var(--color-text-primary)' }}>
              Uurtarieven Workx
            </h2>
            <p className="text-sm mt-2 max-w-2xl" style={{ color: 'var(--color-text-secondary)' }}>
              Basis: de standaard uurtarieven per ervaringsjaar (uit het salarishuis).
              Klanten met afwijkende afspraken vind je op het tweede tabblad.
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="inline-flex items-center gap-1 p-1 rounded-xl mb-5" style={{
          background: 'var(--color-bg-glass)',
          border: '1px solid var(--color-border)',
        }}>
          <button
            onClick={() => setTab('standaard')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
              tab === 'standaard' ? '' : ''
            }`}
            style={tab === 'standaard'
              ? { background: 'rgb(249, 255, 133)', color: 'rgb(45, 45, 45)' }
              : { color: 'var(--color-text-secondary)' }}
          >
            <Icons.layers size={14} />
            Standaard tarieven
          </button>
          <button
            onClick={() => setTab('afwijkend')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2`}
            style={tab === 'afwijkend'
              ? { background: 'rgb(249, 255, 133)', color: 'rgb(45, 45, 45)' }
              : { color: 'var(--color-text-secondary)' }}
          >
            <Icons.users size={14} />
            Afwijkende klant-tarieven
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-black/20">{CLIENT_RATES.length}</span>
          </button>
        </div>

        {/* Disclaimer */}
        <div className="mb-6 rounded-2xl border-2 p-4 flex items-start gap-3" style={{
          background: 'rgba(249, 255, 133, 0.12)',
          borderColor: 'rgba(180, 185, 50, 0.5)',
        }}>
          <span className="text-2xl shrink-0">⚠️</span>
          <div className="flex-1">
            <p className="text-sm font-bold mb-1" style={{ color: 'var(--color-text-primary)' }}>
              Indicatieve tarieven
            </p>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
              Standaardtarieven volgen uit het salarishuis. Afwijkende klant-tarieven worden door Hanna onderhouden — controleer altijd de meest recente afspraak per klant.
            </p>
          </div>
        </div>

        {/* Tab content */}
        {tab === 'standaard' ? (
          /* ── Standaard tarieven ────────────────── */
          !loaded ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: 'rgba(180, 185, 50, 0.3)', borderTopColor: 'rgb(180, 185, 50)' }} />
            </div>
          ) : scales.length === 0 ? (
            <div className="rounded-2xl p-12 text-center" style={{
              background: 'var(--color-bg-card)',
              border: '1px dashed var(--color-border)',
            }}>
              <span className="text-5xl block mb-3">💰</span>
              <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
                Nog geen salarisschaal geladen — laad eerst het salarishuis.
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border overflow-hidden" style={{
              background: 'var(--color-bg-card)',
              borderColor: 'var(--color-border-subtle)',
            }}>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ background: 'var(--color-bg-glass)', borderBottom: '1px solid var(--color-border-subtle)' }}>
                      <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgb(140, 150, 30)' }}>Ervaringsjaar</th>
                      <th className="text-right py-3 px-4 text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgb(140, 150, 30)' }}>Standaard uurtarief</th>
                      <th className="text-right py-3 px-4 text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgb(140, 150, 30)' }}>Range</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scales.map((scale, idx) => (
                      <tr
                        key={scale.id}
                        style={{
                          background: idx % 2 === 0 ? 'var(--color-bg-glass)' : 'transparent',
                          borderBottom: '1px solid var(--color-border-subtle)',
                        }}
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shrink-0" style={{
                              background: 'rgba(249, 255, 133, 0.30)',
                              color: 'rgb(140, 150, 30)',
                            }}>
                              {scale.experienceYear}
                            </div>
                            <span className="font-medium" style={{ color: 'var(--color-text-primary)' }}>{scale.label}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="font-bold tabular-nums" style={{ color: 'rgb(140, 150, 30)' }}>€{scale.hourlyRateBase}</span>
                          <span className="ml-1 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>/uur</span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          {scale.hourlyRateMin && scale.hourlyRateMax ? (
                            <span className="text-sm tabular-nums" style={{ color: 'var(--color-text-secondary)' }}>
                              €{scale.hourlyRateMin} – €{scale.hourlyRateMax}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--color-text-tertiary)' }}>—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        ) : (
          /* ── Afwijkende klant-tarieven ─────────── */
          <div className="space-y-4">
            {/* Filter */}
            <div className="relative max-w-xs">
              <Icons.search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter op klant of rol…"
                className="w-full rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none"
                style={{
                  background: 'var(--color-bg-glass)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text-primary)',
                }}
              />
            </div>

            {/* Client cards grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredClients.map((client) => (
                <div
                  key={client.klant}
                  className="rounded-2xl p-5 border space-y-3"
                  style={{
                    background: 'var(--color-bg-card)',
                    borderColor: 'var(--color-border-subtle)',
                  }}
                >
                  {/* Klant header */}
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <h3 className="font-semibold text-base" style={{ color: 'var(--color-text-primary)' }}>{client.klant}</h3>
                      <p className="text-[11px] uppercase tracking-wider mt-0.5" style={{ color: 'rgb(140, 150, 30)' }}>
                        Vanaf {client.vanaf}
                      </p>
                    </div>
                  </div>

                  {/* Vast bedrag (alternatief voor uurtarief) */}
                  {client.vast && (
                    <div className="rounded-xl px-3 py-2 flex items-center justify-between" style={{
                      background: 'rgba(249, 255, 133, 0.10)',
                      border: '1px solid rgba(180, 185, 50, 0.3)',
                    }}>
                      <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{client.vast.label}</span>
                      <span className="font-bold tabular-nums" style={{ color: 'rgb(140, 150, 30)' }}>
                        {formatEur(client.vast.bedrag)}
                      </span>
                    </div>
                  )}

                  {/* Tarieven-lijst */}
                  {client.tarieven.length > 0 && (
                    <div className="space-y-1">
                      {client.tarieven.map((t, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between py-1.5 px-2 rounded-lg"
                          style={{ background: i % 2 === 0 ? 'var(--color-bg-glass)' : 'transparent' }}
                        >
                          <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{t.rol}</span>
                          {t.tarief !== null ? (
                            <span className="font-semibold tabular-nums" style={{ color: 'var(--color-text-primary)' }}>
                              {formatEur(t.tarief, t.tarief % 1 === 0 ? 0 : 2)}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--color-text-tertiary)' }}>—</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Notes */}
                  {client.notes && client.notes.length > 0 && (
                    <div className="pt-2 border-t space-y-1" style={{ borderColor: 'var(--color-border-subtle)' }}>
                      {client.notes.map((n, i) => (
                        <p key={i} className="text-xs italic" style={{ color: 'var(--color-text-tertiary)' }}>
                          {n}
                        </p>
                      ))}
                    </div>
                  )}

                  {/* Opmerking — als waarschuwing */}
                  {client.opmerking && (
                    <div className="rounded-lg px-3 py-2 flex items-start gap-2" style={{
                      background: 'rgba(251, 191, 36, 0.08)',
                      border: '1px solid rgba(251, 191, 36, 0.25)',
                    }}>
                      <Icons.info size={14} className="text-amber-400 mt-0.5 flex-shrink-0" />
                      <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                        {client.opmerking}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {filteredClients.length === 0 && (
              <div className="rounded-2xl p-12 text-center" style={{
                background: 'var(--color-bg-card)',
                border: '1px dashed var(--color-border)',
              }}>
                <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
                  Geen klanten gevonden voor "{filter}"
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
