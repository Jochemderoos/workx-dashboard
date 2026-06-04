'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Icons } from '@/components/ui/Icons'

// ─── Style-definities ────────────────────────────────────────────────────

interface ThemeStyle {
  id: string
  name: string
  tagline: string
  bgPage: string
  bgCard: string
  bgCardElevated: string
  border: string
  borderSubtle: string
  textPrimary: string
  textSecondary: string
  textMuted: string
  accent: string
  accentText: string
  accentBg: string
  badgeBg: string
  badgeText: string
  barBg: string
  barText: string
  shadow: string
  buttonPrimary: string
  buttonPrimaryText: string
  highlights: string[]
}

const STYLES: ThemeStyle[] = [
  {
    id: 'linear',
    name: 'Linear-clean',
    tagline: 'Cool slate undertoon — strak en geconcentreerd, alsof je in een code-editor zit',
    bgPage: '#f8f9fb',
    bgCard: '#ffffff',
    bgCardElevated: '#fdfdfe',
    border: '#e2e8f0',
    borderSubtle: '#eef2f6',
    textPrimary: '#0f172a',
    textSecondary: '#475569',
    textMuted: '#94a3b8',
    accent: '#f9ff85',
    accentText: '#1e1e1e',
    accentBg: '#f9ff8520',
    badgeBg: '#f1f5f9',
    badgeText: '#475569',
    barBg: '#f1f5f9',
    barText: '#0f172a',
    shadow: '0 1px 2px rgba(15,23,42,0.04), 0 1px 3px rgba(15,23,42,0.06)',
    buttonPrimary: '#0f172a',
    buttonPrimaryText: '#ffffff',
    highlights: ['Slate-100 borders', 'Cool blue undertone', 'Ultra-fine shadows', 'Lime-on-pale-lime accent'],
  },
  {
    id: 'notion',
    name: 'Notion-warm',
    tagline: 'Warm crème papier — document-achtig, cozy, minder corporate',
    bgPage: '#fbfaf6',
    bgCard: '#fdfcf8',
    bgCardElevated: '#ffffff',
    border: '#ebe7dd',
    borderSubtle: '#f2efe8',
    textPrimary: '#2e2e2c',
    textSecondary: '#6b6864',
    textMuted: '#a5a19a',
    accent: '#d4a64a',
    accentText: '#2e2e2c',
    accentBg: '#f6e8c5',
    badgeBg: '#f0ece2',
    badgeText: '#6b6864',
    barBg: '#f0ece2',
    barText: '#2e2e2c',
    shadow: '0 1px 2px rgba(46,46,44,0.04), 0 2px 6px rgba(46,46,44,0.04)',
    buttonPrimary: '#2e2e2c',
    buttonPrimaryText: '#fdfcf8',
    highlights: ['Cream paper feel', 'Amber + sage accenten', 'Warm graphite text', 'Sand-tint borders'],
  },
  {
    id: 'stripe',
    name: 'Stripe-polish',
    tagline: 'Premium gradient feel — gepolijst, corporate, met diepte via gelaagde schaduw',
    bgPage: '#f4f6f9',
    bgCard: '#ffffff',
    bgCardElevated: '#ffffff',
    border: '#e3e8ef',
    borderSubtle: '#eef2f6',
    textPrimary: '#0a2540',
    textSecondary: '#425466',
    textMuted: '#8898aa',
    accent: '#635bff',
    accentText: '#ffffff',
    accentBg: '#eef2ff',
    badgeBg: '#eef2ff',
    badgeText: '#4b48d6',
    barBg: 'linear-gradient(90deg, #eef2ff 0%, #f4f6f9 100%)',
    barText: '#0a2540',
    shadow: '0 0 0 1px rgba(50,50,93,0.025), 0 4px 8px -2px rgba(50,50,93,0.06), 0 8px 24px -8px rgba(50,50,93,0.1)',
    buttonPrimary: '#635bff',
    buttonPrimaryText: '#ffffff',
    highlights: ['Layered glow shadows', 'Indigo + lime mix', 'Navy text op cool gray', 'Polished gradient cards'],
  },
  {
    id: 'vercel',
    name: 'Vercel-stark',
    tagline: 'Hoog contrast — bijna-witte achtergrond, pure-zwarte typografie, lime springt eruit',
    bgPage: '#fafafa',
    bgCard: '#ffffff',
    bgCardElevated: '#ffffff',
    border: '#e5e5e5',
    borderSubtle: '#f0f0f0',
    textPrimary: '#000000',
    textSecondary: '#525252',
    textMuted: '#a3a3a3',
    accent: '#f9ff85',
    accentText: '#000000',
    accentBg: '#f9ff8530',
    badgeBg: '#f5f5f5',
    badgeText: '#000000',
    barBg: '#000000',
    barText: '#ffffff',
    shadow: 'none',
    buttonPrimary: '#000000',
    buttonPrimaryText: '#ffffff',
    highlights: ['Pure-zwarte koppen', 'Hairline borders #e5e5e5', 'Geen schaduwen', 'Maximum contrast'],
  },
]

// ─── Demo-component dat in een gekozen stijl rendert ─────────────────────

function StyleDemo({ s }: { s: ThemeStyle }) {
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: s.bgPage, color: s.textPrimary, padding: '24px' }}
    >
      {/* Page-header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs uppercase tracking-wider" style={{ color: s.textMuted }}>{s.tagline}</p>
          <h2 className="text-2xl font-bold mt-1" style={{ color: s.textPrimary }}>{s.name}</h2>
        </div>
        <button
          className="px-4 py-2 rounded-lg text-sm font-semibold transition-opacity hover:opacity-90"
          style={{ background: s.buttonPrimary, color: s.buttonPrimaryText }}
        >
          Primaire actie
        </button>
      </div>

      {/* Hoofd-grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        {/* Card 1 — overzicht */}
        <div
          className="rounded-xl p-4"
          style={{ background: s.bgCard, border: `1px solid ${s.border}`, boxShadow: s.shadow }}
        >
          <p className="text-xs uppercase tracking-wider font-semibold mb-1" style={{ color: s.textMuted }}>Performance</p>
          <p className="text-2xl font-bold mb-2" style={{ color: s.textPrimary }}>8</p>
          <p className="text-sm" style={{ color: s.textSecondary }}>openstaande items deze week</p>
          <div className="mt-3 flex gap-1.5 flex-wrap">
            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: s.badgeBg, color: s.badgeText }}>nieuw</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: s.accentBg, color: s.accentText }}>belangrijk</span>
          </div>
        </div>

        {/* Card 2 — bar met tekst (HET probleemgeval) */}
        <div
          className="rounded-xl p-4"
          style={{ background: s.bgCard, border: `1px solid ${s.border}`, boxShadow: s.shadow }}
        >
          <p className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: s.textMuted }}>Voortgang</p>
          <div
            className="rounded-lg p-3 mb-2"
            style={{ background: s.barBg, color: s.barText }}
          >
            <p className="text-sm font-semibold">Werkverdeling deze week</p>
            <p className="text-xs opacity-80">8 van 12 gesprekken ingepland</p>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: s.borderSubtle }}>
            <div style={{ width: '66%', height: '100%', background: s.accent }} />
          </div>
        </div>

        {/* Card 3 — lijst */}
        <div
          className="rounded-xl p-4"
          style={{ background: s.bgCard, border: `1px solid ${s.border}`, boxShadow: s.shadow }}
        >
          <p className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: s.textMuted }}>Recente kandidaten</p>
          {['Marije Ozinga', 'Caspar Bosma', 'Sanne Wouters'].map((n) => (
            <div key={n} className="flex items-center gap-2 py-1.5" style={{ borderBottom: `1px solid ${s.borderSubtle}` }}>
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ background: s.accentBg, color: s.accentText }}>
                {n.charAt(0)}
              </div>
              <span className="text-sm" style={{ color: s.textPrimary }}>{n}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Variants strip */}
      <div className="rounded-xl p-4 mb-4" style={{ background: s.bgCard, border: `1px solid ${s.border}`, boxShadow: s.shadow }}>
        <p className="text-xs uppercase tracking-wider font-semibold mb-3" style={{ color: s.textMuted }}>Veel-gebruikte elementen</p>
        <div className="flex flex-wrap items-center gap-2">
          <button className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: s.buttonPrimary, color: s.buttonPrimaryText }}>Primary</button>
          <button className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: s.accent, color: s.accentText }}>Accent</button>
          <button className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: s.bgCard, color: s.textPrimary, border: `1px solid ${s.border}` }}>Secondary</button>
          <button className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ color: s.textSecondary }}>Ghost</button>
          <span className="text-[11px] px-2 py-1 rounded-full" style={{ background: s.badgeBg, color: s.badgeText }}>● badge</span>
          <span className="text-[11px] px-2 py-1 rounded-full" style={{ background: '#dcfce7', color: '#166534' }}>✓ groen</span>
          <span className="text-[11px] px-2 py-1 rounded-full" style={{ background: '#fee2e2', color: '#991b1b' }}>! rood</span>
          <span className="text-[11px] px-2 py-1 rounded-full" style={{ background: '#dbeafe', color: '#1e3a8a' }}>i blauw</span>
        </div>
      </div>

      {/* Highlights bullet list */}
      <ul className="space-y-1">
        {s.highlights.map(h => (
          <li key={h} className="text-sm flex items-center gap-2" style={{ color: s.textSecondary }}>
            <span style={{ color: s.accent }}>●</span>
            <span>{h}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ─── Pagina ───────────────────────────────────────────────────────────────

export default function LightModePreviewPage() {
  const router = useRouter()
  const [active, setActive] = useState<string>(STYLES[0].id)
  const [role, setRole] = useState<string | null>(null)

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch('/api/user/profile')
        if (res.ok) {
          const d = await res.json()
          setRole(d.role)
        }
      } catch { /* ignore */ }
    }
    check()
  }, [])

  const isManager = role === 'PARTNER' || role === 'ADMIN'

  if (role && !isManager) {
    return (
      <div className="p-8 text-center text-gray-400">
        <p>Deze pagina is alleen voor partners en Hanna (preview-tool).</p>
      </div>
    )
  }

  const current = STYLES.find(s => s.id === active) || STYLES[0]

  return (
    <div className="space-y-6 fade-in">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white">Light-mode preview</h1>
        <p className="text-sm text-gray-400 mt-1">
          Vier stijl-richtingen voor light mode. Klik door de tabs om de look te vergelijken. Niemand anders ziet deze pagina — dit is alleen voor jou om te kiezen.
        </p>
      </div>

      {/* Tab-bar */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-white/5 border border-white/10 overflow-x-auto">
        {STYLES.map(s => (
          <button
            key={s.id}
            onClick={() => setActive(s.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              active === s.id ? 'bg-workx-lime/20 text-workx-lime' : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            {s.name}
          </button>
        ))}
      </div>

      {/* Demo */}
      <StyleDemo s={current} />

      {/* Info */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
        <p className="font-semibold text-white mb-1">Wat zie je hier?</p>
        <ul className="space-y-1 text-xs">
          <li>• Achtergrond + card-kleuren in de gekozen stijl</li>
          <li>• Een gekleurde balk met tekst erin (het probleemgeval — wit op licht)</li>
          <li>• Buttons, badges, lijstrijen — alles wat je elders op het dashboard ziet</li>
          <li>• De vier hoofdkleuren-badges (groen/rood/blauw/accent) zodat je ziet hoe waarschuwingen kleuren</li>
        </ul>
        <p className="text-xs text-white/50 mt-3">
          Kies degene die je het mooist vindt en laat me weten welke — dan rol ik 'm uit als de echte light-mode.
        </p>
      </div>
    </div>
  )
}
