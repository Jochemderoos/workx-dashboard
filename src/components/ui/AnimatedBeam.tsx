'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, useInView } from 'framer-motion'

interface AnimatedBeamProps {
  /** Start element ref or position */
  fromX: number
  fromY: number
  /** End element ref or position */
  toX: number
  toY: number
  /** Beam color */
  color?: string
  /** Width of SVG container */
  width: number
  /** Height of SVG container */
  height: number
  /** Curvature amount */
  curvature?: number
  /** Animation duration */
  duration?: number
  /** Beam width */
  strokeWidth?: number
  /** Additional class for the SVG */
  className?: string
  /** Delay before animation */
  delay?: number
}

export default function AnimatedBeam({
  fromX,
  fromY,
  toX,
  toY,
  color = '#f9ff85',
  width,
  height,
  curvature = 50,
  duration = 2,
  strokeWidth = 2,
  className = '',
  delay = 0,
}: AnimatedBeamProps) {
  const ref = useRef<SVGSVGElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-50px' })

  // Calculate control points for curved beam
  const midX = (fromX + toX) / 2
  const midY = (fromY + toY) / 2 - curvature
  const path = `M ${fromX} ${fromY} Q ${midX} ${midY} ${toX} ${toY}`

  return (
    <svg
      ref={ref}
      width={width}
      height={height}
      className={`absolute inset-0 pointer-events-none ${className}`}
      style={{ overflow: 'visible' }}
    >
      <defs>
        <linearGradient id={`beam-gradient-${fromX}-${toX}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={color} stopOpacity="0" />
          <stop offset="50%" stopColor={color} stopOpacity="0.8" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
        <filter id={`beam-glow-${fromX}-${toX}`}>
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Background path (dim) */}
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth * 0.5}
        strokeOpacity="0.1"
        strokeLinecap="round"
      />

      {/* Animated beam */}
      <motion.path
        d={path}
        fill="none"
        stroke={`url(#beam-gradient-${fromX}-${toX})`}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        filter={`url(#beam-glow-${fromX}-${toX})`}
        initial={{ pathLength: 0, opacity: 0 }}
        animate={isInView ? { pathLength: [0, 1], opacity: [0, 1, 1, 0] } : {}}
        transition={{
          duration,
          delay,
          repeat: Infinity,
          repeatDelay: 1,
          ease: 'easeInOut',
        }}
      />

      {/* Traveling dot */}
      <motion.circle
        r={3}
        fill={color}
        filter={`url(#beam-glow-${fromX}-${toX})`}
        initial={{ opacity: 0 }}
        animate={isInView ? {
          opacity: [0, 1, 1, 0],
          offsetDistance: ['0%', '100%'],
        } : {}}
        transition={{
          duration: duration * 0.8,
          delay: delay + 0.2,
          repeat: Infinity,
          repeatDelay: 1.2,
          ease: 'easeInOut',
        }}
        style={{
          offsetPath: `path("${path}")`,
        }}
      />
    </svg>
  )
}

/** Pre-built beam connections between stat cards */
export function BeamConnector({
  className = '',
}: {
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-50px' })
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })

  useEffect(() => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect()
      setDimensions({ width: rect.width, height: rect.height })
    }
  }, [])

  if (dimensions.width === 0) {
    return <div ref={ref} className={`absolute inset-0 pointer-events-none ${className}`} />
  }

  const w = dimensions.width
  const h = dimensions.height

  return (
    <div ref={ref} className={`absolute inset-0 pointer-events-none z-0 ${className}`}>
      <AnimatedBeam
        fromX={w * 0.15}
        fromY={h * 0.5}
        toX={w * 0.5}
        toY={h * 0.3}
        width={w}
        height={h}
        color="#f9ff85"
        curvature={30}
        duration={2.5}
        strokeWidth={1.5}
        delay={0.5}
      />
      <AnimatedBeam
        fromX={w * 0.5}
        fromY={h * 0.3}
        toX={w * 0.85}
        toY={h * 0.5}
        width={w}
        height={h}
        color="#60a5fa"
        curvature={25}
        duration={2.5}
        strokeWidth={1.5}
        delay={1}
      />
    </div>
  )
}
