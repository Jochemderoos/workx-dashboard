'use client'

import { ReactNode } from 'react'

// Base skeleton with shimmer animation
function SkeletonBase({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`relative overflow-hidden bg-white/5 ${className}`}
      style={{
        background: 'linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(249,255,133,0.06) 50%, rgba(255,255,255,0.03) 75%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 2s ease-in-out infinite',
        ...style,
      }}
    />
  )
}

// Text line skeleton
export function SkeletonText({ width = '100%', className = '' }: { width?: string | number; className?: string }) {
  return <SkeletonBase className={`h-4 rounded ${className}`} style={{ width }} />
}

// Circle skeleton (for avatars)
export function SkeletonCircle({ size = 40, className = '' }: { size?: number; className?: string }) {
  return <SkeletonBase className={`rounded-full ${className}`} style={{ width: size, height: size }} />
}

// Card skeleton
export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`card p-5 space-y-4 ${className}`}>
      <div className="flex items-center gap-3">
        <SkeletonCircle size={40} />
        <div className="flex-1 space-y-2">
          <SkeletonBase className="h-4 rounded w-3/4" />
          <SkeletonBase className="h-3 rounded w-1/2" />
        </div>
      </div>
      <SkeletonBase className="h-20 rounded-lg" />
    </div>
  )
}

// Stat card skeleton
export function SkeletonStatCard({ className = '' }: { className?: string }) {
  return (
    <div className={`card p-4 sm:p-5 ${className}`}>
      <SkeletonBase className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl mb-3" />
      <SkeletonBase className="h-7 sm:h-8 rounded w-1/2 mb-2" />
      <SkeletonBase className="h-4 rounded w-2/3" />
    </div>
  )
}

// Table row skeleton
export function SkeletonTableRow({ columns = 4, className = '' }: { columns?: number; className?: string }) {
  return (
    <div className={`flex items-center gap-4 p-4 ${className}`}>
      {Array.from({ length: columns }).map((_, i) => (
        <SkeletonBase
          key={i}
          className="h-4 rounded"
          style={{ flex: i === 0 ? 2 : 1 }}
        />
      ))}
    </div>
  )
}

// List item skeleton
export function SkeletonListItem({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 p-3 ${className}`}>
      <SkeletonCircle size={36} />
      <div className="flex-1 space-y-2">
        <SkeletonBase className="h-4 rounded w-1/3" />
        <SkeletonBase className="h-3 rounded w-1/2" />
      </div>
    </div>
  )
}

// Calendar day skeleton
export function SkeletonCalendarDay({ className = '' }: { className?: string }) {
  return (
    <div className={`aspect-square rounded-lg p-2 ${className}`}>
      <SkeletonBase className="h-full w-full rounded-md" />
    </div>
  )
}

// Dashboard widget skeleton
export function SkeletonWidget({ className = '' }: { className?: string }) {
  return (
    <div className={`card p-5 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <SkeletonBase className="w-8 h-8 rounded-lg" />
          <SkeletonBase className="h-5 rounded w-32" />
        </div>
        <SkeletonBase className="h-6 rounded-full w-16" />
      </div>
      <div className="space-y-3">
        <SkeletonListItem />
        <SkeletonListItem />
        <SkeletonListItem />
      </div>
    </div>
  )
}

// Hero section skeleton
export function SkeletonHero({ className = '' }: { className?: string }) {
  return (
    <div className={`card p-6 sm:p-8 ${className}`}>
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <SkeletonBase className="hidden md:block w-24 h-16 rounded-lg" />
          <div className="space-y-2">
            <SkeletonBase className="h-4 rounded w-24" />
            <SkeletonBase className="h-8 rounded w-48" />
            <SkeletonBase className="h-4 rounded w-64 hidden sm:block" />
          </div>
        </div>
      </div>
    </div>
  )
}

// Absence grid skeleton
export function SkeletonAbsenceGrid({ className = '' }: { className?: string }) {
  return (
    <div className={`space-y-4 ${className}`}>
      <div className="grid grid-cols-5 gap-1 sm:gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonBase key={i} className="h-4 rounded mx-auto w-6" />
        ))}
      </div>
      <div className="grid grid-cols-5 gap-1 sm:gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonBase key={i} className="h-24 sm:h-32 rounded-lg" />
        ))}
      </div>
    </div>
  )
}

// Wrapper component for conditional skeleton
interface SkeletonWrapperProps {
  isLoading: boolean
  skeleton: ReactNode
  children: ReactNode
}

export function SkeletonWrapper({ isLoading, skeleton, children }: SkeletonWrapperProps) {
  return isLoading ? <>{skeleton}</> : <>{children}</>
}

// Add shimmer keyframes to global styles (add to globals.css)
// @keyframes shimmer {
//   0% { background-position: 200% 0; }
//   100% { background-position: -200% 0; }
// }
