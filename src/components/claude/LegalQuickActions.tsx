'use client'

import { useState } from 'react'
import { Icons } from '@/components/ui/Icons'

interface LegalQuickActionsProps {
  onAction: (prompt: string) => void
  disabled?: boolean
  hasDocuments?: boolean
  inline?: boolean // When true, renders as grid cards inside chat area
}

interface QuickAction {
  label: string
  description: string
  prompt: string
  icon: string
  category: 'vraag' | 'document' | 'rechtspraak' | 'berekening' | 'opstellen'
  requiresDocument?: boolean
}

const QUICK_ACTIONS: QuickAction[] = [
  // Snelle juridische vragen
  {
    label: 'Opzegtermijn bij dienstverband',
    description: 'Bereken de wettelijke opzegtermijn op basis van dienstjaren',
    prompt: 'Wat is de wettelijke opzegtermijn bij een dienstverband van een bepaald aantal jaren? Geef een overzicht van de opzegtermijnen per schijf conform art. 7:672 BW, inclusief eventuele afwijkingsmogelijkheden in de arbeidsovereenkomst of cao. Vermeld ook de aftrek van de proceduretijd bij UWV-procedures (art. 7:672 lid 4 BW).',
    icon: 'clock',
    category: 'vraag',
  },
  {
    label: 'Transitievergoeding — wanneer wel/niet?',
    description: 'Voorwaarden en uitzonderingen voor het recht op transitievergoeding',
    prompt: 'Wanneer heeft een werknemer recht op een transitievergoeding en wanneer vervalt dit recht? Bespreek de voorwaarden van art. 7:673 BW, de uitzonderingen (art. 7:673 lid 7), de vervaltermijn van 3 maanden (art. 7:686a lid 4 BW), en de situaties waarin de werkgever de transitievergoeding niet verschuldigd is. Noem ook relevante recente rechtspraak.',
    icon: 'helpCircle',
    category: 'vraag',
  },
  {
    label: 'Vereisten ontslag disfunctioneren',
    description: 'Alle voorwaarden voor een succesvolle d-grond procedure',
    prompt: 'Wat zijn alle vereisten voor een succesvol ontslag wegens disfunctioneren (d-grond, art. 7:669 lid 3 sub d BW)? Bespreek: (1) de ongeschiktheid, (2) tijdige kennisgeving, (3) voldoende gelegenheid tot verbetering, (4) geen onvoldoende zorg voor scholing, (5) geen herplaatsingsmogelijkheden. Geef per vereiste aan welke bewijslast er geldt en verwijs naar relevante rechtspraak.',
    icon: 'info',
    category: 'vraag',
  },

  // Document analyse
  {
    label: 'VSO beoordelen',
    description: 'Uitgebreide check op volledigheid, juistheid en WW-risico\'s',
    prompt: 'Beoordeel de bijgevoegde vaststellingsovereenkomst op volledigheid en juistheid. Controleer specifiek:\n\n1. Initiatief werkgever (WW-vriendelijkheid)\n2. Bedenktermijn 14 dagen (art. 7:670b BW)\n3. Einddatum en opzegtermijn\n4. Hoogte transitievergoeding vs. wettelijk minimum\n5. Finale kwijting — is deze voldoende ruim geformuleerd?\n6. Concurrentie- en relatiebeding\n7. Vergoeding juridische kosten\n8. Vakantiedagen en vakantiegeld\n9. Geheimhoudingsbeding\n10. Referenties/getuigschrift\n\nGeef per punt een oordeel (akkoord/aandachtspunt/risico) en concrete verbeterpunten.',
    icon: 'check',
    category: 'document',
    requiresDocument: true,
  },
  {
    label: 'Arbeidsovereenkomst controleren',
    description: 'Check op geldigheid, risico\'s en ontbrekende bedingen',
    prompt: 'Controleer de bijgevoegde arbeidsovereenkomst op juridische juistheid en volledigheid. Beoordeel:\n\n1. Bepaalde of onbepaalde tijd — ketenregeling (art. 7:668a BW)\n2. Proeftijdbeding (art. 7:652 BW) — geldigheid\n3. Concurrentiebeding (art. 7:653 BW) — motivering bij bepaalde tijd\n4. Eenzijdig wijzigingsbeding (art. 7:613 BW)\n5. Looncomponenten en pensioen\n6. Arbeidsduur en werktijden\n7. Toepasselijke cao\n8. Tussentijds opzegbeding bij bepaalde tijd\n9. Geheimhouding en intellectueel eigendom\n10. Boeteclausules — proportionaliteit\n\nSignaleer ontbrekende bepalingen en juridische risico\'s.',
    icon: 'file',
    category: 'document',
    requiresDocument: true,
  },

  // Rechtspraak zoeken
  {
    label: 'Recente rechtspraak zoeken',
    description: 'Vind relevante uitspraken met ECLI-nummers',
    prompt: 'Zoek naar relevante recente Nederlandse rechtspraak over arbeidsrecht. Ik geef je zo het onderwerp. Doe minimaal 2 zoekopdrachten op rechtspraak.nl met verschillende zoektermen. Geef per uitspraak:\n\n- ECLI-nummer\n- Instantie en datum\n- Korte samenvatting van de feiten\n- De rechtsoverweging die relevant is\n- De uitkomst\n\nSorteer op relevantie. Geef aan het eind een analyse van de lijn in de rechtspraak.\n\nHet onderwerp is: ',
    icon: 'globe',
    category: 'rechtspraak',
  },
  {
    label: 'Lijn in rechtspraak analyseren',
    description: 'Overzicht van de jurisprudentielijn over een specifiek onderwerp',
    prompt: 'Analyseer de lijn in de rechtspraak over een specifiek arbeidsrechtelijk onderwerp. Ik geef je zo het onderwerp. Zoek uitspraken van de Hoge Raad, gerechtshoven en kantonrechters. Geef:\n\n1. De hoofdregel volgens de Hoge Raad\n2. Hoe lagere rechters deze toepassen\n3. Eventuele afwijkende uitspraken en waarom\n4. De trend in recente uitspraken\n5. Praktische handvatten voor de advocatenpraktijk\n\nVerwijs naar concrete uitspraken met ECLI-nummers.\n\nHet onderwerp is: ',
    icon: 'search',
    category: 'rechtspraak',
  },

  // Berekeningen
  {
    label: 'Transitievergoeding berekenen',
    description: 'Exacte berekening op basis van salaris en dienstjaren',
    prompt: 'Bereken de transitievergoeding. Ik geef je zo de gegevens. Gebruik de wettelijke formule: 1/3 bruto maandsalaris per dienstjaar (art. 7:673 lid 2 BW). Neem mee:\n\n- Bruto maandsalaris\n- Vakantiegeld (8%)\n- Vaste eindejaarsuitkering (indien van toepassing)\n- Structurele overwerkvergoeding\n- Overige vaste looncomponenten\n\nGeef de berekening stap voor stap. Vermeld ook het wettelijk maximum (2026). Geef de gegevens die je nodig hebt als ik die niet meegeef.',
    icon: 'calculator',
    category: 'berekening',
  },
  {
    label: 'Opzegtermijn berekenen',
    description: 'Inclusief aftrek proceduretijd en contractuele afwijkingen',
    prompt: 'Bereken de correcte opzegtermijn. Ik geef je zo de gegevens. Houd rekening met:\n\n1. Wettelijke opzegtermijn op basis van dienstjaren (art. 7:672 BW)\n2. Contractuele afwijkingen (als vermeld)\n3. Aftrek proceduretijd UWV (art. 7:672 lid 4 BW) of ontbinding\n4. Minimaal 1 maand overblijvend\n5. Opzegging tegen het einde van de maand (tenzij anders overeengekomen)\n\nGeef de berekening stap voor stap met de einddatum. Geef de gegevens die je nodig hebt als ik die niet meegeef.',
    icon: 'calendar',
    category: 'berekening',
  },

  // Stukken opstellen
  {
    label: 'Verweerschrift opstellen',
    description: 'Concept verweerschrift op basis van de processtukken',
    prompt: 'Stel een concept-verweerschrift op voor een ontbindingsverzoek (art. 7:671b BW). Ik geef je zo de details of het verzoekschrift. Structureer als volgt:\n\n1. Aanduiding partijen en verzoek\n2. Feiten en omstandigheden (vanuit verweerder)\n3. Verweer per grond:\n   - Primair: afwijzing verzoek (geen redelijke grond / herplaatsing mogelijk)\n   - Subsidiair: toekenning billijke vergoeding (art. 7:671b lid 9 BW)\n4. Transitievergoeding\n5. Proceskosten\n6. Bewijsaanbod\n\nGebruik een zakelijke, juridische schrijfstijl.',
    icon: 'edit',
    category: 'opstellen',
  },
  {
    label: 'Adviesbrief schrijven',
    description: 'Helder clientadvies met juridische onderbouwing',
    prompt: 'Schrijf een concept-adviesbrief aan de client. Ik geef je zo de feiten. Structureer als volgt:\n\n1. Samenvatting van de feiten en de vraag\n2. Juridisch kader (relevante wetsartikelen)\n3. Toepassing op de situatie\n4. Conclusie en advies\n5. Procesrisico-inschatting\n6. Mogelijke vervolgstappen\n\nSchrijf in begrijpelijk Nederlands (de client is geen jurist). Vermijd jargon waar mogelijk, of leg het uit. Sluit af met een concreet advies.',
    icon: 'fileText',
    category: 'opstellen',
  },
  {
    label: 'Ontslagroute adviseren',
    description: 'Vergelijk routes: kantonrechter, UWV of VSO',
    prompt: 'Adviseer over de beste ontslagroute voor de geschetste situatie. Vergelijk:\n\n1. **Ontbinding via kantonrechter** (art. 7:671b BW)\n   - Toepasselijke gronden (a t/m i)\n   - Doorlooptijd en kosten\n   - Risico op billijke vergoeding\n\n2. **Opzegging via UWV** (art. 7:671a BW)\n   - Toepasselijke gronden (a en b)\n   - Doorlooptijd en kosten\n   - Risico op herstel of billijke vergoeding in hoger beroep\n\n3. **Beeindiging met wederzijds goedvinden (VSO)**\n   - Onderhandelingspositie\n   - WW-risico\n   - Snelheid en kosten\n\nGeef een concreet advies welke route het meest kansrijk is en waarom.',
    icon: 'arrowRight',
    category: 'opstellen',
  },
]

const CATEGORY_CONFIG: Record<string, { label: string; color: string; gradient: string }> = {
  vraag: {
    label: 'Juridische vragen',
    color: 'text-blue-400',
    gradient: 'from-blue-500/10 to-blue-500/5',
  },
  document: {
    label: 'Document analyse',
    color: 'text-emerald-400',
    gradient: 'from-emerald-500/10 to-emerald-500/5',
  },
  rechtspraak: {
    label: 'Rechtspraak',
    color: 'text-purple-400',
    gradient: 'from-purple-500/10 to-purple-500/5',
  },
  berekening: {
    label: 'Berekeningen',
    color: 'text-amber-400',
    gradient: 'from-amber-500/10 to-amber-500/5',
  },
  opstellen: {
    label: 'Stukken opstellen',
    color: 'text-rose-400',
    gradient: 'from-rose-500/10 to-rose-500/5',
  },
}

const CATEGORY_BORDER_COLORS: Record<string, string> = {
  vraag: 'border-blue-500/20 hover:border-blue-400/40',
  document: 'border-emerald-500/20 hover:border-emerald-400/40',
  rechtspraak: 'border-purple-500/20 hover:border-purple-400/40',
  berekening: 'border-amber-500/20 hover:border-amber-400/40',
  opstellen: 'border-rose-500/20 hover:border-rose-400/40',
}

const CATEGORY_ICON_COLORS: Record<string, string> = {
  vraag: 'text-blue-400/60 group-hover:text-blue-400',
  document: 'text-emerald-400/60 group-hover:text-emerald-400',
  rechtspraak: 'text-purple-400/60 group-hover:text-purple-400',
  berekening: 'text-amber-400/60 group-hover:text-amber-400',
  opstellen: 'text-rose-400/60 group-hover:text-rose-400',
}

const ACTION_ICONS: Record<string, (props: { size: number; className?: string }) => React.ReactNode> = {
  clock: Icons.clock,
  helpCircle: Icons.helpCircle,
  info: Icons.info,
  check: Icons.check,
  file: Icons.file,
  globe: Icons.globe,
  search: Icons.search,
  calculator: Icons.calculator,
  calendar: Icons.calendar,
  edit: Icons.edit,
  fileText: Icons.fileText,
  arrowRight: Icons.arrowRight,
}

export default function LegalQuickActions({ onAction, disabled = false, hasDocuments = false, inline = false }: LegalQuickActionsProps) {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)
  const categories = ['vraag', 'document', 'rechtspraak', 'berekening', 'opstellen'] as const

  // Inline mode: render as a grid of cards inside the chat area
  if (inline) {
    return (
      <div className="space-y-5 animate-fade-in">
        {categories.map((category) => {
          const config = CATEGORY_CONFIG[category]
          const actions = QUICK_ACTIONS.filter(a => a.category === category)

          return (
            <div key={category}>
              <div className="flex items-center gap-2 mb-2.5 px-1">
                <span className={`text-[11px] uppercase tracking-wider font-semibold ${config.color}`}>
                  {config.label}
                </span>
                <div className="flex-1 h-px bg-gradient-to-r from-white/[0.06] to-transparent" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {actions.map((action) => {
                  const isDisabledByDoc = action.requiresDocument && !hasDocuments
                  const IconComponent = ACTION_ICONS[action.icon]
                  const iconColorClass = CATEGORY_ICON_COLORS[category]
                  const borderColorClass = CATEGORY_BORDER_COLORS[category]

                  return (
                    <button
                      key={action.label}
                      onClick={() => onAction(action.prompt)}
                      disabled={disabled || isDisabledByDoc}
                      title={isDisabledByDoc ? 'Upload eerst een document via het paperclip-icoon' : undefined}
                      className={`group relative text-left p-3.5 rounded-xl border bg-gradient-to-br ${config.gradient} ${borderColorClass} transition-all duration-300 hover:bg-white/[0.05] hover:shadow-lg hover:shadow-black/15 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] disabled:opacity-25 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`flex-shrink-0 mt-0.5 transition-colors duration-300 ${iconColorClass}`}>
                          {IconComponent && <IconComponent size={16} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium text-white/80 group-hover:text-white transition-colors duration-300 leading-snug">
                            {action.label}
                          </p>
                          <p className="text-[11px] text-white/30 group-hover:text-white/45 transition-colors duration-300 mt-0.5 leading-relaxed line-clamp-2">
                            {action.description}
                          </p>
                        </div>
                      </div>
                      {isDisabledByDoc && (
                        <div className="absolute top-2 right-2">
                          <Icons.paperclip size={10} className="text-white/15" />
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // Sidebar mode: compact collapsible list
  return (
    <div className="space-y-1.5">
      {categories.map((category) => {
        const config = CATEGORY_CONFIG[category]
        const actions = QUICK_ACTIONS.filter(a => a.category === category)
        const isExpanded = expandedCategory === category

        return (
          <div key={category}>
            <button
              onClick={() => setExpandedCategory(isExpanded ? null : category)}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left hover:bg-white/[0.03] transition-colors group"
            >
              <span className={`text-[10px] uppercase tracking-wider font-semibold ${config.color} opacity-70 group-hover:opacity-100 transition-opacity`}>
                {config.label}
              </span>
              <Icons.chevronRight
                size={10}
                className={`text-white/20 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
              />
            </button>
            <div className={`overflow-hidden transition-all duration-300 ease-in-out ${
              isExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
            }`}>
              <div className="space-y-0.5 pb-1">
                {actions.map((action) => {
                  const isDisabledByDoc = action.requiresDocument && !hasDocuments
                  const IconComponent = ACTION_ICONS[action.icon]
                  const iconColorClass = CATEGORY_ICON_COLORS[category]

                  return (
                    <button
                      key={action.label}
                      onClick={() => onAction(action.prompt)}
                      disabled={disabled || isDisabledByDoc}
                      title={isDisabledByDoc ? 'Upload eerst een document' : action.description}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left text-[12px] text-white/50 hover:text-white hover:bg-white/[0.04] transition-all duration-200 disabled:opacity-25 disabled:cursor-not-allowed group"
                    >
                      <span className={`flex-shrink-0 transition-colors duration-200 ${iconColorClass}`}>
                        {IconComponent && <IconComponent size={13} />}
                      </span>
                      <div className="flex-1 min-w-0">
                        <span className="truncate block">{action.label}</span>
                        <span className="text-[10px] text-white/20 group-hover:text-white/35 truncate block transition-colors">
                          {action.description}
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
