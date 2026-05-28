'use client'

import { useState, useEffect } from 'react'
import { Icons } from '@/components/ui/Icons'

interface Ronde {
  nummer: 1 | 2 | 3
  titel: string
  korteTitel: string
  karakter: string
  duur?: string
  betrokkenen: string[]
  doel: string
  inhoud: { label: string; punten: string[] }[]
  voorbeeldvragen: string[]
  emoji: string
  accent: string
  bg: string
  ring: string
}

const RONDES: Ronde[] = [
  {
    nummer: 1,
    titel: 'Kennismaking en introductie',
    korteTitel: 'Kennismaking',
    karakter: 'Formeel / informatief',
    betrokkenen: ['Maaike of Bas', 'Andere partner'],
    doel:
      'Workx informeert de kandidaat over het kantoor, de organisatiestructuur en de procedure. Tegelijk maakt Workx kennis met de persoon, de motivatie en de algemene werkbeleving van de kandidaat.',
    inhoud: [
      {
        label: 'Introductie Workx',
        punten: [
          'Geschiedenis — oprichting, groei, positionering',
          'Werkwijze — organisatie, samenwerking, werkcultuur',
          'Cliënten — aard en profiel van de cliëntenkring',
          'Soort werk — praktijkgebieden, focus op arbeidsrecht',
        ],
      },
      {
        label: 'Motivatie en werkbeleving kandidaat',
        punten: [
          'Waarom solliciteert de kandidaat bij Workx?',
          'Wat trekt aan in juridisch werk, en arbeidsrecht in het bijzonder?',
          'Wat is belangrijk in een werkomgeving?',
        ],
      },
      {
        label: 'Persoonlijk profiel',
        punten: ['Persoonlijke interesses en drijfveren', 'Loopbaanwensen op middellange termijn'],
      },
      {
        label: 'Uitleg vervolg + afsluiting',
        punten: [
          'Opzet en vervolg van de selectieprocedure helder uitleggen',
          'Gelegenheid voor vragen kandidaat',
          'Aangeven wanneer de kandidaat bericht kan verwachten',
        ],
      },
    ],
    voorbeeldvragen: [
      'Wat heeft u ertoe bewogen te solliciteren bij Workx, en wat weet u al over ons kantoor?',
      'Wat trekt u aan in de arbeidsrechtpraktijk en welke aspecten van het vak spreken u het meest aan?',
      'Wat vindt u belangrijk in de samenwerking met collega\'s en leidinggevenden?',
      'Hoe ziet uw ideale werkomgeving eruit?',
      'Waar wilt u over vijf jaar staan in uw carrière?',
    ],
    emoji: '🤝',
    accent: 'text-cyan-300',
    bg: 'from-cyan-500/15 to-cyan-500/[0.02]',
    ring: 'border-cyan-500/30',
  },
  {
    nummer: 2,
    titel: 'Inhoudelijk selectiegesprek',
    korteTitel: 'Vakinhoud',
    karakter: 'Formeel / toetsend',
    betrokkenen: ['Maaike of Bas', 'Andere partner'],
    doel:
      'Beoordeling van juridisch-inhoudelijke kwaliteiten: praktijkervaring, vakinhoudelijke kennis van het arbeidsrecht en analytisch vermogen aan de hand van een concrete casus. Herhaling van gesprek 1 wordt bewust vermeden.',
    inhoud: [
      {
        label: 'Korte introductie',
        punten: ['Beknopte warming-up; geen herhaling van gesprek 1. Focus op de inhoud.'],
      },
      {
        label: 'Ervaring en soort zaken',
        punten: [
          'Bespreking eerdere praktijkervaring',
          'Welke typen zaken behandeld?',
          'Wat was rol en verantwoordelijkheden?',
        ],
      },
      {
        label: 'Casus arbeidsrecht',
        punten: [
          'Concrete, mondeling gepresenteerde casus met open karakter',
          'Toetsing: juridisch analytisch denken, structuur, praktische aanpak, cliëntgerichtheid',
          'Thema\'s bijv: ontslag op staande voet, non-concurrentiebeding, re-integratie, arbeidsvoorwaardelijke wijziging',
        ],
      },
      {
        label: 'Ontwikkelingen in het arbeidsrecht',
        punten: [
          'Actuele ontwikkelingen volgens de kandidaat',
          'Hoe houdt de kandidaat zijn/haar kennis up-to-date?',
        ],
      },
    ],
    voorbeeldvragen: [
      'Kunt u een complexe zaak beschrijven die u recentelijk heeft behandeld? Wat was uw aanpak en wat was het resultaat?',
      'Ik leg u een situatie voor: [casus]. Hoe zou u dit juridisch beoordelen en welk advies zou u uw cliënt geven?',
      'Welke recente uitspraken of wetswijzigingen in het arbeidsrecht hebben u het meest beziggehouden, en waarom?',
      'Op welk gebied van het arbeidsrecht wilt u zich verder ontwikkelen?',
    ],
    emoji: '⚖️',
    accent: 'text-workx-lime',
    bg: 'from-workx-lime/15 to-workx-lime/[0.02]',
    ring: 'border-workx-lime/30',
  },
  {
    nummer: 3,
    titel: 'Informeel gesprek met het team',
    korteTitel: 'Teamfit',
    karakter: 'Informeel / wederzijds',
    duur: '30–60 minuten',
    betrokkenen: ['Twee medewerkers van Workx (gevarieerde samenstelling)'],
    doel:
      'Tweeledig: de kandidaat een realistisch beeld geven van werken bij Workx vanuit collega-perspectief, én het team de gelegenheid geven een indruk te vormen van de kandidaat als persoon en mogelijke toekomstige collega.',
    inhoud: [
      {
        label: 'Vertellen vanuit de medewerkers',
        punten: [
          'Dagelijkse praktijk en soort zaken',
          'Samenwerking binnen het team',
          'Cultuur van het kantoor — wat maakt Workx bijzonder?',
          'Uitdagingen en groeimogelijkheden',
          'Open en eerlijk; vermijd vertrouwelijke kantoorinformatie of lopende zaken',
        ],
      },
      {
        label: 'Wederzijdse kennismaking',
        punten: [
          'Kandidaat krijgt ruimte voor vragen aan medewerkers',
          'Informele uitwisseling over interesses, werkstijl, verwachtingen',
        ],
      },
      {
        label: 'Terugkoppeling aan partners',
        punten: [
          'Korte, gestructureerde terugkoppeling aan partners',
          'Vaste aandachtspunten: teamfit, communicatiestijl, enthousiasme',
        ],
      },
    ],
    voorbeeldvragen: [],
    emoji: '👥',
    accent: 'text-purple-300',
    bg: 'from-purple-500/15 to-purple-500/[0.02]',
    ring: 'border-purple-500/30',
  },
]

// Visuele defaults per ronde (emoji/accent/bg/ring) — geïndexeerd op nummer
const VISUAL_DEFAULTS: Record<number, { emoji: string; accent: string; bg: string; ring: string }> = {
  1: { emoji: '🤝', accent: 'text-cyan-300', bg: 'from-cyan-500/15 to-cyan-500/[0.02]', ring: 'border-cyan-500/30' },
  2: { emoji: '⚖️', accent: 'text-workx-lime', bg: 'from-workx-lime/15 to-workx-lime/[0.02]', ring: 'border-workx-lime/30' },
  3: { emoji: '👥', accent: 'text-purple-300', bg: 'from-purple-500/15 to-purple-500/[0.02]', ring: 'border-purple-500/30' },
}

export default function SollicitatiebeleidSection() {
  const [open, setOpen] = useState(true)
  const [expandedRonde, setExpandedRonde] = useState<number | null>(null)
  const [rondes, setRondes] = useState<Ronde[]>(RONDES)

  // Laad content uit DB; fallback naar hardcoded defaults bij fout/leeg.
  useEffect(() => {
    let cancelled = false
    fetch('/api/policy/sollicitatiebeleid')
      .then(r => r.ok ? r.json() : null)
      .then((data) => {
        if (cancelled) return
        const dbRondes = data?.content?.rondes
        if (Array.isArray(dbRondes) && dbRondes.length > 0) {
          // Merge DB content met visuele defaults per nummer
          const merged: Ronde[] = dbRondes.map((r: Partial<Ronde> & { nummer: 1 | 2 | 3 }) => {
            const v = VISUAL_DEFAULTS[r.nummer] || VISUAL_DEFAULTS[1]
            return {
              nummer: r.nummer,
              titel: r.titel || '',
              korteTitel: r.korteTitel || '',
              karakter: r.karakter || '',
              duur: r.duur || undefined,
              betrokkenen: r.betrokkenen || [],
              doel: r.doel || '',
              inhoud: r.inhoud || [],
              voorbeeldvragen: r.voorbeeldvragen || [],
              emoji: v.emoji,
              accent: v.accent,
              bg: v.bg,
              ring: v.ring,
            }
          })
          setRondes(merged)
        }
      })
      .catch(() => { /* fallback naar defaults */ })
    return () => { cancelled = true }
  }, [])

  return (
    <section className="relative overflow-hidden rounded-3xl border border-workx-lime/20 bg-gradient-to-br from-workx-lime/[0.08] via-workx-dark/40 to-workx-dark/40">
      {/* Decorative glows */}
      <div className="absolute -top-20 -right-20 w-64 h-64 bg-workx-lime/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative p-6 sm:p-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-workx-lime/20 flex items-center justify-center text-2xl flex-shrink-0">
              📋
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-workx-lime/70 font-semibold mb-1">Sollicitatiebeleid</p>
              <h2 className="text-2xl font-semibold text-white">Selectieprocedure in drie gespreksrondes</h2>
              <p className="text-sm text-white/50 mt-1 max-w-2xl">
                Onze gestructureerde manier om kandidaten zorgvuldig, consistent en respectvol te beoordelen.
              </p>
            </div>
          </div>

          <button
            onClick={() => setOpen(o => !o)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 text-white/70 hover:bg-white/10 hover:text-white text-sm transition-all border border-white/10"
            title={open ? 'Inklappen' : 'Uitklappen'}
          >
            <Icons.chevronDown size={16} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
            <span>{open ? 'Inklappen' : 'Toon details'}</span>
          </button>
        </div>

        {/* Timeline overview — altijd zichtbaar */}
        <div className="mt-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            {rondes.map((r, idx) => (
              <button
                key={r.nummer}
                onClick={() => {
                  setOpen(true)
                  setExpandedRonde(expandedRonde === r.nummer ? null : r.nummer)
                  if (typeof window !== 'undefined') {
                    setTimeout(() => {
                      document.getElementById(`ronde-${r.nummer}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    }, 50)
                  }
                }}
                className={`relative bg-gradient-to-br ${r.bg} border ${r.ring} rounded-2xl p-4 text-left hover:scale-[1.02] transition-all group`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shrink-0 bg-workx-dark border ${r.ring} relative z-10`}>
                    {r.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-[10px] uppercase tracking-wider ${r.accent} font-semibold mb-0.5`}>Ronde {r.nummer}</p>
                    <h3 className="text-sm font-semibold text-white truncate">{r.korteTitel}</h3>
                  </div>
                </div>
                <p className="text-xs text-white/60 leading-relaxed mb-2">{r.titel}</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  <span className={`text-[10px] px-2 py-0.5 rounded-md bg-white/5 ${r.accent} font-medium`}>
                    {r.karakter}
                  </span>
                  {r.duur && (
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/5 text-white/50">
                      {r.duur}
                    </span>
                  )}
                </div>
                <div className="mt-3 flex items-center gap-1 text-[10px] text-white/40 group-hover:text-white/70 transition-colors">
                  <Icons.chevronDown size={10} />
                  <span>Klik voor detail</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Uitklapbare detail-content */}
        {open && (
          <div className="mt-8 space-y-6">
            {/* Inleiding */}
            <div className="border-t border-white/5 pt-6">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-white/40 mb-3">Inleiding en doelstelling</h3>
              <p className="text-sm text-white/80 leading-relaxed max-w-3xl">
                Dit beleidsdocument beschrijft de gestructureerde sollicitatieprocedure van Workx. Het doel is om op een{' '}
                <span className="text-workx-lime">zorgvuldige, consistente en respectvolle</span> wijze te beoordelen of een
                kandidaat aansluit bij de professionele standaarden, de werkcultuur en de inhoudelijke eisen van het kantoor.
                Alle kandidaten worden op gelijke wijze beoordeeld en ervaringen worden intern geborgd.
              </p>
            </div>

            {/* Per ronde — full detail */}
            {rondes.map((r) => {
              const isExpanded = expandedRonde === r.nummer
              return (
                <div
                  key={r.nummer}
                  id={`ronde-${r.nummer}`}
                  className={`border ${r.ring} rounded-2xl overflow-hidden bg-gradient-to-br ${r.bg}`}
                >
                  <button
                    onClick={() => setExpandedRonde(isExpanded ? null : r.nummer)}
                    className="w-full p-5 flex items-center gap-4 text-left hover:bg-white/[0.02] transition-colors"
                  >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 bg-workx-dark border ${r.ring}`}>
                      {r.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-[10px] uppercase tracking-wider ${r.accent} font-semibold mb-0.5`}>
                        Ronde {r.nummer} · {r.karakter}{r.duur ? ` · ${r.duur}` : ''}
                      </p>
                      <h3 className="text-base font-semibold text-white">{r.titel}</h3>
                    </div>
                    <Icons.chevronDown size={18} className={`transition-transform text-white/40 ${isExpanded ? 'rotate-180' : ''}`} />
                  </button>

                  {isExpanded && (
                    <div className="px-5 pb-5 space-y-5">
                      {/* Doel */}
                      <div className="bg-white/[0.03] rounded-xl p-4 border border-white/5">
                        <p className="text-[10px] uppercase tracking-wider text-white/40 font-medium mb-2">Doel</p>
                        <p className="text-sm text-white/80 leading-relaxed">{r.doel}</p>
                      </div>

                      {/* Betrokkenen */}
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-white/40 font-medium mb-2">Betrokkenen</p>
                        <div className="flex flex-wrap gap-2">
                          {r.betrokkenen.map((b) => (
                            <span key={b} className={`text-xs px-3 py-1.5 rounded-full bg-white/5 border ${r.ring} ${r.accent} font-medium`}>
                              {b}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Inhoud */}
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-white/40 font-medium mb-3">Inhoud</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {r.inhoud.map((item, i) => (
                            <div key={i} className="bg-white/[0.03] rounded-xl p-4 border border-white/5">
                              <p className={`text-xs font-semibold ${r.accent} mb-2`}>{String.fromCharCode(65 + i)}. {item.label}</p>
                              <ul className="space-y-1.5">
                                {item.punten.map((p, j) => (
                                  <li key={j} className="text-xs text-white/70 leading-relaxed flex gap-2">
                                    <span className={`${r.accent} mt-0.5`}>•</span>
                                    <span className="flex-1">{p}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Voorbeeldvragen */}
                      {r.voorbeeldvragen.length > 0 && (
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-white/40 font-medium mb-3">Voorbeeldvragen</p>
                          <div className="space-y-2">
                            {r.voorbeeldvragen.map((v, i) => (
                              <div key={i} className="flex gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5">
                                <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 bg-workx-dark border ${r.ring} ${r.accent}`}>
                                  {i + 1}
                                </div>
                                <p className="text-sm text-white/75 leading-relaxed italic">"{v}"</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}

            {/* Besluitvorming */}
            <div className="border border-workx-lime/30 rounded-2xl p-5 bg-gradient-to-br from-workx-lime/10 via-workx-lime/[0.03] to-transparent">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-workx-lime/20 flex items-center justify-center text-xl">✅</div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-workx-lime/80 font-semibold mb-0.5">Stap 4</p>
                  <h3 className="text-base font-semibold text-white">Besluitvorming en afronding</h3>
                </div>
              </div>
              <p className="text-sm text-white/80 leading-relaxed mb-3">
                Na het derde gesprek vindt een intern overleg tussen de partners plaats. De volgende punten worden besproken:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                <div className="bg-white/[0.03] rounded-xl p-3 border border-white/5">
                  <p className="text-xs font-semibold text-workx-lime mb-1">Inhoudelijk</p>
                  <p className="text-[11px] text-white/60">Geschiktheid obv gesprek 2</p>
                </div>
                <div className="bg-white/[0.03] rounded-xl p-3 border border-white/5">
                  <p className="text-xs font-semibold text-cyan-300 mb-1">Persoonlijk</p>
                  <p className="text-[11px] text-white/60">Fit en motivatie obv gesprekken 1 + 3</p>
                </div>
                <div className="bg-white/[0.03] rounded-xl p-3 border border-white/5">
                  <p className="text-xs font-semibold text-purple-300 mb-1">Aandachtspunten</p>
                  <p className="text-[11px] text-white/60">Eventuele openstaande vragen</p>
                </div>
              </div>
              <div className="text-xs text-white/70 leading-relaxed bg-white/[0.02] rounded-xl p-3 border border-white/5">
                <p>
                  <strong className="text-workx-lime">Uitgangspunt:</strong> jaarcontract dat bij wederzijdse positieve ervaring
                  tijdig wordt omgezet in contract voor onbepaalde tijd. In uitzonderingsgevallen kan direct een contract voor
                  onbepaalde tijd worden aangeboden.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
