'use client'

import { Icons } from '@/components/ui/Icons'

interface LegalQuickActionsProps {
  onAction: (prompt: string) => void
  disabled?: boolean
  hasDocuments?: boolean
}

interface QuickAction {
  label: string
  prompt: string
  icon: string
  category: 'document' | 'research' | 'calculate' | 'draft'
  requiresDocument?: boolean
}

const QUICK_ACTIONS: QuickAction[] = [
  // Document analyse acties
  {
    label: 'Samenvatting maken',
    prompt: 'Maak een beknopte samenvatting van de bijgevoegde documenten. Structureer dit met kopjes voor de belangrijkste punten, partijen, en kernbedingen.',
    icon: 'file',
    category: 'document',
    requiresDocument: true,
  },
  {
    label: 'Juridische analyse',
    prompt: 'Geef een uitgebreide juridische analyse van de bijgevoegde documenten. Identificeer de relevante rechtsgebieden, toepasselijke wetsartikelen (met name uit Boek 7 BW), en juridische standpunten van partijen.',
    icon: 'search',
    category: 'document',
    requiresDocument: true,
  },
  {
    label: "Risico's & aandachtspunten",
    prompt: "Identificeer alle juridische risico's en aandachtspunten in de bijgevoegde documenten. Geef per risico: (1) een omschrijving, (2) de ernst (hoog/midden/laag), (3) de toepasselijke wetgeving, en (4) een aanbeveling.",
    icon: 'warning',
    category: 'document',
    requiresDocument: true,
  },
  {
    label: 'VSO controleren',
    prompt: 'Controleer de bijgevoegde vaststellingsovereenkomst op volledigheid en juistheid. Check specifiek: bedenktermijn (art. 7:670b BW), einddatum, transitievergoeding, finale kwijting, concurrentiebeding, vergoeding juridische kosten, en WW-vriendelijkheid.',
    icon: 'check',
    category: 'document',
    requiresDocument: true,
  },

  // Onderzoek acties
  {
    label: 'Rechtspraak zoeken',
    prompt: 'Zoek naar relevante recente Nederlandse rechtspraak over arbeidsrecht die verband houdt met de kwesties in dit dossier. Gebruik web search om actuele uitspraken van kantonrechters, gerechtshoven en de Hoge Raad te vinden. Vermeld ECLI-nummers waar mogelijk.',
    icon: 'globe',
    category: 'research',
  },
  {
    label: 'Wetsartikelen opzoeken',
    prompt: 'Zoek de relevante wetsartikelen op voor de juridische kwestie in dit dossier. Focus op Boek 7 Burgerlijk Wetboek (arbeidsovereenkomst), Wet werk en zekerheid, en de Ontslagregeling. Geef de volledige tekst van de meest relevante artikelen.',
    icon: 'books',
    category: 'research',
  },

  // Berekeningen
  {
    label: 'Transitievergoeding berekenen',
    prompt: 'Bereken de transitievergoeding op basis van de gegevens in het dossier. Gebruik de formule: 1/3 bruto maandsalaris per dienstjaar. Vermeld de relevante componenten: bruto maandsalaris, vakantiegeld (8%), eventuele vaste emolumenten, en het aantal dienstjaren.',
    icon: 'calculator',
    category: 'calculate',
  },
  {
    label: 'Opzegtermijn berekenen',
    prompt: 'Bereken de juiste opzegtermijn op basis van de duur van het dienstverband (art. 7:672 BW). Houd rekening met: wettelijke opzegtermijnen, eventuele contractuele afwijkingen, en de aftrek van de proceduretijd bij UWV of ontbinding.',
    icon: 'calendar',
    category: 'calculate',
  },
  {
    label: 'Termijnen & deadlines',
    prompt: 'Bereken alle relevante procesrechtelijke termijnen voor dit dossier. Denk aan: dagvaardingstermijn, beroepstermijnen, verjaringstermijnen, bedenktermijn VSO (14 dagen), UWV procedure termijnen, en andere relevante deadlines.',
    icon: 'clock',
    category: 'calculate',
  },

  // Concepten
  {
    label: 'Dagvaarding checklist',
    prompt: 'Maak een checklist op basis van art. 45 en 111 Rv voor het opstellen van een dagvaarding in een arbeidsrechtzaak. Controleer of alle vereiste elementen aanwezig zijn en geef aan wat er eventueel ontbreekt.',
    icon: 'checklist',
    category: 'draft',
  },
  {
    label: 'Re-integratie checklist',
    prompt: 'Maak een Wet Verbetering Poortwachter checklist voor de re-integratieverplichtingen. Controleer: probleemanalyse (week 6), plan van aanpak (week 8), bijstelling, eerstejaarsevaluatie, eindevaluatie, en WIA-aanvraag (week 93).',
    icon: 'checklist',
    category: 'draft',
  },
  {
    label: 'Ontslagroute adviseren',
    prompt: 'Adviseer over de beste ontslagroute voor deze situatie. Vergelijk: (1) Ontbinding via kantonrechter (art. 7:671b BW), (2) Opzegging via UWV, (3) Beëindiging met wederzijds goedvinden (VSO). Geef voor elke route de voor- en nadelen, kosten, en doorlooptijd.',
    icon: 'route',
    category: 'draft',
  },
]

const CATEGORY_LABELS: Record<string, string> = {
  document: 'Document analyse',
  research: 'Onderzoek',
  calculate: 'Berekeningen',
  draft: 'Hulpmiddelen',
}

const ACTION_ICONS: Record<string, React.ReactNode> = {
  file: <Icons.file size={13} />,
  search: <Icons.search size={13} />,
  warning: <Icons.info size={13} />,
  check: <Icons.check size={13} />,
  globe: <Icons.globe size={13} />,
  books: <Icons.books size={13} />,
  calculator: <Icons.sparkles size={13} />,
  calendar: <Icons.calendar size={13} />,
  clock: <Icons.calendar size={13} />,
  checklist: <Icons.check size={13} />,
  route: <Icons.arrowRight size={13} />,
}

export default function LegalQuickActions({ onAction, disabled = false, hasDocuments = false }: LegalQuickActionsProps) {
  const categories = ['document', 'research', 'calculate', 'draft'] as const

  return (
    <div className="space-y-4">
      {categories.map((category) => {
        const actions = QUICK_ACTIONS.filter(a => a.category === category)
        return (
          <div key={category}>
            <p className="text-[10px] uppercase tracking-wider text-white/25 font-medium mb-1.5 px-1">
              {CATEGORY_LABELS[category]}
            </p>
            <div className="space-y-0.5">
              {actions.map((action) => {
                const isDisabledByDoc = action.requiresDocument && !hasDocuments
                return (
                  <button
                    key={action.label}
                    onClick={() => onAction(action.prompt)}
                    disabled={disabled || isDisabledByDoc}
                    title={isDisabledByDoc ? 'Upload eerst een document' : action.label}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-[12px] text-white/50 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-25 disabled:cursor-not-allowed group"
                  >
                    <span className="text-white/25 group-hover:text-workx-lime/70 flex-shrink-0 transition-colors">
                      {ACTION_ICONS[action.icon]}
                    </span>
                    <span className="truncate">{action.label}</span>
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
