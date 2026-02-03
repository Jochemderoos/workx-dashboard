'use client'

import { useState, useEffect, useCallback } from 'react'
import { Icons } from '@/components/ui/Icons'
import { URGENCY_CONFIG, START_METHOD_LABELS } from '@/lib/zaken-constants'

interface ZaakOffer {
  id: string
  zaakId: string
  expiresAt: string
  zaak: {
    id: string
    shortDescription: string
    fullDescription?: string
    urgency: string
    startMethod: string
    startInstructions?: string
    startsQuickly: boolean
    clientName?: string
    createdBy: { name: string }
  }
}

interface ZaakOfferPopupProps {
  offer: ZaakOffer
  onAccept: () => Promise<void>
  onDecline: (reason?: string) => Promise<void>
}

// Simple confetti effect
function Confetti() {
  const [particles, setParticles] = useState<Array<{ id: number; x: number; delay: number; color: string }>>([])

  useEffect(() => {
    const colors = ['#f9ff85', '#22c55e', '#3b82f6', '#f59e0b', '#ec4899']
    const newParticles = Array.from({ length: 50 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      delay: Math.random() * 2,
      color: colors[Math.floor(Math.random() * colors.length)],
    }))
    setParticles(newParticles)
  }, [])

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute w-3 h-3 rounded-full animate-confetti"
          style={{
            left: `${p.x}%`,
            top: '-20px',
            backgroundColor: p.color,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
      <style jsx>{`
        @keyframes confetti {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }
        .animate-confetti {
          animation: confetti 3s ease-out forwards;
        }
      `}</style>
    </div>
  )
}

// Thank you screen
function ThankYouScreen({ name, onClose }: { name: string; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000)
    return () => clearTimeout(timer)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      <Confetti />
      <div className="relative bg-gradient-to-br from-green-500/20 to-green-600/10 border border-green-500/30 rounded-3xl p-12 text-center max-w-lg mx-4 animate-scale-in">
        <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6">
          <Icons.check className="text-green-400" size={40} />
        </div>
        <h1 className="text-3xl font-bold text-white mb-4">
          Bedankt {name}!
        </h1>
        <p className="text-xl text-green-400 mb-2">
          Je inzet wordt enorm gewaardeerd
        </p>
        <p className="text-gray-400">
          De zaak is aan jou toegewezen. Succes!
        </p>
      </div>
      <style jsx>{`
        @keyframes scale-in {
          0% {
            transform: scale(0.8);
            opacity: 0;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
        .animate-scale-in {
          animation: scale-in 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  )
}

export default function ZaakOfferPopup({ offer, onAccept, onDecline }: ZaakOfferPopupProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [showDeclineReason, setShowDeclineReason] = useState(false)
  const [declineReason, setDeclineReason] = useState('')
  const [showThankYou, setShowThankYou] = useState(false)
  const [timeLeft, setTimeLeft] = useState('')
  const [userName, setUserName] = useState('')

  const urgency = URGENCY_CONFIG[offer.zaak.urgency as keyof typeof URGENCY_CONFIG] || URGENCY_CONFIG.NORMAL

  // Calculate time remaining
  useEffect(() => {
    const updateTimer = () => {
      const now = new Date()
      const expires = new Date(offer.expiresAt)
      const diff = expires.getTime() - now.getTime()

      if (diff <= 0) {
        setTimeLeft('Verlopen')
        return
      }

      const hours = Math.floor(diff / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)

      setTimeLeft(`${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`)
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)
    return () => clearInterval(interval)
  }, [offer.expiresAt])

  const handleAccept = useCallback(async () => {
    setIsLoading(true)
    try {
      await onAccept()
      // Get user name from response or session
      setUserName('') // Will be set by parent
      setShowThankYou(true)
    } catch (error) {
      console.error('Accept failed:', error)
    } finally {
      setIsLoading(false)
    }
  }, [onAccept])

  const handleDecline = useCallback(async () => {
    setIsLoading(true)
    try {
      await onDecline(declineReason || undefined)
    } catch (error) {
      console.error('Decline failed:', error)
    } finally {
      setIsLoading(false)
    }
  }, [onDecline, declineReason])

  if (showThankYou) {
    return <ThankYouScreen name={userName || 'collega'} onClose={() => window.location.reload()} />
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative w-full max-w-xl bg-gradient-to-br from-workx-dark to-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-slide-up">
        {/* Header with urgency indicator */}
        <div className={`px-6 py-4 border-b border-white/10 ${urgency.bgColor}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-workx-lime/20 flex items-center justify-center">
                <Icons.briefcase className="text-workx-lime" size={20} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Nieuwe zaak voor jou!</h2>
                <p className="text-sm text-gray-400">Van {offer.zaak.createdBy.name}</p>
              </div>
            </div>
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${urgency.bgColor} ${urgency.textColor}`}>
              {urgency.label}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Description */}
          <div>
            <h3 className="text-xl font-medium text-white mb-2">{offer.zaak.shortDescription}</h3>
            {offer.zaak.fullDescription && (
              <p className="text-gray-400 text-sm">{offer.zaak.fullDescription}</p>
            )}
          </div>

          {/* Details grid */}
          <div className="grid grid-cols-2 gap-4">
            {offer.zaak.clientName && (
              <div className="bg-white/5 rounded-xl p-3">
                <p className="text-xs text-gray-500 mb-1">Klant</p>
                <p className="text-white font-medium">{offer.zaak.clientName}</p>
              </div>
            )}
            <div className="bg-white/5 rounded-xl p-3">
              <p className="text-xs text-gray-500 mb-1">Hoe te starten</p>
              <p className="text-white font-medium text-sm">
                {START_METHOD_LABELS[offer.zaak.startMethod as keyof typeof START_METHOD_LABELS]}
              </p>
            </div>
            {offer.zaak.startsQuickly && (
              <div className="bg-amber-500/10 rounded-xl p-3 col-span-2">
                <div className="flex items-center gap-2">
                  <Icons.zap className="text-amber-400" size={16} />
                  <p className="text-amber-400 font-medium">Deze zaak gaat snel lopen!</p>
                </div>
              </div>
            )}
          </div>

          {offer.zaak.startInstructions && (
            <div className="bg-blue-500/10 rounded-xl p-4">
              <p className="text-xs text-blue-400 mb-1">Extra instructies</p>
              <p className="text-white text-sm">{offer.zaak.startInstructions}</p>
            </div>
          )}

          {/* Timer warning */}
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icons.clock className="text-amber-400" size={18} />
                <span className="text-amber-400 text-sm">Tijd om te reageren:</span>
              </div>
              <span className="text-amber-400 font-mono font-bold text-lg">{timeLeft}</span>
            </div>
          </div>

          {/* Decline reason input */}
          {showDeclineReason && (
            <div className="space-y-2 animate-fade-in">
              <label className="text-sm text-gray-400">Reden (optioneel)</label>
              <input
                type="text"
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                placeholder="Bijv. te druk met andere zaak..."
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-workx-lime/50 focus:ring-0 outline-none"
              />
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="p-6 pt-0 space-y-3">
          {!showDeclineReason ? (
            <>
              <button
                onClick={handleAccept}
                disabled={isLoading}
                className="w-full py-4 bg-workx-lime text-workx-dark font-semibold rounded-xl hover:bg-workx-lime/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <span className="w-5 h-5 border-2 border-workx-dark/30 border-t-workx-dark rounded-full animate-spin" />
                ) : (
                  <>
                    <Icons.check size={20} />
                    Ja, ik pak deze zaak op
                  </>
                )}
              </button>
              <button
                onClick={() => setShowDeclineReason(true)}
                disabled={isLoading}
                className="w-full py-4 bg-white/5 text-gray-400 font-medium rounded-xl hover:bg-white/10 hover:text-white transition-colors disabled:opacity-50"
              >
                Nee, doorsturen naar collega
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleDecline}
                disabled={isLoading}
                className="w-full py-4 bg-red-500/20 text-red-400 font-semibold rounded-xl hover:bg-red-500/30 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <span className="w-5 h-5 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
                ) : (
                  'Bevestig: Doorsturen'
                )}
              </button>
              <button
                onClick={() => setShowDeclineReason(false)}
                disabled={isLoading}
                className="w-full py-3 text-gray-500 hover:text-white transition-colors"
              >
                Annuleren
              </button>
            </>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes slide-up {
          0% {
            transform: translateY(20px);
            opacity: 0;
          }
          100% {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out forwards;
        }
        @keyframes fade-in {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
        .animate-fade-in {
          animation: fade-in 0.2s ease-out forwards;
        }
      `}</style>
    </div>
  )
}
