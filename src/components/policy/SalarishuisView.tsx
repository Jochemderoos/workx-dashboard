'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'
import { Icons } from '@/components/ui/Icons'

interface SalaryScale {
  id: string
  experienceYear: number
  label: string
  salary: number
  hourlyRateBase: number
  hourlyRateMin: number | null
  hourlyRateMax: number | null
}

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v)

export default function SalarishuisView() {
  const { data: session } = useSession()
  const role = (session?.user as { role?: string })?.role
  const isManager = role === 'PARTNER' || role === 'ADMIN'

  const [scales, setScales] = useState<SalaryScale[]>([])
  const [loaded, setLoaded] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [bulkEdit, setBulkEdit] = useState(false)

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

  const seedScales = async () => {
    try {
      const res = await fetch('/api/financien/salary-scales/seed', { method: 'POST' })
      if (res.ok) fetchScales()
      else toast.error('Kon schaal niet laden')
    } catch {
      toast.error('Kon schaal niet laden')
    }
  }

  const saveScale = async (scale: SalaryScale, patch: Partial<SalaryScale>) => {
    try {
      await fetch('/api/financien/salary-scales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...scale, ...patch }),
      })
      fetchScales()
      setEditing(null)
    } catch {
      toast.error('Kon niet opslaan')
    }
  }

  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: 'rgba(180, 185, 50, 0.3)', borderTopColor: 'rgb(180, 185, 50)' }} />
      </div>
    )
  }

  return (
    <section className="relative overflow-hidden rounded-3xl border" style={{
      borderColor: 'rgba(180, 185, 50, 0.35)',
      background: 'linear-gradient(135deg, rgba(249, 255, 133, 0.18), var(--color-bg-secondary) 70%)',
    }}>
      <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full blur-3xl pointer-events-none" style={{ background: 'rgba(249, 255, 133, 0.18)' }} />

      <div className="relative p-6 sm:p-10">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0" style={{
              background: 'rgba(249, 255, 133, 0.35)',
              border: '1px solid rgba(180, 185, 50, 0.4)',
            }}>
              💶
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-widest font-bold mb-1" style={{ color: 'rgb(140, 150, 30)' }}>
                Salarishuis
              </p>
              <h2 className="text-3xl font-bold leading-tight" style={{ color: 'var(--color-text-primary)' }}>
                Tarieven per ervaringsjaar
              </h2>
              <p className="text-sm mt-2 max-w-2xl" style={{ color: 'var(--color-text-secondary)' }}>
                Het salarishuis van Workx Advocaten. Alle medewerkers gaan per 1 maart elk jaar automatisch een stap omhoog.
              </p>
            </div>
          </div>
          {isManager && scales.length > 0 && (
            <button
              onClick={() => { setBulkEdit(b => !b); if (bulkEdit) setEditing(null) }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors"
              style={{
                background: bulkEdit ? 'rgb(249, 255, 133)' : 'var(--color-bg-glass)',
                color: bulkEdit ? 'rgb(45, 45, 45)' : 'var(--color-text-secondary)',
                border: '1px solid var(--color-border)',
              }}
            >
              <Icons.edit size={14} />
              {bulkEdit ? 'Klaar' : 'Bewerken'}
            </button>
          )}
        </div>

        {/* Indicatief-disclaimer */}
        <div className="mb-6 rounded-2xl border-2 p-4 flex items-start gap-3" style={{
          background: 'rgba(249, 255, 133, 0.12)',
          borderColor: 'rgba(180, 185, 50, 0.5)',
        }}>
          <span className="text-2xl shrink-0">⚠️</span>
          <div className="flex-1">
            <p className="text-sm font-bold mb-1" style={{ color: 'var(--color-text-primary)' }}>
              Indicatief salarishuis
            </p>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
              Dit overzicht is <strong>indicatief</strong> en kan worden gewijzigd. Bedragen geven een richtlijn per ervaringsjaar; werkelijke salarissen worden bepaald in de arbeidsovereenkomst.
            </p>
          </div>
        </div>

        {scales.length === 0 ? (
          <div className="rounded-2xl p-12 text-center" style={{
            background: 'var(--color-bg-card)',
            border: '1px dashed var(--color-border)',
          }}>
            <span className="text-5xl block mb-3">💶</span>
            <p className="text-sm mb-4" style={{ color: 'var(--color-text-tertiary)' }}>Nog geen salarisschaal geladen</p>
            {isManager && (
              <button
                onClick={seedScales}
                className="px-4 py-2 rounded-xl font-semibold text-sm transition-colors"
                style={{ background: 'rgb(249, 255, 133)', color: 'rgb(45, 45, 45)' }}
              >
                Standaard schaal laden
              </button>
            )}
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
                    <th className="text-right py-3 px-4 text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgb(140, 150, 30)' }}>Bruto Salaris</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgb(140, 150, 30)' }}>Uurtarief</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgb(140, 150, 30)' }}>Range</th>
                    {bulkEdit && <th className="w-12"></th>}
                  </tr>
                </thead>
                <tbody>
                  {scales.map((scale, idx) => {
                    const isEditingRow = editing === scale.id
                    return (
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
                          {isEditingRow ? (
                            <input
                              type="number"
                              id={`salary-${scale.id}`}
                              defaultValue={scale.salary}
                              className="rounded-md px-2 py-1 text-sm w-28 text-right focus:outline-none"
                              style={{ background: 'var(--color-bg-glass)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
                            />
                          ) : (
                            <>
                              <span className="font-bold tabular-nums" style={{ color: 'var(--color-text-primary)' }}>{formatCurrency(scale.salary)}</span>
                              <span className="ml-1 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>/mnd</span>
                            </>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {isEditingRow ? (
                            <input
                              type="number"
                              id={`hourlyRate-${scale.id}`}
                              defaultValue={scale.hourlyRateBase}
                              className="rounded-md px-2 py-1 text-sm w-20 text-right focus:outline-none"
                              style={{ background: 'var(--color-bg-glass)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
                            />
                          ) : (
                            <span className="font-bold tabular-nums" style={{ color: 'rgb(140, 150, 30)' }}>€{scale.hourlyRateBase}</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {isEditingRow ? (
                            <div className="flex items-center justify-end gap-1">
                              <input
                                type="number"
                                id={`rateMin-${scale.id}`}
                                defaultValue={scale.hourlyRateMin || ''}
                                placeholder="min"
                                className="rounded-md px-2 py-1 text-sm w-16 text-right focus:outline-none"
                                style={{ background: 'var(--color-bg-glass)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
                              />
                              <span style={{ color: 'var(--color-text-tertiary)' }}>–</span>
                              <input
                                type="number"
                                id={`rateMax-${scale.id}`}
                                defaultValue={scale.hourlyRateMax || ''}
                                placeholder="max"
                                className="rounded-md px-2 py-1 text-sm w-16 text-right focus:outline-none"
                                style={{ background: 'var(--color-bg-glass)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
                              />
                            </div>
                          ) : scale.hourlyRateMin && scale.hourlyRateMax ? (
                            <span className="text-sm tabular-nums" style={{ color: 'var(--color-text-secondary)' }}>
                              €{scale.hourlyRateMin} – €{scale.hourlyRateMax}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--color-text-tertiary)' }}>—</span>
                          )}
                        </td>
                        {bulkEdit && (
                          <td className="py-3 px-2">
                            {isEditingRow ? (
                              <div className="flex gap-1">
                                <button
                                  onClick={() => {
                                    const salary = (document.getElementById(`salary-${scale.id}`) as HTMLInputElement).value
                                    const rate = (document.getElementById(`hourlyRate-${scale.id}`) as HTMLInputElement).value
                                    const min = (document.getElementById(`rateMin-${scale.id}`) as HTMLInputElement).value
                                    const max = (document.getElementById(`rateMax-${scale.id}`) as HTMLInputElement).value
                                    saveScale(scale, {
                                      salary: parseFloat(salary) || scale.salary,
                                      hourlyRateBase: parseFloat(rate) || scale.hourlyRateBase,
                                      hourlyRateMin: parseFloat(min) || null,
                                      hourlyRateMax: parseFloat(max) || null,
                                    })
                                  }}
                                  className="p-1.5 rounded-md transition-colors"
                                  style={{ background: 'rgb(249, 255, 133)', color: 'rgb(45, 45, 45)' }}
                                  title="Opslaan"
                                >
                                  <Icons.check size={12} />
                                </button>
                                <button
                                  onClick={() => setEditing(null)}
                                  className="p-1.5 rounded-md transition-colors"
                                  style={{ background: 'var(--color-bg-glass)', color: 'var(--color-text-tertiary)' }}
                                >
                                  <Icons.x size={12} />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setEditing(scale.id)}
                                className="p-1.5 rounded-md transition-colors"
                                style={{ color: 'var(--color-text-tertiary)' }}
                                title="Bewerken"
                              >
                                <Icons.edit size={12} />
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
