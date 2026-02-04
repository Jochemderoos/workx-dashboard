'use client'

import { useState, useEffect } from 'react'
import { Icons } from '@/components/ui/Icons'
import { formatDistanceToNow } from 'date-fns'
import { nl } from 'date-fns/locale'
import { getPhotoUrl } from '@/lib/team-photos'

interface ActivityItem {
  id: string
  type: 'vacation_request' | 'vacation_approved' | 'work_item' | 'office_attendance' | 'feedback' | 'zaak'
  title: string
  description: string
  userName: string
  userPhoto?: string | null
  createdAt: Date
  metadata?: {
    status?: string
    priority?: string
  }
}

interface ActivityFeedProps {
  limit?: number
  showHeader?: boolean
  className?: string
}

export function ActivityFeed({ limit = 10, showHeader = true, className = '' }: ActivityFeedProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchActivities = async () => {
      try {
        const res = await fetch(`/api/activity?limit=${limit}`)
        if (res.ok) {
          const data = await res.json()
          setActivities(data.activities || [])
        } else {
          setError('Kon activiteiten niet laden')
        }
      } catch (err) {
        setError('Verbindingsfout')
      } finally {
        setIsLoading(false)
      }
    }

    fetchActivities()

    // Refresh every 60 seconds
    const interval = setInterval(fetchActivities, 60000)
    return () => clearInterval(interval)
  }, [limit])

  const getActivityIcon = (type: ActivityItem['type']) => {
    switch (type) {
      case 'vacation_request':
      case 'vacation_approved':
        return <Icons.sun size={14} className="text-yellow-400" />
      case 'work_item':
        return <Icons.briefcase size={14} className="text-blue-400" />
      case 'office_attendance':
        return <Icons.mapPin size={14} className="text-green-400" />
      case 'feedback':
        return <Icons.chat size={14} className="text-purple-400" />
      case 'zaak':
        return <Icons.file size={14} className="text-cyan-400" />
      default:
        return <Icons.activity size={14} className="text-gray-400" />
    }
  }

  const getActivityColor = (type: ActivityItem['type']) => {
    switch (type) {
      case 'vacation_request':
      case 'vacation_approved':
        return 'from-yellow-500/20'
      case 'work_item':
        return 'from-blue-500/20'
      case 'office_attendance':
        return 'from-green-500/20'
      case 'feedback':
        return 'from-purple-500/20'
      case 'zaak':
        return 'from-cyan-500/20'
      default:
        return 'from-gray-500/20'
    }
  }

  if (isLoading) {
    return (
      <div className={`card p-6 ${className}`}>
        {showHeader && (
          <div className="flex items-center gap-2 mb-4">
            <Icons.activity size={18} className="text-workx-lime" />
            <h3 className="font-medium">Activiteit</h3>
          </div>
        )}
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex gap-3 animate-pulse">
              <div className="w-8 h-8 rounded-full bg-white/5" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-white/5 rounded w-3/4" />
                <div className="h-2 bg-white/5 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`card p-6 ${className}`}>
        {showHeader && (
          <div className="flex items-center gap-2 mb-4">
            <Icons.activity size={18} className="text-workx-lime" />
            <h3 className="font-medium">Activiteit</h3>
          </div>
        )}
        <div className="text-center py-4">
          <p className="text-sm text-gray-400">{error}</p>
        </div>
      </div>
    )
  }

  if (activities.length === 0) {
    return (
      <div className={`card p-6 ${className}`}>
        {showHeader && (
          <div className="flex items-center gap-2 mb-4">
            <Icons.activity size={18} className="text-workx-lime" />
            <h3 className="font-medium">Activiteit</h3>
          </div>
        )}
        <div className="text-center py-8">
          <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mx-auto mb-3">
            <Icons.activity size={24} className="text-gray-500" />
          </div>
          <p className="text-sm text-gray-400">Nog geen activiteit</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`card overflow-hidden ${className}`}>
      {showHeader && (
        <div className="flex items-center justify-between p-5 pb-3 border-b border-white/5">
          <div className="flex items-center gap-2">
            <Icons.activity size={18} className="text-workx-lime" />
            <h3 className="font-medium">Recente activiteit</h3>
          </div>
          <span className="text-xs text-gray-500">Live</span>
        </div>
      )}

      <div className="divide-y divide-white/5 max-h-[400px] overflow-y-auto workx-scrollbar">
        {activities.map((activity, index) => (
          <div
            key={activity.id}
            className={`p-4 hover:bg-white/[0.02] transition-colors relative overflow-hidden slide-up-fade`}
            style={{ animationDelay: `${index * 50}ms` }}
          >
            {/* Gradient accent */}
            <div className={`absolute inset-y-0 left-0 w-1 bg-gradient-to-b ${getActivityColor(activity.type)} to-transparent`} />

            <div className="flex gap-3 pl-2">
              {/* User avatar */}
              <div className="relative flex-shrink-0">
                {activity.userPhoto || getPhotoUrl(activity.userName) ? (
                  <img
                    src={activity.userPhoto || getPhotoUrl(activity.userName) || ''}
                    alt={activity.userName}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-workx-lime to-workx-lime/50 flex items-center justify-center">
                    <span className="text-xs font-semibold text-workx-dark">
                      {activity.userName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </span>
                  </div>
                )}
                {/* Activity type icon badge */}
                <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-workx-dark border border-white/10 flex items-center justify-center">
                  {getActivityIcon(activity.type)}
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-sm">
                  <span className="font-medium text-white">{activity.userName}</span>
                  {' '}
                  <span className="text-gray-400">{activity.title}</span>
                </p>
                {activity.description && (
                  <p className="text-xs text-gray-500 mt-0.5 truncate">
                    {activity.description}
                  </p>
                )}
                <p className="text-xs text-gray-600 mt-1">
                  {formatDistanceToNow(new Date(activity.createdAt), {
                    addSuffix: true,
                    locale: nl,
                  })}
                </p>
              </div>

              {/* Status badge if applicable */}
              {activity.metadata?.status && (
                <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
                  activity.metadata.status === 'APPROVED' ? 'bg-green-500/20 text-green-400' :
                  activity.metadata.status === 'PENDING' ? 'bg-yellow-500/20 text-yellow-400' :
                  'bg-gray-500/20 text-gray-400'
                }`}>
                  {activity.metadata.status === 'APPROVED' ? 'Goedgekeurd' :
                   activity.metadata.status === 'PENDING' ? 'In afwachting' :
                   activity.metadata.status}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default ActivityFeed
