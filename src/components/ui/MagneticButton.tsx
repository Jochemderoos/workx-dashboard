'use client'

import { useRef, useState, ReactNode, useCallback } from 'react'
import { motion, useMotionValue, useSpring } from 'framer-motion'

interface MagneticButtonProps {
  children: ReactNode
  className?: string
  /** Magnetic pull strength (0-1) - default 0.3 */
  strength?: number
  /** Magnetic radius in px - default 150 */
  radius?: number
  /** Spring stiffness - default 150 */
  stiffness?: number
  /** Spring damping - default 15 */
  damping?: number
  /** onClick handler */
  onClick?: () => void
  /** Render as different element */
  as?: any
  [key: string]: any
}

export default function MagneticButton({
  children,
  className = '',
  strength = 0.3,
  radius = 150,
  stiffness = 150,
  damping = 15,
  onClick,
  as: Component = 'button',
  ...props
}: MagneticButtonProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [isHovered, setIsHovered] = useState(false)

  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const springX = useSpring(x, { stiffness, damping })
  const springY = useSpring(y, { stiffness, damping })

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    const deltaX = e.clientX - centerX
    const deltaY = e.clientY - centerY
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)

    if (distance < radius) {
      const pull = (1 - distance / radius) * strength
      x.set(deltaX * pull)
      y.set(deltaY * pull)
    }
  }, [radius, strength, x, y])

  const handleMouseLeave = useCallback(() => {
    x.set(0)
    y.set(0)
    setIsHovered(false)
  }, [x, y])

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true)
  }, [])

  const MotionComponent = motion.create(Component)

  return (
    <MotionComponent
      ref={ref}
      className={className}
      style={{ x: springX, y: springY }}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      whileTap={{ scale: 0.95 }}
      {...props}
    >
      {children}
    </MotionComponent>
  )
}
