'use client'

import { useEffect, useRef, useState, ReactNode, useCallback } from 'react'
import { Icons } from './Icons'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  titleIcon?: ReactNode
  children: ReactNode
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  // Optional: Y position where modal should appear (from click event)
  clickY?: number
}

export function Modal({
  isOpen,
  onClose,
  title,
  titleIcon,
  children,
  maxWidth = 'md',
  clickY,
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  const [topPosition, setTopPosition] = useState<number | null>(null)
  const [isPositioned, setIsPositioned] = useState(false)

  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
  }

  // Calculate position after modal renders
  const calculatePosition = useCallback(() => {
    if (!modalRef.current) return

    const modalHeight = modalRef.current.offsetHeight
    const viewportHeight = window.innerHeight
    const padding = 16

    let newTop: number

    if (clickY !== undefined && clickY > 0) {
      // Position modal so top is near click point, but not above it
      // The modal should appear "below" or "at" the click position
      newTop = clickY - 50 // Start slightly above click point

      // Make sure modal doesn't go off the bottom
      if (newTop + modalHeight > viewportHeight - padding) {
        newTop = viewportHeight - modalHeight - padding
      }

      // Make sure modal doesn't go off the top
      if (newTop < padding) {
        newTop = padding
      }
    } else {
      // Default: center vertically
      newTop = Math.max(padding, (viewportHeight - modalHeight) / 2)
    }

    setTopPosition(newTop)
    setIsPositioned(true)
  }, [clickY])

  // Calculate position when modal opens or content changes
  useEffect(() => {
    if (isOpen) {
      // Small delay to ensure content is rendered
      const timer = setTimeout(calculatePosition, 10)
      return () => clearTimeout(timer)
    } else {
      setIsPositioned(false)
      setTopPosition(null)
    }
  }, [isOpen, calculatePosition])

  // Recalculate on window resize
  useEffect(() => {
    if (!isOpen) return

    const handleResize = () => calculatePosition()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [isOpen, calculatePosition])

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      const scrollY = window.scrollY
      document.body.style.position = 'fixed'
      document.body.style.top = `-${scrollY}px`
      document.body.style.width = '100%'
      return () => {
        document.body.style.position = ''
        document.body.style.top = ''
        document.body.style.width = ''
        window.scrollTo(0, scrollY)
      }
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        style={{
          position: 'fixed',
          top: topPosition !== null ? `${topPosition}px` : '50%',
          left: '50%',
          transform: topPosition !== null ? 'translateX(-50%)' : 'translate(-50%, -50%)',
          opacity: isPositioned ? 1 : 0,
          maxHeight: 'calc(100vh - 32px)',
        }}
        className={`bg-workx-gray rounded-2xl w-[calc(100%-32px)] ${maxWidthClasses[maxWidth]} border border-white/10 shadow-2xl transition-opacity duration-150 flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="flex items-center justify-between p-5 border-b border-white/5 flex-shrink-0">
            <div className="flex items-center gap-3">
              {titleIcon}
              <h2 className="font-semibold text-white text-lg">{title}</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
            >
              <Icons.x size={18} />
            </button>
          </div>
        )}
        {!title && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors z-10"
          >
            <Icons.x size={18} />
          </button>
        )}
        <div className="overflow-y-auto flex-1">
          {children}
        </div>
      </div>
    </div>
  )
}

// Helper hook to capture click Y position
export function useModalPosition() {
  const [clickY, setClickY] = useState<number | undefined>(undefined)

  const captureClick = (e: React.MouseEvent) => {
    setClickY(e.clientY)
  }

  const resetPosition = () => {
    setClickY(undefined)
  }

  return { clickY, captureClick, resetPosition }
}
