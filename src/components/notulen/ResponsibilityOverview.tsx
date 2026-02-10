'use client'

import { Icons } from '@/components/ui/Icons'
import { getPhotoUrl } from '@/lib/team-photos'

interface OpenAction {
  id: string
  description: string
  responsibleName: string
  isCompleted: boolean
  week?: {
    id: string
    dateLabel: string
  }
}

interface ResponsibilityOverviewProps {
  actions: OpenAction[]
  onToggleComplete: (actionId: string, isCompleted: boolean) => void
}

export default function ResponsibilityOverview({ actions, onToggleComplete }: ResponsibilityOverviewProps) {
  // Group by responsible person — handle comma-separated names
  const grouped: Record<string, OpenAction[]> = {}
  for (const action of actions) {
    const names = action.responsibleName.split(',').map(n => n.trim()).filter(Boolean)
    for (const name of names) {
      if (!grouped[name]) grouped[name] = []
      grouped[name].push(action)
    }
  }

  const sortedNames = Object.keys(grouped).sort()

  if (sortedNames.length === 0) {
    return (
      <div className="card p-6 text-center">
        <Icons.checkCircle size={32} className="text-green-400 mx-auto mb-3 opacity-50" />
        <p className="text-gray-400 text-sm">Geen openstaande actiepunten</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
          <Icons.target className="text-orange-400" size={16} />
        </div>
        <h3 className="font-medium text-white">Openstaande actiepunten per persoon</h3>
        <span className="px-2 py-0.5 text-xs rounded-full bg-orange-500/20 text-orange-400">
          {actions.length}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sortedNames.map((name) => {
          const personActions = grouped[name]
          const photo = getPhotoUrl(name)
          return (
            <div key={name} className="card p-4">
              <div className="flex items-center gap-3 mb-3 pb-3 border-b border-white/5">
                {photo ? (
                  <img src={photo} alt={name} className="w-8 h-8 rounded-lg object-cover ring-1 ring-white/10" />
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-workx-lime/10 flex items-center justify-center text-workx-lime text-sm font-bold">
                    {name.charAt(0)}
                  </div>
                )}
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">{name}</p>
                  <p className="text-xs text-gray-500">{personActions.length} open</p>
                </div>
              </div>
              <div className="space-y-2">
                {personActions.map((action) => (
                  <div key={action.id} className="flex items-start gap-2">
                    <button
                      onClick={() => onToggleComplete(action.id, !action.isCompleted)}
                      className="mt-0.5 w-4 h-4 rounded border border-white/20 hover:border-green-500/50 flex items-center justify-center flex-shrink-0 transition-colors"
                    >
                      {action.isCompleted && <Icons.check size={10} className="text-green-400" />}
                    </button>
                    <div className="min-w-0">
                      <p className="text-xs text-white/70 leading-relaxed">{action.description}</p>
                      <p className="text-[10px] text-gray-600 mt-0.5">{action.week?.dateLabel}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
