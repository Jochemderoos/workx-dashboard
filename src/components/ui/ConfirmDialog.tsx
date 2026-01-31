'use client'

import { useEffect, useCallback } from 'react'
import { Icons } from './Icons'

interface ConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title?: string
  message?: string
  confirmText?: string
  cancelText?: string
  type?: 'danger' | 'warning' | 'info'
  isLoading?: boolean
}

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = 'Bevestigen',
  message = 'Weet je dit zeker?',
  confirmText = 'Bevestigen',
  cancelText = 'Annuleren',
  type = 'danger',
  isLoading = false,
}: ConfirmDialogProps) {
  // Handle escape key
  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && !isLoading) {
      onClose()
    }
  }, [onClose, isLoading])

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [isOpen, handleEscape])

  if (!isOpen) return null

  const typeConfig = {
    danger: {
      icon: Icons.alertTriangle,
      iconBg: 'bg-red-500/10',
      iconColor: 'text-red-400',
      buttonClass: 'bg-red-500 hover:bg-red-600 text-white',
    },
    warning: {
      icon: Icons.alertTriangle,
      iconBg: 'bg-orange-500/10',
      iconColor: 'text-orange-400',
      buttonClass: 'bg-orange-500 hover:bg-orange-600 text-white',
    },
    info: {
      icon: Icons.info,
      iconBg: 'bg-blue-500/10',
      iconColor: 'text-blue-400',
      buttonClass: 'bg-blue-500 hover:bg-blue-600 text-white',
    },
  }

  const config = typeConfig[type]
  const IconComponent = config.icon

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 fade-in"
      onClick={() => !isLoading && onClose()}
    >
      <div
        className="bg-workx-gray rounded-2xl p-6 w-full max-w-sm border border-white/10 shadow-2xl relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Decorative glow */}
        <div className={`absolute top-0 right-0 w-32 h-32 ${config.iconBg} rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 pointer-events-none`} />

        <div className="relative">
          {/* Icon & Title */}
          <div className="flex items-center gap-4 mb-4">
            <div className={`w-12 h-12 rounded-xl ${config.iconBg} flex items-center justify-center flex-shrink-0`}>
              <IconComponent className={config.iconColor} size={24} />
            </div>
            <div>
              <h2 className="font-semibold text-white text-lg">{title}</h2>
              <p className="text-sm text-white/50 mt-0.5">{message}</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 mt-6">
            <button
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 btn-secondary disabled:opacity-50"
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              disabled={isLoading}
              className={`flex-1 px-4 py-2.5 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${config.buttonClass} disabled:opacity-50`}
            >
              {isLoading ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Icons.check size={16} />
                  {confirmText}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Hook for easier usage
import { useState } from 'react'

interface UseConfirmOptions {
  title?: string
  message?: string
  confirmText?: string
  cancelText?: string
  type?: 'danger' | 'warning' | 'info'
}

export function useConfirm() {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [options, setOptions] = useState<UseConfirmOptions>({})
  const [resolveRef, setResolveRef] = useState<((value: boolean) => void) | null>(null)

  const confirm = (opts: UseConfirmOptions = {}): Promise<boolean> => {
    setOptions(opts)
    setIsOpen(true)
    return new Promise((resolve) => {
      setResolveRef(() => resolve)
    })
  }

  const handleConfirm = () => {
    if (resolveRef) {
      resolveRef(true)
      setResolveRef(null)
    }
    setIsOpen(false)
  }

  const handleClose = () => {
    if (resolveRef) {
      resolveRef(false)
      setResolveRef(null)
    }
    setIsOpen(false)
  }

  const ConfirmDialogComponent = () => (
    <ConfirmDialog
      isOpen={isOpen}
      onClose={handleClose}
      onConfirm={handleConfirm}
      isLoading={isLoading}
      {...options}
    />
  )

  return {
    confirm,
    setIsLoading,
    ConfirmDialogComponent,
  }
}
