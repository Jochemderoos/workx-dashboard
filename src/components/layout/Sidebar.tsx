'use client'

import React, { memo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { Icons } from '@/components/ui/Icons'
import { getPhotoUrl } from '@/lib/team-photos'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import {
  teamMenu_Algemeen as menuTeamAlgemeen,
  teamMenu_Werk as menuTeamWerk,
  teamMenu_Tools as menuTeamTools,
  teamMenu_Docs as menuTeamDocs,
  partnersMenuItems as menuPartners,
  extraMenuItems as menuExtra,
  manageMenuItems as menuBeheer,
  allMenuHrefs as menuAllHrefs,
} from '@/lib/menu-data'

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

// Menu-data zit nu in src/lib/menu-data.ts (single source of truth voor
// zowel sidebar als overzicht-pagina). Aliassen hieronder voor leesbaarheid.
const teamMenu_Algemeen = menuTeamAlgemeen
const teamMenu_Werk = menuTeamWerk
const teamMenu_Tools = menuTeamTools
const teamMenu_Docs = menuTeamDocs
const partnersMenuItems = menuPartners
const extraMenuItems = menuExtra
const manageMenuItems = menuBeheer
const allMenuHrefs = menuAllHrefs

function SidebarComponent({ user }: SidebarProps) {
  const pathname = usePathname()
  const [extraOpen, setExtraOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const [openChildren, setOpenChildren] = useState<Set<string>>(new Set())

  const isExternal = user.role === 'EXTERNAL'
  const isPartnerOrAdmin = user.role === 'PARTNER' || user.role === 'ADMIN'
  // Toon item: niet hideForExternal voor EXTERNAL, niet partnerOnly voor non-partners
  const visibleForUser = (i: { hideForExternal?: boolean; partnerOnly?: boolean }) =>
    !(isExternal && i.hideForExternal) && !(i.partnerOnly && !isPartnerOrAdmin)
  const filterQ = filter.trim().toLowerCase()
  const matches = (label: string) => !filterQ || label.toLowerCase().includes(filterQ)
  const filterItems = <T extends { label: string }>(items: T[]) => filterQ ? items.filter(i => matches(i.label)) : items

  const NavLink = (props: { href: string; icon: typeof Icons.home; label: string; iconAnim?: string; badge?: string; children?: typeof menuTeamAlgemeen }) => {
    const { href, icon: Icon, label, iconAnim, badge, children } = props
    // Exact match, or prefix match only when no more-specific menu item matches
    const isActive = pathname === href || (
      href !== '/dashboard' &&
      pathname.startsWith(href + '/') &&
      !allMenuHrefs.some(h => h !== href && h.startsWith(href + '/') && pathname.startsWith(h))
    )
    const isLustrum = href === '/dashboard/lustrum'
    const hasChildren = !!children && children.length > 0
    const isExpanded = openChildren.has(href) || (filterQ.length > 0 && hasChildren)

    if (hasChildren) {
      return (
        <>
          <div className={`nav-link ${isActive ? 'active' : ''} ${iconAnim || ''}`} style={{ paddingRight: '0.5rem' }}>
            <Link href={href} className="flex items-center gap-3 flex-1 min-w-0">
              <span className="icon-animated">
                <Icon size={18} />
              </span>
              <span className="flex-1 truncate">{label}</span>
              {badge && (
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-gradient-to-r from-orange-500 to-amber-500 text-white flex-shrink-0">
                  {badge}
                </span>
              )}
            </Link>
            <button
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setOpenChildren(prev => {
                  const next = new Set(prev)
                  if (next.has(href)) next.delete(href)
                  else next.add(href)
                  return next
                })
              }}
              className="p-1 rounded hover:bg-white/10 transition-colors shrink-0"
              title={isExpanded ? 'Inklappen' : 'Uitklappen'}
            >
              <Icons.chevronDown size={12} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
            </button>
          </div>
          {isExpanded && (
            <div className="ml-7 mt-1 mb-1 space-y-0.5 border-l pl-3" style={{ borderColor: 'var(--color-border-subtle)' }}>
              {children.map((child) => {
                const ChildIcon = child.icon
                const childActive = pathname + (typeof window !== 'undefined' ? window.location.search : '') === child.href
                return (
                  <Link
                    key={child.href}
                    href={child.href}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors ${childActive ? 'text-workx-lime bg-workx-lime/10' : 'hover:bg-white/5'}`}
                    style={{ color: childActive ? undefined : 'var(--color-text-secondary)' }}
                  >
                    <ChildIcon size={12} className="shrink-0 opacity-70" />
                    <span className="truncate">{child.label}</span>
                  </Link>
                )
              })}
            </div>
          )}
        </>
      )
    }

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
      <div className="p-6 pb-4 flex-shrink-0">
        <Link href="/dashboard" className="block group">
          <div className="relative">
            <WorkxLogoBox />
            <div className="absolute inset-0 bg-workx-lime/10 blur-2xl rounded-lg opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </Link>
      </div>

      {/* Sidebar filter — typ om menu items te filteren */}
      <div className="px-4 mb-4 flex-shrink-0">
        <div className="relative">
          <Icons.search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--color-text-tertiary)' }} />
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter menu…"
            className="w-full rounded-xl pl-9 pr-8 py-2 text-sm focus:outline-none transition-colors"
            style={{
              background: 'var(--color-bg-glass)',
              border: '1px solid var(--color-border-subtle)',
              color: 'var(--color-text-primary)',
            }}
          />
          {filter && (
            <button
              onClick={() => setFilter('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded transition-colors"
              style={{ color: 'var(--color-text-tertiary)' }}
              title="Wissen"
            >
              <Icons.x size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 space-y-6">
        {/* Team — algemene pagina's, in 4 visuele sub-groepjes met sub-labels */}
        {(() => {
          const algemeen = filterItems(teamMenu_Algemeen.filter(i => visibleForUser(i)))
          const isPartnerRole = user.role === 'PARTNER' || user.role === 'ADMIN'
          const partner = isPartnerRole ? filterItems(partnersMenuItems) : []
          const werk = filterItems(teamMenu_Werk.filter(i => visibleForUser(i)))
          const tools = filterItems(teamMenu_Tools.filter(i => visibleForUser(i)))
          const docs = filterItems(teamMenu_Docs.filter(i => visibleForUser(i)))
          const showLodewijk = isExternal && (!filterQ || matches('Werk Lodewijk'))
          const hasAny = algemeen.length || partner.length || werk.length || tools.length || docs.length || showLodewijk
          if (!hasAny) return null
          return (
            <div>
              <p className="px-4 mb-2 text-[10px] font-medium uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>Team</p>
              {algemeen.length > 0 && (
                <div className="space-y-1">
                  {algemeen.map((item) => <NavLink key={item.href} {...item} />)}
                </div>
              )}
              {showLodewijk && (
                <div className="space-y-1 mt-1">
                  <NavLink href="/dashboard/partners/werk-lodewijk" icon={Icons.briefcase} label="Werk Lodewijk" iconAnim="icon-briefcase-hover" />
                </div>
              )}
              {partner.length > 0 && (
                <>
                  <p className="px-4 mt-4 mb-1.5 text-[9px] font-medium uppercase tracking-wider" style={{ color: 'rgba(180, 185, 50, 0.6)' }}>Partner</p>
                  <div className="space-y-1">
                    {partner.map((item) => <NavLink key={item.href} {...item} />)}
                  </div>
                </>
              )}
              {werk.length > 0 && (
                <>
                  <p className="px-4 mt-4 mb-1.5 text-[9px] font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-muted)', opacity: 0.6 }}>Werk</p>
                  <div className="space-y-1">
                    {werk.map((item) => <NavLink key={item.href} {...item} />)}
                  </div>
                </>
              )}
              {tools.length > 0 && (
                <>
                  <p className="px-4 mt-4 mb-1.5 text-[9px] font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-muted)', opacity: 0.6 }}>Tools</p>
                  <div className="space-y-1">
                    {tools.map((item) => <NavLink key={item.href} {...item} />)}
                  </div>
                </>
              )}
              {docs.length > 0 && (
                <>
                  <p className="px-4 mt-4 mb-1.5 text-[9px] font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-muted)', opacity: 0.6 }}>Info</p>
                  <div className="space-y-1">
                    {docs.map((item) => <NavLink key={item.href} {...item} />)}
                  </div>
                </>
              )}
            </div>
          )
        })()}

        {/* Extra — uitklapbaar, default dicht; bij filter automatisch open + alle hits zichtbaar */}
        {(() => {
          const extra = filterItems(extraMenuItems.filter(i => visibleForUser(i)))
          if (extra.length === 0) return null
          const isOpen = extraOpen || !!filterQ
          return (
            <div>
              <button
                type="button"
                onClick={() => setExtraOpen(v => !v)}
                disabled={!!filterQ}
                className="w-full flex items-center justify-between px-4 mb-2 text-[10px] font-medium uppercase tracking-widest hover:text-workx-lime transition-colors disabled:hover:text-current"
                style={{ color: 'var(--color-text-muted)' }}
              >
                <span>Extra</span>
                <Icons.chevronDown size={12} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </button>
              {isOpen && (
                <div className="space-y-1">
                  {extra.map((item) => <NavLink key={item.href} {...item} />)}
                </div>
              )}
            </div>
          )
        })()}

        {/* Beheer — Feedback + Instellingen */}
        {(() => {
          const beheer = filterItems(manageMenuItems)
          if (beheer.length === 0) return null
          return (
            <div>
              <p className="px-4 mb-2 text-[10px] font-medium uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>Beheer</p>
              <div className="space-y-1">
                {beheer.map((item) => <NavLink key={item.href} {...item} />)}
              </div>
            </div>
          )
        })()}

        {/* Empty state bij actieve filter zonder resultaten */}
        {filterQ && (() => {
          const totalMatches =
            filterItems(teamMenu_Algemeen).length +
            filterItems(teamMenu_Werk).length +
            filterItems(teamMenu_Tools).length +
            filterItems(teamMenu_Docs).length +
            filterItems(partnersMenuItems).length +
            filterItems(extraMenuItems).length +
            filterItems(manageMenuItems).length
          if (totalMatches > 0) return null
          return (
            <div className="px-4 py-8 text-center text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
              Geen pagina's gevonden voor "{filter}"
            </div>
          )
        })()}
      </nav>

      {/* Bottom section */}
      <div className="p-4 space-y-3 flex-shrink-0">
        <ThemeToggle />
        <div className="divider-lime" />

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
