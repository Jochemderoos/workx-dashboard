'use client'

import { useEffect, useRef, useState } from 'react'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  opacity: number
  color: string
}

interface AmbientBackgroundProps {
  particleCount?: number
  colors?: string[]
  speed?: number
  interactive?: boolean
  className?: string
}

export function AmbientBackground({
  particleCount = 30,
  colors = ['#f9ff85', '#60a5fa', '#a78bfa'],
  speed = 0.3,
  interactive = true,
  className = '',
}: AmbientBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mouseRef = useRef({ x: 0, y: 0 })
  const particlesRef = useRef<Particle[]>([])
  const animationRef = useRef<number>()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size
    const resizeCanvas = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)

    // Initialize particles
    particlesRef.current = Array.from({ length: particleCount }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * speed,
      vy: (Math.random() - 0.5) * speed,
      size: Math.random() * 3 + 1,
      opacity: Math.random() * 0.5 + 0.1,
      color: colors[Math.floor(Math.random() * colors.length)],
    }))

    // Mouse tracking
    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY }
    }
    if (interactive) {
      window.addEventListener('mousemove', handleMouseMove)
    }

    // Animation loop
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      particlesRef.current.forEach((particle, i) => {
        // Update position
        particle.x += particle.vx
        particle.y += particle.vy

        // Mouse interaction
        if (interactive) {
          const dx = mouseRef.current.x - particle.x
          const dy = mouseRef.current.y - particle.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 150) {
            const force = (150 - dist) / 150
            particle.vx -= (dx / dist) * force * 0.02
            particle.vy -= (dy / dist) * force * 0.02
          }
        }

        // Boundary wrapping
        if (particle.x < 0) particle.x = canvas.width
        if (particle.x > canvas.width) particle.x = 0
        if (particle.y < 0) particle.y = canvas.height
        if (particle.y > canvas.height) particle.y = 0

        // Apply friction
        particle.vx *= 0.99
        particle.vy *= 0.99

        // Re-apply minimum velocity
        if (Math.abs(particle.vx) < 0.1) particle.vx = (Math.random() - 0.5) * speed
        if (Math.abs(particle.vy) < 0.1) particle.vy = (Math.random() - 0.5) * speed

        // Draw particle
        ctx.beginPath()
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2)
        ctx.fillStyle = particle.color
        ctx.globalAlpha = particle.opacity
        ctx.fill()

        // Draw connections
        particlesRef.current.slice(i + 1).forEach((other) => {
          const dx = particle.x - other.x
          const dy = particle.y - other.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 120) {
            ctx.beginPath()
            ctx.moveTo(particle.x, particle.y)
            ctx.lineTo(other.x, other.y)
            ctx.strokeStyle = particle.color
            ctx.globalAlpha = (1 - dist / 120) * 0.15
            ctx.stroke()
          }
        })
      })

      animationRef.current = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      window.removeEventListener('resize', resizeCanvas)
      if (interactive) {
        window.removeEventListener('mousemove', handleMouseMove)
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [particleCount, colors, speed, interactive])

  return (
    <canvas
      ref={canvasRef}
      className={`fixed inset-0 pointer-events-none z-0 ${className}`}
      style={{ opacity: 0.4 }}
    />
  )
}

// Floating orbs component for a more subtle effect
export function FloatingOrbs() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {/* Large lime orb - top right */}
      <div
        className="absolute w-[600px] h-[600px] rounded-full animate-float"
        style={{
          top: '-200px',
          right: '-200px',
          background: 'radial-gradient(circle, rgba(249, 255, 133, 0.08) 0%, transparent 70%)',
          animationDuration: '8s',
        }}
      />

      {/* Medium blue orb - bottom left */}
      <div
        className="absolute w-[400px] h-[400px] rounded-full animate-float"
        style={{
          bottom: '-100px',
          left: '-100px',
          background: 'radial-gradient(circle, rgba(96, 165, 250, 0.06) 0%, transparent 70%)',
          animationDuration: '10s',
          animationDelay: '-2s',
        }}
      />

      {/* Small purple orb - center */}
      <div
        className="absolute w-[300px] h-[300px] rounded-full animate-float"
        style={{
          top: '40%',
          left: '30%',
          background: 'radial-gradient(circle, rgba(167, 139, 250, 0.04) 0%, transparent 70%)',
          animationDuration: '12s',
          animationDelay: '-4s',
        }}
      />

      {/* Extra small lime orb - top left */}
      <div
        className="absolute w-[200px] h-[200px] rounded-full animate-float"
        style={{
          top: '20%',
          left: '10%',
          background: 'radial-gradient(circle, rgba(249, 255, 133, 0.05) 0%, transparent 70%)',
          animationDuration: '6s',
          animationDelay: '-1s',
        }}
      />
    </div>
  )
}

// Gradient mesh background
export function GradientMesh() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0">
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(at 0% 0%, rgba(249, 255, 133, 0.1) 0%, transparent 50%),
            radial-gradient(at 100% 0%, rgba(96, 165, 250, 0.08) 0%, transparent 50%),
            radial-gradient(at 100% 100%, rgba(167, 139, 250, 0.08) 0%, transparent 50%),
            radial-gradient(at 0% 100%, rgba(249, 255, 133, 0.05) 0%, transparent 50%)
          `,
        }}
      />
    </div>
  )
}

// Spotlight cursor follower
export function SpotlightCursor() {
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setPosition({ x: e.clientX, y: e.clientY })
      setVisible(true)
    }

    const handleMouseLeave = () => {
      setVisible(false)
    }

    window.addEventListener('mousemove', handleMouseMove)
    document.body.addEventListener('mouseleave', handleMouseLeave)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      document.body.removeEventListener('mouseleave', handleMouseLeave)
    }
  }, [])

  return (
    <div
      className="fixed pointer-events-none z-[1] transition-opacity duration-300"
      style={{
        left: position.x,
        top: position.y,
        opacity: visible ? 1 : 0,
        transform: 'translate(-50%, -50%)',
      }}
    >
      <div
        className="w-[300px] h-[300px] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(249, 255, 133, 0.06) 0%, transparent 70%)',
        }}
      />
    </div>
  )
}

export default AmbientBackground
