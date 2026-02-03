'use client'

import { useState, useEffect, useCallback, createContext, useContext } from 'react'
import ZaakOfferPopup from './ZaakOfferPopup'
import toast from 'react-hot-toast'

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

  // Only show offers for employees (not partners/admins who create zaken)
  const shouldPoll = userRole === 'EMPLOYEE'

  const checkForOffers = useCallback(async () => {
    if (!shouldPoll) return

    try {
      const res = await fetch('/api/zaken/pending')
      if (res.ok) {
        const data = await res.json()
        if (data.offer) {
          // Check if this is a new offer
          if (!pendingOffer || pendingOffer.id !== data.offer.id) {
            setPendingOffer(data.offer)
            setShowPopup(true)
            // Play notification sound (optional)
            // new Audio('/notification.mp3').play().catch(() => {})
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
