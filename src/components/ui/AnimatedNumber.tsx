'use client'

import { useEffect, useRef } from 'react'
import { useMotionValue, useSpring, useInView } from 'framer-motion'

interface AnimatedNumberProps {
  value: number
  decimals?: number
  stiffness?: number
  damping?: number
  className?: string
  prefix?: string
  suffix?: string
}

export default function AnimatedNumber({
  value,
  decimals = 0,
  stiffness = 80,
  damping = 20,
  className = '',
  prefix = '',
  suffix = '',
}: AnimatedNumberProps) {
  const spanRef = useRef<HTMLSpanElement>(null)
  const motionValue = useMotionValue(0)
  const springValue = useSpring(motionValue, { stiffness, damping, mass: 1 })
  const isInView = useInView(spanRef, { once: true, margin: '-50px' })

  useEffect(() => {
    if (isInView) {
      motionValue.set(value)
    }
  }, [isInView, value, motionValue])

  useEffect(() => {
    const unsubscribe = springValue.on('change', (latest) => {
      if (spanRef.current) {
        spanRef.current.textContent = latest.toFixed(decimals)
      }
    })
    return unsubscribe
  }, [springValue, decimals])

  return (
    <span className={className}>
      {prefix}<span ref={spanRef}>0</span>{suffix}
    </span>
  )
}
