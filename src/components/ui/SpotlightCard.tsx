'use client'

import { useRef, useState, ReactNode, useCallback } from 'react'

interface SpotlightCardProps {
  children: ReactNode
  className?: string
  /** Spotlight color - default is workx-lime */
  spotlightColor?: string
  /** Spotlight size in px - default 350 */
  spotlightSize?: number
  /** Enable 3D tilt effect - default true */
  tilt?: boolean
  /** Max tilt angle in degrees - default 6 */
  maxTilt?: number
  /** Render as a different element (e.g. 'a', Link) */
  as?: any
  [key: string]: any
}

export default function SpotlightCard({
  children,
  className = '',
  spotlightColor = 'rgba(249, 255, 133, 0.08)',
  spotlightSize = 350,
  tilt = true,
  maxTilt = 6,
  as: Component = 'div',
  ...props
}: SpotlightCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [spotlightPos, setSpotlightPos] = useState({ x: 0, y: 0 })
  const [isHovered, setIsHovered] = useState(false)
  const [tiltTransform, setTiltTransform] = useState('')

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return
    const rect = cardRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    // Spotlight position
    setSpotlightPos({ x, y })

    // 3D tilt
    if (tilt) {
      const centerX = rect.width / 2
      const centerY = rect.height / 2
      const rotateX = ((y - centerY) / centerY) * -maxTilt
      const rotateY = ((x - centerX) / centerX) * maxTilt
      setTiltTransform(`perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`)
    }
  }, [tilt, maxTilt])

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true)
  }, [])

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false)
    setTiltTransform('')
  }, [])

  return (
    <Component
      ref={cardRef}
      className={`relative ${className}`}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        transform: isHovered && tilt ? tiltTransform : 'perspective(800px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)',
        transition: isHovered ? 'transform 0.1s ease-out' : 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        willChange: isHovered ? 'transform' : 'auto',
      }}
      {...props}
    >
      {/* Spotlight radial gradient overlay */}
      <div
        className="pointer-events-none absolute inset-0 z-10 rounded-[inherit] transition-opacity duration-300"
        style={{
          opacity: isHovered ? 1 : 0,
          background: `radial-gradient(${spotlightSize}px circle at ${spotlightPos.x}px ${spotlightPos.y}px, ${spotlightColor}, transparent 70%)`,
        }}
      />
      {/* Spotlight border glow */}
      <div
        className="pointer-events-none absolute inset-0 z-10 rounded-[inherit] transition-opacity duration-300"
        style={{
          opacity: isHovered ? 1 : 0,
          background: `radial-gradient(${spotlightSize * 0.6}px circle at ${spotlightPos.x}px ${spotlightPos.y}px, rgba(249, 255, 133, 0.12), transparent 70%)`,
          mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
          maskComposite: 'exclude',
          WebkitMaskComposite: 'xor',
          padding: '1px',
        }}
      />
      {children}
    </Component>
  )
}
