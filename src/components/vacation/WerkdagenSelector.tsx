'use client'

import { DAY_NAMES } from '@/lib/vacation-utils'

interface WerkdagenSelectorProps {
  value: number[]
  onChange: (werkdagen: number[]) => void
  disabled?: boolean
}

export default function WerkdagenSelector({ value, onChange, disabled = false }: WerkdagenSelectorProps) {
  const toggleDay = (day: number) => {
    if (disabled) return
    if (value.includes(day)) {
      onChange(value.filter(d => d !== day))
    } else {
      onChange([...value, day].sort((a, b) => a - b))
    }
  }

  // All days 1-7
  const allDays = [1, 2, 3, 4, 5, 6, 7]

  return (
    <div className="flex flex-wrap gap-1.5">
      {allDays.map((day) => {
        const isSelected = value.includes(day)
        const isWeekend = day >= 6

        return (
          <button
            key={day}
            type="button"
            onClick={() => toggleDay(day)}
            disabled={disabled}
            className={`
              px-3 py-2 rounded-lg text-sm font-medium transition-all
              ${isSelected
                ? isWeekend
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                  : 'bg-workx-lime/20 text-workx-lime border border-workx-lime/30'
                : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10 hover:text-gray-300'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            <span className="flex items-center gap-1.5">
              <span className={`
                w-4 h-4 rounded border flex items-center justify-center
                ${isSelected
                  ? isWeekend
                    ? 'bg-purple-500 border-purple-500'
                    : 'bg-workx-lime border-workx-lime'
                  : 'border-gray-500'
                }
              `}>
                {isSelected && (
                  <svg className="w-3 h-3 text-workx-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </span>
              {DAY_NAMES[day]}
            </span>
          </button>
        )
      })}
    </div>
  )
}
