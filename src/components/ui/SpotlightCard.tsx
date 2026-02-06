'use client'

import { ReactNode } from 'react'

interface SpotlightCardProps {
  children: ReactNode
  className?: string
  spotlightColor?: string
  spotlightSize?: number
  tilt?: boolean
  maxTilt?: number
  as?: any
  [key: string]: any
}

export default function SpotlightCard({
  children,
  className = '',
  as: Component = 'div',
  // Accept but ignore these props to maintain API compatibility
  spotlightColor,
  spotlightSize,
  tilt,
  maxTilt,
  ...props
}: SpotlightCardProps) {
  return (
    <Component
      className={`relative ${className}`}
      {...props}
    >
      {children}
    </Component>
  )
}
