'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { Icons } from '@/components/ui/Icons'
import { SITE_SECTIONS, type MenuItem } from '@/lib/menu-data'
import HomeSearchBar from '@/components/dashboard/HomeSearchBar'

export default function OverzichtPage() {
  const { data: session } = useSession()
  const role = (session?.user as { role?: string })?.role
  const isExternal = role === 'EXTERNAL'
  const isPartnerOrAdmin = role === 'PARTNER' || role === 'ADMIN'
  const isAdmin = role === 'ADMIN'
  const isOwner = (session?.user?.email || '').toLowerCase() === 'jochem.deroos@workxadvocaten.nl'

  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['team']))

  const filterItem = (item: MenuItem) => {
    if (isExternal && item.hideForExternal) return false
    if (item.partnerOnly && !isPartnerOrAdmin) return false
    if (item.adminOnly && !isAdmin) return false
    if (item.ownerOnly && !isOwner) return false
    return true
  }

  const sections = useMemo(() => {
    return SITE_SECTIONS
      .filter(s => !s.partnerOnly || isPartnerOrAdmin)
      .map(s => ({
        ...s,
        subGroups: s.subGroups.map(sg => ({
          ...sg,
          items: sg.items.filter(filterItem),
        })).filter(sg => sg.items.length > 0),
      }))
      .filter(s => s.subGroups.length > 0)
  }, [isPartnerOrAdmin, isExternal, isAdmin, isOwner]) // eslint-disable-line react-hooks/exhaustive-deps

  const totalPages = sections.reduce(
    (sum, s) => sum + s.subGroups.reduce((ssum, sg) => ssum + sg.items.length, 0), 0,
  )

  const effectiveOpen = (sectionId: string) => openSections.has(sectionId)
  const toggleSection = (id: string) => {
    const next = new Set(openSections)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setOpenSections(next)
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border" style={{
        borderColor: 'rgba(180, 185, 50, 0.35)',
        background: 'linear-gradient(135deg, rgba(249, 255, 133, 0.18), var(--color-bg-secondary) 70%)',
      }}>
        <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full blur-3xl pointer-events-none" style={{ background: 'rgba(249, 255, 133, 0.20)' }} />
        <div className="absolute -bottom-20 -left-20 w-64 h-64 rounded-full blur-3xl pointer-events-none" style={{ background: 'rgba(249, 255, 133, 0.10)' }} />

        <div className="relative p-6 sm:p-10">
          <div className="flex items-start gap-4 flex-wrap">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0" style={{
              background: 'rgba(249, 255, 133, 0.35)',
              border: '1px solid rgba(180, 185, 50, 0.4)',
            }}>
              🧭
            </div>
            <div className="flex-1 min-w-[260px]">
              <p className="text-[11px] uppercase tracking-widest font-bold mb-1" style={{ color: 'rgb(140, 150, 30)' }}>
                Workx Dashboard
              </p>
              <h1 className="text-3xl font-bold leading-tight" style={{ color: 'var(--color-text-primary)' }}>
                Overzicht van alles wat erin zit
              </h1>
              <p className="text-sm mt-2 max-w-2xl" style={{ color: 'var(--color-text-secondary)' }}>
                {totalPages} pagina's verdeeld over {sections.length} secties. Gebruik de zoekbalk hieronder om direct alles te doorzoeken (zoals op de homepage), of klik op een sectie om te bladeren.
              </p>
            </div>
          </div>

          {/* Globale zoekbalk — zelfde als op de homepage */}
          <div className="mt-6 max-w-xl">
            <HomeSearchBar />
          </div>
        </div>
      </section>

      {/* Sections */}
      {sections.map((section) => {
        const isOpen = effectiveOpen(section.id)
        const pageCount = section.subGroups.reduce((sum, sg) => sum + sg.items.length, 0)
        return (
          <section
            key={section.id}
            className="rounded-3xl border overflow-hidden"
            style={{ background: 'var(--color-bg-card)', borderColor: 'rgba(180, 185, 50, 0.25)' }}
          >
            <button
              onClick={() => toggleSection(section.id)}
              className="w-full px-6 py-5 flex items-center gap-4 text-left transition-colors"
              style={{
                background: isOpen ? 'rgba(249, 255, 133, 0.10)' : 'transparent',
              }}
            >
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0" style={{
                background: 'rgba(249, 255, 133, 0.30)',
                border: '1px solid rgba(180, 185, 50, 0.4)',
              }}>
                {section.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
                  {section.title}
                </h2>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                  {section.description} · {pageCount} pagina{pageCount !== 1 && "'s"}
                </p>
              </div>
              <Icons.chevronDown size={18} className={`transition-transform shrink-0 ${isOpen ? 'rotate-180' : ''}`} style={{ color: 'var(--color-text-tertiary)' }} />
            </button>

            {isOpen && (
              <div className="px-6 pb-6 space-y-5">
                {section.subGroups.map((sg) => (
                  <div key={sg.id}>
                    {section.subGroups.length > 1 && (
                      <p className="text-[10px] uppercase tracking-widest font-bold mb-3" style={{ color: 'rgb(140, 150, 30)' }}>
                        {sg.title}
                      </p>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {sg.items.map((item) => {
                        const Icon = item.icon
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            className="group rounded-2xl border p-4 flex gap-3 transition-all hover:scale-[1.01]"
                            style={{
                              background: 'var(--color-bg-glass)',
                              borderColor: 'var(--color-border-subtle)',
                            }}
                          >
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors group-hover:bg-workx-lime/30" style={{
                              background: 'rgba(249, 255, 133, 0.15)',
                            }}>
                              <Icon size={18} className="text-workx-lime" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>
                                  {item.label}
                                </p>
                                {item.badge && (
                                  <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider bg-gradient-to-r from-orange-500 to-amber-500 text-white">
                                    {item.badge}
                                  </span>
                                )}
                              </div>
                              {item.description && (
                                <p className="text-xs mt-0.5 leading-snug line-clamp-2" style={{ color: 'var(--color-text-tertiary)' }}>
                                  {item.description}
                                </p>
                              )}
                            </div>
                            <Icons.arrowRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-3" style={{ color: 'rgb(140, 150, 30)' }} />
                          </Link>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )
      })}

      {/* Footer info */}
      <p className="text-[11px] italic text-center" style={{ color: 'var(--color-text-tertiary)' }}>
        💡 Tip: nieuwe pagina's verschijnen hier automatisch zodra ze in de sidebar staan.
      </p>
    </div>
  )
}
