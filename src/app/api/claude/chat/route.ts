import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'
import { anonymizeText } from '@/lib/anonymize'
import { generateEmbedding, searchSimilarChunks } from '@/lib/embeddings'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// Rate limiter: per-user, in-memory (resets on cold start, sufficient for small team)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
function checkRateLimit(userId: string, maxRequests = 30, windowMs = 3600000): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(userId)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + windowMs })
    return true
  }
  if (entry.count >= maxRequests) return false
  entry.count++
  return true
}

// Token estimator for Dutch text (~3.5 chars per token)
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.5)
}

const SYSTEM_PROMPT = `Je bent de senior juridisch AI-medewerker van Workx Advocaten, een gespecialiseerd arbeidsrecht-advocatenkantoor in Amsterdam. Je opereert als een ervaren, analytische jurist die advocaten bijstaat met onderzoek, analyse, strategie en het opstellen van stukken.

## Jouw Rol
Je bent geen generieke chatbot — je bent een gespecialiseerde juridische sparringpartner. Je denkt actief mee over strategie, signaleert proactief risico's en kansen, en levert output die direct bruikbaar is in de rechtspraktijk. Je analyseert zoals een ervaren medewerker van een gerenommeerd arbeidsrechtkantoor: grondig, kritisch en oplossingsgericht.

## Kernprincipes
1. NAUWKEURIGHEID BOVEN SNELHEID — Verifieer alles. Gok nooit. Liever eerlijk "dat weet ik niet zeker" dan een onbetrouwbaar antwoord.
2. BRONVERMELDING IS VERPLICHT — Elk juridisch standpunt onderbouw je met een wetsartikel of geverifieerde uitspraak.
3. PROACTIEF MEEDENKEN — Signaleer altijd risico's, kansen, termijnen en aandachtspunten die niet expliciet gevraagd zijn maar wel relevant kunnen zijn.
4. PRAKTISCH BRUIKBAAR — Je output moet direct bruikbaar zijn: geen academische beschouwingen maar concrete, toepasbare analyses en adviezen.
5. VOLLEDIG — Behandel alle relevante aspecten. Een advocaat moet op jouw analyse kunnen vertrouwen als compleet vertrekpunt.
6. BEIDE KANTEN BELICHTEN — Analyseer altijd zowel de sterke als de zwakke punten van een positie. Een eenzijdig verhaal is waardeloos voor een advocaat.

## Taal en Opmaak
- Altijd in het Nederlands tenzij expliciet anders gevraagd
- Schrijfstijl: zakelijk-juridisch, als in een intern memo van een gerenommeerd kantoor
- Gebruik markdown voor structuur: ## kopjes voor hoofdsecties, ### voor subsecties, **vet** alleen voor sectietitels
- Gebruik genummerde lijsten (1., 2., etc.) en opsommingslijsten (- item) voor argumenten en bevindingen
- Gebruik GEEN markdown-tabellen — presenteer vergelijkingsdata als genummerde opsommingen
- Begin met een kernachtige **Conclusie** of samenvatting, gevolgd door de onderbouwing
- Verwijs naar wetsartikelen inline: "op grond van art. 7:669 lid 3 sub g BW"
- Eindig met een ## Vervolgstappen sectie met concrete actiepunten
- Bij inhoudelijke juridische analyses vermeld je: "Dit betreft een informatieve analyse en geen formeel juridisch advies."
- Bij CAO-specifieke vragen: zoek de relevante CAO-tekst via web_search, of vraag de gebruiker om de CAO-bepaling als document bij te voegen

## Werkwijze — Gestructureerde Juridische Analyse

Bij elke juridische vraag volg je dit framework:

A. KWALIFICATIE — Bepaal het type vraag en stem je aanpak daarop af:
- Feitelijke vraag (termijn, bedrag, procedure) → beknopt en precies antwoord met bronvermelding
- Juridische analyse (toetsing, kwalificatie, beoordeling) → gestructureerd memo: feiten → juridisch kader → toepassing → conclusie
- Documentreview (contract, VSO, processtuk) → systematische beoordeling met bevindingen per clausule
- Opstellen stuk (brief, verzoekschrift, VSO) → direct bruikbaar stuk in de correcte juridische toon en structuur
- Strategieadvies (aanpak, kansen/risico's) → gewogen advies met scenario-analyse en risicobeoordeling

B. ONDERZOEK — Gebruik je tools actief en grondig (zie Zoekstrategie hieronder)

C. ANALYSE — Pas het juridisch kader toe op de feiten:
- Benoem het toepasselijke wettelijk kader met exacte artikelen
- Analyseer relevante jurisprudentie en hoe deze zich verhoudt tot de casus
- Benoem argumenten VOOR én TEGEN de positie — een advocaat moet beide kanten kennen
- Weeg de argumenten en geef een gemotiveerd oordeel

D. RISICOANALYSE — Standaard bij elke inhoudelijke analyse:
- Sterke punten van de positie
- Zwakke punten en risico's
- Procesrisico-inschatting als relevant
- Concrete aanbevelingen om risico's te mitigeren

E. CONCLUSIE EN VERVOLGSTAPPEN:
- Concrete, actionable conclusie
- Specifieke vervolgstappen
- Relevante termijnen en deadlines

## STRIKTE REGELS VOOR ECLI-NUMMERS EN JURISPRUDENTIE
⚠️ ABSOLUUT VERBOD OP VERZONNEN ECLI-NUMMERS ⚠️
1. Je mag NOOIT, ONDER GEEN ENKELE OMSTANDIGHEID, een ECLI-nummer noemen dat je niet hebt opgezocht via de search_rechtspraak tool in DIT gesprek.
2. Als je een juridische vraag krijgt: gebruik EERST de search_rechtspraak tool VOORDAT je begint te antwoorden.
3. Als de tool geen resultaten geeft of een fout retourneert:
   - Zeg EERLIJK: "Ik heb gezocht maar kon geen specifieke uitspraken verifiëren via rechtspraak.nl."
   - Benoem het juridische principe ZONDER ECLI-nummer
   - Verwijs naar het relevante wetsartikel in plaats van jurisprudentie
4. Gebruik NOOIT ECLI-nummers uit je trainingsdata of geheugen — deze kunnen verouderd, onjuist, of volledig verzonnen zijn.
5. Elke ECLI die je noemt MOET in dit gesprek zijn opgezocht en geverifieerd via de search_rechtspraak of get_rechtspraak_ruling tool.
6. Als je twijfelt of je een uitspraak hebt opgezocht: NOEM HET ECLI-NUMMER NIET.

## Bronhiërarchie — Gelaagd Onderzoek (BELANGRIJK)
Bij arbeidsrechtelijke vragen werk je ALTIJD volgens deze strikte hiërarchie:

### LAAG 1 — Interne kennisbronnen (UITGANGSPUNT)
Je EERSTE stap is ALTIJD het raadplegen van de meegeleverde interne kennisbronnen: Tekst & Commentaar, Thematica Arbeidsrecht, VAAN AR Updates, ArbeidsRecht (tijdschrift), en Rechtspraak Arbeidsrecht (RAR). Dit zijn gezaghebbende, actuele naslagwerken en vormen het fundament van je antwoord.
- Zoek in de meegeleverde kennisbronnen naar het relevante onderwerp
- Gebruik de informatie als BASIS voor je analyse
- Verwijs ALTIJD expliciet naar de exacte bron zodat de advocaat deze kan terugvinden:
  • Tekst & Commentaar: "Volgens T&C Arbeidsrecht bij art. 7:669 BW..."
  • Thematica: "Thematica Arbeidsrecht, [onderwerp/hoofdstuk], vermeldt..."
  • VAAN AR Updates: "Volgens VAAN [uitspraaknummer] ([ECLI-nummer]), [instantie], [datum]..." — vermeld ALTIJD het uitspraaknummer (bijv. ar-2025-0834) en het ECLI-nummer als dat in de passage staat
  • ArbeidsRecht (tijdschrift): "In ArbeidsRecht [referentie], '[titel]', schrijft [auteur]..." — vermeld artikelreferentie, titel en auteur
  • RAR (Rechtspraak Arbeidsrecht): "Volgens RAR [referentie] ([ECLI-nummer]), [instantie], [datum]..." — vermeld de RAR-referentie en het ECLI-nummer
- Als de kennisbronnen het onderwerp behandelen: bouw je antwoord hierop
- Bij elke passage die je gebruikt: noem de bron zodat de advocaat de oorspronkelijke tekst kan raadplegen

### LAAG 2 — Rechtspraak.nl (AANVULLING & VERIFICATIE)
Vervolgens zoek je op rechtspraak.nl ter aanvulling en verificatie:
- Doe MEERDERE zoekopdrachten met VERSCHILLENDE zoektermen (minimaal 2)
- LEES de 2-3 meest relevante uitspraken VOLLEDIG via get_rechtspraak_ruling — skim niet, lees
- Gebruik rechtspraak om de theorie uit Laag 1 te onderbouwen met concrete uitspraken
- ⚠️ ECLI-nummers ALLEEN noemen als je ze in DIT gesprek hebt opgezocht en geverifieerd

### LAAG 3 — Eigen kennis & web search (LAATSTE REDMIDDEL)
Pas als Laag 1 en 2 onvoldoende informatie opleveren:
- Gebruik web_search voor actuele wetteksten (wetten.overheid.nl), vakliteratuur en beleidsregels
- Val terug op je eigen juridische kennis
- ⚠️ WEES EXTRA VOORZICHTIG: eigen kennis kan verouderd of onvolledig zijn
- Geef ALTIJD aan wanneer je terugvalt op eigen kennis in plaats van geverifieerde bronnen

### Transparantie over brongebruik
Vermeld in je antwoord ALTIJD welke laag(lagen) je hebt gebruikt, met EXACTE bronverwijzing:
- "Op basis van T&C Arbeidsrecht bij art. 7:669 BW..." (Laag 1)
- "Uit VAAN ar-2025-0834 (ECLI:NL:HR:2025:123)..." (Laag 1 — VAAN)
- "Thematica Arbeidsrecht, hoofdstuk Ontslagrecht, vermeldt..." (Laag 1)
- "In ArbeidsRecht 2025/12 schrijft [auteur]..." (Laag 1 — ArbeidsRecht)
- "Uit RAR 2025/45 (ECLI:...)..." (Laag 1 — RAR)
- "Uit rechtspraak blijkt..." met geverifieerde ECLI (Laag 2)
- "Op basis van mijn juridische kennis (niet geverifieerd in de beschikbare bronnen)..." (Laag 3)

⚠️ VERPLICHT: Eindig je antwoord ALTIJD met een ## Gebruikte bronnen sectie — SLA DIT NOOIT OVER. Zonder deze sectie is je antwoord INCOMPLEET. Voor ELKE bron die je hebt gebruikt maak je een inklapbaar blok met:
1. De exacte vindplaats (bronnnaam, artikel/referentie, auteur)
2. Een LETTERLIJK citaat (max 2-3 zinnen) uit de meegeleverde brontekst

Dit is het VERPLICHTE formaat (gebruik exact deze HTML-tags):

<details>
<summary>T&C Arbeidsrecht, art. 7:669 BW</summary>

> "De werkgever kan de arbeidsovereenkomst opzeggen indien daar een redelijke grond voor is en herplaatsing..."

</details>

<details>
<summary>Thematica Arbeidsrecht, [hoofdstuk/onderwerp]</summary>

> "Letterlijk citaat uit de relevante passage..."

</details>

<details>
<summary>VAAN ar-2025-0834 (ECLI:NL:HR:2025:123), [instantie], [datum]</summary>

> "Letterlijk citaat uit de uitspraak of annotatie..."

</details>

<details>
<summary>ArbeidsRecht 2025/12, 'Titel', auteur</summary>

> "Letterlijk citaat uit het artikel..."

</details>

<details>
<summary>RAR 2025/45 (ECLI:NL:HR:2025:456), Hoge Raad, 01-03-2025</summary>

> "Letterlijk citaat uit de annotatie of uitspraak..."

</details>

REGELS voor de Gebruikte bronnen sectie:
- Neem ELKE bron op die je hebt geraadpleegd, ook als het er 5+ zijn
- Het citaat moet een LETTERLIJK fragment zijn uit de meegeleverde brontekst. Als je geen exact citaat kunt geven, parafraseer dan de relevante passage en markeer dit met [parafrase]
- Gebruik de exacte vindplaats zodat de advocaat de passage kan terugvinden
- Deze sectie is net zo belangrijk als het antwoord zelf — het maakt je analyse verifieerbaar

Bij web_search voor juridische bronnen, geef VOORKEUR aan: wetten.overheid.nl (wetteksten), rechtspraak.nl (jurisprudentie), navigator.nl (vakliteratuur), ar-updates.nl (arbeidsrecht updates), uwv.nl (UWV-procedures).

## Arbeidsrecht Expertise
Workx Advocaten is gespecialiseerd in:
- Ontslagrecht: ontbinding ex art. 7:671b BW, opzegging met UWV-toestemming ex art. 7:671a BW, ontslag op staande voet ex art. 7:677/678 BW, vaststellingsovereenkomsten ex art. 7:900 BW
- Arbeidsovereenkomstenrecht: kwalificatie arbeidsrelatie (Deliveroo-arrest), ketenregeling art. 7:668a BW, proeftijd art. 7:652 BW, wijziging arbeidsvoorwaarden art. 7:611/613 BW
- Transitievergoeding (art. 7:673 BW) en billijke vergoeding (art. 7:671b lid 10 BW, New Hairstyle-factoren)
- Concurrentie- en relatiebedingen: art. 7:653 BW, schriftelijkheidsvereiste, belangenafweging, motiveringsplicht bij bepaalde tijd
- Ziekte en re-integratie: Wet Verbetering Poortwachter, loondoorbetaling art. 7:629 BW, deskundigenoordeel UWV, WIA/WGA/IVA
- Collectief arbeidsrecht: CAO-recht (AVV, incorporatie, nawerking), Wet op de Ondernemingsraden, reorganisatie, Wet Melding Collectief Ontslag (WMCO)
- Medezeggenschap: adviesrecht art. 25 WOR, instemmingsrecht art. 27 WOR
- WWZ/WAB-vraagstukken: cumulatiegrond art. 7:669 lid 3 sub i BW, oproepcontracten, payrolling
- Gelijke behandeling en discriminatie in arbeidsrelaties

## Proactieve Signalering
Bij ELK antwoord check je ACTIEF op deze punten en benoem je wat relevant is:
- TERMIJNEN: vervaltermijnen (2 maanden vernietiging opzegging ex art. 7:686a lid 4 BW, 3 maanden kennelijk onredelijk ontslag, bedenktermijn 14 dagen VSO ex art. 7:670b BW), verjarings- en vervaltermijnen
- BEWIJSLAST: wie moet wat bewijzen? Is het bewijs voorhanden of moet het nog worden vergaard?
- PROCESSUEEL: bevoegde rechter, griffierecht, nevenverzoeken (bijv. transitievergoeding naast ontbinding), uitvoerbaarheid bij voorraad
- STRATEGIE: welke verweren of grondslagen zijn nog niet overwogen? Welke processtrategie is het meest kansrijk?
- SAMENHANGENDE CLAIMS: zijn er aanvullende vorderingen mogelijk die meegenomen kunnen worden?
- ACTUALITEITEN: recente wetswijzigingen, relevante prejudiciële vragen aan de HR, of aankomende veranderingen
- ONBENOEMD MAAR RELEVANT: als je iets opvalt in een document of casus dat niet gevraagd is maar wel belangrijk — benoem het expliciet

## Document Analyse
Als documenten zijn bijgevoegd, analyseer je deze SYSTEMATISCH:
1. Lees het document volledig en identificeer het type (arbeidsovereenkomst, VSO, processtuk, brief, etc.)
2. Bepaal het toepasselijke juridische kader (welke wetsartikelen, CAO, regelingen zijn van toepassing?)
3. Beoordeel elke relevante clausule op:
   - Juridische juistheid (klopt het met de wet en actuele rechtspraak?)
   - Volledigheid (ontbreken er essentiële bepalingen?)
   - Risico's (welke clausules zijn nadelig of aanvechtbaar?)
   - Marktconformiteit (is dit gangbaar in de praktijk?)
4. Signaleer wat er NIET in staat maar er WEL in zou moeten staan
5. Geef concrete, specifieke aanbevelingen per bevinding
6. Prioriteer bevindingen: KRITIEK (juridisch onjuist/risicovol) → BELANGRIJK (onvolledig) → AANBEVELING (verbetering)
7. Bij VSO's: check specifiek de bedenktermijn, finale kwijting, opzegtermijn, transitievergoeding, concurrentiebeding, en WW-veiligheid

## Templates
Als een template (modelovereenkomst, arbeidsovereenkomst, etc.) is bijgevoegd in de documenten:
- Herken deze als invul-template en gebruik de volledige inhoud als basis
- Vul alle velden in met de gegevens die de gebruiker heeft verstrekt
- Markeer ontbrekende gegevens als [INVULLEN: omschrijving]
- Behoud de exacte structuur en opmaak van het template

## Berekeningen
Bij berekeningen (transitievergoeding, opzegtermijnen, verjaringstermijnen):
- Toon altijd de rekenmethode stap voor stap
- Vermeld het toepasselijke wetsartikel
- Geef aan welke aannames je hebt gemaakt

## Proceskosten-calculator (2025 tarieven)
Gebruik deze tarieven wanneer de gebruiker vraagt om een proceskostenberekening:

**Griffierecht 2025:**
- Onvermogenden: €90
- Natuurlijke personen: €241 (vordering ≤€12.500), €649 (vordering >€12.500)
- Rechtspersonen: €688 (vordering ≤€12.500), €2.889 (vordering >€12.500)
- Hoger beroep: €361 (onvermogend), €862 (natuurlijk persoon), €6.077 (rechtspersoon)
- Kort geding: zelfde als dagvaarding
- Verzoekschrift arbeid (art. 7:671b BW): €90 (onvermogend), €241 (natuurlijk persoon), €688 (rechtspersoon)

**Salaris gemachtigde (liquidatietarief kantonrechter 2025):**
- Per punt: €200 (vordering ≤€12.500), €400 (vordering €12.500-€25.000), €500 (vordering €25.000-€100.000)
- Dagvaarding/verzoekschrift = 1 punt, conclusie/akte = 1 punt, zitting = 1 punt, repliek/dupliek = 0.5 punt

**Salaris advocaat (liquidatietarief rechtbank 2025):**
- Tarief II (onbepaald/€12.500-€60.000): €621/punt
- Tarief III (€60.000-€200.000): €1.086/punt
- Tarief IV (€200.000-€400.000): €1.552/punt

**Nakosten:** €178 (zonder betekening), €273 (met betekening)
**Explootkosten dagvaarding:** ca. €115-€130 (verschilt per deurwaarder)

Presenteer berekeningen altijd in een overzichtelijke genummerde opsomming (geen markdown-tabellen).

## Betrouwbaarheidsindicator
Sluit ELK antwoord af met een betrouwbaarheidsindicator op de LAATSTE regel in exact dit formaat:
%%CONFIDENCE:hoog%% of %%CONFIDENCE:gemiddeld%% of %%CONFIDENCE:laag%%
Regels (gekoppeld aan bronhiërarchie):
- **hoog**: je antwoord is gebaseerd op de interne kennisbronnen (T&C, Thematica) EN onderbouwd met geverifieerde rechtspraak. Duidelijke wettekst, vaste rechtspraak, eenduidige feiten.
- **gemiddeld**: je antwoord is gebaseerd op rechtspraak.nl maar het onderwerp wordt NIET (volledig) behandeld in de interne kennisbronnen. OF er is interpretatieruimte, tegenstrijdige rechtspraak, of je mist mogelijk relevante feiten.
- **laag**: je antwoord is (grotendeels) gebaseerd op eigen kennis omdat het onderwerp NIET in de interne kennisbronnen staat EN je het niet kon verifiëren via rechtspraak.nl. OF de vraag valt buiten je expertise, of er zijn onvoldoende gegevens.
Vuistregel: hoe verder je afdaalt in de bronhiërarchie (kennisbronnen → rechtspraak → eigen kennis), hoe lager de betrouwbaarheid.
Voeg GEEN toelichting toe na de %%CONFIDENCE%% tag — die wordt automatisch verwerkt.`

// GET: load messages for an existing conversation
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const conversationId = searchParams.get('conversationId')

  if (!conversationId) {
    return NextResponse.json({ error: 'conversationId is verplicht' }, { status: 400 })
  }

  // Verify user owns or is member of the conversation's project
  const conversation = await prisma.aIConversation.findFirst({
    where: {
      id: conversationId,
      OR: [
        { userId: session.user.id },
        { project: { members: { some: { userId: session.user.id } } } },
      ],
    },
  })

  if (!conversation) {
    return NextResponse.json({ error: 'Gesprek niet gevonden' }, { status: 404 })
  }

  const messages = await prisma.aIMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      role: true,
      content: true,
      hasWebSearch: true,
      citations: true,
      createdAt: true,
    },
  })

  // Parse citations from JSON string (with safe parsing)
  const parsed = messages.map(m => {
    let parsedCitations = null
    if (m.citations) {
      try { parsedCitations = JSON.parse(m.citations as string) } catch { /* ignore malformed */ }
    }
    return { ...m, citations: parsedCitations }
  })

  return NextResponse.json({ messages: parsed })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  // Rate limit: max 30 requests per user per hour
  if (!checkRateLimit(session.user.id)) {
    return NextResponse.json({ error: 'Te veel verzoeken. Wacht even voordat je een nieuwe vraag stelt (max 30 per uur).' }, { status: 429 })
  }

  const { conversationId, projectId, message, documentIds, anonymize, model: requestedModel } = await req.json()

  if (!message?.trim()) {
    return NextResponse.json({ error: 'Bericht mag niet leeg zijn' }, { status: 400 })
  }
  if (message.length > 50000) {
    return NextResponse.json({ error: 'Bericht te lang (max 50.000 tekens). Maak je vraag korter of voeg lange teksten toe als document.' }, { status: 400 })
  }

  const userId = session.user.id

  try {
    // Verify projectId access if provided
    if (projectId) {
      const projectAccess = await prisma.aIProject.findFirst({
        where: {
          id: projectId,
          OR: [
            { userId },
            { members: { some: { userId } } },
          ],
        },
      })
      if (!projectAccess) {
        return NextResponse.json({ error: 'Geen toegang tot dit project' }, { status: 403 })
      }
    }

    // Create or get conversation (with ownership check)
    let convId = conversationId
    if (!convId) {
      const conversation = await prisma.aIConversation.create({
        data: {
          userId,
          projectId: projectId || null,
          title: message.slice(0, 80),
        },
      })
      convId = conversation.id
    } else {
      // H2 fix: verify user owns or is member of the conversation
      const convAccess = await prisma.aIConversation.findFirst({
        where: {
          id: convId,
          OR: [
            { userId },
            { project: { members: { some: { userId } } } },
          ],
        },
      })
      if (!convAccess) {
        return NextResponse.json({ error: 'Geen toegang tot dit gesprek' }, { status: 403 })
      }
    }

    // Save user message (always store ORIGINAL, unanonymized content)
    await prisma.aIMessage.create({
      data: {
        conversationId: convId,
        role: 'user',
        content: message,
      },
    })

    // Get conversation history (last 30 messages — fetch newest, then reverse)
    const historyDesc = await prisma.aIMessage.findMany({
      where: { conversationId: convId },
      orderBy: { createdAt: 'desc' },
      take: 30,
    })
    const history = historyDesc.reverse()

    // Build context from documents — use native PDF support when available
    let documentContext = ''
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const documentBlocks: any[] = []  // Native document blocks for Claude API
    let hasDocxAttachments = false

    if (documentIds?.length) {
      const docs = await prisma.aIDocument.findMany({
        where: {
          id: { in: documentIds },
          OR: [
            { userId },
            { project: { members: { some: { userId } } } },
          ],
        },
      })
      for (const doc of docs) {
        // Track DOCX attachments for edit instructions
        if (doc.fileType === 'docx') hasDocxAttachments = true
        // Prefer native PDF support: send base64 PDF directly to Claude
        if (doc.fileType === 'pdf' && doc.fileUrl?.startsWith('data:application/pdf;base64,')) {
          const base64Data = doc.fileUrl.split(',')[1]
          documentBlocks.push({
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: base64Data },
            title: doc.name,
          })
        } else if (doc.content) {
          // Fallback for text files and docs without fileUrl — include document ID for DOCX editing
          documentContext += `\n\n--- Document: ${doc.name} (id: ${doc.id}) ---\n${doc.content.slice(0, 20000)}\n--- Einde ---`
        }
      }
    }

    if (projectId) {
      const projectDocs = await prisma.aIDocument.findMany({
        where: { projectId },
        take: 20,
      })
      for (const doc of projectDocs) {
        if (documentIds?.includes(doc.id)) continue
        if (doc.fileType === 'docx') hasDocxAttachments = true
        if (doc.fileType === 'pdf' && doc.fileUrl?.startsWith('data:application/pdf;base64,')) {
          if (documentBlocks.length >= 5) break  // Max 5 PDF attachments
          const base64Data = doc.fileUrl.split(',')[1]
          documentBlocks.push({
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: base64Data },
            title: doc.name,
          })
        } else if (doc.content) {
          if (documentContext.length > 200000) break
          documentContext += `\n\n--- ${doc.name} (id: ${doc.id}) ---\n${doc.content.slice(0, 20000)}\n--- Einde ---`
        }
      }
    }

    // Anonymize message and document context if requested
    let messageForClaude = message
    if (anonymize) {
      const anonMessage = anonymizeText(message)
      messageForClaude = anonMessage.text
      if (documentContext) {
        const anonDocs = anonymizeText(documentContext)
        documentContext = anonDocs.text
      }
    }

    // Fetch knowledge sources using chunk-based retrieval for primary sources
    let sourcesContext = ''
    const usedSourceNames: Array<{ name: string; category: string; url?: string }> = []
    try {
      const activeSources = await prisma.aISource.findMany({
        where: { isActive: true, isProcessed: true },
        select: { id: true, name: true, category: true, summary: true, url: true },
      })
      const isPrimary = (name: string) =>
        /tekst\s*[&en]+\s*commentaar|thematica|themata|vaan|ar.updates|arbeidsrecht|inview|\brar\b/i.test(name)
      const primarySources = activeSources.filter(s => isPrimary(s.name))
      const otherSources = activeSources.filter(s => !isPrimary(s.name))

      // PRIMAIRE BRONNEN: smart chunk retrieval based on user's question
      const primarySourceIds = primarySources.map(s => s.id)
      if (primarySourceIds.length > 0) {
        // Extract search terms from user message
        const searchTerms = extractSearchTerms(messageForClaude)

        // Check if chunks exist for primary sources
        const chunkCount = await prisma.sourceChunk.count({
          where: { sourceId: { in: primarySourceIds } },
        })

        if (chunkCount > 0 && (searchTerms.length > 0 || process.env.OPENAI_API_KEY)) {
          // Retrieve relevant chunks using hybrid search (semantic + keyword)
          const relevantChunks = await retrieveRelevantChunks(
            primarySourceIds,
            searchTerms,
            35, // max chunks to include (~175K chars)
            messageForClaude // for semantic embedding
          )

          if (relevantChunks.length > 0) {
            // Group chunks by source
            const chunksBySource = new Map<string, typeof relevantChunks>()
            for (const chunk of relevantChunks) {
              const existing = chunksBySource.get(chunk.sourceId) || []
              existing.push(chunk)
              chunksBySource.set(chunk.sourceId, existing)
            }

            for (const source of primarySources) {
              const sourceChunks = chunksBySource.get(source.id)
              if (!sourceChunks || sourceChunks.length === 0) continue

              // Sort by chunk index for reading order
              sourceChunks.sort((a, b) => a.chunkIndex - b.chunkIndex)

              sourcesContext += `\n\n--- ${source.name} [PRIMAIRE BRON — ${sourceChunks.length} relevante passages] (${source.category}) ---`
              for (const chunk of sourceChunks) {
                const headingLabel = chunk.heading ? ` [${chunk.heading}]` : ''
                sourcesContext += `\n\n[Passage ${chunk.chunkIndex + 1}${headingLabel}]\n${chunk.content}`
              }
              usedSourceNames.push({ name: source.name, category: source.category, url: source.url || undefined })
            }
          }
        }

        // Fallback: if no chunks exist yet, use summary
        if (!sourcesContext) {
          for (const source of primarySources) {
            if (source.summary) {
              sourcesContext += `\n\n--- ${source.name} [PRIMAIRE BRON — samenvatting] (${source.category}) ---\n${source.summary.slice(0, 50000)}`
              usedSourceNames.push({ name: source.name, category: source.category, url: source.url || undefined })
            }
          }
        }
      }

      // AANVULLENDE BRONNEN: samenvattingen (secundair)
      let len = sourcesContext.length
      for (const source of otherSources) {
        if (source.summary) {
          const trimmed = source.summary.slice(0, 8000)
          if (len + trimmed.length > 300000) break
          len += trimmed.length
          sourcesContext += `\n\n--- ${source.name} [Aanvullende bron] (${source.category}) ---\n${trimmed}`
          usedSourceNames.push({ name: source.name, category: source.category, url: source.url || undefined })
        }
      }
    } catch (err) {
      console.error('Error fetching sources:', err)
    }

    // Fetch available templates — so Claude knows what templates exist
    let templatesContext = ''
    try {
      const templates = await prisma.aITemplate.findMany({
        where: { isActive: true },
        select: { id: true, name: true, category: true, description: true, content: true, placeholders: true, instructions: true },
        orderBy: { usageCount: 'desc' },
        take: 10,
      })
      if (templates.length > 0) {
        let totalContentLen = 0
        templatesContext = templates.map(t => {
          let entry = `\n\n### ${t.name} (id: ${t.id}, categorie: ${t.category})`
          if (t.description) entry += `\n${t.description}`
          if (t.placeholders) {
            try {
              const fields = JSON.parse(t.placeholders)
              if (Array.isArray(fields) && fields.length > 0) {
                entry += `\nInvulvelden: ${fields.join(', ')}`
              }
            } catch { /* ignore */ }
          }
          if (t.instructions) entry += `\nInstructies: ${t.instructions}`
          // Include full content for templates (up to 80K total)
          if (t.content && totalContentLen < 80000) {
            const contentSlice = t.content.slice(0, 20000)
            totalContentLen += contentSlice.length
            entry += `\n\n--- Volledige template inhoud ---\n${contentSlice}\n--- Einde template ---`
          }
          return entry
        }).join('')
      }
    } catch { /* templates not critical */ }

    // Fetch project context from previous conversations (chat memory)
    let projectMemory = ''
    if (projectId) {
      try {
        // Get summaries from other conversations in this project (excluding current)
        const otherConvs = await prisma.aIConversation.findMany({
          where: {
            projectId,
            ...(convId ? { id: { not: convId } } : {}),
          },
          orderBy: { updatedAt: 'desc' },
          take: 5,
          select: {
            title: true,
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 2, // Last exchange from each conversation
              select: { role: true, content: true },
            },
          },
        })
        for (const conv of otherConvs) {
          if (conv.messages.length > 0) {
            const lastMsg = conv.messages.find(m => m.role === 'assistant')
            if (lastMsg) {
              projectMemory += `\n\n### ${conv.title}\n${lastMsg.content.slice(0, 1000)}${lastMsg.content.length > 1000 ? '...' : ''}`
            }
          }
        }
      } catch { /* project memory not critical */ }
    }

    // Build system prompt
    let systemPrompt = SYSTEM_PROMPT
    if (projectMemory) {
      systemPrompt += `\n\n## Dossiergeheugen — Eerdere gesprekken in dit project\nHieronder staan samenvattingen van eerdere gesprekken in dit dossier. Gebruik deze context om consistent te antwoorden en niet te herhalen wat al besproken is.${projectMemory}`
    }
    if (anonymize) {
      systemPrompt += `\n\n## Privacy — Geanonimiseerde gegevens
BELANGRIJK: In dit gesprek zijn persoonsgegevens geanonimiseerd ter bescherming van de privacy.
Gebruik ALTIJD dezelfde placeholders ([Persoon-1], [Bedrijf-1], [BSN-1], etc.) in je antwoord.
Vraag NIET naar de echte namen of gegevens.`
    }
    if (sourcesContext) {
      systemPrompt += `\n\n## Kennisbronnen van Workx Advocaten (LAAG 1 — ALTIJD EERST RAADPLEGEN)
Hieronder staan passages uit de interne kennisbronnen, geselecteerd op basis van de vraag van de gebruiker. Bronnen gemarkeerd als [PRIMAIRE BRON] bevatten de ORIGINELE tekst uit gezaghebbende naslagwerken (Tekst & Commentaar, Thematica Arbeidsrecht). Dit is je EERSTE en BELANGRIJKSTE referentiepunt.

WERKWIJZE:
1. Zoek EERST in de passages hieronder — dit zijn directe citaten uit de bronnen, geen samenvattingen
2. Gebruik de exacte formuleringen, artikelverwijzingen en analyses uit deze passages
3. Verwijs EXPLICIET naar de bron: "Volgens Tekst & Commentaar bij art. X..." of "Thematica vermeldt..."
4. Vul aan met rechtspraak.nl (Laag 2) voor concrete uitspraken
5. Val ALLEEN terug op eigen kennis (Laag 3) als de bronnen het onderwerp niet behandelen
6. Als het antwoord NIET in deze bronnen staat: vermeld dit expliciet en pas je betrouwbaarheidsindicator naar beneden aan${sourcesContext}`
    }
    if (templatesContext) {
      systemPrompt += `\n\n## Beschikbare templates van Workx Advocaten
De volgende templates zijn beschikbaar in het systeem. Als de gebruiker vraagt om een document op te stellen of een template in te vullen:
1. Herken welk template van toepassing is op basis van de naam en beschrijving
2. Vermeld het template bij naam zodat de gebruiker weet welk template je gebruikt
3. Als je de inhoud van het template nodig hebt om het in te vullen, vraag de gebruiker om het template als document bij te voegen of gebruik de beschrijving en invulvelden hieronder

Beschikbare templates:${templatesContext}`
    }
    if (documentContext) {
      systemPrompt += `\n\n## Documenten${documentContext}`
    }
    if (hasDocxAttachments) {
      systemPrompt += `\n\n## Word-document bewerking
Wanneer de gebruiker vraagt om wijzigingen in een bijgevoegd Word-document (DOCX), geef dan:
1. Een menselijke uitleg van de wijzigingen die je voorstelt
2. Een gestructureerd bewerkingsblok in EXACT dit formaat:

%%DOCX_EDITS%%
{
  "documentId": "<het document ID zoals vermeld bij het document hierboven>",
  "documentName": "<bestandsnaam>",
  "edits": [
    { "find": "<EXACTE originele tekst uit het document>", "replace": "<nieuwe tekst>" }
  ]
}
%%END_DOCX_EDITS%%

BELANGRIJK:
- De "find" tekst moet EXACT overeenkomen met tekst in het originele document, inclusief hoofdletters en leestekens
- Gebruik zo lang mogelijke fragmenten om uniek te matchen (minimaal een halve zin)
- Geef meerdere find/replace paren voor meerdere wijzigingen
- Zet het bewerkingsblok ALTIJD aan het einde van je antwoord, NA de uitleg
- Gebruik GEEN markdown-opmaak binnen het JSON-blok`
    }

    // Reinforce critical rules at end of prompt (after all context that may dilute them)
    systemPrompt += `\n\n## HERINNERING — Kritieke Regels
1. BRONHIËRARCHIE: raadpleeg EERST de interne kennisbronnen (T&C, Thematica), dan rechtspraak.nl, dan pas eigen kennis.
2. Noem GEEN ECLI-nummers die je niet in DIT gesprek hebt opgezocht via search_rechtspraak of get_rechtspraak_ruling.
3. Doe MINIMAAL 2 search_rechtspraak zoekopdrachten met VERSCHILLENDE zoektermen.
4. Lees relevante uitspraken VOLLEDIG via get_rechtspraak_ruling voordat je ze bespreekt.
5. Gebruik markdown-opmaak (## kopjes, **vet**, genummerde lijsten) voor leesbare structuur.
6. Sluit af met %%CONFIDENCE:hoog/gemiddeld/laag%% op de allerlaatste regel. Hoe meer je leunt op eigen kennis i.p.v. bronnen, hoe LAGER de confidence.`

    // Build messages — ensure alternating user/assistant roles (required by Claude API)
    // When a previous request failed, assistant messages may be missing, causing
    // consecutive user messages. We merge those to prevent API errors.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const msgs: Array<{ role: 'user' | 'assistant'; content: any }> = []
    for (let i = 0; i < history.length; i++) {
      const msg = history[i]
      if (msg.role !== 'user' && msg.role !== 'assistant') continue

      const isLastUserMsg = msg.role === 'user' && i === history.length - 1
      const content = (isLastUserMsg && anonymize) ? messageForClaude : msg.content

      // Merge consecutive messages of the same role (can happen if previous request failed)
      const prev = msgs[msgs.length - 1]
      if (prev && prev.role === msg.role) {
        if (msg.role === 'user') {
          // Append to previous user message
          if (typeof prev.content === 'string') {
            prev.content = prev.content + '\n\n' + content
          }
          // If this merged msg is also the last one and has doc blocks, upgrade to multipart
          if (isLastUserMsg && documentBlocks.length > 0) {
            prev.content = [
              ...documentBlocks,
              { type: 'text', text: prev.content },
            ]
          }
        } else {
          // Merge consecutive assistant messages (keep last one)
          prev.content = content
        }
        continue
      }

      // Attach PDF document blocks to the last user message
      if (isLastUserMsg && documentBlocks.length > 0) {
        msgs.push({
          role: 'user',
          content: [
            ...documentBlocks,
            { type: 'text', text: content },
          ],
        })
      } else {
        msgs.push({ role: msg.role as 'user' | 'assistant', content })
      }
    }

    // Context window protection: estimate tokens and trim if needed
    const MAX_CONTEXT = 170000 // Leave buffer from 200K limit
    let totalTokens = estimateTokens(systemPrompt)
    for (const msg of msgs) {
      if (typeof msg.content === 'string') {
        totalTokens += estimateTokens(msg.content)
      } else if (Array.isArray(msg.content)) {
        for (const block of msg.content) {
          if (block.type === 'text') totalTokens += estimateTokens(block.text || '')
          if (block.type === 'document') totalTokens += 5000 // Rough estimate per PDF
        }
      }
    }
    // Trim oldest messages if over limit (keep at least last 4 messages for context)
    while (msgs.length > 4 && totalTokens > MAX_CONTEXT) {
      const removed = msgs.shift()
      if (removed && typeof removed.content === 'string') {
        totalTokens -= estimateTokens(removed.content)
      }
    }
    if (totalTokens > MAX_CONTEXT) {
      console.warn(`[chat] Context still over limit after trimming: ~${totalTokens} tokens`)
    }

    // Check API key
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY niet geconfigureerd' }, { status: 500 })
    }

    // Web search always available — Claude decides when to search (like Claude.ai)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tools: any[] = [{
      type: 'web_search_20250305',
      name: 'web_search',
      max_uses: 20,
    }]

    // Rechtspraak tools always available — direct API access to Dutch case law
    tools.push({
      name: 'search_rechtspraak',
      description: 'VERPLICHT bij elke juridische vraag. Doorzoekt de officiële Nederlandse rechtspraak-database (rechtspraak.nl). Retourneert ECLI-nummers, samenvattingen en metadata. BELANGRIJK: Doe ALTIJD meerdere zoekopdrachten met VERSCHILLENDE zoektermen voor een volledig beeld (bijv. eerst "ontslag staande voet dringende reden", dan "art 7:677 schadevergoeding werkgever", dan "billijke vergoeding ernstig verwijtbaar"). Je mag ALLEEN ECLI-nummers noemen die je via deze tool hebt opgezocht in DIT gesprek.',
      input_schema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Zoektermen, bijv. "ontslag op staande voet billijke vergoeding" of "art 7:669 lid 3 sub g BW"' },
          max: { type: 'number', description: 'Maximum aantal resultaten (1-20, standaard 10)', default: 10 },
        },
        required: ['query'],
      },
    })
    tools.push({
      name: 'get_rechtspraak_ruling',
      description: 'Haal de VOLLEDIGE tekst van een uitspraak op via het ECLI-nummer. ALTIJD gebruiken wanneer je een uitspraak wilt citeren of bespreken — lees de uitspraak VOLLEDIG voordat je erover schrijft. Gebruik dit voor de 2-3 meest relevante zoekresultaten van search_rechtspraak. Zo kun je de exacte overwegingen van de rechter citeren in je analyse.',
      input_schema: {
        type: 'object',
        properties: {
          ecli: { type: 'string', description: 'ECLI-nummer zoals gevonden via search_rechtspraak, bijv. "ECLI:NL:HR:2023:1234"' },
        },
        required: ['ecli'],
      },
    })

    // Parse rechtspraak.nl XML to clean text (saves 60-80% tokens vs raw XML)
    const parseRechtspraakSearch = (xml: string): string => {
      const entries: string[] = []
      const entryRegex = /<entry>([\s\S]*?)<\/entry>/gi
      let match
      while ((match = entryRegex.exec(xml)) !== null) {
        const entry = match[1]
        const id = entry.match(/<id[^>]*>([\s\S]*?)<\/id>/i)?.[1]?.trim() || ''
        const title = entry.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() || ''
        const summary = entry.match(/<summary[^>]*>([\s\S]*?)<\/summary>/i)?.[1]?.trim() || ''
        const updated = entry.match(/<updated[^>]*>([\s\S]*?)<\/updated>/i)?.[1]?.trim() || ''
        if (id) entries.push(`ECLI: ${id}\nTitel: ${title}\nDatum: ${updated}\nSamenvatting: ${summary}`)
      }
      return entries.length > 0
        ? `Gevonden uitspraken (${entries.length}):\n\n${entries.join('\n\n---\n\n')}`
        : 'Geen resultaten gevonden in de rechtspraak-database.'
    }

    const parseRechtspraakRuling = (xml: string): string => {
      // Extract metadata
      const identifier = xml.match(/<dcterms:identifier[^>]*>([\s\S]*?)<\/dcterms:identifier>/i)?.[1]?.trim() || ''
      const title = xml.match(/<dcterms:title[^>]*>([\s\S]*?)<\/dcterms:title>/i)?.[1]?.trim() || ''
      const abstract = xml.match(/<dcterms:abstract[^>]*>([\s\S]*?)<\/dcterms:abstract>/i)?.[1]?.trim() || ''
      // Extract main text (uitspraak or conclusie body)
      const bodyMatch = xml.match(/<(?:uitspraak|conclusie)[^>]*>([\s\S]*?)<\/(?:uitspraak|conclusie)>/i)
      let bodyText = bodyMatch ? bodyMatch[1] : xml
      // Strip XML tags, clean up whitespace and entities
      bodyText = bodyText
        .replace(/<[^>]+>/g, ' ')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#\d+;/g, '')
        .replace(/\s+/g, ' ')
        .trim()
      let result = ''
      if (identifier) result += `ECLI: ${identifier}\n`
      if (title) result += `Titel: ${title}\n`
      if (abstract) result += `Samenvatting: ${abstract}\n\n`
      result += bodyText
      return result.slice(0, 40000)
    }

    const client = new Anthropic({ apiKey, timeout: 300000 })
    console.log(`[chat] Streaming: ${systemPrompt.length} chars, ${msgs.length} messages, tools=${tools.length}`)

    // Stream the response
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        let fullText = ''
        let hasWebSearch = false
        const citations: Array<{ url: string; title: string }> = []

        try {
          // Model selection: default Sonnet, optionally Opus for deep analysis
          const modelId = requestedModel === 'opus' ? 'claude-opus-4-6' : 'claude-sonnet-4-5-20250929'
          const isOpus = modelId.includes('opus')
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const streamParams: any = {
            model: modelId,
            max_tokens: isOpus ? 64000 : 32000,
            system: systemPrompt,
            messages: msgs,
            thinking: {
              type: 'enabled',
              budget_tokens: isOpus ? 16000 : 10000,
            },
            ...(tools.length > 0 ? { tools } : {}),
          }

          const anthropicStream = client.messages.stream(streamParams)

          // Send conversationId immediately
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'start', conversationId: convId })}\n\n`))

          // Stream thinking and text via raw stream events
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          anthropicStream.on('streamEvent' as any, (event: any) => {
            try {
              if (event.type === 'content_block_start') {
                if (event.content_block?.type === 'thinking') {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'thinking_start' })}\n\n`))
                }
              }
              if (event.type === 'content_block_delta') {
                if (event.delta?.type === 'thinking_delta' && event.delta.thinking) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'thinking', text: event.delta.thinking })}\n\n`))
                }
              }
            } catch { /* ignore thinking stream errors */ }
          })

          anthropicStream.on('text', (text) => {
            fullText += text
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'delta', text })}\n\n`))
          })

          // Listen for content blocks for web search detection
          anthropicStream.on('contentBlock', (block) => {
            const blockType = (block as { type: string }).type
            if (blockType === 'web_search_tool_use' || blockType === 'server_tool_use') {
              hasWebSearch = true
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'status', text: 'AI Search...' })}\n\n`))
            }
          })

          // Wait for the full response
          let finalMessage = await anthropicStream.finalMessage()

          // Extract citations from any response (web search results, etc.)
          const extractCitations = (message: typeof finalMessage) => {
            for (const block of message.content) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const b = block as any
              if (b.type === 'text' && Array.isArray(b.citations)) {
                for (const cite of b.citations) {
                  if (cite.url && !citations.some(c => c.url === cite.url)) {
                    citations.push({ url: cite.url, title: cite.title || '' })
                  }
                }
              }
            }
          }

          // Extract citations from initial response (important: web search citations live here)
          extractCitations(finalMessage)

          // Handle tool use: execute rechtspraak tools and continue (multi-round loop)
          let toolRound = 0
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let loopMsgs: Array<{ role: 'user' | 'assistant'; content: any }> = [...msgs]

          while (finalMessage.stop_reason === 'tool_use' && toolRound < 10) {
            toolRound++
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const toolUseBlocks = finalMessage.content.filter((b: any) => b.type === 'tool_use')
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const toolResults: any[] = []

            for (const toolBlock of toolUseBlocks) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const tb = toolBlock as any
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'status', text: `Rechtspraak.nl doorzoeken... (${toolRound})` })}\n\n`))

              try {
                let resultText = ''
                // 15 second timeout for external API calls
                const fetchTimeout = AbortSignal.timeout(25000)

                if (tb.name === 'search_rechtspraak') {
                  const params = new URLSearchParams({ q: tb.input.query, max: String(tb.input.max || 10), return: 'DOC', sort: 'DESC' })
                  const searchRes = await fetch(`https://data.rechtspraak.nl/uitspraken/zoeken?${params}`, {
                    headers: { Accept: 'application/xml' },
                    signal: fetchTimeout,
                  })
                  if (!searchRes.ok) throw new Error(`Rechtspraak API error: ${searchRes.status}`)
                  const rawXml = await searchRes.text()
                  resultText = parseRechtspraakSearch(rawXml)
                } else if (tb.name === 'get_rechtspraak_ruling') {
                  const contentRes = await fetch(`https://data.rechtspraak.nl/uitspraken/content?id=${encodeURIComponent(tb.input.ecli)}`, {
                    headers: { Accept: 'application/xml' },
                    signal: AbortSignal.timeout(45000), // Rulings can be large, allow more time
                  })
                  if (!contentRes.ok) throw new Error(`Rechtspraak API error: ${contentRes.status}`)
                  const rawXml = await contentRes.text()
                  resultText = parseRechtspraakRuling(rawXml)
                }
                toolResults.push({ type: 'tool_result', tool_use_id: tb.id, content: resultText || 'Geen resultaten gevonden' })
              } catch (toolErr) {
                const errMsg = toolErr instanceof Error ? toolErr.message : 'Tool failed'
                console.error(`[chat] Tool ${tb.name} error:`, errMsg)
                toolResults.push({ type: 'tool_result', tool_use_id: tb.id, content: `Fout bij ophalen van rechtspraak.nl: ${errMsg}. BELANGRIJK: Noem GEEN ECLI-nummers of specifieke uitspraken die je niet hebt kunnen verifiëren. Beantwoord de vraag op basis van wetsartikelen en algemene juridische principes, en vermeld dat je de rechtspraak-database niet kon bereiken.`, is_error: true })
              }
            }

            // Continue conversation with tool results
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'status', text: 'Resultaten analyseren...' })}\n\n`))
            // Strip thinking blocks from assistant content to save tokens in continuation
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const filteredContent = finalMessage.content.filter((b: any) => b.type !== 'thinking')
            loopMsgs = [
              ...loopMsgs,
              { role: 'assistant' as const, content: filteredContent },
              { role: 'user' as const, content: toolResults },
            ]
            const continueStream = client.messages.stream({
              model: modelId,
              max_tokens: isOpus ? 64000 : 32000,
              system: systemPrompt,
              messages: loopMsgs,
              thinking: { type: 'enabled' as const, budget_tokens: isOpus ? 32000 : 16000 },
              tools,
            })

            // Stream thinking events for the continuation too
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            continueStream.on('streamEvent' as any, (event: any) => {
              try {
                if (event.type === 'content_block_start' && event.content_block?.type === 'thinking') {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'thinking_start' })}\n\n`))
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'status', text: 'Claude analyseert resultaten...' })}\n\n`))
                }
                if (event.type === 'content_block_delta' && event.delta?.type === 'thinking_delta' && event.delta.thinking) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'thinking', text: event.delta.thinking })}\n\n`))
                }
              } catch { /* ignore */ }
            })

            continueStream.on('text', (text) => {
              fullText += text
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'delta', text })}\n\n`))
            })

            // Detect web search in continuation
            continueStream.on('contentBlock', (block) => {
              const blockType = (block as { type: string }).type
              if (blockType === 'web_search_tool_use' || blockType === 'server_tool_use') {
                hasWebSearch = true
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'status', text: 'AI Search...' })}\n\n`))
              }
            })

            finalMessage = await continueStream.finalMessage()
            extractCitations(finalMessage)
          }

          // ECLI verification: scan response for ECLI numbers and verify they actually exist
          // This catches hallucinated ECLIs that slip through despite system prompt instructions
          const ecliPattern = /ECLI:NL:[A-Z]{2,6}:\d{4}:\d{1,6}/g
          const mentionedEclis = Array.from(new Set(fullText.match(ecliPattern) || []))
          if (mentionedEclis.length > 0) {
            // Collect all ECLIs that appeared in tool results (from loopMsgs)
            const verifiedEcliTexts = loopMsgs
              .filter(m => m.role === 'user' && Array.isArray(m.content))
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              .flatMap(m => (m.content as any[]).filter(c => c.type === 'tool_result').map(c => c.content || ''))
              .join(' ')

            const unverifiedEclis = mentionedEclis.filter(ecli => !verifiedEcliTexts.includes(ecli))
            if (unverifiedEclis.length > 0) {
              // Quick-verify unverified ECLIs against rechtspraak.nl (e.g. found via web search)
              const stillUnverified: string[] = []
              for (const ecli of unverifiedEclis) {
                try {
                  const checkRes = await fetch(`https://data.rechtspraak.nl/uitspraken/content?id=${encodeURIComponent(ecli)}`, {
                    headers: { Accept: 'application/xml' },
                    signal: AbortSignal.timeout(5000),
                  })
                  if (!checkRes.ok) stillUnverified.push(ecli)
                } catch {
                  stillUnverified.push(ecli)
                }
              }
              if (stillUnverified.length > 0) {
                const warningText = `\n\n---\n⚠️ **Let op:** De volgende ECLI-nummers konden niet worden geverifieerd via rechtspraak.nl en kunnen onjuist zijn: ${stillUnverified.join(', ')}. Controleer deze handmatig op rechtspraak.nl.`
                fullText += warningText
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'delta', text: warningText })}\n\n`))
              }
            }
          }

          // Save assistant message to database
          await prisma.aIMessage.create({
            data: {
              conversationId: convId,
              role: 'assistant',
              content: fullText,
              hasWebSearch,
              citations: citations.length > 0 ? JSON.stringify(citations) : null,
            },
          })

          // Update conversation title
          if (history.length <= 1) {
            await prisma.aIConversation.update({
              where: { id: convId },
              data: { title: message.slice(0, 80) + (message.length > 80 ? '...' : '') },
            })
          }

          // Send final event with citations and source names
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'done',
            hasWebSearch,
            citations,
            sources: usedSourceNames,
            model: modelId,
          })}\n\n`))

        } catch (error) {
          const errMsg = error instanceof Error ? error.message : String(error)
          console.error('[chat] Stream error:', errMsg)

          // Save partial response or error placeholder to keep history alternation intact
          // Without this, the next request would have consecutive user messages → API error
          try {
            const errorContent = fullText || `[Fout: ${errMsg.slice(0, 200)}]`
            await prisma.aIMessage.create({
              data: { conversationId: convId, role: 'assistant', content: errorContent },
            })
          } catch { /* DB save not critical here */ }

          let userError = 'Er ging iets mis bij het verwerken van je vraag. Probeer het opnieuw.'
          if (errMsg.includes('timeout') || errMsg.includes('abort')) {
            userError = 'Claude had meer tijd nodig dan verwacht. Probeer een kortere of eenvoudigere vraag.'
          } else if (errMsg.includes('rate_limit') || errMsg.includes('429')) {
            userError = 'Even rustig aan — te veel verzoeken tegelijk. Wacht een minuut en probeer het opnieuw.'
          } else if (errMsg.includes('overloaded') || errMsg.includes('529')) {
            userError = 'Claude is momenteel overbelast. Probeer het over een paar seconden opnieuw.'
          } else if (errMsg.includes('invalid_request') || errMsg.includes('max_tokens') || errMsg.includes('400')) {
            userError = 'Er was een technisch probleem met het verzoek. Probeer het opnieuw — als het blijft falen, probeer een kortere vraag.'
          } else if (errMsg.includes('authentication') || errMsg.includes('401') || errMsg.includes('api_key')) {
            userError = 'Er is een probleem met de API-configuratie. Neem contact op met de beheerder.'
          } else if (errMsg.includes('credit') || errMsg.includes('billing') || errMsg.includes('402')) {
            userError = 'De API-limieten zijn bereikt. Neem contact op met de beheerder.'
          }

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', error: userError })}\n\n`))
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error)
    console.error('[chat] Error:', errMsg)
    return NextResponse.json({ error: 'Er is een interne fout opgetreden. Probeer het opnieuw.' }, { status: 500 })
  }
}

// ==================== CHUNK RETRIEVAL HELPERS ====================

/** Dutch stop words to filter out when extracting search terms */
const DUTCH_STOP_WORDS = new Set([
  'de', 'het', 'een', 'van', 'in', 'is', 'dat', 'die', 'op', 'te', 'en', 'voor',
  'met', 'zijn', 'aan', 'er', 'maar', 'om', 'als', 'dan', 'nog', 'wel', 'geen',
  'ook', 'al', 'naar', 'uit', 'kan', 'tot', 'bij', 'zo', 'wat', 'niet', 'wordt',
  'door', 'over', 'dit', 'werd', 'worden', 'heeft', 'hoe', 'waar', 'wanneer',
  'wie', 'welke', 'moet', 'mag', 'zou', 'kunnen', 'hebben', 'deze', 'meer',
  'was', 'waren', 'veel', 'zeer', 'ben', 'je', 'jij', 'we', 'wij', 'zij', 'ik',
  'mijn', 'hun', 'ons', 'haar', 'hem', 'u', 'men', 'zich', 'hier', 'daar',
])

/**
 * Extract meaningful search terms from user's question.
 * Keeps legal terms, article numbers, and removes stop words.
 */
function extractSearchTerms(message: string): string[] {
  const terms: string[] = []

  // Extract article references (e.g., "7:669", "art. 7:611 BW", "artikel 6")
  const articleMatches = message.match(/(?:art(?:ikel)?\.?\s*)?(\d+[.:]\d+(?:\s*(?:lid\s+\d+|sub\s+[a-z]))?(?:\s*BW)?)/gi)
  if (articleMatches) {
    for (const match of articleMatches) {
      terms.push(match.trim())
    }
  }

  // Extract multi-word legal phrases (2-3 word combinations)
  const words = message
    .toLowerCase()
    .replace(/[^\w\s:.-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !DUTCH_STOP_WORDS.has(w))

  // Add individual meaningful words
  for (const word of words) {
    if (word.length >= 4) {
      terms.push(word)
    }
  }

  // Add 2-word combinations (bigrams) for better matching
  for (let i = 0; i < words.length - 1; i++) {
    if (words[i].length >= 3 && words[i + 1].length >= 3) {
      terms.push(`${words[i]} ${words[i + 1]}`)
    }
  }

  return Array.from(new Set(terms))
}

/**
 * Retrieve the most relevant chunks using HYBRID search:
 * 1. Semantic search via embeddings (pgvector cosine similarity)
 * 2. Keyword search via PostgreSQL text matching
 * Results are combined using Reciprocal Rank Fusion (RRF) for best results.
 */
async function retrieveRelevantChunks(
  sourceIds: string[],
  searchTerms: string[],
  maxChunks: number,
  userMessage?: string
): Promise<Array<{ sourceId: string; chunkIndex: number; content: string; heading: string | null; score: number }>> {
  if (sourceIds.length === 0) return []

  // Run semantic search and keyword search in parallel
  const [semanticResults, keywordResults] = await Promise.all([
    // 1. SEMANTIC SEARCH — meaning-based via embeddings
    (async () => {
      if (!userMessage || !process.env.OPENAI_API_KEY) return []
      try {
        const queryEmbedding = await generateEmbedding(userMessage)
        return await searchSimilarChunks(queryEmbedding, sourceIds, maxChunks * 2)
      } catch (err) {
        console.error('Semantic search fout:', err)
        return []
      }
    })(),

    // 2. KEYWORD SEARCH — exact term matching (existing approach)
    (async () => {
      if (searchTerms.length === 0) return []

      const orConditions = searchTerms.slice(0, 20).map(term => ({
        content: { contains: term, mode: 'insensitive' as const },
      }))

      const matchingChunks = await prisma.sourceChunk.findMany({
        where: {
          sourceId: { in: sourceIds },
          OR: orConditions,
        },
        select: {
          id: true,
          sourceId: true,
          chunkIndex: true,
          content: true,
          heading: true,
        },
        take: 200, // Limit to prevent loading thousands of chunks with common terms
      })

      // Score by matching terms
      return matchingChunks.map(chunk => {
        const contentLower = chunk.content.toLowerCase()
        let score = 0
        for (const term of searchTerms) {
          if (contentLower.includes(term.toLowerCase())) {
            score += term.length >= 6 ? 3 : term.includes(':') ? 4 : 1
          }
        }
        return { ...chunk, score }
      }).sort((a, b) => b.score - a.score)
    })(),
  ])

  // If we have both semantic and keyword results, combine with Reciprocal Rank Fusion
  if (semanticResults.length > 0 && keywordResults.length > 0) {
    const K = 60 // RRF constant
    const rrfScores = new Map<string, {
      sourceId: string; chunkIndex: number; content: string; heading: string | null; score: number
    }>()

    // Add semantic results with RRF scores (weighted 0.6 — semantic is primary)
    semanticResults.forEach((result, rank) => {
      const key = `${result.sourceId}-${result.chunkIndex}`
      const rrfScore = 0.6 / (K + rank + 1)
      rrfScores.set(key, {
        sourceId: result.sourceId,
        chunkIndex: result.chunkIndex,
        content: result.content,
        heading: result.heading,
        score: rrfScore,
      })
    })

    // Add keyword results with RRF scores (weighted 0.4 — keyword is secondary)
    keywordResults.forEach((result, rank) => {
      const key = `${result.sourceId}-${result.chunkIndex}`
      const rrfScore = 0.4 / (K + rank + 1)
      const existing = rrfScores.get(key)
      if (existing) {
        existing.score += rrfScore // Chunk found by both methods gets higher score
      } else {
        rrfScores.set(key, {
          sourceId: result.sourceId,
          chunkIndex: result.chunkIndex,
          content: result.content,
          heading: result.heading,
          score: rrfScore,
        })
      }
    })

    // Sort by combined RRF score and return top N
    const combined = Array.from(rrfScores.values())
    combined.sort((a, b) => b.score - a.score)
    return combined.slice(0, maxChunks)
  }

  // Fallback: if only semantic results
  if (semanticResults.length > 0) {
    return semanticResults.slice(0, maxChunks).map(r => ({
      sourceId: r.sourceId,
      chunkIndex: r.chunkIndex,
      content: r.content,
      heading: r.heading,
      score: r.similarity,
    }))
  }

  // Fallback: if only keyword results (no embeddings available)
  return keywordResults.slice(0, maxChunks)
}
