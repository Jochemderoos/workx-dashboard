'use client'

import { forwardRef, useState, useRef, useEffect } from 'react'
import { Icons } from './Icons'

interface TimePickerProps {
  value: string
  onChange: (time: string) => void
  placeholder?: string
  className?: string
}

export default function TimePicker({
  value,
  onChange,
  placeholder = 'Selecteer tijd...',
  className = '',
}: TimePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Parse current value
  const [hours, minutes] = value ? value.split(':').map(Number) : [9, 0]

  // Generate time options (every 15 minutes)
  const timeOptions: string[] = []
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      timeOptions.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
    }
  }

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const formatDisplayTime = (time: string) => {
    if (!time) return placeholder
    const [h, m] = time.split(':')
    return `${h}:${m} uur`
  }

  return (
    <div ref={containerRef} className={`relative workx-timepicker ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-gradient-to-br from-workx-gray/90 to-workx-dark/95 border border-white/10 rounded-xl text-left hover:border-workx-lime/30 hover:shadow-lg hover:shadow-workx-lime/5 focus:outline-none focus:border-workx-lime/50 focus:ring-2 focus:ring-workx-lime/20 transition-all duration-300 group"
      >
        <Icons.clock size={18} className="text-white/40 group-hover:text-workx-lime group-focus:text-workx-lime transition-colors" />
        <span className={value ? 'text-white' : 'text-white/40'}>
          {formatDisplayTime(value)}
        </span>
        <Icons.chevronDown size={16} className={`ml-auto text-white/30 group-hover:text-workx-lime transition-all duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 right-0 top-full mt-2 z-50 bg-workx-dark/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden fade-in">
            {/* Quick select buttons */}
            <div className="p-3 border-b border-white/5">
              <div className="grid grid-cols-4 gap-2">
                {['09:00', '10:00', '14:00', '17:00'].map((time) => (
                  <button
                    key={time}
                    type="button"
                    onClick={() => { onChange(time); setIsOpen(false) }}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      value === time
                        ? 'bg-workx-lime text-workx-dark'
                        : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {time}
                  </button>
                ))}
              </div>
            </div>

            {/* Scrollable time list */}
            <div className="max-h-48 overflow-y-auto p-2 workx-scrollbar">
              <div className="grid grid-cols-4 gap-1">
                {timeOptions.map((time) => (
                  <button
                    key={time}
                    type="button"
                    onClick={() => { onChange(time); setIsOpen(false) }}
                    className={`px-2 py-1.5 rounded-lg text-sm transition-all ${
                      value === time
                        ? 'bg-workx-lime text-workx-dark font-medium'
                        : 'text-white/60 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    {time}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
