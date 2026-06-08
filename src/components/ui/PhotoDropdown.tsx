'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { Icons } from '@/components/ui/Icons'

export interface PhotoOption {
  id: string
  label: string
  photoUrl?: string | null
}

interface PhotoDropdownProps {
  value: string | null
  options: PhotoOption[]
  onChange: (id: string | null) => void
  placeholder?: string
  emptyOption?: string // tekst voor "niemand" — null betekent geen empty optie
  size?: 'sm' | 'md'
  className?: string
}

// Herbruikbare dropdown met foto's. Sluit bij click-outside.
export default function PhotoDropdown({
  value,
  options,
  onChange,
  placeholder = 'Niet toegewezen',
  emptyOption = 'Niet toegewezen',
  size = 'sm',
  className = '',
}: PhotoDropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const selected = options.find(o => o.id === value)

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const triggerCls = size === 'sm'
    ? 'flex items-center gap-1.5 text-xs px-2 py-1 rounded-md bg-white/[0.04] border border-white/10 hover:border-amber-500/30 hover:bg-white/[0.08] text-gray-300 transition-colors'
    : 'flex items-center gap-2 text-sm px-3 py-2 rounded-lg bg-white/5 border border-white/10 hover:border-amber-500/30 hover:bg-white/[0.08] text-white/80 transition-colors'

  const photoSize = size === 'sm' ? 16 : 22
  const initialsCls = size === 'sm' ? 'w-4 h-4 text-[9px]' : 'w-6 h-6 text-[11px]'

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o) }}
        className={triggerCls}
      >
        {selected ? (
          <>
            {selected.photoUrl ? (
              <Image
                src={selected.photoUrl}
                alt={selected.label}
                width={photoSize}
                height={photoSize}
                className="rounded-full object-cover"
                style={{ width: photoSize, height: photoSize }}
              />
            ) : (
              <span className={`${initialsCls} rounded-full bg-amber-500/20 flex items-center justify-center font-bold text-amber-200`}>
                {selected.label.charAt(0).toUpperCase()}
              </span>
            )}
            <span className="truncate max-w-[80px]">{selected.label.split(' ')[0]}</span>
          </>
        ) : (
          <span className="text-white/40">{placeholder}</span>
        )}
        <Icons.chevronDown size={11} className={`text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-30 min-w-[180px] rounded-lg border border-white/10 bg-workx-dark shadow-2xl py-1 max-h-72 overflow-y-auto">
          {emptyOption && (
            <button
              type="button"
              onClick={() => { onChange(null); setOpen(false) }}
              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-white/5 transition-colors flex items-center gap-2 ${
                !selected ? 'text-amber-300' : 'text-gray-400'
              }`}
            >
              <span className="w-[18px] h-[18px] rounded-full bg-white/5 flex items-center justify-center text-gray-600">—</span>
              {emptyOption}
            </button>
          )}
          {options.map(opt => {
            const isSel = selected?.id === opt.id
            return (
              <button
                type="button"
                key={opt.id}
                onClick={() => { onChange(opt.id); setOpen(false) }}
                className={`w-full text-left px-3 py-1.5 text-xs hover:bg-white/5 transition-colors flex items-center gap-2 ${
                  isSel ? 'text-amber-200 bg-amber-500/10' : 'text-white/80'
                }`}
              >
                {opt.photoUrl ? (
                  <Image
                    src={opt.photoUrl}
                    alt={opt.label}
                    width={18}
                    height={18}
                    className="w-[18px] h-[18px] rounded-full object-cover"
                  />
                ) : (
                  <span className="w-[18px] h-[18px] rounded-full bg-amber-500/20 flex items-center justify-center text-[10px] font-bold text-amber-200">
                    {opt.label.charAt(0).toUpperCase()}
                  </span>
                )}
                {opt.label.split(' ')[0]}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
