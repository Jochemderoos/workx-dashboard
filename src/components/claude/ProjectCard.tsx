'use client'

import Link from 'next/link'

interface ProjectCardProps {
  id: string
  title: string
  description?: string | null
  icon: string
  color: string
  status: string
  conversationCount: number
  documentCount: number
}

const PROJECT_ICONS: Record<string, string> = {
  folder: '📁',
  briefcase: '💼',
  scale: '⚖️',
  document: '📄',
  gavel: '🔨',
  shield: '🛡️',
  building: '🏢',
  people: '👥',
  contract: '📝',
  money: '💰',
  clock: '⏰',
  warning: '⚠️',
  star: '⭐',
  fire: '🔥',
  lock: '🔒',
}

export default function ProjectCard({
  id,
  title,
  description,
  icon,
  color,
  status,
  conversationCount,
  documentCount,
}: ProjectCardProps) {
  const displayIcon = PROJECT_ICONS[icon] || icon

  return (
    <Link href={`/dashboard/ai/${id}`}>
      <div className="group relative overflow-hidden rounded-xl bg-white/5 border border-white/10 p-5 hover:border-white/20 transition-all cursor-pointer hover:bg-white/[0.07]">
        {/* Color accent bar */}
        <div
          className="absolute top-0 left-0 right-0 h-1 opacity-60 group-hover:opacity-100 transition-opacity"
          style={{ backgroundColor: color }}
        />

        <div className="flex items-start gap-3">
          {/* Icon */}
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
            style={{ backgroundColor: color + '20' }}
          >
            {displayIcon}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium text-white truncate">{title}</h3>
              {status === 'archived' && (
                <span className="px-1.5 py-0.5 text-[10px] rounded bg-white/10 text-white/40">
                  Gearchiveerd
                </span>
              )}
            </div>
            {description && (
              <p className="text-xs text-white/40 mt-1 line-clamp-2">{description}</p>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 mt-4 text-[11px] text-white/30">
          <span>{conversationCount} gesprek{conversationCount !== 1 ? 'ken' : ''}</span>
          <span>{documentCount} document{documentCount !== 1 ? 'en' : ''}</span>
        </div>
      </div>
    </Link>
  )
}
