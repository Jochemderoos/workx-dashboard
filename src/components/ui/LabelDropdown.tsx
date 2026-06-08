'use client'

import { useState, useEffect, useRef } from 'react'
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

// Compacte ronde dropdown — zelfde stijl als PhotoDropdown maar zonder foto's.
export default function LabelDropdown({
  value,
  options,
  onChange,
  size = 'sm',
  className = '',
  tone = 'amber',
}: LabelDropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const selected = options.find(o => o.key === value) || options[0]

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const hoverBorder = tone === 'amber' ? 'hover:border-amber-500/30' : 'hover:border-purple-500/30'
  const selBg = tone === 'amber' ? 'bg-amber-500/10 text-amber-200' : 'bg-purple-500/10 text-purple-200'

  const triggerCls = size === 'sm'
    ? `flex items-center gap-1.5 text-xs px-2 py-1 rounded-md bg-white/[0.04] border border-white/10 ${hoverBorder} hover:bg-white/[0.08] text-gray-300 transition-colors`
    : `flex items-center gap-2 text-sm px-3 py-2 rounded-lg bg-white/5 border border-white/10 ${hoverBorder} hover:bg-white/[0.08] text-white/80 transition-colors`

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o) }}
        className={triggerCls}
      >
        <span className="truncate">{selected.label}</span>
        <Icons.chevronDown size={11} className={`text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-30 min-w-[140px] rounded-lg border border-white/10 bg-workx-dark shadow-2xl py-1 max-h-72 overflow-y-auto">
          {options.map(opt => {
            const isSel = selected.key === opt.key
            return (
              <button
                type="button"
                key={opt.key}
                onClick={() => { onChange(opt.key); setOpen(false) }}
                className={`w-full text-left px-3 py-1.5 text-xs hover:bg-white/5 transition-colors ${
                  isSel ? selBg : 'text-white/80'
                }`}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
