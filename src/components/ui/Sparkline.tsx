'use client'

import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'

interface SparklineProps {
  /** Data points (will be normalized) */
  data: number[]
  /** Width of SVG */
  width?: number
  /** Height of SVG */
  height?: number
  /** Line color */
  color?: string
  /** Gradient fill below line */
  fillColor?: string
  /** Line width */
  strokeWidth?: number
  /** Animation duration in seconds */
  duration?: number
  /** Additional class */
  className?: string
  /** Show end dot */
  showDot?: boolean
}

function buildPath(data: number[], width: number, height: number, padding: number = 2): string {
  if (data.length < 2) return ''

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1

  const points = data.map((value, i) => ({
    x: padding + (i / (data.length - 1)) * (width - padding * 2),
    y: padding + (1 - (value - min) / range) * (height - padding * 2),
  }))

  // Smooth curve using cubic bezier
  let path = `M ${points[0].x} ${points[0].y}`
  for (let i = 0; i < points.length - 1; i++) {
    const curr = points[i]
    const next = points[i + 1]
    const cpx = (curr.x + next.x) / 2
    path += ` C ${cpx} ${curr.y}, ${cpx} ${next.y}, ${next.x} ${next.y}`
  }

  return path
}

function buildFillPath(data: number[], width: number, height: number, padding: number = 2): string {
  const linePath = buildPath(data, width, height, padding)
  if (!linePath) return ''

  const lastX = padding + ((data.length - 1) / (data.length - 1)) * (width - padding * 2)
  return `${linePath} L ${lastX} ${height} L ${padding} ${height} Z`
}

export default function Sparkline({
  data,
  width = 120,
  height = 40,
  color = '#f9ff85',
  fillColor,
  strokeWidth = 2,
  duration = 1.5,
  className = '',
  showDot = true,
}: SparklineProps) {
  const ref = useRef<SVGSVGElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-50px' })

  if (data.length < 2) return null

  const linePath = buildPath(data, width, height)
  const fill = fillColor || color
  const fillPathD = buildFillPath(data, width, height)

  // Last point position for the dot
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const lastPoint = {
    x: 2 + ((data.length - 1) / (data.length - 1)) * (width - 4),
    y: 2 + (1 - (data[data.length - 1] - min) / range) * (height - 4),
  }

  return (
    <svg
      ref={ref}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      style={{ overflow: 'visible' }}
    >
      <defs>
        <linearGradient id={`sparkline-fill-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={fill} stopOpacity="0.2" />
          <stop offset="100%" stopColor={fill} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Fill area */}
      <motion.path
        d={fillPathD}
        fill={`url(#sparkline-fill-${color.replace('#', '')})`}
        initial={{ opacity: 0 }}
        animate={isInView ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: duration * 0.8, delay: duration * 0.3 }}
      />

      {/* Animated line */}
      <motion.path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={isInView ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
        transition={{
          pathLength: { duration, ease: 'easeInOut' },
          opacity: { duration: 0.3 },
        }}
      />

      {/* End dot */}
      {showDot && (
        <motion.circle
          cx={lastPoint.x}
          cy={lastPoint.y}
          r={3}
          fill={color}
          initial={{ scale: 0, opacity: 0 }}
          animate={isInView ? { scale: 1, opacity: 1 } : { scale: 0, opacity: 0 }}
          transition={{ delay: duration, duration: 0.3, type: 'spring', stiffness: 300 }}
        />
      )}

      {/* Glow dot */}
      {showDot && (
        <motion.circle
          cx={lastPoint.x}
          cy={lastPoint.y}
          r={6}
          fill={color}
          initial={{ scale: 0, opacity: 0 }}
          animate={isInView ? { scale: 1, opacity: 0.3 } : { scale: 0, opacity: 0 }}
          transition={{ delay: duration, duration: 0.4, type: 'spring', stiffness: 200 }}
        />
      )}
    </svg>
  )
}
