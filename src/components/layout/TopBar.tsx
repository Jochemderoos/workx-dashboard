'use client'

import { useState, useEffect } from 'react'
import { Icons } from '@/components/ui/Icons'

interface TopBarProps {
  user: {
    name: string
    email: string
    role: string
  }
}

export default function TopBar({ user }: TopBarProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [showNotifications, setShowNotifications] = useState(false)
  const [greeting, setGreeting] = useState('')

  useEffect(() => {
    const hour = new Date().getHours()
    if (hour < 12) setGreeting('Goedemorgen')
    else if (hour < 18) setGreeting('Goedemiddag')
    else setGreeting('Goedenavond')
  }, [])

  const notifications = [
    { id: 1, text: 'Lisa is morgen jarig!', time: '5 min', icon: Icons.star, color: 'text-yellow-400' },
    { id: 2, text: 'Vakantie goedgekeurd', time: '1 uur', icon: Icons.check, color: 'text-green-400' },
    { id: 3, text: 'Deadline over 2 dagen', time: '2 uur', icon: Icons.clock, color: 'text-orange-400' },
  ]

  return (
    <header className="h-16 border-b border-white/5 flex items-center justify-between px-8 relative z-20 backdrop-blur-sm bg-workx-dark/30">
      {/* Left: Greeting */}
      <div className="hidden lg:block">
        <p className="text-white/40 text-sm">{greeting},</p>
        <p className="text-white font-medium">{user.name?.split(' ')[0]}</p>
      </div>

      {/* Center: Search */}
      <div className="flex-1 max-w-xl mx-8">
        <div className="relative group">
          <div className="absolute inset-0 bg-workx-lime/10 rounded-xl blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity" />
          <Icons.search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-workx-lime transition-colors" size={18} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Zoek in alles..."
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-workx-lime/30 focus:bg-white/10 transition-all relative"
          />
          <kbd className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] text-white/20 px-1.5 py-0.5 rounded bg-white/10 hidden sm:inline">
            /
          </kbd>
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {/* Quick actions */}
        <button className="p-2.5 text-white/40 hover:text-workx-lime rounded-xl hover:bg-white/5 transition-all">
          <Icons.zap size={18} />
        </button>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2.5 text-white/40 hover:text-white rounded-xl hover:bg-white/5 transition-all"
          >
            <Icons.bell size={18} />
            {notifications.length > 0 && (
              <span className="notification-dot absolute top-1.5 right-1.5" />
            )}
          </button>

          {showNotifications && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
              <div className="absolute right-0 top-full mt-3 w-80 z-50 fade-in-scale">
                <div className="bg-workx-gray/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
                  <div className="p-4 border-b border-white/10 flex items-center justify-between">
                    <span className="font-medium text-white">Notificaties</span>
                    <span className="badge badge-lime">{notifications.length} nieuw</span>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.map((n) => {
                      const Icon = n.icon
                      return (
                        <div key={n.id} className="p-4 hover:bg-white/5 transition-colors cursor-pointer border-b border-white/5 last:border-0 group">
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-lg bg-white/5 ${n.color}`}>
                              <Icon size={16} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-white group-hover:text-workx-lime transition-colors">{n.text}</p>
                              <p className="text-xs text-white/40 mt-0.5">{n.time} geleden</p>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <div className="p-3 border-t border-white/10">
                    <button className="w-full text-center text-sm text-workx-lime hover:underline">
                      Alle notificaties bekijken
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Date pill */}
        <div className="hidden md:flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10">
          <Icons.calendar size={14} className="text-workx-lime" />
          <span className="text-sm text-white/60">
            {new Date().toLocaleDateString('nl-NL', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
            })}
          </span>
        </div>
      </div>
    </header>
  )
}
