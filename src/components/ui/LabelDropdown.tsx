'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Icons } from '@/components/ui/Icons'

export interface LabelOption {
  key: string
  label: string
}

interface LabelDropdownProps {
  value: string
  options: LabelOption[]
  onChange: (key: string) => void
  size?: 'sm' | 'md'
  className?: string
  tone?: 'amber' | 'purple'
}

// Compacte ronde dropdown. Het menu rendert via een portal (document.body) met
// vaste positionering, zodat het nooit door een kaart/overflow wordt geclipt en
// altijd goed scrollt. Klapt omhoog als er onderaan te weinig ruimte is.
export default function LabelDropdown({
  value,
  options,
  onChange,
  size = 'sm',
  className = '',
  tone = 'amber',
}: LabelDropdownProps) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number; width: number; maxH: number }>({ top: 0, left: 0, width: 0, maxH: 288 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const selected = options.find(o => o.key === value) || options[0]

  const reposition = useCallback(() => {
    const el = triggerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const estH = Math.min(288, options.length * 30 + 8)
    const spaceBelow = window.innerHeight - r.bottom - 8
    const spaceAbove = r.top - 8
    const up = spaceBelow < estH && spaceAbove > spaceBelow
    const maxH = Math.max(120, Math.min(288, up ? spaceAbove : spaceBelow))
    setPos({
      top: up ? r.top - Math.min(estH, maxH) - 4 : r.bottom + 4,
      left: r.left,
      width: r.width,
      maxH,
    })
  }, [options.length])

  useEffect(() => {
    if (!open) return
    reposition()
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node
      if (triggerRef.current?.contains(t) || menuRef.current?.contains(t)) return
      setOpen(false)
    }
    const onMove = () => reposition()
    document.addEventListener('mousedown', onDoc)
    window.addEventListener('scroll', onMove, true)
    window.addEventListener('resize', onMove)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      window.removeEventListener('scroll', onMove, true)
      window.removeEventListener('resize', onMove)
    }
  }, [open, reposition])

  const hoverBorder = tone === 'amber' ? 'hover:border-amber-500/30' : 'hover:border-purple-500/30'
  const selBg = tone === 'amber' ? 'bg-amber-500/10 text-amber-200' : 'bg-purple-500/10 text-purple-200'

  const triggerCls = size === 'sm'
    ? `flex items-center gap-1.5 text-xs px-2 py-1 rounded-md bg-white/[0.04] border border-white/10 ${hoverBorder} hover:bg-white/[0.08] text-gray-300 transition-colors`
    : `flex items-center gap-2 text-sm px-3 py-2 rounded-lg bg-white/5 border border-white/10 ${hoverBorder} hover:bg-white/[0.08] text-white/80 transition-colors`

  return (
    <div className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o) }}
        className={triggerCls}
      >
        <span className="truncate">{selected?.label}</span>
        <Icons.chevronDown size={11} className={`text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          style={{ position: 'fixed', top: pos.top, left: pos.left, minWidth: Math.max(pos.width, 160), maxHeight: pos.maxH }}
          className="z-[100] rounded-lg border border-white/10 bg-workx-dark shadow-2xl py-1 overflow-y-auto overscroll-contain"
        >
          {options.map(opt => {
            const isSel = selected?.key === opt.key
            return (
              <button
                type="button"
                key={opt.key}
                onClick={() => { onChange(opt.key); setOpen(false) }}
                className={`w-full text-left px-3 py-1.5 text-xs hover:bg-white/5 transition-colors ${isSel ? selBg : 'text-white/80'}`}
              >
                {opt.label}
              </button>
            )
          })}
        </div>,
        document.body
      )}
    </div>
  )
}
