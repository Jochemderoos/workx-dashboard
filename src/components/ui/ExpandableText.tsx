'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'

interface ExpandableTextProps {
  text: string | null
  onChange?: (value: string) => void
  placeholder?: string
  maxLines?: number
  className?: string
  editClassName?: string
  readOnly?: boolean
}

// Floating preview card on hover
function HoverPreview({
  text,
  anchorRef,
}: {
  text: string
  anchorRef: React.RefObject<HTMLElement | null>
}) {
  const [style, setStyle] = useState<React.CSSProperties>({ opacity: 0, position: 'fixed', zIndex: 9999 })
  const cardRef = useRef<HTMLDivElement>(null)

  // Two-pass positioning: render offscreen first, then measure and position
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (!anchorRef.current || !cardRef.current) return
      const rect = anchorRef.current.getBoundingClientRect()
      const cardRect = cardRef.current.getBoundingClientRect()
      const cardWidth = Math.min(440, window.innerWidth - 32)
      const cardHeight = cardRect.height
      const viewH = window.innerHeight
      const margin = 12

      // Decide vertical placement: prefer above, fall back to below, constrain to viewport
      const spaceAbove = rect.top - margin
      const spaceBelow = viewH - rect.bottom - margin
      let top: number

      if (spaceAbove >= cardHeight) {
        // Fits above
        top = rect.top - cardHeight - 8
      } else if (spaceBelow >= cardHeight) {
        // Fits below
        top = rect.bottom + 8
      } else {
        // Doesn't fit either way — pin to whichever side has more room, card will scroll
        top = spaceAbove > spaceBelow ? margin : rect.bottom + 8
      }

      // Clamp to viewport
      if (top + cardHeight > viewH - margin) {
        top = viewH - cardHeight - margin
      }
      if (top < margin) top = margin

      // Horizontal
      let left = rect.left
      if (left + cardWidth > window.innerWidth - 16) {
        left = window.innerWidth - cardWidth - 16
      }
      if (left < 16) left = 16

      setStyle({
        position: 'fixed',
        top,
        left,
        width: cardWidth,
        opacity: 1,
        zIndex: 9999,
      })
    })
    return () => cancelAnimationFrame(frame)
  }, [anchorRef])

  // Max height = 60vh so the card is always scrollable within the viewport
  return createPortal(
    <div
      ref={cardRef}
      style={style}
      className="pointer-events-none fade-in-scale"
    >
      <div className="bg-workx-gray/95 backdrop-blur-xl border border-white/15 rounded-2xl shadow-2xl shadow-black/40 p-5 ring-1 ring-white/5">
        <p className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed max-h-[60vh] overflow-y-auto">
          {text}
        </p>
      </div>
    </div>,
    document.body
  )
}

export default function ExpandableText({
  text,
  onChange,
  placeholder = 'Klik om tekst toe te voegen...',
  maxLines = 2,
  className = '',
  editClassName = '',
  readOnly = false,
}: ExpandableTextProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [isTruncated, setIsTruncated] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLParagraphElement>(null)
  const editRef = useRef<HTMLTextAreaElement>(null)
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const displayText = text || ''

  // Check if text is actually truncated (compare scrollHeight of the clamped <p>)
  useEffect(() => {
    if (textRef.current) {
      setIsTruncated(textRef.current.scrollHeight > textRef.current.clientHeight + 2)
    }
  }, [displayText, maxLines])

  // Auto-focus and auto-resize textarea on edit
  useEffect(() => {
    if (isEditing && editRef.current) {
      editRef.current.focus()
      editRef.current.selectionStart = editRef.current.value.length
      editRef.current.style.height = 'auto'
      editRef.current.style.height = editRef.current.scrollHeight + 'px'
    }
  }, [isEditing])

  const handleMouseEnter = useCallback(() => {
    if (isEditing || !isTruncated) return
    hoverTimer.current = setTimeout(() => setShowPreview(true), 350)
  }, [isEditing, isTruncated])

  const handleMouseLeave = useCallback(() => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current)
    setShowPreview(false)
  }, [])

  const handleClick = () => {
    if (readOnly || isEditing) return
    if (!onChange) return
    setShowPreview(false)
    setIsEditing(true)
  }

  const handleBlur = () => {
    setIsEditing(false)
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange?.(e.target.value)
    // Auto-resize
    e.target.style.height = 'auto'
    e.target.style.height = e.target.scrollHeight + 'px'
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsEditing(false)
    }
  }

  if (isEditing) {
    return (
      <textarea
        ref={editRef}
        value={displayText}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className={`w-full bg-white/5 border border-workx-lime/30 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-workx-lime/50 resize-none ring-2 ring-workx-lime/10 ${editClassName}`}
        rows={3}
      />
    )
  }

  return (
    <div
      ref={wrapperRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      className={`relative ${onChange && !readOnly ? 'cursor-pointer' : ''} group/text ${className}`}
    >
      {displayText ? (
        <div className="relative">
          <p
            ref={textRef}
            className={`text-sm text-gray-400 whitespace-pre-wrap leading-relaxed transition-colors ${
              onChange && !readOnly ? 'group-hover/text:text-gray-300' : ''
            }`}
            style={!isExpanded ? {
              display: '-webkit-box',
              WebkitLineClamp: maxLines,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            } : undefined}
          >
            {displayText}
          </p>
          {/* Expand hint — no gradient overlay (caused ugly gray line on light mode) */}
          {isTruncated && (
            <div className="flex items-center justify-end mt-0.5">
              <button
                onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded) }}
                className="text-[10px] text-workx-lime/60 font-medium tracking-wide cursor-pointer hover:text-workx-lime transition-colors"
              >
                {isExpanded ? 'minder tonen ▴' : 'meer tonen ▾'}
              </button>
            </div>
          )}
        </div>
      ) : onChange && !readOnly ? (
        <p className="text-sm text-white/20 italic">{placeholder}</p>
      ) : null}

      {/* Hover preview */}
      {showPreview && displayText && (
        <HoverPreview text={displayText} anchorRef={wrapperRef} />
      )}
    </div>
  )
}
