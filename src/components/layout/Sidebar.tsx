'use client'

import React, { memo } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { Icons } from '@/components/ui/Icons'
import { getPhotoUrl } from '@/lib/team-photos'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

interface SidebarProps {
  user: {
    name: string
    email: string
    role: string
  }
}

// Official Workx logo — rendered from vector PDF via canvas
function WorkxLogoBox() {
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const [loaded, setLoaded] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false
    async function render() {
      try {
        const pdfjsLib = await import('pdfjs-dist')
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
        const response = await fetch('/workx-logo.pdf')
        if (!response.ok || cancelled) return
        const data = await response.arrayBuffer()
        const pdf = await pdfjsLib.getDocument({ data }).promise
        const page = await pdf.getPage(1)
        const viewport = page.getViewport({ scale: 3 })
        const canvas = canvasRef.current
        if (!canvas || cancelled) return
        canvas.width = viewport.width
        canvas.height = viewport.height
        const ctx = canvas.getContext('2d')!
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        await page.render({ canvas, canvasContext: ctx, viewport }).promise

        // Witte pixels transparant maken (PDF heeft witte achtergrond ingebakken)
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const pixels = imgData.data
        for (let i = 0; i < pixels.length; i += 4) {
          const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2]
          // Verwijder wit/grijs maar behoud geel (geel heeft lage B ~133)
          // Als B hoog is (>170) EN R en G ook hoog → wit/grijs → transparant
          if (r > 190 && g > 190 && b > 170) {
            pixels[i + 3] = 0
          }
        }
        ctx.putImageData(imgData, 0, 0)
        if (!cancelled) setLoaded(true)
      } catch {
        // Fallback: keep canvas hidden, show nothing
      }
    }
    render()
    return () => { cancelled = true }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className={`h-14 w-auto transition-opacity ${loaded ? 'opacity-100' : 'opacity-0'}`}
      style={{ imageRendering: 'auto' }}
    />
  )
}

const mainMenuItems = [
  { href: '/dashboard', icon: Icons.home, label: 'Dashboard', iconAnim: 'icon-home-hover' },
  { href: '/dashboard/lustrum', icon: Icons.palmTree, label: 'Lustrum Mallorca', iconAnim: 'icon-party-hover', badge: '15 jaar!' },
  { href: '/dashboard/appjeplekje', icon: Icons.mapPin, label: 'Appjeplekje', iconAnim: 'icon-mappin-hover' },
  { href: '/dashboard/agenda', icon: Icons.calendar, label: 'Agenda', iconAnim: 'icon-calendar-hover' },
  { href: '/dashboard/vakanties', icon: Icons.sun, label: 'Vakanties & Verlof', iconAnim: 'icon-sun-hover', hideForExternal: true },
  { href: '/dashboard/opleidingen', icon: Icons.graduationCap, label: 'Opleidingen', iconAnim: 'icon-graduation-hover' },
  { href: '/dashboard/werk', icon: Icons.users, label: 'Wie doet Wat', iconAnim: 'icon-briefcase-hover' },
  { href: '/dashboard/bevriende-kantoren', icon: Icons.building, label: 'Bevriende kantoren', iconAnim: 'icon-briefcase-hover' },
  { href: '/dashboard/eigen-taken', icon: Icons.check, label: 'Eigen taken', iconAnim: 'icon-check-hover' },
  { href: '/dashboard/werk/overdracht', icon: Icons.fileText, label: 'Overdracht', iconAnim: 'icon-file-hover' },
  { href: '/dashboard/werkstudent', icon: Icons.clipboard, label: 'Werkstudent', iconAnim: 'icon-file-hover' },
  { href: '/dashboard/werkoverleg', icon: Icons.presentation, label: 'Werkoverleg', iconAnim: 'icon-file-hover' },
  { href: '/dashboard/ontwikkelplannen', icon: Icons.target, label: 'Ontwikkelplannen', iconAnim: 'icon-target-hover', hideForExternal: true },
  { href: '/dashboard/declaraties', icon: Icons.euro, label: 'Declaraties', iconAnim: 'icon-euro-hover', hideForExternal: true },
  { href: '/dashboard/debiteuren', icon: Icons.fileText, label: 'Debiteuren', iconAnim: 'icon-file-hover', hideForExternal: true },
  { href: '/dashboard/dd-projecten', icon: Icons.shield, label: 'DD Projecten', iconAnim: 'icon-briefcase-hover', hideForExternal: true },
]

// Partners sectie - alleen zichtbaar voor PARTNER en ADMIN
const partnersMenuItems = [
  { href: '/dashboard/partners/werk', icon: Icons.briefcase, label: 'Werk', iconAnim: 'icon-briefcase-hover' },
  { href: '/dashboard/partners/verantwoordelijk', icon: Icons.users, label: 'Verantwoordelijk', iconAnim: 'icon-users-hover' },
  { href: '/dashboard/partners/notulen', icon: Icons.fileText, label: 'Notulen', iconAnim: 'icon-file-hover' },
  { href: '/dashboard/partners/werkverdelingsgesprekken', icon: Icons.chat, label: 'Werkverdelingsgesprekken', iconAnim: 'icon-chat-hover' },
  { href: '/dashboard/partners/werk-lodewijk', icon: Icons.briefcase, label: 'Werk Lodewijk', iconAnim: 'icon-briefcase-hover' },
  { href: '/dashboard/partners/sollicitaties', icon: Icons.userPlus, label: 'Sollicitaties', iconAnim: 'icon-user-hover' },
  { href: '/dashboard/financien', icon: Icons.pieChart, label: 'Financien', iconAnim: 'icon-piechart-hover' },
  { href: '/dashboard/kosten', icon: Icons.euro, label: 'Kosten', iconAnim: 'icon-euro-hover' },
]

const toolsMenuItems = [
  { href: '/dashboard/ai', icon: Icons.sparkles, label: 'AI Assistent', iconAnim: 'icon-zap-hover', isAI: true },
  { href: '/dashboard/bonus', icon: Icons.euro, label: 'Bonus', iconAnim: 'icon-euro-hover', hideForExternal: true },
  { href: '/dashboard/transitie', icon: Icons.calculator, label: 'Transitievergoeding', iconAnim: 'icon-calculator-hover' },
  { href: '/dashboard/afspiegeling', icon: Icons.layers, label: 'Afspiegeling', iconAnim: 'icon-layers-hover' },
  { href: '/dashboard/pitch', icon: Icons.file, label: 'Pitch Maker', iconAnim: 'icon-file-hover', hideForExternal: true },
  { href: '/dashboard/workxflow', icon: Icons.printer, label: 'Workxflow', iconAnim: 'icon-file-hover', hideForExternal: true },
]

const manageMenuItems = [
  { href: '/dashboard/team', icon: Icons.users, label: 'Team', iconAnim: 'icon-users-hover' },
  { href: '/dashboard/wachtwoorden', icon: Icons.lock, label: 'Wachtwoorden', iconAnim: 'icon-lock-hover', hideForExternal: true },
  { href: '/dashboard/hr-docs', icon: Icons.books, label: 'Workx Docs', iconAnim: 'icon-books-hover', hideForExternal: true },
  { href: '/dashboard/feedback', icon: Icons.chat, label: 'Feedback', iconAnim: 'icon-chat-hover' },
]

// All menu hrefs for accurate active-state detection
const allMenuHrefs = [...mainMenuItems, ...partnersMenuItems, ...toolsMenuItems, ...manageMenuItems].map(i => i.href)

function SidebarComponent({ user }: SidebarProps) {
  const pathname = usePathname()

  const isExternal = user.role === 'EXTERNAL'

  const NavLink = ({ href, icon: Icon, label, iconAnim, badge, isAI }: { href: string; icon: typeof Icons.home; label: string; iconAnim?: string; badge?: string; isAI?: boolean }) => {
    // Exact match, or prefix match only when no more-specific menu item matches
    const isActive = pathname === href || (
      href !== '/dashboard' &&
      pathname.startsWith(href + '/') &&
      !allMenuHrefs.some(h => h !== href && h.startsWith(href + '/') && pathname.startsWith(h))
    )
    const isLustrum = href === '/dashboard/lustrum'

    // AI Assistent verborgen (slaapstand)
    if (isAI) return null

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
    <aside className="w-72 h-full max-h-screen border-r flex flex-col relative z-20 overflow-y-auto" style={{ borderColor: 'var(--color-border-subtle)', background: 'var(--color-bg-sidebar)' }}>
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
          <p className="px-4 mb-2 text-[10px] font-medium uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>Menu</p>
          <div className="space-y-1">
            {mainMenuItems.filter(i => !isExternal || !('hideForExternal' in i && i.hideForExternal)).map((item) => <NavLink key={item.href} {...item} />)}
            {/* Werk Lodewijk voor EXTERNAL */}
            {isExternal && <NavLink href="/dashboard/partners/werk-lodewijk" icon={Icons.briefcase} label="Werk Lodewijk" iconAnim="icon-briefcase-hover" />}
          </div>
        </div>

        {/* Partners - alleen voor PARTNER en ADMIN */}
        <div style={(user.role === 'PARTNER' || user.role === 'ADMIN') ? {} : { display: 'none' }}>
          <p className="px-4 mb-2 text-[10px] font-medium text-workx-lime/40 uppercase tracking-widest" style={{ color: 'rgba(180, 185, 50, 0.5)' }}>Partners</p>
          <div className="space-y-1">
            {partnersMenuItems.map((item) => <NavLink key={item.href} {...item} />)}
          </div>
        </div>

        {/* Tools */}
        <div>
          <p className="px-4 mb-2 text-[10px] font-medium uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>Tools</p>
          <div className="space-y-1">
            {toolsMenuItems.filter(i => !isExternal || !('hideForExternal' in i && i.hideForExternal)).map((item) => <NavLink key={item.href} {...item} />)}
          </div>
        </div>

        {/* Management */}
        <div>
          <p className="px-4 mb-2 text-[10px] font-medium uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>Beheer</p>
          <div className="space-y-1">
            {manageMenuItems.filter(i => !isExternal || !('hideForExternal' in i && i.hideForExternal)).map((item) => <NavLink key={item.href} {...item} />)}
          </div>
        </div>
      </nav>

      {/* Bottom section */}
      <div className="p-4 space-y-3 flex-shrink-0">
        <ThemeToggle />
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
        <div className="relative overflow-hidden rounded-xl p-4" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
          <div className="absolute top-0 right-0 w-20 h-20 bg-workx-lime/10 rounded-full blur-2xl" />
          <div className="flex items-center gap-3 relative">
            {getPhotoUrl(user.name) ? (
              <Image
                src={getPhotoUrl(user.name)!}
                alt={user.name}
                width={40}
                height={40}
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
              <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>{user.name}</p>
              <p className="text-xs truncate" style={{ color: 'var(--color-text-tertiary)' }}>{user.email}</p>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="p-2 rounded-lg transition-colors icon-logout-hover"
              style={{ color: 'var(--color-text-tertiary)' }}
              title="Uitloggen"
              aria-label="Uitloggen"
            >
              <span className="icon-animated">
                <Icons.logout size={16} />
              </span>
            </button>
          </div>
        </div>

        {/* Version badge - triple click for easter egg! */}
        <div className="flex items-center justify-center gap-2 pt-2 group cursor-default">
          <span className="text-[10px] transition-colors" style={{ color: 'var(--color-text-muted)' }}>Workx Dashboard</span>
          <span className="badge badge-lime text-[10px] py-0.5 px-2 hover:scale-110 transition-transform cursor-pointer" title="Try triple-clicking me 😉">v2.0</span>
        </div>

        {/* Pigeons illustration with fly away animation */}
        <div className="flex justify-center pt-2 pigeons-container">
          <Image src="/pigeons.svg" alt="Pigeons" width={120} height={48} className="h-12 w-auto" />
        </div>
      </div>
    </aside>
  )
}

export default memo(SidebarComponent)
