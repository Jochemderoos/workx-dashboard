'use client'

import { useState } from 'react'
import { Icons } from '@/components/ui/Icons'
import jsPDF from 'jspdf'
import { drawWorkxLogo, loadWorkxLogo } from '@/lib/pdf'
import toast from 'react-hot-toast'

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

export default function SollicitatiebeleidSection() {
  const [open, setOpen] = useState(false)
  const [expandedRonde, setExpandedRonde] = useState<number | null>(null)
  const [downloading, setDownloading] = useState(false)

  const downloadPDF = async () => {
    setDownloading(true)
    try {
      await generateBeleidPDF()
    } catch (e) {
      console.error(e)
      toast.error('Kon PDF niet maken')
    } finally {
      setDownloading(false)
    }
  }

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

          <div className="flex items-center gap-2">
            <button
              onClick={downloadPDF}
              disabled={downloading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-workx-lime text-workx-dark font-semibold text-sm hover:bg-workx-lime/90 transition-all shadow-lg shadow-workx-lime/20 disabled:opacity-50"
            >
              {downloading ? (
                <div className="w-4 h-4 border-2 border-workx-dark/30 border-t-workx-dark rounded-full animate-spin" />
              ) : (
                <Icons.download size={16} />
              )}
              <span>{downloading ? 'PDF maken...' : 'Download PDF'}</span>
            </button>
            <button
              onClick={() => setOpen(o => !o)}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/5 text-white/70 hover:bg-white/10 hover:text-white text-sm transition-all"
              title={open ? 'Inklappen' : 'Uitklappen'}
            >
              <Icons.chevronDown size={16} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
              <span className="hidden sm:inline">{open ? 'Inklappen' : 'Uitklappen'}</span>
            </button>
          </div>
        </div>

        {/* Timeline overview — altijd zichtbaar */}
        <div className="mt-8">
          <div className="relative grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            {/* Connecting lines op desktop */}
            <div className="hidden sm:block absolute top-7 left-[16.66%] right-[16.66%] h-px bg-gradient-to-r from-cyan-500/30 via-workx-lime/40 to-purple-500/30 pointer-events-none" />

            {RONDES.map((r, idx) => (
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
            {RONDES.map((r) => {
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

// ─── PDF Generation ──────────────────────────────────────────────────────────

async function generateBeleidPDF() {
  const logoDataUrl = await loadWorkxLogo()
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 18
  const contentW = pageW - margin * 2

  // ─ Cover/Header
  drawWorkxLogo(doc, 0, 0, 55, logoDataUrl)

  doc.setTextColor(45, 45, 45)
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.text('Sollicitatiebeleid', pageW / 2, 60, { align: 'center' })

  doc.setFontSize(13)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(120, 120, 120)
  doc.text('Selectieprocedure in drie gespreksrondes', pageW / 2, 68, { align: 'center' })

  // Yellow accent line
  doc.setFillColor(249, 255, 133)
  doc.rect(pageW / 2 - 20, 72, 40, 1.5, 'F')

  doc.setFontSize(9)
  doc.setTextColor(140, 140, 140)
  const dateStr = new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })
  doc.text(`Workx Advocaten · ${dateStr}`, pageW / 2, 80, { align: 'center' })

  // ─ Inleiding
  let y = 95
  y = addSectionTitle(doc, '1. Inleiding en doelstelling', margin, y)
  y = addParagraph(
    doc,
    'Dit beleidsdocument beschrijft de gestructureerde sollicitatieprocedure van Workx. Het doel is om op een zorgvuldige, consistente en respectvolle wijze te beoordelen of een kandidaat aansluit bij de professionele standaarden, de werkcultuur en de inhoudelijke eisen van het kantoor. De procedure bestaat uit drie gespreksrondes, elk met een eigen doel, samenstelling en inhoud. Workx hanteert dit document als leidraad bij elke sollicitatie, zodat alle kandidaten op gelijke wijze worden beoordeeld en ervaringen intern geborgd zijn.',
    margin,
    y,
    contentW
  )

  // ─ Overzicht tabel
  y += 4
  y = addSectionTitle(doc, '2. Overzicht van de procedure', margin, y)
  y = addOverzichtTable(doc, margin, y, contentW)

  // ─ Per ronde — telkens nieuwe pagina
  for (const r of RONDES) {
    doc.addPage()
    drawWorkxLogo(doc, 0, 0, 55, logoDataUrl)

    y = 60
    y = addSectionTitle(doc, `${r.nummer + 2}. Gesprek ${r.nummer} – ${r.titel}`, margin, y)

    // Karakter + duur badge
    doc.setFontSize(9)
    doc.setTextColor(120, 120, 120)
    let badgeText = `Karakter: ${r.karakter}`
    if (r.duur) badgeText += `  ·  Duur: ${r.duur}`
    doc.text(badgeText, margin, y)
    y += 6

    // Doel
    y = addSubTitle(doc, 'Doel', margin, y)
    y = addParagraph(doc, r.doel, margin, y, contentW)
    y += 2

    // Betrokkenen
    y = addSubTitle(doc, 'Betrokkenen', margin, y)
    for (const b of r.betrokkenen) {
      y = addBullet(doc, b, margin, y, contentW)
    }
    y += 2

    // Inhoud
    y = addSubTitle(doc, 'Inhoud', margin, y)
    for (let i = 0; i < r.inhoud.length; i++) {
      const item = r.inhoud[i]
      if (y > pageH - 40) { doc.addPage(); drawWorkxLogo(doc, 0, 0, 55, logoDataUrl); y = 60 }
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(45, 45, 45)
      doc.text(`${String.fromCharCode(65 + i)}. ${item.label}`, margin, y)
      y += 5
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      for (const p of item.punten) {
        y = addBullet(doc, p, margin, y, contentW)
      }
      y += 2
    }

    // Voorbeeldvragen
    if (r.voorbeeldvragen.length > 0) {
      if (y > pageH - 50) { doc.addPage(); drawWorkxLogo(doc, 0, 0, 55, logoDataUrl); y = 60 }
      y = addSubTitle(doc, 'Voorbeeldvragen', margin, y)
      for (let i = 0; i < r.voorbeeldvragen.length; i++) {
        if (y > pageH - 30) { doc.addPage(); drawWorkxLogo(doc, 0, 0, 55, logoDataUrl); y = 60 }
        doc.setFont('helvetica', 'italic')
        doc.setFontSize(10)
        doc.setTextColor(80, 80, 80)
        const lines = doc.splitTextToSize(`${i + 1}.  "${r.voorbeeldvragen[i]}"`, contentW - 4)
        doc.text(lines, margin + 2, y)
        y += lines.length * 5 + 2
        doc.setFont('helvetica', 'normal')
      }
    }
  }

  // ─ Besluitvorming pagina
  doc.addPage()
  drawWorkxLogo(doc, 0, 0, 55, logoDataUrl)
  y = 60
  y = addSectionTitle(doc, '6. Besluitvorming en afronding', margin, y)
  y = addParagraph(
    doc,
    'Na het derde gesprek vindt een intern overleg plaats tussen de partners. De volgende punten worden besproken:',
    margin,
    y,
    contentW
  )
  y += 2
  y = addBullet(doc, 'Inhoudelijke geschiktheid (op basis van gesprek 2)', margin, y, contentW)
  y = addBullet(doc, 'Persoonlijke fit en motivatie (op basis van gesprekken 1 en 3)', margin, y, contentW)
  y = addBullet(doc, 'Eventuele openstaande vragen of aandachtspunten', margin, y, contentW)
  y += 3
  y = addParagraph(
    doc,
    'Workx informeert de kandidaat kort na de laatste twee gesprekken over de uitkomst. Bij een positief besluit wordt een aanbod gedaan.',
    margin,
    y,
    contentW
  )
  y += 2
  doc.setFillColor(249, 255, 133, 0.15)
  doc.setDrawColor(180, 180, 0)
  doc.setLineWidth(0.3)
  doc.roundedRect(margin, y, contentW, 22, 2, 2, 'S')
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(45, 45, 45)
  doc.text('Uitgangspunt', margin + 4, y + 6)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.setTextColor(60, 60, 60)
  const slot = doc.splitTextToSize(
    'Jaarcontract dat bij wederzijdse positieve ervaring tijdig wordt omgezet in contract voor onbepaalde tijd. In uitzonderingsgevallen kan besloten worden direct een contract voor onbepaalde tijd aan te bieden.',
    contentW - 8
  )
  doc.text(slot, margin + 4, y + 12)

  // ─ Footer op elke pagina
  const totalPages = doc.getNumberOfPages()
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p)
    doc.setFillColor(45, 45, 45)
    doc.rect(0, pageH - 14, pageW, 14, 'F')
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(220, 220, 220)
    doc.text(
      'Workx Advocaten  ·  Herengracht 448, 1017 CA Amsterdam  ·  +31 (0)20 308 03 20  ·  info@workxadvocaten.nl',
      pageW / 2,
      pageH - 7,
      { align: 'center' }
    )
    doc.text(`${p} / ${totalPages}`, pageW - margin, pageH - 7, { align: 'right' })
  }

  // Open in new tab
  const blob = doc.output('blob')
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank')
}

// ─ PDF helpers
function addSectionTitle(doc: jsPDF, text: string, x: number, y: number): number {
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(45, 45, 45)
  doc.text(text, x, y)
  // Yellow underline
  doc.setFillColor(249, 255, 133)
  doc.rect(x, y + 1.5, 25, 1, 'F')
  return y + 9
}

function addSubTitle(doc: jsPDF, text: string, x: number, y: number): number {
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(80, 80, 80)
  doc.text(text.toUpperCase(), x, y)
  doc.setFont('helvetica', 'normal')
  return y + 5
}

function addParagraph(doc: jsPDF, text: string, x: number, y: number, w: number): number {
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(60, 60, 60)
  const lines = doc.splitTextToSize(text, w)
  doc.text(lines, x, y)
  return y + lines.length * 4.8 + 3
}

function addBullet(doc: jsPDF, text: string, x: number, y: number, w: number): number {
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(60, 60, 60)
  doc.setFillColor(180, 180, 0)
  doc.circle(x + 2, y - 1.2, 0.8, 'F')
  const lines = doc.splitTextToSize(text, w - 6)
  doc.text(lines, x + 5, y)
  return y + lines.length * 4.8 + 1.5
}

function addOverzichtTable(doc: jsPDF, x: number, y: number, w: number): number {
  const colW = [18, 60, 70, w - 18 - 60 - 70]
  // Header
  doc.setFillColor(245, 245, 245)
  doc.rect(x, y, w, 8, 'F')
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(60, 60, 60)
  doc.text('Ronde', x + 2, y + 5.5)
  doc.text('Gesprek', x + colW[0] + 2, y + 5.5)
  doc.text('Betrokkenen', x + colW[0] + colW[1] + 2, y + 5.5)
  doc.text('Karakter', x + colW[0] + colW[1] + colW[2] + 2, y + 5.5)
  y += 8

  const rows = [
    ['1', 'Kennismakingsgesprek', 'Maaike of Bas + 1 partner', 'Formeel / informatief'],
    ['2', 'Inhoudelijk selectiegesprek', 'Maaike of Bas + 1 partner', 'Formeel / toetsend'],
    ['3', 'Informeel gesprek met team', 'Twee medewerkers', 'Informeel / wederzijds'],
  ]
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(60, 60, 60)
  for (const r of rows) {
    doc.text(r[0], x + 2, y + 5.5)
    doc.text(r[1], x + colW[0] + 2, y + 5.5)
    doc.text(r[2], x + colW[0] + colW[1] + 2, y + 5.5)
    doc.text(r[3], x + colW[0] + colW[1] + colW[2] + 2, y + 5.5)
    doc.setDrawColor(230, 230, 230)
    doc.setLineWidth(0.2)
    doc.line(x, y + 8, x + w, y + 8)
    y += 8
  }
  return y + 4
}
