'use client'

import { useState, useEffect, useRef } from 'react'
import { Icons } from '@/components/ui/Icons'
import * as Popover from '@radix-ui/react-popover'
import { formatDistanceToNow } from 'date-fns'
import { nl } from 'date-fns/locale'

interface Notification {
  id: string
  type: 'zaak' | 'vacation' | 'feedback' | 'calendar' | 'system'
  title: string
  message: string
  createdAt: Date
  read: boolean
  href?: string
  icon?: string
}

interface NotificationCenterProps {
  userId: string
}

export function NotificationCenter({ userId }: NotificationCenterProps) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const pollRef = useRef<NodeJS.Timeout>()

  // Fetch notifications
  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications')
      if (res.ok) {
        const data = await res.json()
        setNotifications(data.notifications || [])
        setUnreadCount(data.unreadCount || 0)
      }
    } catch (error) {
      console.error('Error fetching notifications:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Poll for new notifications
  useEffect(() => {
    fetchNotifications()

    // Poll every 30 seconds
    pollRef.current = setInterval(fetchNotifications, 30000)

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
      }
    }
  }, [])

  // Mark notification as read
  const markAsRead = async (notificationId: string) => {
    try {
      await fetch(`/api/notifications/${notificationId}/read`, { method: 'POST' })
      setNotifications(prev =>
        prev.map(n => (n.id === notificationId ? { ...n, read: true } : n))
      )
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  }

  // Mark all as read
  const markAllAsRead = async () => {
    try {
      await fetch('/api/notifications/read-all', { method: 'POST' })
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
      setUnreadCount(0)
    } catch (error) {
      console.error('Error marking all as read:', error)
    }
  }

  // Get icon for notification type
  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'zaak':
        return <Icons.briefcase size={16} className="text-blue-400" />
      case 'vacation':
        return <Icons.sun size={16} className="text-yellow-400" />
      case 'feedback':
        return <Icons.chat size={16} className="text-purple-400" />
      case 'calendar':
        return <Icons.calendar size={16} className="text-green-400" />
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
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-xs text-workx-lime hover:underline"
              >
                Alles als gelezen markeren
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
                    className={`p-4 hover:bg-white/5 transition-colors cursor-pointer ${
                      !notification.read ? 'bg-workx-lime/5' : ''
                    }`}
                    onClick={() => {
                      if (!notification.read) {
                        markAsRead(notification.id)
                      }
                      if (notification.href) {
                        window.location.href = notification.href
                      }
                      setIsOpen(false)
                    }}
                  >
                    <div className="flex gap-3">
                      <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p
                            className={`text-sm font-medium truncate ${
                              !notification.read ? 'text-white' : 'text-gray-300'
                            }`}
                          >
                            {notification.title}
                          </p>
                          {!notification.read && (
                            <span className="w-2 h-2 rounded-full bg-workx-lime flex-shrink-0 mt-1.5" />
                          )}
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">
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
    </Popover.Root>
  )
}

export default NotificationCenter
