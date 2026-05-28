// Seed initiele content voor stappenplan-partner en sollicitatiebeleid.
// Idempotent: skip per key als al gevuld.

import { PrismaClient } from '@prisma/client'

const STAPPENPLAN_PARTNER = {
  title: 'Stappenplan van Counsel naar Partner',
  subtitle: 'Drie stappen, telkens met duidelijke verwachtingen op inhoud, softskills en bijdrage aan kantoor',
  steps: [
    {
      id: 1,
      naam: 'Counsel',
      omzetWorkx: '€ 120.000 – 160.000',
      omzetEigen: '€ 40.000 – 60.000',
      inhoud: 'Volledig zelfstandig inhoudelijk adviseren en op hoog niveau in het Engels adviseren.',
      softskills: 'Voldoende zorgvuldig en scherp, tevredenheid klanten.',
      bijdrage: 'Begeleiding en samenwerking van collega\'s naar tevredenheid, toont initiatieven en werkt aan sociale cohesie team Workx.',
    },
    {
      id: 2,
      naam: 'Director',
      omzetWorkx: '€ 120.000 – 160.000',
      omzetEigen: '€ 70.000 – 100.000',
      inhoud: 'Zelfstandig reorganisatie kunnen doorvoeren, waaronder adviestraject met de Ondernemingsraad.',
      softskills: 'Kan laten zien dat klanten "reclame" maken voor jezelf en eigen omzet groeit.',
      bijdrage: 'Verantwoordelijk voor volledig en goed werkend know-how systeem en bijdrage aan marketing en acquisitie van kantoor.',
    },
    {
      id: 3,
      naam: 'Partner / aandeelhouder',
      omzetWorkx: '€ 120.000 – 160.000',
      omzetEigen: '€ 100.000 – 130.000',
      inhoud: 'In staat om volledig zelfstandig te adviseren over alle aspecten van het arbeidsrecht, zelfstandig due diligence in Engels kunnen doen.',
      softskills: 'Ambassadeur van Workx.',
      bijdrage: 'Functioneert op hetzelfde niveau als de andere partners, evenveel effort in kantoor.',
    },
  ],
  opmerkingen: [
    'Het stappenplan wordt jaarlijks geëvalueerd en kan worden herijkt naar persoonlijke ontwikkeling en ontwikkelingen van kantoor.',
    'Bij het bereiken van stap 1 ontvangt de medewerker een aangepaste bonusregeling (indien voldaan aan beide doelstellingen dan een bonus van 50% van de eigen omzet).',
    'Bij het bereiken van stap 3 zal een vorm van een ingroeimodel worden gehanteerd.',
    'Als de medewerker parttime gaat werken dan wordt de "Workx omzet" evenredig aangepast. De "eigen omzet" doelstelling blijft hetzelfde.',
    'Dit stappenplan is indicatief en geen arbeidsvoorwaarde. Het is ter discretie van Workx om nader invulling te geven en te bepalen of aan de vereisten is voldaan.',
  ],
}

const SOLLICITATIEBELEID = {
  title: 'Sollicitatiebeleid',
  subtitle: 'Selectieprocedure in drie gespreksrondes',
  intro: 'Onze gestructureerde manier om kandidaten zorgvuldig, consistent en respectvol te beoordelen.',
  inleiding:
    'Dit beleidsdocument beschrijft de gestructureerde sollicitatieprocedure van Workx. Het doel is om op een zorgvuldige, consistente en respectvolle wijze te beoordelen of een kandidaat aansluit bij de professionele standaarden, de werkcultuur en de inhoudelijke eisen van het kantoor. Alle kandidaten worden op gelijke wijze beoordeeld en ervaringen worden intern geborgd.',
  rondes: [
    {
      nummer: 1,
      titel: 'Kennismaking en introductie',
      korteTitel: 'Kennismaking',
      karakter: 'Formeel / informatief',
      duur: '',
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
    },
    {
      nummer: 2,
      titel: 'Inhoudelijk selectiegesprek',
      korteTitel: 'Vakinhoud',
      karakter: 'Formeel / toetsend',
      duur: '',
      betrokkenen: ['Maaike of Bas', 'Andere partner'],
      doel:
        'Beoordeling van juridisch-inhoudelijke kwaliteiten: praktijkervaring, vakinhoudelijke kennis van het arbeidsrecht en analytisch vermogen aan de hand van een concrete casus. Herhaling van gesprek 1 wordt bewust vermeden.',
      inhoud: [
        { label: 'Korte introductie', punten: ['Beknopte warming-up; geen herhaling van gesprek 1. Focus op de inhoud.'] },
        {
          label: 'Ervaring en soort zaken',
          punten: ['Bespreking eerdere praktijkervaring', 'Welke typen zaken behandeld?', 'Wat was rol en verantwoordelijkheden?'],
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
          punten: ['Actuele ontwikkelingen volgens de kandidaat', 'Hoe houdt de kandidaat zijn/haar kennis up-to-date?'],
        },
      ],
      voorbeeldvragen: [
        'Kunt u een complexe zaak beschrijven die u recentelijk heeft behandeld? Wat was uw aanpak en wat was het resultaat?',
        'Ik leg u een situatie voor: [casus]. Hoe zou u dit juridisch beoordelen en welk advies zou u uw cliënt geven?',
        'Welke recente uitspraken of wetswijzigingen in het arbeidsrecht hebben u het meest beziggehouden, en waarom?',
        'Op welk gebied van het arbeidsrecht wilt u zich verder ontwikkelen?',
      ],
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
          punten: ['Kandidaat krijgt ruimte voor vragen aan medewerkers', 'Informele uitwisseling over interesses, werkstijl, verwachtingen'],
        },
        {
          label: 'Terugkoppeling aan partners',
          punten: ['Korte, gestructureerde terugkoppeling aan partners', 'Vaste aandachtspunten: teamfit, communicatiestijl, enthousiasme'],
        },
      ],
      voorbeeldvragen: [],
    },
  ],
  besluitvorming: {
    intro: 'Na het derde gesprek vindt een intern overleg plaats tussen de partners. De volgende punten worden besproken:',
    punten: [
      'Inhoudelijke geschiktheid (op basis van gesprek 2)',
      'Persoonlijke fit en motivatie (op basis van gesprekken 1 en 3)',
      'Eventuele openstaande vragen of aandachtspunten',
    ],
    afsluiting:
      'Workx informeert de kandidaat kort na de laatste twee gesprekken over de uitkomst. Bij een positief besluit wordt een aanbod gedaan.',
    uitgangspunt:
      'Jaarcontract dat bij wederzijdse positieve ervaring tijdig wordt omgezet in contract voor onbepaalde tijd. In uitzonderingsgevallen kan besloten worden om direct een contract voor onbepaalde tijd aan te bieden.',
  },
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log('[seed-editable-policies] geen DATABASE_URL — overslaan')
    return
  }
  const prisma = new PrismaClient()
  try {
    const seeds: Array<{ key: string; content: unknown }> = [
      { key: 'stappenplan-partner', content: STAPPENPLAN_PARTNER },
      { key: 'sollicitatiebeleid', content: SOLLICITATIEBELEID },
    ]
    for (const s of seeds) {
      const existing = await prisma.editablePolicy.findUnique({ where: { key: s.key } })
      if (existing) {
        console.log(`[seed-editable-policies] '${s.key}' bestaat al — niet aangepast`)
        continue
      }
      await prisma.editablePolicy.create({
        data: { key: s.key, content: JSON.stringify(s.content) },
      })
      console.log(`[seed-editable-policies] '${s.key}' geseed`)
    }
  } catch (err) {
    console.error('[seed-editable-policies] mislukt:', err)
  } finally {
    await prisma.$disconnect().catch(() => {})
  }
}

main()
