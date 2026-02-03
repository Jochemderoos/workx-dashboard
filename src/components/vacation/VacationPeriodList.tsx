'use client'

import { useState } from 'react'
import { Icons } from '@/components/ui/Icons'
import { formatWerkdagen, parseWerkdagen, getHolidaysInRange } from '@/lib/vacation-utils'

export interface VacationPeriod {
  id: string
  userId: string
  startDate: string
  endDate: string
  werkdagen: string
  days: number
  note: string | null
  createdAt: string
  user?: {
    id: string
    name: string
  }
  createdBy?: {
    id: string
    name: string
  }
}

interface VacationPeriodListProps {
  periods: VacationPeriod[]
  onEdit?: (period: VacationPeriod) => void
  onDelete?: (periodId: string) => void
  showUser?: boolean
  compact?: boolean
}

// Helper function to calculate period breakdown
function calculatePeriodBreakdown(startDateStr: string, endDateStr: string, werkdagenStr: string) {
  const startDate = new Date(startDateStr)
  const endDate = new Date(endDateStr)
  const werkdagen = parseWerkdagen(werkdagenStr)

  // Calendar days
  const calendarDays = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1

  // Weekend days excluded
  let weekendDaysExcluded = 0
  const current = new Date(startDate)
  while (current <= endDate) {
    const jsDay = current.getDay()
    const ourDay = jsDay === 0 ? 7 : jsDay
    if ((ourDay === 6 || ourDay === 7) && !werkdagen.includes(ourDay)) {
      weekendDaysExcluded++
    }
    current.setDate(current.getDate() + 1)
  }

  // Holidays excluded
  const holidaysInRange = getHolidaysInRange(startDate, endDate)
  const holidaysExcluded = holidaysInRange.filter(h => {
    const jsDay = h.date.getDay()
    const ourDay = jsDay === 0 ? 7 : jsDay
    return werkdagen.includes(ourDay)
  })

  return {
    calendarDays,
    weekendDaysExcluded,
    holidaysExcluded,
  }
}

export default function VacationPeriodList({
  periods,
  onEdit,
  onDelete,
  showUser = false,
  compact = false
}: VacationPeriodListProps) {
  const [expandedPeriod, setExpandedPeriod] = useState<string | null>(null)

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('nl-NL', {
      day: 'numeric',
      month: compact ? 'short' : 'long',
    })
  }

  const formatDateWithYear = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('nl-NL', {
      day: 'numeric',
      month: compact ? 'short' : 'long',
      year: 'numeric',
    })
  }

  if (periods.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mx-auto mb-3">
          <Icons.calendar className="text-gray-500" size={20} />
        </div>
        <p className="text-gray-400 text-sm">Geen vakantieperiodes ingevoerd</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {periods.map((period) => {
        const werkdagenArray = parseWerkdagen(period.werkdagen)
        const werkdagenText = formatWerkdagen(werkdagenArray)
        const isFullWeek = werkdagenArray.length === 5 &&
          werkdagenArray.every((d, i) => d === i + 1)
        const isExpanded = expandedPeriod === period.id
        const breakdown = isExpanded ? calculatePeriodBreakdown(period.startDate, period.endDate, period.werkdagen) : null

        return (
          <div
            key={period.id}
            className={`
              group rounded-xl
              bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] hover:border-white/10
              transition-all overflow-hidden
            `}
          >
            <div className="flex items-center justify-between gap-3 p-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <button
                  onClick={() => setExpandedPeriod(isExpanded ? null : period.id)}
                  className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center flex-shrink-0 hover:bg-green-500/20 transition-colors"
                >
                  {isExpanded ? (
                    <Icons.chevronDown className="text-green-400" size={18} />
                  ) : (
                    <Icons.sun className="text-green-400" size={18} />
                  )}
                </button>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {showUser && period.user && (
                      <span className="font-medium text-white text-sm">
                        {period.user.name}
                      </span>
                    )}
                    <span className={`text-sm ${showUser ? 'text-gray-400' : 'text-white'}`}>
                      {formatDate(period.startDate)} - {formatDateWithYear(period.endDate)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-xs text-green-400 font-medium">
                      {period.days} {period.days === 1 ? 'dag' : 'dagen'}
                    </span>
                    {!isFullWeek && (
                      <span className="text-xs text-gray-500">
                        ({werkdagenText})
                      </span>
                    )}
                    {period.note && (
                      <span className="text-xs text-gray-500 truncate max-w-[150px]">
                        - {period.note}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {(onEdit || onDelete) && (
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {onEdit && (
                    <button
                      onClick={() => onEdit(period)}
                      className="p-2 text-gray-400 hover:text-workx-lime hover:bg-workx-lime/10 rounded-lg transition-all"
                      title="Bewerken"
                    >
                      <Icons.edit size={14} />
                    </button>
                  )}
                  {onDelete && (
                    <button
                      onClick={() => {
                        if (confirm('Weet je zeker dat je deze periode wilt verwijderen?')) {
                          onDelete(period.id)
                        }
                      }}
                      className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                      title="Verwijderen"
                    >
                      <Icons.trash size={14} />
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Expanded calculation breakdown */}
            {isExpanded && breakdown && (
              <div className="px-3 pb-3 ml-[52px]">
                <div className="p-3 bg-green-500/5 border border-green-500/10 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Icons.calculator className="text-green-400" size={14} />
                    <span className="text-xs text-green-400 font-medium">Berekening</span>
                  </div>
                  <div className="text-xs text-gray-400 space-y-1">
                    <div className="flex justify-between">
                      <span>Kalenderdagen:</span>
                      <span className="text-white">{breakdown.calendarDays}</span>
                    </div>
                    {breakdown.weekendDaysExcluded > 0 && (
                      <div className="flex justify-between text-blue-400/80">
                        <span>Weekenddagen:</span>
                        <span>-{breakdown.weekendDaysExcluded}</span>
                      </div>
                    )}
                    {breakdown.holidaysExcluded.length > 0 && (
                      <div className="flex justify-between text-orange-400/80">
                        <span>Feestdagen:</span>
                        <span>-{breakdown.holidaysExcluded.length}</span>
                      </div>
                    )}
                    <div className="flex justify-between pt-1 border-t border-white/5 font-medium">
                      <span className="text-green-400">Vakantiedagen:</span>
                      <span className="text-green-400">{period.days}</span>
                    </div>
                  </div>
                  {breakdown.holidaysExcluded.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-white/5">
                      <p className="text-[10px] text-orange-400/70 mb-1">Feestdagen in deze periode:</p>
                      <div className="text-[10px] text-gray-500 space-y-0.5">
                        {breakdown.holidaysExcluded.map((h, i) => (
                          <div key={i}>
                            {h.name} ({h.date.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' })})
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
