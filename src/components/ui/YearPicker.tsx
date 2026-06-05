'use client'

import React from 'react'

interface YearPickerProps {
  years: number[]
  selected: number | null
  onChange: (year: number) => void
  /** Compact maakt 'm wat kleiner — handig in sticky page-headers */
  compact?: boolean
  /** Extra inhoud per jaar (bv. status-dot voor actief plan) */
  badgeFor?: (year: number) => React.ReactNode
  className?: string
}

/**
 * Pill-style jaar-segmented control — zelfde look als de view-toggle van
 * /dashboard/agenda. Gebruik overal waar je tussen jaren switcht.
 */
export default function YearPicker({ years, selected, onChange, compact, badgeFor, className = '' }: YearPickerProps) {
  if (years.length === 0) return null
  const sortedYears = [...years].sort((a, b) => a - b)

  return (
    <div className={`inline-flex items-center bg-white/5 rounded-xl p-0.5 sm:p-1 border border-white/10 ${className}`}>
      {sortedYears.map((year) => {
        const isActive = selected === year
        return (
          <button
            key={year}
            onClick={() => onChange(year)}
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg transition-all ${
              compact ? 'px-2.5 py-1 text-xs' : 'px-3 sm:px-3.5 py-1 sm:py-1.5 text-xs sm:text-sm'
            } ${
              isActive
                ? 'bg-workx-lime text-black font-semibold shadow-sm'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {year}
            {badgeFor && badgeFor(year)}
          </button>
        )
      })}
    </div>
  )
}
