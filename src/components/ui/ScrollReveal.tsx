'use client'

import { ReactNode } from 'react'

interface ScrollRevealProps {
  children: ReactNode
  className?: string
  direction?: 'up' | 'down' | 'left' | 'right' | 'none'
  distance?: number
  delay?: number
  duration?: number
  staggerChildren?: number
  once?: boolean
  margin?: string
}

export default function ScrollReveal({
  children,
  className = '',
}: ScrollRevealProps) {
  return (
    <div className={className}>
      {children}
    </div>
  )
}

/** Wrap each child in this for stagger effect inside ScrollReveal */
export function ScrollRevealItem({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
  direction?: 'up' | 'down' | 'left' | 'right' | 'none'
  distance?: number
  duration?: number
}) {
  return (
    <div className={className}>
      {children}
    </div>
  )
}
