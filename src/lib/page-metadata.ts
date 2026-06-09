// Centrale bron voor per-pagina OG/snippet-metadata. Gebruikt door
// src/app/dashboard/layout.tsx → generateMetadata zodat Slack /
// LinkedIn / WhatsApp / etc. een passende snippet tonen voor elke
// dashboard-URL i.p.v. de generieke "Workx Dashboard".
//
// Bron: menu-data.ts (single source of truth). Nieuwe pagina's krijgen
// dus automatisch goede metadata zodra ze in het menu staan.

import {
  teamMenu_Algemeen,
  teamMenu_Werk,
  teamMenu_Tools,
  teamMenu_Docs,
  partnersMenuItems,
  extraMenuItems,
  manageMenuItems,
  type MenuItem,
} from '@/lib/menu-data'

export interface PageMeta {
  title: string
  description: string
}

const ALL_GROUPS: MenuItem[][] = [
  teamMenu_Algemeen,
  teamMenu_Werk,
  teamMenu_Tools,
  teamMenu_Docs,
  partnersMenuItems,
  extraMenuItems,
  manageMenuItems,
]

function flatten(items: MenuItem[]): MenuItem[] {
  const out: MenuItem[] = []
  for (const item of items) {
    out.push(item)
    if (item.children) out.push(...flatten(item.children))
  }
  return out
}

function buildMap(): Map<string, PageMeta> {
  const map = new Map<string, PageMeta>()
  for (const group of ALL_GROUPS) {
    for (const item of flatten(group)) {
      if (!item.href) continue
      const baseLabel = item.label || 'Workx Dashboard'
      const desc = item.description || 'Intern dashboard voor Workx Advocaten'
      // Onder de hood: zelfde href kan twee keer voorkomen (bv. /dashboard/hr-docs)
      // — eerste registratie wint.
      if (!map.has(item.href)) {
        map.set(item.href, {
          title: `${baseLabel} — Workx Dashboard`,
          description: desc,
        })
      }
    }
  }
  return map
}

const PAGE_META = buildMap()

const DEFAULT_META: PageMeta = {
  title: 'Workx Dashboard',
  description: 'Intern dashboard voor Workx Advocaten',
}

// Vindt de beste match voor een pathname (+ optionele querystring).
// Probeert eerst exacte match op href incl. query (voor sub-pagina's zoals
// /dashboard/hr-docs?doc=the-way-it-workx); valt dan terug op de pathname
// alleen; en uiteindelijk op de default.
export function getPageMeta(pathname: string, search = ''): PageMeta {
  const full = pathname + (search || '')
  return PAGE_META.get(full) || PAGE_META.get(pathname) || DEFAULT_META
}
