'use client'

import { ReactNode } from 'react'
import { motion, Variants } from 'framer-motion'

interface ScrollRevealProps {
  children: ReactNode
  className?: string
  /** Animation direction */
  direction?: 'up' | 'down' | 'left' | 'right' | 'none'
  /** Distance in pixels */
  distance?: number
  /** Delay in seconds */
  delay?: number
  /** Duration in seconds */
  duration?: number
  /** Stagger children by this many seconds */
  staggerChildren?: number
  /** Only animate once */
  once?: boolean
  /** Viewport margin for trigger */
  margin?: string
}

const getVariants = (
  direction: string,
  distance: number,
  duration: number,
): Variants => {
  const hidden: Record<string, number> = { opacity: 0 }
  const visible: Record<string, number> = { opacity: 1 }

  switch (direction) {
    case 'up':
      hidden.y = distance
      visible.y = 0
      break
    case 'down':
      hidden.y = -distance
      visible.y = 0
      break
    case 'left':
      hidden.x = distance
      visible.x = 0
      break
    case 'right':
      hidden.x = -distance
      visible.x = 0
      break
    case 'none':
      hidden.scale = 0.95
      visible.scale = 1
      break
  }

  return {
    hidden,
    visible: {
      ...visible,
      transition: {
        duration,
        ease: [0.25, 0.4, 0.25, 1],
      },
    },
  }
}

export default function ScrollReveal({
  children,
  className = '',
  direction = 'up',
  distance = 30,
  delay = 0,
  duration = 0.6,
  staggerChildren,
  once = true,
  margin = '-80px',
}: ScrollRevealProps) {
  const variants = getVariants(direction, distance, duration)

  const containerVariants: Variants = staggerChildren
    ? {
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: {
            staggerChildren,
            delayChildren: delay,
          },
        },
      }
    : variants

  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once, margin }}
      variants={containerVariants}
      transition={!staggerChildren ? { delay } : undefined}
    >
      {staggerChildren
        ? children
        : children}
    </motion.div>
  )
}

/** Wrap each child in this for stagger effect inside ScrollReveal */
export function ScrollRevealItem({
  children,
  className = '',
  direction = 'up',
  distance = 25,
  duration = 0.5,
}: {
  children: ReactNode
  className?: string
  direction?: 'up' | 'down' | 'left' | 'right' | 'none'
  distance?: number
  duration?: number
}) {
  return (
    <motion.div
      className={className}
      variants={getVariants(direction, distance, duration)}
    >
      {children}
    </motion.div>
  )
}
