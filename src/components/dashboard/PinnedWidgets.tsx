'use client'

// Persoonlijke homepage-pins. Iedereen kan onderwerpen pinnen (bovenaan of als
// snelkoppeling lager op de pagina) en un-pinnen. Office-team (Hanna/Lotte/
// Bente) start standaard met de office-kernvakjes bovenaan.
//
// Wordt tweemaal gerenderd: zone="top" (bovenaan, incl. Aanpassen-knop) en
// zone="below" (snelkoppelingen lager). Bij opslaan verversen beide via een
// window-event.

import { useEffect, useState, useCallback, type DragEvent } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { Icons } from '@/components/ui/Icons'
import { PINNABLE_WIDGETS, PINNABLE_BY_KEY } from '@/lib/pinnable-widgets'

type Placement = 'top' | 'below'
interface Pin { widgetKey: string; placement: Placement; sortOrder: number }
type Draft = Record<string, 'off' | Placement>

const UPDATED_EVENT = 'dashboard-pins-updated'

function IconFor({ name, size = 18 }: { name: string; size?: number }) {
  const Icon = (Icons as unknown as Record<string, (p: { size?: number }) => JSX.Element>)[name] || Icons.fileText
  return <Icon size={size} />
}

export default function PinnedWidgets({ zone }: { zone: Placement }) {
  const [pins, setPins] = useState<Pin[] | null>(null)
  const [openDecl, setOpenDecl] = useState<number | null>(null)
  const [newMc, setNewMc] = useState<number | null>(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Draft>({})
  const [saving, setSaving] = useState(false)
  const [dragKey, setDragKey] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard-pins')
      if (res.ok) {
        const data = await res.json()
        setPins(Array.isArray(data.pins) ? data.pins : [])
      } else {
        setPins([])
      }
    } catch {
      setPins([])
    }
  }, [])

  useEffect(() => {
    load()
    const onUpdate = () => load()
    window.addEventListener(UPDATED_EVENT, onUpdate)
    return () => window.removeEventListener(UPDATED_EVENT, onUpdate)
  }, [load])

  // Badges (alleen echt nodig bij declaraties/mailchimp-tegels)
  useEffect(() => {
    fetch('/api/expenses?status=SUBMITTED')
      .then(r => (r.ok ? r.json() : []))
      .then((d: unknown) => setOpenDecl(Array.isArray(d) ? d.length : 0))
      .catch(() => setOpenDecl(0))
    fetch('/api/mailchimp-contacts')
      .then(r => (r.ok ? r.json() : null))
      .then((d: { contacts?: { addedToMailchimp: boolean; unsubscribed: boolean }[] } | null) => {
        const list = d?.contacts || []
        setNewMc(list.filter(c => !c.addedToMailchimp && !c.unsubscribed).length)
      })
      .catch(() => setNewMc(0))
  }, [])

  const openEditor = () => {
    const d: Draft = {}
    for (const p of pins || []) if (PINNABLE_BY_KEY[p.widgetKey]) d[p.widgetKey] = p.placement
    setDraft(d)
    setEditing(true)
  }

  const savePins = async () => {
    setSaving(true)
    const next: Pin[] = PINNABLE_WIDGETS
      .filter(w => draft[w.key] && draft[w.key] !== 'off')
      .map((w, i) => ({ widgetKey: w.key, placement: draft[w.key] as Placement, sortOrder: i }))
    try {
      const res = await fetch('/api/dashboard-pins', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pins: next }),
      })
      if (!res.ok) throw new Error()
      setPins(next)
      setEditing(false)
      window.dispatchEvent(new Event(UPDATED_EVENT))
      toast.success('Homepage bijgewerkt')
    } catch {
      toast.error('Kon pins niet opslaan')
    } finally {
      setSaving(false)
    }
  }

  // Sleep-herordenen binnen deze zone; volgorde direct opslaan.
  const handleDrop = async (targetKey: string) => {
    const current = pins || []
    if (!dragKey || dragKey === targetKey) { setDragKey(null); return }
    const zoneItems = current
      .filter(p => p.placement === zone && PINNABLE_BY_KEY[p.widgetKey])
      .sort((a, b) => a.sortOrder - b.sortOrder)
    const from = zoneItems.findIndex(p => p.widgetKey === dragKey)
    const to = zoneItems.findIndex(p => p.widgetKey === targetKey)
    setDragKey(null)
    if (from < 0 || to < 0) return
    const reordered = [...zoneItems]
    const [moved] = reordered.splice(from, 1)
    reordered.splice(to, 0, moved)
    const orderMap = new Map(reordered.map((p, i) => [p.widgetKey, i] as const))
    const updated = current.map(p =>
      p.placement === zone && orderMap.has(p.widgetKey) ? { ...p, sortOrder: orderMap.get(p.widgetKey)! } : p
    )
    setPins(updated)
    try {
      const res = await fetch('/api/dashboard-pins', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pins: updated.map(p => ({ widgetKey: p.widgetKey, placement: p.placement, sortOrder: p.sortOrder })) }),
      })
      if (!res.ok) throw new Error()
      window.dispatchEvent(new Event(UPDATED_EVENT))
    } catch {
      toast.error('Kon volgorde niet opslaan')
      load()
    }
  }

  const dragProps = (key: string) => ({
    draggable: true,
    dragging: dragKey === key,
    onDragStart: (e: DragEvent) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', key); setDragKey(key) },
    onDragOver: (e: DragEvent) => e.preventDefault(),
    onDrop: (e: DragEvent) => { e.preventDefault(); handleDrop(key) },
    onDragEnd: () => setDragKey(null),
  })

  const subFor = (w: (typeof PINNABLE_WIDGETS)[number]): { sub: string; badge: number | null } => {
    if (w.badge === 'declaraties') return { sub: openDecl === null ? 'laden…' : openDecl > 0 ? `${openDecl} open` : 'niets open', badge: openDecl || null }
    if (w.badge === 'mailchimp') return { sub: newMc === null ? 'laden…' : newMc > 0 ? `${newMc} nieuw` : 'niets nieuw', badge: newMc || null }
    return { sub: w.sub, badge: null }
  }

  const zonePins = (pins || [])
    .filter(p => p.placement === zone && PINNABLE_BY_KEY[p.widgetKey])
    .sort((a, b) => a.sortOrder - b.sortOrder)

  // 'below'-zone: toon niets als er geen snelkoppelingen zijn (en geen loader/knop).
  if (zone === 'below') {
    if (!pins || zonePins.length === 0) return null
    return (
      <div>
        <p className="text-[11px] uppercase tracking-wider text-white/40 mb-2 font-medium">Mijn snelkoppelingen</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {zonePins.map(p => {
            const w = PINNABLE_BY_KEY[p.widgetKey]
            const { sub, badge } = subFor(w)
            return <Tile key={w.key} w={w} sub={sub} badge={badge} {...dragProps(w.key)} />
          })}
        </div>
      </div>
    )
  }

  // 'top'-zone: strip + altijd een Aanpassen-knop.
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] uppercase tracking-wider text-white/40 font-medium">
          {zonePins.length > 0 ? 'Bovenaan gepind' : 'Homepage'}
        </p>
        <button
          onClick={openEditor}
          className="flex items-center gap-1.5 text-[11px] text-white/50 hover:text-workx-lime transition-colors"
        >
          <Icons.settings size={13} />
          Aanpassen
        </button>
      </div>

      {zonePins.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {zonePins.map(p => {
            const w = PINNABLE_BY_KEY[p.widgetKey]
            const { sub, badge } = subFor(w)
            return <Tile key={w.key} w={w} sub={sub} badge={badge} {...dragProps(w.key)} />
          })}
        </div>
      ) : (
        <button
          onClick={openEditor}
          className="w-full card p-4 flex items-center justify-center gap-2 text-sm text-white/50 hover:text-workx-lime hover:border-white/20 transition-colors border-dashed"
        >
          <Icons.plus size={16} />
          Onderwerpen pinnen op je homepage
        </button>
      )}

      {editing && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto" onClick={() => setEditing(false)}>
          <div className="w-full max-w-lg bg-workx-dark border border-white/10 rounded-2xl shadow-2xl my-8" onClick={e => e.stopPropagation()}>
            <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Homepage samenstellen</h2>
                <p className="text-xs text-white/50 mt-0.5">Kies wat je op je homepage wilt en waar.</p>
              </div>
              <button onClick={() => setEditing(false)} className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/10">
                <Icons.x size={18} />
              </button>
            </div>
            <div className="p-3 sm:p-4 max-h-[60vh] overflow-y-auto space-y-1.5">
              {PINNABLE_WIDGETS.map(w => {
                const state = draft[w.key] || 'off'
                return (
                  <div key={w.key} className="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.03]">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${w.color}`}>
                      <IconFor name={w.icon} size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-white truncate">{w.label}</p>
                      <p className="text-xs text-white/40 truncate">{w.sub}</p>
                    </div>
                    <div className="flex gap-1 flex-shrink-0 bg-white/5 rounded-lg p-0.5">
                      {([['off', 'Uit'], ['top', 'Bovenaan'], ['below', 'Niet bovenaan']] as const).map(([val, lbl]) => (
                        <button
                          key={val}
                          onClick={() => setDraft(prev => ({ ...prev, [w.key]: val }))}
                          className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
                            state === val ? 'bg-workx-lime text-workx-dark' : 'text-white/50 hover:text-white'
                          }`}
                        >
                          {lbl}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="p-4 border-t border-white/10 flex justify-end gap-2">
              <button onClick={() => setEditing(false)} className="btn-secondary">Annuleren</button>
              <button onClick={savePins} disabled={saving} className="btn-primary flex items-center gap-2 disabled:opacity-50">
                {saving ? <span className="w-4 h-4 border-2 border-workx-dark/30 border-t-workx-dark rounded-full animate-spin" /> : <Icons.check size={16} />}
                Opslaan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Tile({ w, sub, badge, draggable, dragging, onDragStart, onDragOver, onDrop, onDragEnd }: {
  w: (typeof PINNABLE_WIDGETS)[number]
  sub: string
  badge: number | null
  draggable?: boolean
  dragging?: boolean
  onDragStart?: (e: DragEvent) => void
  onDragOver?: (e: DragEvent) => void
  onDrop?: (e: DragEvent) => void
  onDragEnd?: () => void
}) {
  return (
    <Link
      href={w.href}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      title={draggable ? 'Sleep om de volgorde aan te passen' : undefined}
      className={`card p-4 flex items-center gap-3 hover:border-white/20 transition-colors group ${draggable ? 'cursor-grab active:cursor-grabbing' : ''} ${dragging ? 'opacity-40 ring-1 ring-workx-lime/40' : ''}`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${w.color}`}>
        <IconFor name={w.icon} size={18} />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-white group-hover:text-workx-lime transition-colors truncate">{w.label}</p>
        <p className="text-xs text-white/50 truncate">{sub}</p>
      </div>
      {badge ? <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full bg-white/10 text-white flex-shrink-0">{badge}</span> : null}
    </Link>
  )
}
