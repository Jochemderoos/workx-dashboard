'use client'

import { useState, useEffect, useCallback, createContext, useContext } from 'react'
import ZaakOfferPopup from './ZaakOfferPopup'
import toast from 'react-hot-toast'
import { usePushNotifications } from '@/lib/hooks'

interface ZaakOffer {
  id: string
  zaakId: string
  expiresAt: string
  phase: 'INITIAL' | 'REMINDER' // INITIAL = Slack only, REMINDER = Slack + popup
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

interface ZaakContextType {
  pendingOffer: ZaakOffer | null
  refreshOffers: () => Promise<void>
}

const ZaakContext = createContext<ZaakContextType>({
  pendingOffer: null,
  refreshOffers: async () => {},
})

export const useZaakContext = () => useContext(ZaakContext)

interface ZaakNotificationProviderProps {
  children: React.ReactNode
  userRole?: string
}

export default function ZaakNotificationProvider({ children, userRole }: ZaakNotificationProviderProps) {
  const [pendingOffer, setPendingOffer] = useState<ZaakOffer | null>(null)
  const [showPopup, setShowPopup] = useState(false)
  const [hasAskedForPush, setHasAskedForPush] = useState(false)

  // Only show offers for employees (not partners/admins who create zaken)
  const shouldPoll = userRole === 'EMPLOYEE'

  // Push notifications
  const { isSupported, isSubscribed, permission, subscribe } = usePushNotifications()

  // Auto-subscribe to push notifications for employees
  useEffect(() => {
    if (!shouldPoll || !isSupported || isSubscribed || hasAskedForPush) return

    // Only ask once per session
    setHasAskedForPush(true)

    // If permission not yet asked, ask after a short delay
    if (permission === 'default') {
      const timer = setTimeout(async () => {
        const result = await subscribe()
        if (result) {
          toast.success('Push notificaties ingeschakeld')
        }
      }, 5000) // Wait 5 seconds after page load

      return () => clearTimeout(timer)
    } else if (permission === 'granted' && !isSubscribed) {
      // Permission already granted but not subscribed
      subscribe()
    }
  }, [shouldPoll, isSupported, isSubscribed, permission, subscribe, hasAskedForPush])

  const checkForOffers = useCallback(async () => {
    if (!shouldPoll) return

    try {
      const res = await fetch('/api/zaken/pending')
      if (res.ok) {
        const data = await res.json()
        if (data.offer) {
          const offer = data.offer as ZaakOffer
          setPendingOffer(offer)

          // Only show popup in REMINDER phase (after 1 hour of no response)
          // In INITIAL phase, the employee only gets a Slack notification
          if (offer.phase === 'REMINDER') {
            // Check if this is a new reminder or phase change
            if (!pendingOffer || pendingOffer.id !== offer.id || pendingOffer.phase !== 'REMINDER') {
              setShowPopup(true)
              // Play notification sound for reminder
              // new Audio('/notification.mp3').play().catch(() => {})
            }
          } else {
            // INITIAL phase - no popup, just track the offer
            setShowPopup(false)
          }
        } else {
          setPendingOffer(null)
          setShowPopup(false)
        }
      }
    } catch (error) {
      console.error('Error checking for offers:', error)
    }
  }, [shouldPoll, pendingOffer])

  useEffect(() => {
    if (!shouldPoll) return

    // Check immediately on mount
    checkForOffers()

    // Poll every 30 seconds
    const interval = setInterval(checkForOffers, 30000)

    return () => clearInterval(interval)
  }, [checkForOffers, shouldPoll])

  const handleAccept = useCallback(async () => {
    if (!pendingOffer) return

    const res = await fetch('/api/zaken/respond', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        zaakId: pendingOffer.zaakId,
        response: 'ACCEPT',
      }),
    })

    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || 'Failed to accept')
    }

    setPendingOffer(null)
    setShowPopup(false)
  }, [pendingOffer])

  const handleDecline = useCallback(async (reason?: string) => {
    if (!pendingOffer) return

    const res = await fetch('/api/zaken/respond', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        zaakId: pendingOffer.zaakId,
        response: 'DECLINE',
        reason,
      }),
    })

    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || 'Failed to decline')
    }

    toast.success('Zaak is doorgegeven aan de volgende collega')
    setPendingOffer(null)
    setShowPopup(false)
  }, [pendingOffer])

  const refreshOffers = useCallback(async () => {
    await checkForOffers()
  }, [checkForOffers])

  return (
    <ZaakContext.Provider value={{ pendingOffer, refreshOffers }}>
      {children}
      {showPopup && pendingOffer && (
        <ZaakOfferPopup
          offer={pendingOffer}
          onAccept={handleAccept}
          onDecline={handleDecline}
        />
      )}
    </ZaakContext.Provider>
  )
}
