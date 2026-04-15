'use client'

import { useState, useEffect, useRef } from 'react'
import { Icons } from '@/components/ui/Icons'
import * as Popover from '@radix-ui/react-popover'
import { formatDistanceToNow } from 'date-fns'
import { nl } from 'date-fns/locale'
import { useNotifications } from '@/lib/hooks/useData'
import { AnnouncementModal, type AnnouncementInitial } from '@/components/AnnouncementModal'

interface Notification {
  id: string
  type: 'zaak' | 'vacation' | 'feedback' | 'calendar' | 'werkverdeling' | 'system' | 'lustrum' | 'overdracht' | 'announcement'
  title: string
  message: string
  createdAt: Date
  read: boolean
  href?: string
  icon?: string
  priority?: string
  announcementId?: string
  senderId?: string
  senderName?: string
}

interface NotificationCenterProps {
  userId: string
  userRole?: string
}

export function NotificationCenter({ userId, userRole }: NotificationCenterProps) {
  const { data, isLoading, mutate } = useNotifications()
  const [isOpen, setIsOpen] = useState(false)
  const [editing, setEditing] = useState<AnnouncementInitial | null>(null)
  const seenAnnouncementIds = useRef<Set<string> | null>(null)

  const notifications: Notification[] = data?.notifications || []
  const unreadCount: number = data?.unreadCount || 0

  // Play a short two-tone "bing" via Web Audio API when a new announcement arrives.
  useEffect(() => {
    const announcementIds = notifications
      .filter((n) => n.type === 'announcement')
      .map((n) => n.id)

    // First load: prime the set without playing a sound.
    if (seenAnnouncementIds.current === null) {
      seenAnnouncementIds.current = new Set(announcementIds)
      return
    }

    const newOnes = announcementIds.filter((id) => !seenAnnouncementIds.current!.has(id))
    if (newOnes.length === 0) return

    // Update seen set and play sound.
    newOnes.forEach((id) => seenAnnouncementIds.current!.add(id))

    try {
      const AudioCtx =
        typeof window !== 'undefined' &&
        (window.AudioContext || (window as any).webkitAudioContext)
      if (!AudioCtx) return
      const ctx = new AudioCtx()
      const now = ctx.currentTime

      const playTone = (freq: number, start: number, duration: number) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.value = freq
        gain.gain.setValueAtTime(0, now + start)
        gain.gain.linearRampToValueAtTime(0.18, now + start + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.0001, now + start + duration)
        osc.connect(gain).connect(ctx.destination)
        osc.start(now + start)
        osc.stop(now + start + duration + 0.05)
      }

      playTone(880, 0, 0.18) // A5
      playTone(1175, 0.14, 0.22) // D6

      setTimeout(() => ctx.close().catch(() => {}), 700)
    } catch {
      // Audio playback can fail (autoplay policy) — silently ignore.
    }
  }, [notifications])

  // Open edit modal — fetch full announcement data first
  const openEdit = async (announcementId: string) => {
    try {
      const res = await fetch(`/api/announcements/${announcementId}`)
      if (!res.ok) return
      const a = await res.json()
      setEditing({
        id: a.id,
        title: a.title ?? null,
        message: a.message,
        recipients: a.recipients,
        priority: a.priority,
        icon: a.icon ?? null,
      })
      setIsOpen(false)
    } catch (e) {
      console.error('Kon melding niet laden:', e)
    }
  }

  const canEditAnnouncement = (n: Notification) =>
    n.type === 'announcement' &&
    !!n.announcementId &&
    (n.senderId === userId || userRole === 'ADMIN')

  // Dismiss a single notification (permanently hide it)
  const dismissNotification = async (notificationId: string) => {
    // Optimistic update — remove from list
    mutate(
      {
        notifications: notifications.filter(n => n.id !== notificationId),
        unreadCount: Math.max(0, unreadCount - 1),
      },
      false
    )
    try {
      await fetch(`/api/notifications/${notificationId}/read`, { method: 'POST' })
      mutate()
    } catch (error) {
      console.error('Error dismissing notification:', error)
      mutate() // Revert on error
    }
  }

  // Dismiss all notifications
  const dismissAll = async () => {
    // Optimistic update — clear list
    mutate(
      {
        notifications: [],
        unreadCount: 0,
      },
      false
    )
    try {
      // Dismiss each notification individually
      await Promise.all(
        notifications.map(n =>
          fetch(`/api/notifications/${n.id}/read`, { method: 'POST' })
        )
      )
      mutate()
    } catch (error) {
      console.error('Error dismissing all notifications:', error)
      mutate() // Revert on error
    }
  }

  // Get icon for notification type
  const getNotificationIcon = (notification: Notification) => {
    switch (notification.type) {
      case 'zaak':
        return <Icons.briefcase size={16} className="text-blue-400" />
      case 'vacation':
        return <Icons.sun size={16} className="text-yellow-400" />
      case 'feedback':
        return <Icons.chat size={16} className="text-purple-400" />
      case 'calendar':
        return <Icons.calendar size={16} className="text-green-400" />
      case 'werkverdeling':
        return <Icons.users size={16} className="text-yellow-400" />
      case 'overdracht':
        return <Icons.fileText size={16} className="text-blue-400" />
      case 'announcement':
        return <span className="inline-block text-base">{notification.icon || '📢'}</span>
      case 'lustrum':
        return <span className="inline-block animate-bounce text-base">🎉</span>
      default:
        return <Icons.bell size={16} className="text-gray-400" />
    }
  }

  const hasUnread = unreadCount > 0

  return (
    <Popover.Root open={isOpen} onOpenChange={setIsOpen}>
      <Popover.Trigger asChild>
        <button
          className={`relative p-2 rounded-xl border transition-all group ${
            hasUnread
              ? 'bg-workx-lime/20 border-workx-lime/40 hover:bg-workx-lime/30 hover:border-workx-lime/60 shadow-[0_0_12px_rgba(249,255,133,0.15)]'
              : 'bg-white/5 hover:bg-white/10 border-white/10 hover:border-white/20'
          }`}
          aria-label="Notificaties"
        >
          <Icons.bell
            size={20}
            className={`transition-colors ${
              hasUnread
                ? 'text-workx-lime bell-ring'
                : 'text-gray-400 group-hover:text-white'
            }`}
          />
          {hasUnread && (
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center badge-pulse">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          className="w-[380px] max-h-[500px] bg-workx-dark border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden animate-modal-in"
          sideOffset={8}
          align="end"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <h3 className="text-lg font-semibold">Notificaties</h3>
            {notifications.length > 0 && (
              <button
                onClick={dismissAll}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 text-gray-400 text-xs font-medium hover:bg-white/10 hover:text-white transition-colors"
              >
                <Icons.x size={12} />
                Alles wissen
              </button>
            )}
          </div>

          {/* Notifications list */}
          <div className="max-h-[400px] overflow-y-auto workx-scrollbar">
            {isLoading ? (
              <div className="p-8 text-center">
                <div className="w-6 h-6 border-2 border-white/20 border-t-workx-lime rounded-full animate-spin mx-auto" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center">
                <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mx-auto mb-3">
                  <Icons.bell size={24} className="text-gray-500" />
                </div>
                <p className="text-gray-400 text-sm">Geen notificaties</p>
                <p className="text-gray-500 text-xs mt-1">
                  Je bent helemaal bij!
                </p>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`group/notif p-4 hover:bg-white/5 transition-colors cursor-pointer ${
                      notification.type === 'lustrum'
                        ? 'bg-gradient-to-r from-pink-500/10 via-yellow-500/10 to-pink-500/10 border-l-2 border-yellow-400'
                        : 'bg-workx-lime/5'
                    }`}
                    onClick={() => {
                      if (notification.href) {
                        window.location.href = notification.href
                      }
                      setIsOpen(false)
                    }}
                  >
                    <div className="flex gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        notification.type === 'announcement' && notification.priority === 'urgent'
                          ? 'bg-red-500/20'
                          : 'bg-white/5'
                      }`}>
                        {getNotificationIcon(notification)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium truncate text-white">
                            {notification.title}
                          </p>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {canEditAnnouncement(notification) && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  openEdit(notification.announcementId!)
                                }}
                                className="p-1 rounded-lg text-gray-600 hover:text-workx-lime hover:bg-white/10 transition-all opacity-0 group-hover/notif:opacity-100"
                                title="Bewerken"
                              >
                                <Icons.edit size={14} />
                              </button>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                dismissNotification(notification.id)
                              }}
                              className="p-1 rounded-lg text-gray-600 hover:text-white hover:bg-white/10 transition-all opacity-0 group-hover/notif:opacity-100"
                              title="Verwijderen"
                            >
                              <Icons.x size={14} />
                            </button>
                          </div>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5 whitespace-pre-wrap break-words">
                          {notification.message}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {formatDistanceToNow(new Date(notification.createdAt), {
                            addSuffix: true,
                            locale: nl,
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="p-3 border-t border-white/10 text-center">
              <a
                href="/dashboard/notifications"
                className="text-xs text-workx-lime hover:underline"
              >
                Alle notificaties bekijken
              </a>
            </div>
          )}

          <Popover.Arrow className="fill-workx-dark" />
        </Popover.Content>
      </Popover.Portal>

      {/* Edit modal voor bestaande melding */}
      <AnnouncementModal
        isOpen={!!editing}
        onClose={() => setEditing(null)}
        initial={editing}
        onSaved={() => mutate()}
      />
    </Popover.Root>
  )
}

export default NotificationCenter
