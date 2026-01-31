'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { Icons } from '@/components/ui/Icons'

interface TopBarProps {
  user: {
    name: string
    email: string
    role: string
  }
}

const mobileMenuItems = [
  { href: '/dashboard', icon: Icons.home, label: 'Dashboard' },
  { href: '/dashboard/agenda', icon: Icons.calendar, label: 'Agenda' },
  { href: '/dashboard/vakanties', icon: Icons.sun, label: 'Vakanties' },
  { href: '/dashboard/werk', icon: Icons.briefcase, label: 'Werk' },
  { href: '/dashboard/financien', icon: Icons.pieChart, label: 'Financiën' },
  { href: '/dashboard/bonus', icon: Icons.euro, label: 'Bonus' },
  { href: '/dashboard/transitie', icon: Icons.calculator, label: 'Transitie' },
  { href: '/dashboard/afspiegeling', icon: Icons.layers, label: 'Afspiegeling' },
  { href: '/dashboard/team', icon: Icons.users, label: 'Team' },
  { href: '/dashboard/feedback', icon: Icons.chat, label: 'Feedback' },
  { href: '/dashboard/settings', icon: Icons.settings, label: 'Instellingen' },
]

// Silicon Valley easter egg keywords
const siliconValleyEasterEggs: Record<string, { emoji: string; message: string }> = {
  'jian yang': { emoji: '🏠', message: 'ERLICH BACHMAN, THIS IS YOUR MOM!' },
  'pied piper': { emoji: '🎵', message: 'Making the world a better place!' },
  'hotdog': { emoji: '🌭', message: 'Hotdog! Not hotdog!' },
  'hot dog': { emoji: '🌭', message: 'Hotdog! Not hotdog!' },
  'bachman': { emoji: '🚬', message: 'Aviato.' },
  'aviato': { emoji: '✈️', message: 'My Aviato?' },
  'tres comas': { emoji: '🍾', message: 'This guy fucks!' },
  'gavin': { emoji: '🦅', message: 'Consider the elephant...' },
  'hooli': { emoji: '😈', message: 'Making the world a better place' },
  'dinesh': { emoji: '🇵🇰', message: 'GILFOYLE!' },
  'gilfoyle': { emoji: '😈', message: 'Code is my religion.' },
  'delete': { emoji: '🗑️', message: 'Delete Facebook.' },
  'russ': { emoji: '💰', message: 'This guy fucks!' },
  'middle out': { emoji: '📦', message: 'Optimal tip-to-tip efficiency!' },
}

export default function TopBar({ user }: TopBarProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [showNotifications, setShowNotifications] = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [greeting, setGreeting] = useState('')
  const [easterEggMessage, setEasterEggMessage] = useState<{ emoji: string; message: string } | null>(null)
  const pathname = usePathname()

  useEffect(() => {
    const hour = new Date().getHours()
    if (hour < 12) setGreeting('Goedemorgen')
    else if (hour < 18) setGreeting('Goedemiddag')
    else setGreeting('Goedenavond')
  }, [])

  // Check for easter egg keywords
  useEffect(() => {
    const lowerQuery = searchQuery.toLowerCase().trim()
    for (const [keyword, data] of Object.entries(siliconValleyEasterEggs)) {
      if (lowerQuery === keyword) {
        setEasterEggMessage(data)
        const timer = setTimeout(() => setEasterEggMessage(null), 3000)
        return () => clearTimeout(timer)
      }
    }
  }, [searchQuery])

  const notifications = [
    { id: 1, text: 'Lisa is morgen jarig!', time: '5 min', icon: Icons.star, color: 'text-yellow-400' },
    { id: 2, text: 'Vakantie goedgekeurd', time: '1 uur', icon: Icons.check, color: 'text-green-400' },
    { id: 3, text: 'Deadline over 2 dagen', time: '2 uur', icon: Icons.clock, color: 'text-orange-400' },
  ]

  return (
    <header className="h-16 border-b border-white/5 flex items-center justify-between px-4 md:px-8 relative z-30 backdrop-blur-sm bg-workx-dark/30">
      {/* Mobile: Hamburger Menu */}
      <div className="md:hidden">
        <button
          onClick={() => setShowMobileMenu(!showMobileMenu)}
          className="p-2 text-white/60 hover:text-white rounded-lg hover:bg-white/5 transition-all"
        >
          {showMobileMenu ? <Icons.x size={24} /> : <Icons.menu size={24} />}
        </button>
      </div>

      {/* Left: Greeting (desktop only) */}
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

          {/* Easter egg message popup */}
          {easterEggMessage && (
            <div className="absolute left-0 right-0 top-full mt-2 z-50 pointer-events-none">
              <div className="bg-gradient-to-r from-workx-lime/90 to-green-400/90 backdrop-blur-sm text-workx-dark px-4 py-2 rounded-xl shadow-lg text-center animate-bounce">
                <span className="text-xl mr-2">{easterEggMessage.emoji}</span>
                <span className="font-medium text-sm">{easterEggMessage.message}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {/* Quick actions */}
        <button className="p-2.5 text-white/40 hover:text-workx-lime rounded-xl hover:bg-white/5 transition-all icon-zap-hover">
          <span className="icon-animated">
            <Icons.zap size={18} />
          </span>
        </button>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2.5 text-white/40 hover:text-white rounded-xl hover:bg-white/5 transition-all icon-bell-hover"
          >
            <span className="icon-animated">
              <Icons.bell size={18} />
            </span>
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
        <div className="hidden md:flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:border-workx-lime/30 hover:bg-white/10 transition-all cursor-default group icon-calendar-hover">
          <span className="icon-animated">
            <Icons.calendar size={14} className="text-workx-lime" />
          </span>
          <span className="text-sm text-white/60 group-hover:text-white/80 transition-colors">
            {new Date().toLocaleDateString('nl-NL', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
            })}
          </span>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {showMobileMenu && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setShowMobileMenu(false)} />
          <div className="fixed left-0 right-0 top-16 z-50 md:hidden fade-in">
            <div className="bg-workx-dark/98 backdrop-blur-xl border-b border-white/10 shadow-2xl">
              {/* User info */}
              <div className="p-4 border-b border-white/10 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-workx-lime to-workx-lime/80 flex items-center justify-center">
                  <span className="text-workx-dark font-semibold">
                    {user.name?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">{user.name}</p>
                  <p className="text-xs text-white/40">{user.email}</p>
                </div>
              </div>

              {/* Navigation items */}
              <nav className="p-2 max-h-[60vh] overflow-y-auto">
                {mobileMenuItems.map((item) => {
                  const Icon = item.icon
                  const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setShowMobileMenu(false)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                        isActive
                          ? 'bg-workx-lime text-workx-dark font-medium'
                          : 'text-white/70 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <Icon size={20} />
                      <span>{item.label}</span>
                      {isActive && <div className="ml-auto w-2 h-2 rounded-full bg-current opacity-60" />}
                    </Link>
                  )
                })}
              </nav>

              {/* Logout button */}
              <div className="p-4 border-t border-white/10">
                <button
                  onClick={() => signOut({ callbackUrl: '/login' })}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all"
                >
                  <Icons.logout size={18} />
                  <span>Uitloggen</span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </header>
  )
}
