'use client'

import { ReactNode } from 'react'
import Link from 'next/link'

interface EmptyStateProps {
  icon?: ReactNode
  illustration?: 'calendar' | 'tasks' | 'team' | 'search' | 'inbox' | 'vacation' | 'celebration'
  title: string
  description?: string
  action?: {
    label: string
    href?: string
    onClick?: () => void
  }
  className?: string
}

// Beautiful SVG illustrations for different empty states
const illustrations = {
  calendar: (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="20" y="30" width="80" height="70" rx="8" stroke="currentColor" strokeWidth="2" className="text-white/20" />
      <rect x="20" y="30" width="80" height="20" rx="8" fill="currentColor" className="text-white/10" />
      <circle cx="35" cy="25" r="5" stroke="currentColor" strokeWidth="2" className="text-white/20" />
      <circle cx="85" cy="25" r="5" stroke="currentColor" strokeWidth="2" className="text-white/20" />
      <line x1="35" y1="30" x2="35" y2="20" stroke="currentColor" strokeWidth="2" className="text-white/20" />
      <line x1="85" y1="30" x2="85" y2="20" stroke="currentColor" strokeWidth="2" className="text-white/20" />
      <rect x="30" y="60" width="15" height="15" rx="3" fill="currentColor" className="text-workx-lime/30" />
      <rect x="52" y="60" width="15" height="15" rx="3" stroke="currentColor" strokeWidth="1.5" className="text-white/10" />
      <rect x="75" y="60" width="15" height="15" rx="3" stroke="currentColor" strokeWidth="1.5" className="text-white/10" />
      <rect x="30" y="80" width="15" height="15" rx="3" stroke="currentColor" strokeWidth="1.5" className="text-white/10" />
      <rect x="52" y="80" width="15" height="15" rx="3" stroke="currentColor" strokeWidth="1.5" className="text-white/10" />
    </svg>
  ),
  tasks: (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="25" y="25" width="70" height="18" rx="4" fill="currentColor" className="text-white/10" />
      <rect x="25" y="51" width="70" height="18" rx="4" fill="currentColor" className="text-white/10" />
      <rect x="25" y="77" width="70" height="18" rx="4" fill="currentColor" className="text-white/10" />
      <circle cx="35" cy="34" r="4" stroke="currentColor" strokeWidth="2" className="text-workx-lime/50" />
      <path d="M32 34L34 36L38 32" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-workx-lime" />
      <circle cx="35" cy="60" r="4" stroke="currentColor" strokeWidth="2" className="text-white/20" />
      <circle cx="35" cy="86" r="4" stroke="currentColor" strokeWidth="2" className="text-white/20" />
      <line x1="48" y1="34" x2="85" y2="34" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-white/20" />
      <line x1="48" y1="60" x2="75" y2="60" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-white/15" />
      <line x1="48" y1="86" x2="80" y2="86" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-white/10" />
    </svg>
  ),
  team: (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="60" cy="45" r="15" stroke="currentColor" strokeWidth="2" className="text-workx-lime/50" />
      <circle cx="35" cy="55" r="10" stroke="currentColor" strokeWidth="2" className="text-white/20" />
      <circle cx="85" cy="55" r="10" stroke="currentColor" strokeWidth="2" className="text-white/20" />
      <path d="M40 90C40 79 49 70 60 70C71 70 80 79 80 90" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-workx-lime/50" />
      <path d="M20 95C20 87 26 80 35 80C40 80 44 82 47 85" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-white/20" />
      <path d="M100 95C100 87 94 80 85 80C80 80 76 82 73 85" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-white/20" />
    </svg>
  ),
  search: (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="52" cy="52" r="25" stroke="currentColor" strokeWidth="3" className="text-white/20" />
      <line x1="70" y1="70" x2="95" y2="95" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="text-white/20" />
      <path d="M40 52H64" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-workx-lime/50" />
      <circle cx="52" cy="52" r="5" fill="currentColor" className="text-workx-lime/30" />
    </svg>
  ),
  inbox: (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M25 50L40 30H80L95 50V85C95 89 92 92 88 92H32C28 92 25 89 25 85V50Z" stroke="currentColor" strokeWidth="2" className="text-white/20" />
      <path d="M25 50H45C45 58 52 65 60 65C68 65 75 58 75 50H95" stroke="currentColor" strokeWidth="2" className="text-white/20" />
      <line x1="45" y1="72" x2="75" y2="72" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-white/10" />
      <line x1="50" y1="80" x2="70" y2="80" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-white/10" />
    </svg>
  ),
  vacation: (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="60" cy="35" r="18" fill="currentColor" className="text-yellow-400/30" />
      <path d="M30 95C30 95 45 70 60 70C75 70 90 95 90 95" stroke="currentColor" strokeWidth="2" className="text-workx-lime/50" />
      <path d="M55 70V55" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="text-green-500/50" />
      <path d="M65 70V60" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="text-green-500/50" />
      <path d="M48 65L55 55L48 55" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-500/40" />
      <path d="M72 60L65 50L72 55" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-500/40" />
      <path d="M20 95H100" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-blue-400/30" />
    </svg>
  ),
  celebration: (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M60 25L63 35L73 35L65 42L68 52L60 46L52 52L55 42L47 35L57 35L60 25Z" fill="currentColor" className="text-workx-lime/50" />
      <path d="M35 45L37 51L43 51L38 55L40 61L35 57L30 61L32 55L27 51L33 51L35 45Z" fill="currentColor" className="text-yellow-400/40" />
      <path d="M85 45L87 51L93 51L88 55L90 61L85 57L80 61L82 55L77 51L83 51L85 45Z" fill="currentColor" className="text-yellow-400/40" />
      <rect x="40" y="65" width="40" height="30" rx="4" stroke="currentColor" strokeWidth="2" className="text-white/20" />
      <path d="M40 75H80" stroke="currentColor" strokeWidth="2" className="text-white/10" />
      <path d="M55 65V60C55 57 57 55 60 55C63 55 65 57 65 60V65" stroke="currentColor" strokeWidth="2" className="text-workx-lime/40" />
    </svg>
  ),
}

export function EmptyState({
  icon,
  illustration,
  title,
  description,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center text-center py-12 px-6 ${className}`}>
      {/* Illustration or Icon */}
      <div className="mb-6 relative">
        {illustration ? (
          <div className="relative">
            {/* Glow effect */}
            <div className="absolute inset-0 blur-2xl opacity-30 bg-workx-lime/20 rounded-full" />
            <div className="relative">
              {illustrations[illustration]}
            </div>
          </div>
        ) : icon ? (
          <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10">
            {icon}
          </div>
        ) : null}
      </div>

      {/* Title */}
      <h3 className="text-lg font-medium text-white mb-2">{title}</h3>

      {/* Description */}
      {description && (
        <p className="text-sm text-gray-400 max-w-sm mb-6">{description}</p>
      )}

      {/* Action button */}
      {action && (
        action.href ? (
          <Link
            href={action.href}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-workx-lime text-workx-dark font-medium text-sm hover:bg-workx-lime/90 transition-all hover:scale-105 shadow-lg shadow-workx-lime/20"
          >
            {action.label}
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M6 12L10 8L6 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        ) : (
          <button
            onClick={action.onClick}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-workx-lime text-workx-dark font-medium text-sm hover:bg-workx-lime/90 transition-all hover:scale-105 shadow-lg shadow-workx-lime/20"
          >
            {action.label}
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M8 3V13M3 8H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )
      )}
    </div>
  )
}

// Pre-configured empty states for common use cases
export function NoEventsEmptyState() {
  return (
    <EmptyState
      illustration="calendar"
      title="Geen events"
      description="Er zijn geen aankomende events gepland."
      action={{ label: 'Event toevoegen', href: '/dashboard/agenda' }}
    />
  )
}

export function NoTasksEmptyState() {
  return (
    <EmptyState
      illustration="tasks"
      title="Geen taken"
      description="Je hebt geen openstaande taken. Lekker bezig!"
    />
  )
}

export function NoSearchResultsEmptyState({ query }: { query: string }) {
  return (
    <EmptyState
      illustration="search"
      title="Geen resultaten"
      description={`We konden niets vinden voor "${query}". Probeer een andere zoekterm.`}
    />
  )
}

export function NoTeamMembersEmptyState() {
  return (
    <EmptyState
      illustration="team"
      title="Geen teamleden"
      description="Er zijn nog geen teamleden toegevoegd."
      action={{ label: 'Teamlid toevoegen', href: '/dashboard/team' }}
    />
  )
}

export function NoNotificationsEmptyState() {
  return (
    <EmptyState
      illustration="inbox"
      title="Geen notificaties"
      description="Je bent helemaal bij!"
    />
  )
}

export function NoVacationsEmptyState() {
  return (
    <EmptyState
      illustration="vacation"
      title="Geen vakanties gepland"
      description="Tijd om wat rust te plannen?"
      action={{ label: 'Vakantie aanvragen', href: '/dashboard/vakanties' }}
    />
  )
}

export default EmptyState
