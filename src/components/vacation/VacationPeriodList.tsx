'use client'

import { Icons } from '@/components/ui/Icons'
import { formatWerkdagen, parseWerkdagen } from '@/lib/vacation-utils'

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

export default function VacationPeriodList({
  periods,
  onEdit,
  onDelete,
  showUser = false,
  compact = false
}: VacationPeriodListProps) {
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

        return (
          <div
            key={period.id}
            className={`
              group flex items-center justify-between gap-3 p-3 rounded-xl
              bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] hover:border-white/10
              transition-all
            `}
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center flex-shrink-0">
                <Icons.sun className="text-green-400" size={18} />
              </div>

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
        )
      })}
    </div>
  )
}
