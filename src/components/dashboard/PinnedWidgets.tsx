'use client'

// Persoonlijke homepage-pins. Iedereen kan onderwerpen pinnen (bovenaan of als
// snelkoppeling lager op de pagina) en un-pinnen. Office-team (Hanna/Lotte/
// Bente) start standaard met de office-kernvakjes bovenaan.
//
// Wordt tweemaal gerenderd: zone="top" (bovenaan, incl. Aanpassen-knop) en
// zone="below" (snelkoppelingen lager). Bij opslaan verversen beide via een
// window-event.

import { useEffect, useState, useCallback, type DragEvent } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { Icons } from '@/components/ui/Icons'
import { PINNABLE_WIDGETS, PINNABLE_BY_KEY } from '@/lib/pinnable-widgets'

type Placement = 'top' | 'below'
type CellState = 'off' | Placement
interface Pin { widgetKey: string; placement: Placement; sortOrder: number }
interface EditItem { key: string; placement: CellState }

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
  const [draftItems, setDraftItems] = useState<EditItem[]>([])
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
    const pinned = (pins || []).filter(p => PINNABLE_BY_KEY[p.widgetKey])
    const top = pinned.filter(p => p.placement === 'top').sort((a, b) => a.sortOrder - b.sortOrder)
    const below = pinned.filter(p => p.placement === 'below').sort((a, b) => a.sortOrder - b.sortOrder)
    const used = new Set([...top, ...below].map(p => p.widgetKey))
    setDraftItems([
      ...top.map(p => ({ key: p.widgetKey, placement: 'top' as CellState })),
      ...below.map(p => ({ key: p.widgetKey, placement: 'below' as CellState })),
      ...PINNABLE_WIDGETS.filter(w => !used.has(w.key)).map(w => ({ key: w.key, placement: 'off' as CellState })),
    ])
    setEditing(true)
  }

  const savePins = async () => {
    setSaving(true)
    const topItems = draftItems.filter(i => i.placement === 'top')
    const belowItems = draftItems.filter(i => i.placement === 'below')
    const next: Pin[] = [
      ...topItems.map((i, idx) => ({ widgetKey: i.key, placement: 'top' as Placement, sortOrder: idx })),
      ...belowItems.map((i, idx) => ({ widgetKey: i.key, placement: 'below' as Placement, sortOrder: idx })),
    ]
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

  // Aanpas-scherm: plaatsing zetten + rijen herordenen (sleep).
  const setPlacement = (key: string, placement: CellState) =>
    setDraftItems(prev => prev.map(i => (i.key === key ? { ...i, placement } : i)))

  const reorderRows = (targetKey: string) => {
    if (!dragKey || dragKey === targetKey) { setDragKey(null); return }
    setDraftItems(prev => {
      const from = prev.findIndex(i => i.key === dragKey)
      const to = prev.findIndex(i => i.key === targetKey)
      if (from < 0 || to < 0) return prev
      const arr = [...prev]
      const [moved] = arr.splice(from, 1)
      arr.splice(to, 0, moved)
      return arr
    })
    setDragKey(null)
  }

  const rowDrag = (key: string) => ({
    draggable: true,
    onDragStart: (e: DragEvent) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', key); setDragKey(key) },
    onDragOver: (e: DragEvent) => e.preventDefault(),
    onDrop: (e: DragEvent) => { e.preventDefault(); reorderRows(key) },
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
            return <Tile key={w.key} w={w} sub={sub} badge={badge} />
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
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-workx-lime/10 text-workx-lime text-xs font-medium border border-workx-lime/30 hover:bg-workx-lime/20 transition-colors"
        >
          <Icons.settings size={14} />
          Homepage aanpassen
        </button>
      </div>

      {zonePins.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {zonePins.map(p => {
            const w = PINNABLE_BY_KEY[p.widgetKey]
            const { sub, badge } = subFor(w)
            return <Tile key={w.key} w={w} sub={sub} badge={badge} />
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

      {editing && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto" onClick={() => setEditing(false)}>
          <div className="w-full max-w-lg bg-workx-dark border border-white/10 rounded-2xl shadow-2xl my-8" onClick={e => e.stopPropagation()}>
            <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Homepage samenstellen</h2>
                <p className="text-xs text-white/50 mt-0.5">Kies wat je wilt en waar — sleep om de volgorde te bepalen.</p>
              </div>
              <button onClick={() => setEditing(false)} className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/10">
                <Icons.x size={18} />
              </button>
            </div>
            <div className="p-3 sm:p-4 max-h-[60vh] overflow-y-auto space-y-1.5">
              {draftItems.map(item => {
                const w = PINNABLE_BY_KEY[item.key]
                if (!w) return null
                return (
                  <div
                    key={item.key}
                    {...rowDrag(item.key)}
                    className={`flex items-center gap-2 p-2.5 rounded-xl bg-white/[0.03] cursor-grab active:cursor-grabbing ${dragKey === item.key ? 'opacity-40 ring-1 ring-workx-lime/40' : ''}`}
                  >
                    <Icons.gripVertical size={16} className="text-white/30 flex-shrink-0" />
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
                          onClick={() => setPlacement(item.key, val)}
                          className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
                            item.placement === val ? 'bg-workx-lime text-workx-dark' : 'text-white/50 hover:text-white'
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
        </div>,
        document.body
      )}
    </div>
  )
}

function Tile({ w, sub, badge }: {
  w: (typeof PINNABLE_WIDGETS)[number]
  sub: string
  badge: number | null
}) {
  return (
    <Link
      href={w.href}
      className="card p-4 flex items-center gap-3 hover:border-white/20 transition-colors group">
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
