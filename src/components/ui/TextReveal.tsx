'use client'

import { ReactNode } from 'react'
import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'

interface TextRevealProps {
  children: string
  className?: string
  /** Animate per word or per character */
  by?: 'word' | 'character'
  /** Delay between each unit */
  stagger?: number
  /** Overall delay before starting */
  delay?: number
  /** Duration per unit */
  duration?: number
  /** Only animate once */
  once?: boolean
}

export default function TextReveal({
  children,
  className = '',
  by = 'word',
  stagger = 0.05,
  delay = 0,
  duration = 0.4,
  once = true,
}: TextRevealProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const isInView = useInView(ref, { once, margin: '-50px' })

  const units = by === 'word'
    ? children.split(' ').map((word, i, arr) => i < arr.length - 1 ? word + '\u00A0' : word)
    : children.split('')

  return (
    <span ref={ref} className={`inline-flex flex-wrap ${className}`}>
      {units.map((unit, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0, y: 12, filter: 'blur(4px)' }}
          animate={isInView ? { opacity: 1, y: 0, filter: 'blur(0px)' } : { opacity: 0, y: 12, filter: 'blur(4px)' }}
          transition={{
            duration,
            delay: delay + i * stagger,
            ease: [0.25, 0.4, 0.25, 1],
          }}
          className="inline-block"
        >
          {unit}
        </motion.span>
      ))}
    </span>
  )
}

/** Simple fade-up reveal for any element */
export function FadeReveal({
  children,
  className = '',
  delay = 0,
  duration = 0.6,
  direction = 'up',
  once = true,
}: {
  children: ReactNode
  className?: string
  delay?: number
  duration?: number
  direction?: 'up' | 'down' | 'left' | 'right'
  once?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once, margin: '-50px' })

  const offset = { up: { y: 20 }, down: { y: -20 }, left: { x: 20 }, right: { x: -20 } }

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, ...offset[direction] }}
      animate={isInView ? { opacity: 1, x: 0, y: 0 } : { opacity: 0, ...offset[direction] }}
      transition={{ duration, delay, ease: [0.25, 0.4, 0.25, 1] }}
    >
      {children}
    </motion.div>
  )
}
