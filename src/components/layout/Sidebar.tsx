'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { Icons } from '@/components/ui/Icons'
import { getPhotoUrl } from '@/lib/team-photos'

interface SidebarProps {
  user: {
    name: string
    email: string
    role: string
  }
}

// Inline Logo Component - yellow background with black text
function WorkxLogoBox() {
  return (
    <div className="inline-block rounded-lg overflow-hidden" style={{ background: '#f9ff85' }}>
      <div className="relative flex flex-col justify-center px-5 py-4" style={{ width: 150 }}>
        <span
          className="leading-none"
          style={{
            fontSize: '34px',
            fontWeight: 400,
            color: '#1e1e1e',
            fontFamily: "'PP Neue Montreal', system-ui, -apple-system, sans-serif"
          }}
        >
          Workx
        </span>
        <span
          className="uppercase"
          style={{
            fontSize: '10px',
            letterSpacing: '2.5px',
            marginTop: '3px',
            fontWeight: 500,
            color: '#1e1e1e',
            fontFamily: "'PP Neue Montreal', system-ui, -apple-system, sans-serif"
          }}
        >
          ADVOCATEN
        </span>
      </div>
    </div>
  )
}

const mainMenuItems = [
  { href: '/dashboard', icon: Icons.home, label: 'Dashboard', iconAnim: 'icon-home-hover' },
  { href: '/dashboard/lustrum', icon: Icons.palmTree, label: 'Lustrum Mallorca', iconAnim: 'icon-party-hover', badge: '15 jaar!' },
  { href: '/dashboard/appjeplekje', icon: Icons.mapPin, label: 'Appjeplekje', iconAnim: 'icon-mappin-hover' },
  { href: '/dashboard/agenda', icon: Icons.calendar, label: 'Agenda', iconAnim: 'icon-calendar-hover' },
  { href: '/dashboard/vakanties', icon: Icons.sun, label: 'Vakanties & Verlof', iconAnim: 'icon-sun-hover' },
  { href: '/dashboard/werk', icon: Icons.briefcase, label: 'Werk', iconAnim: 'icon-briefcase-hover' },
  { href: '/dashboard/financien', icon: Icons.pieChart, label: 'Financien', iconAnim: 'icon-piechart-hover' },
]

const toolsMenuItems = [
  { href: '/dashboard/bonus', icon: Icons.euro, label: 'Bonus', iconAnim: 'icon-euro-hover' },
  { href: '/dashboard/transitie', icon: Icons.calculator, label: 'Transitievergoeding', iconAnim: 'icon-calculator-hover' },
  { href: '/dashboard/afspiegeling', icon: Icons.layers, label: 'Afspiegeling', iconAnim: 'icon-layers-hover' },
]

const manageMenuItems = [
  { href: '/dashboard/team', icon: Icons.users, label: 'Team', iconAnim: 'icon-users-hover' },
  { href: '/dashboard/feedback', icon: Icons.chat, label: 'Feedback', iconAnim: 'icon-chat-hover' },
]

export default function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname()

  const NavLink = ({ href, icon: Icon, label, iconAnim, badge }: { href: string; icon: typeof Icons.home; label: string; iconAnim?: string; badge?: string }) => {
    const isActive = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
    const isLustrum = href === '/dashboard/lustrum'
    return (
      <Link href={href} className={`nav-link ${isActive ? 'active' : ''} ${iconAnim || ''} ${isLustrum ? 'lustrum-link group/lustrum' : ''}`}>
        <span className="icon-animated">
          <Icon size={18} />
        </span>
        <span className="flex-1">{label}</span>
        {badge && (
          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-gradient-to-r from-orange-500 to-amber-500 text-white flex-shrink-0">
            {badge}
          </span>
        )}
        {!badge && isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-current opacity-60" />}
      </Link>
    )
  }

  return (
    <aside className="w-72 h-full max-h-screen border-r border-white/5 flex flex-col relative z-20 bg-gradient-to-b from-workx-dark/80 to-workx-dark/40 backdrop-blur-xl overflow-y-auto">
      {/* Logo - Authentic Workx branding */}
      <div className="p-6 pb-8 flex-shrink-0">
        <Link href="/dashboard" className="block group">
          <div className="relative">
            <WorkxLogoBox />
            <div className="absolute inset-0 bg-workx-lime/10 blur-2xl rounded-lg opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 space-y-6">
        {/* Main */}
        <div>
          <p className="px-4 mb-2 text-[10px] font-medium text-white/30 uppercase tracking-widest">Menu</p>
          <div className="space-y-1">
            {mainMenuItems.map((item) => <NavLink key={item.href} {...item} />)}
          </div>
        </div>

        {/* Tools */}
        <div>
          <p className="px-4 mb-2 text-[10px] font-medium text-white/30 uppercase tracking-widest">Tools</p>
          <div className="space-y-1">
            {toolsMenuItems.map((item) => <NavLink key={item.href} {...item} />)}
          </div>
        </div>

        {/* Management */}
        <div>
          <p className="px-4 mb-2 text-[10px] font-medium text-white/30 uppercase tracking-widest">Beheer</p>
          <div className="space-y-1">
            {manageMenuItems.map((item) => <NavLink key={item.href} {...item} />)}
          </div>
        </div>
      </nav>

      {/* Bottom section */}
      <div className="p-4 space-y-3 flex-shrink-0">
        <div className="divider-lime" />

        <Link
          href="/dashboard/settings"
          className={`nav-link icon-settings-hover ${pathname === '/dashboard/settings' ? 'active' : ''}`}
        >
          <span className="icon-animated">
            <Icons.settings size={18} />
          </span>
          <span>Instellingen</span>
        </Link>

        {/* Premium user card */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/10 p-4">
          <div className="absolute top-0 right-0 w-20 h-20 bg-workx-lime/10 rounded-full blur-2xl" />
          <div className="flex items-center gap-3 relative">
            {getPhotoUrl(user.name) ? (
              <img
                src={getPhotoUrl(user.name)!}
                alt={user.name}
                className="w-10 h-10 rounded-xl object-cover ring-2 ring-workx-lime/30 shadow-lg shadow-workx-lime/20"
              />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-workx-lime to-workx-lime/80 flex items-center justify-center shadow-lg shadow-workx-lime/20">
                <span className="text-workx-dark font-semibold">
                  {user.name?.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user.name}</p>
              <p className="text-xs text-white/40 truncate">{user.email}</p>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="p-2 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors icon-logout-hover"
              title="Uitloggen"
            >
              <span className="icon-animated">
                <Icons.logout size={16} />
              </span>
            </button>
          </div>
        </div>

        {/* Version badge - triple click for easter egg! */}
        <div className="flex items-center justify-center gap-2 pt-2 group cursor-default">
          <span className="text-[10px] text-white/20 group-hover:text-white/30 transition-colors">Workx Dashboard</span>
          <span className="badge badge-lime text-[10px] py-0.5 px-2 hover:scale-110 transition-transform cursor-pointer" title="Try triple-clicking me 😉">v2.0</span>
        </div>

        {/* Pigeons illustration with fly away animation */}
        <div className="flex justify-center pt-2 pigeons-container">
          <img src="/pigeons.svg" alt="Pigeons" className="h-12 w-auto" />
        </div>
      </div>
    </aside>
  )
}
