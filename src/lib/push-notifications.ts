// Server-side push notification utilities
// Only import in API routes, not client components

import webpush from 'web-push'
import { prisma } from '@/lib/prisma'

// Initialize web-push with VAPID keys (lazy initialization)
// Generate keys with: npx web-push generate-vapid-keys
export const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || ''

let isInitialized = false

function initializeWebPush() {
  if (isInitialized) return
  if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
      'mailto:info@workx.nl',
      VAPID_PUBLIC_KEY,
      VAPID_PRIVATE_KEY
    )
    isInitialized = true
  }
}

export interface PushPayload {
  title: string
  body: string
  url?: string
  tag?: string
  requireInteraction?: boolean
  actions?: Array<{ action: string; title: string }>
}

/**
 * Send a push notification to a specific user
 */
export async function sendPushNotification(
  userId: string,
  payload: PushPayload
): Promise<{ sent: number; failed: number }> {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.warn('VAPID keys not configured, skipping push notification')
    return { sent: 0, failed: 0 }
  }

  // Initialize web-push on first use
  initializeWebPush()

  // Get all push subscriptions for this user
  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
  })

  let sent = 0
  let failed = 0

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        },
        JSON.stringify(payload)
      )
      sent++
    } catch (error: any) {
      console.error('Push notification failed:', error)
      failed++

      // If subscription is no longer valid, remove it
      if (error.statusCode === 404 || error.statusCode === 410) {
        await prisma.pushSubscription.delete({
          where: { id: sub.id },
        }).catch(() => {})
      }
    }
  }

  return { sent, failed }
}

/**
 * Send push notification to multiple users
 */
export async function sendPushNotificationToUsers(
  userIds: string[],
  payload: PushPayload
): Promise<{ sent: number; failed: number }> {
  let totalSent = 0
  let totalFailed = 0

  for (const userId of userIds) {
    const result = await sendPushNotification(userId, payload)
    totalSent += result.sent
    totalFailed += result.failed
  }

  return { sent: totalSent, failed: totalFailed }
}

/**
 * Send zaak offer reminder push notification
 */
export async function sendZaakReminderPush(
  userId: string,
  zaak: {
    title: string
    clientName?: string
    createdByName: string
  }
): Promise<boolean> {
  const result = await sendPushNotification(userId, {
    title: 'Herinnering: Zaak wacht op reactie!',
    body: `${zaak.title}${zaak.clientName ? ` - ${zaak.clientName}` : ''}\nVan: ${zaak.createdByName}`,
    url: '/dashboard/werk',
    tag: 'zaak-reminder',
    requireInteraction: true,
    actions: [
      { action: 'view', title: 'Bekijken' },
    ],
  })

  return result.sent > 0
}
