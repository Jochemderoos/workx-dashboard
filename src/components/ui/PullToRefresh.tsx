'use client'

import { useState, useRef, useCallback, ReactNode } from 'react'
import { Icons } from './Icons'

interface PullToRefreshProps {
  onRefresh: () => Promise<void>
  children: ReactNode
  className?: string
}

export default function PullToRefresh({ onRefresh, children, className = '' }: PullToRefreshProps) {
  const [isPulling, setIsPulling] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const startY = useRef(0)
  const currentY = useRef(0)

  const PULL_THRESHOLD = 80
  const MAX_PULL = 120

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    // Only enable pull-to-refresh when scrolled to top
    if (containerRef.current && containerRef.current.scrollTop === 0) {
      startY.current = e.touches[0].clientY
      setIsPulling(true)
    }
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPulling || isRefreshing) return

    currentY.current = e.touches[0].clientY
    const diff = currentY.current - startY.current

    if (diff > 0) {
      // Apply resistance to make it feel natural
      const resistance = 0.5
      const distance = Math.min(diff * resistance, MAX_PULL)
      setPullDistance(distance)
    }
  }, [isPulling, isRefreshing])

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling) return

    if (pullDistance >= PULL_THRESHOLD && !isRefreshing) {
      setIsRefreshing(true)
      setPullDistance(60) // Hold at refresh position

      // Trigger haptic feedback if available
      if (navigator.vibrate) {
        navigator.vibrate(10)
      }

      try {
        await onRefresh()
      } finally {
        setIsRefreshing(false)
        setPullDistance(0)
      }
    } else {
      setPullDistance(0)
    }

    setIsPulling(false)
  }, [isPulling, pullDistance, isRefreshing, onRefresh])

  const progress = Math.min(pullDistance / PULL_THRESHOLD, 1)

  return (
    <div
      ref={containerRef}
      className={`relative overflow-auto ${className}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull indicator */}
      <div
        className="absolute left-0 right-0 flex items-center justify-center z-50 pointer-events-none transition-opacity"
        style={{
          top: pullDistance - 50,
          opacity: pullDistance > 10 ? 1 : 0,
        }}
      >
        <div className={`
          w-10 h-10 rounded-full bg-workx-gray border border-white/10
          flex items-center justify-center shadow-lg
          ${isRefreshing ? 'animate-pulse' : ''}
        `}>
          {isRefreshing ? (
            <span className="w-5 h-5 border-2 border-workx-lime border-t-transparent rounded-full animate-spin" />
          ) : (
            <Icons.chevronDown
              size={20}
              className={`text-workx-lime transition-transform duration-200`}
              style={{
                transform: `rotate(${progress >= 1 ? 180 : 0}deg)`,
                opacity: progress,
              }}
            />
          )}
        </div>
      </div>

      {/* Content with pull transform */}
      <div
        className="transition-transform duration-200 ease-out"
        style={{
          transform: `translateY(${pullDistance}px)`,
          transitionDuration: isPulling ? '0ms' : '200ms',
        }}
      >
        {children}
      </div>
    </div>
  )
}
