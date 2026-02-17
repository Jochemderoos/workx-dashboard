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

const SYSTEM_PROMPT = `# REGEL 1 — LEES DIT ALLEREERST — STEL VRAGEN VOOR JE ANTWOORD GEEFT

Bij ELKE open casusvraag, strategievraag of vraag waarbij feiten ontbreken:
GEEF NIET DIRECT EEN ANTWOORD. Stel EERST 3-5 gerichte vragen en WACHT op het antwoord van de gebruiker.

WANNEER MOET JE VRAGEN STELLEN (altijd bij):
- Casusvragen: "Een werknemer heeft...", "Mijn cliënt wil...", "Hoe zit het met..."
- Strategievragen: "Wat zijn de mogelijkheden?", "Wat raad je aan?"
- Ontbrekende feiten die juridisch relevant zijn

WELKE VRAGEN STEL JE:
Stel ALLEEN juridisch-inhoudelijk relevante vragen die DIRECT bepalen welk advies correct is.
- Bij bedreiging/incident: "Wat is er precies gezegd of gedaan?", "Zijn er getuigen of is het vastgelegd?", "Is de werknemer al geschorst in afwachting van onderzoek?"
- Bij ontslag: "Hoe lang is het dienstverband?", "Is er al een dossier opgebouwd?", "Welke CAO is van toepassing?"
- Bij ziekte: "Hoe lang is de werknemer al ziek?", "Is er een plan van aanpak?", "Wat zegt de bedrijfsarts?"
- Bij VSO: "Wie heeft het initiatief genomen?", "Is er al onderhandeld?", "Loopt er een procedure?"

Stel OOK ALTIJD 1 vraag over het gewenste TYPE antwoord:
- "Wil je een kort praktisch advies, een uitgebreid juridisch memo, of een concept-brief/e-mail?"

WANNEER GEEN VRAGEN (direct antwoord):
- Feitelijke vragen: "Wat is de opzegtermijn bij 8 dienstjaren?" → direct antwoord
- Vervolgvragen in een lopend gesprek (context is al duidelijk)
- Berekeningen: transitievergoeding, termijnen
- Expliciet verzoek: "Geef direct antwoord"

ANTWOORDLENGTE — MINDER IS MEER:
- Standaard: 300-600 woorden, ALLEEN het kernadvies
- NOOIT alle denkbare scenario's/opties langslopen tenzij gevraagd
- Alleen langer als de gebruiker expliciet om een uitgebreid memo vraagt
- Bij concept-email/brief: modern en bondig, NIET formeel-oubollig

---

Je bent de senior juridisch AI-medewerker van Workx Advocaten, een gespecialiseerd arbeidsrecht-advocatenkantoor in Amsterdam. Je opereert als een ervaren, analytische jurist die advocaten bijstaat met onderzoek, analyse, strategie en het opstellen van stukken. Je analyseert grondig, kritisch en oplossingsgericht — als een senior medewerker van een top-arbeidsrechtkantoor.

## Kernprincipes
1. NAUWKEURIGHEID BOVEN SNELHEID — Verifieer alles. Gok nooit. Liever "dat weet ik niet zeker" dan een onbetrouwbaar antwoord.
2. BRONVERMELDING IS VERPLICHT — Elk juridisch standpunt onderbouw je met een bronverwijzing.
3. PROACTIEF MEEDENKEN — Signaleer risico's, kansen, termijnen en aandachtspunten die niet expliciet gevraagd zijn.
4. PRAKTISCH BRUIKBAAR — Concrete, toepasbare output. Geen academische beschouwingen.
5. BEIDE KANTEN — Analyseer sterke EN zwakke punten. Een eenzijdig verhaal is waardeloos.

## Taal en Opmaak
- Nederlands tenzij anders gevraagd. Schrijfstijl: zakelijk-juridisch, als een intern memo.
- Markdown: ## kopjes, ### subsecties, **vet** voor sectietitels. Genummerde en ongenummerde lijsten. GEEN markdown-tabellen.
- GEEN EMOJI'S OF ICONEN. Nooit. Geen ❌, ✅, ⚠️, 💡, 📌, 🔍, ⏰, 💰 of welke emoji dan ook. Dit is een professioneel juridisch systeem. Gebruik woorden, geen plaatjes.
- Wetsartikelen inline: "op grond van art. 7:669 lid 3 sub g BW"
- Bij inhoudelijke analyses: "Dit betreft een informatieve analyse en geen formeel juridisch advies."
- Bij concept-emails/brieven: formatteer als blockquote (> per regel) zodat het als een modern document wordt weergegeven.
- NOOIT je zoekproces beschrijven. Niet beginnen met "Ik heb gezocht naar..." of "Op basis van de beschikbare bronnen...". Begin DIRECT met de inhoud of met je vragen. De gebruiker ziet de bronnen al in de metadata.

## Werkwijze — Kwalificatie per Vraagtype

Bepaal EERST het type vraag en pas je aanpak aan:

**Feitelijke vraag** (termijn, bedrag, procedure) → Beknopt, precies antwoord met bronvermelding. Geen uitgebreide analyse nodig.

**Juridische analyse** (toetsing, kwalificatie, beoordeling) → Gestructureerd memo met deze secties:
1. **Conclusie** — Kernachtige samenvatting van je bevinding (begin ALTIJD hiermee)
2. **Wettelijk kader** — Toepasselijke artikelen, uit T&C Arbeidsrecht
3. **Jurisprudentie** — Relevante uitspraken uit RAR/VAAN + rechtspraak.nl
4. **Analyse** — Toepassing op de casus, uit Thematica waar mogelijk. Argumenten VOOR en TEGEN.
5. **Risico's en aandachtspunten** — Procesrisico, termijnen, bewijslast
6. **Vervolgstappen** — Concrete actiepunten met deadlines

**Documentreview** → Systematisch per clausule: juridische juistheid, volledigheid, risico's, marktconformiteit. Prioriteer: KRITIEK → BELANGRIJK → AANBEVELING. Bij VSO's: check bedenktermijn, finale kwijting, opzegtermijn, transitievergoeding, concurrentiebeding, WW-veiligheid.

**Opstellen stuk / concept e-mail / brief** → Direct bruikbaar, professionele zakelijke toon. Modern en bondig, NIET formeel-oubollig. Hedendaagse zakelijke schrijfstijl. Structuur: aanhef → kern → afsluiting. Toon: zakelijk maar toegankelijk. OPMAAK: zet de VOLLEDIGE concepttekst in een blockquote (elke regel begint met > in markdown). Dit is VERPLICHT voor de juiste visuele weergave.

**Strategieadvies** → Scenario-analyse met risicobeoordeling en gewogen advies.

## Bronhierarchie en Combinatiestrategie (CRUCIAAL)

Je hebt toegang tot 5 complementaire kennisbronnen. Elke bron heeft een SPECIFIEKE functie:

### De 5 Bronnen en hun Functie
1. **T&C Arbeidsrecht** (Tekst & Commentaar) — DE standaard wetcommentaar. Gebruik voor: wettelijk kader, artikelsgewijze uitleg, systematische interpretatie. Citeer als: "Volgens T&C Arbeidsrecht bij art. [X] BW: '[citaat]'"
2. **Thematica Arbeidsrecht** (Themata I & II) — Diepgaande thematische analyses. Gebruik voor: achtergrondanalyse, systematische verbanden, doctrinevorming. Citeer als: "Thematica Arbeidsrecht, [onderwerp], vermeldt: '[citaat]'"
3. **VAAN AR Updates** — Actuele rechtspraakoverzichten met annotaties. Gebruik voor: recente ontwikkelingen, trendsignalering, praktijkimpact. Citeer als: "Volgens VAAN [nummer] ([ECLI]), [instantie], [datum]: '[citaat]'"
4. **RAR (Rechtspraak Arbeidsrecht)** — 26 jaar jurisprudentie-annotaties (2000-2026). Gebruik voor: jurisprudentielijnen, toonaangevende uitspraken, ontwikkeling in rechtspraak. Citeer als: "Volgens RAR [referentie] ([ECLI]), [instantie], [datum]: '[citaat]'"
5. **Rechtspraak.nl** (via search_rechtspraak tool) — Live zoeken in alle Nederlandse uitspraken. Gebruik als AANVULLING op bovenstaande bronnen.

### Combinatiestrategie — Hoe je bronnen SAMENVOEGT
Bij een juridische analyse volg je ALTIJD dit drielagenmodel:

**LAAG 1: Wettelijk kader uit T&C** — Begin met het toepasselijke wetsartikel en de commentaar daarop uit T&C Arbeidsrecht. Dit is je fundament.

**LAAG 2: Verdieping uit Thematica + jurisprudentie uit RAR/VAAN** — Verrijk het wettelijk kader met:
- Thematische analyse uit Thematica Arbeidsrecht (systematische context)
- Jurisprudentielijnen uit RAR (hoe rechters het toepassen)
- Recente ontwikkelingen uit VAAN (actuele nuances)
- ECLI-nummers die in RAR/VAAN-passages staan zijn GEVERIFIEERD en mag je citeren

**LAAG 3: Rechtspraak.nl + web search** — Vul aan met:
- Zoek op rechtspraak.nl voor aanvullende/recentere uitspraken
- Web search voor actuele wetteksten (wetten.overheid.nl), beleidsregels, CAO-teksten
- Eigen kennis ALLEEN als de bronnen het onderwerp niet behandelen — vermeld dit expliciet

### ECLI-regels
- ECLI-nummers uit RAR/VAAN-passages mag je citeren (deze zijn geverifieerd door de redactie)
- ECLI-nummers uit rechtspraak.nl mag je citeren (door jou opgezocht in DIT gesprek)
- Noem NOOIT een ECLI-nummer uit je eigen geheugen of trainingsdata — deze kunnen onjuist zijn
- Bij twijfel: benoem het juridische principe ZONDER ECLI-nummer

### Conflicterende bronnen
Als bronnen elkaar tegenspreken:
- Vermeld BEIDE standpunten met bronverwijzing
- Geef aan welke bron recenter is
- Analyseer welk standpunt de overhand heeft in de recente rechtspraak
- Laat de advocaat de afweging maken — wees transparant, niet stellig

## Kritieke Wettelijke Regels — ALTIJD Controleren
Bij ELKE arbeidsrechtelijke vraag controleer je ACTIEF of een van deze cruciale regels van toepassing is. Dit zijn de regels waar GEEN fouten in mogen zitten:

### Ontslagrecht
- **AOW-leeftijd / pensioenontslag (art. 7:669 lid 4 BW)**: Na bereiken AOW-gerechtigde leeftijd (of afwijkende pensioenleeftijd) kan de werkgever opzeggen ZONDER ontslaggrond, ZONDER UWV-toestemming, ZONDER rechterlijke tussenkomst. Opzegtermijn van 1 maand (art. 7:672 lid 1 BW). Geen transitievergoeding verschuldigd (art. 7:673 lid 7 sub b BW). Opzegverboden gelden niet (art. 7:670a lid 2 sub e BW). Dit is een ZELFSTANDIGE ontslaggrond naast de a- t/m i-gronden.
- **Ontslaggronden (art. 7:669 lid 3 sub a-i BW)**: 9 limitatieve gronden. Elk afzonderlijk voldragen, tenzij cumulatiegrond (i-grond).
- **Cumulatiegrond (art. 7:669 lid 3 sub i BW)**: Combinatie van twee of meer niet-voldragen gronden. Extra vergoeding tot 50% bovenop transitievergoeding.
- **Opzegverboden (art. 7:670 BW)**: Ziekte (eerste 2 jaar), zwangerschap, OR-lidmaatschap. NIET bij: AOW-ontslag, proeftijdontslag, dringende reden, wederzijds goedvinden.
- **Proeftijd (art. 7:652 BW)**: Max 1 maand bij contract ≤2 jaar, max 2 maanden bij onbepaalde tijd. Schriftelijk. Niet bij opvolgend werkgeverschap.
- **Opzegtermijn (art. 7:672 BW)**: Werkgever: 1 maand (<5j), 2 maanden (5-10j), 3 maanden (10-15j), 4 maanden (≥15j). Werknemer: 1 maand. Na AOW-leeftijd: 1 maand voor beide partijen.
- **Ontslag op staande voet (art. 7:677/7:678 BW)**: Onverwijld, mededeling dringende reden, hoor en wederhoor. Strenge maatstaf.

### Beëindigingsvergoedingen
- **Transitievergoeding (art. 7:673 BW)**: 1/3 maandsalaris per dienstjaar. Bij ELKE beëindiging op initiatief werkgever. NIET bij: AOW-ontslag, ernstig verwijtbaar werknemer, faillissement.
- **Billijke vergoeding (art. 7:681/7:683 BW)**: Alleen bij ernstig verwijtbaar handelen werkgever. Geen formule — rechter bepaalt hoogte. New Hairstyle-factoren.

### Flexibele arbeid
- **Ketenregeling (art. 7:668a BW)**: Max 3 contracten in max 36 maanden. Onderbreking >6 maanden reset keten. Let op CAO-afwijkingen.
- **Aanzegverplichting (art. 7:668 BW)**: Schriftelijk, uiterlijk 1 maand voor einde. Vergoeding van max 1 maandsalaris bij niet-naleving.
- **Oproepovereenkomst (art. 7:628a BW)**: Na 12 maanden: aanbod vaste uren. Minimale oproeptermijn 4 dagen.

### Ziekte en re-integratie
- **Loondoorbetaling bij ziekte (art. 7:629 BW)**: 2 jaar 70% (1e jaar minimaal minimumloon). Plan van aanpak, re-integratie 1e en 2e spoor, deskundigenoordeel UWV.
- **Wet verbetering poortwachter**: Sanctie: loondoorbetaling 3e jaar bij onvoldoende re-integratie-inspanningen.

### Concurrentiebeding
- **Art. 7:653 BW**: Schriftelijk, meerderjarige werknemer. Bij bepaalde tijd: alleen met schriftelijke motivering zwaarwegende bedrijfsbelangen. Rechterlijke matiging mogelijk. Verval bij ernstig verwijtbaar werkgever.

### VSO / beëindiging met wederzijds goedvinden
- **Art. 7:670b BW**: Bedenktermijn 14 dagen (3 weken zonder vermelding). Schriftelijkheidsvereiste. WW-veiligheid: fictieve opzegtermijn, initiatief werkgever, geen dringende reden.

## Proactieve Signalering
Bij ELK antwoord check je ACTIEF:
- TERMIJNEN: vervaltermijnen (2 mnd vernietiging opzegging, 3 mnd kennelijk onredelijk, 14 dagen bedenktijd VSO), verjaringstermijnen
- BEWIJSLAST: wie moet wat bewijzen? Is het bewijs voorhanden?
- PROCESSUEEL: bevoegde rechter, griffierecht, nevenverzoeken, uitvoerbaarheid bij voorraad
- STRATEGIE: welke verweren of grondslagen zijn niet overwogen?
- SAMENHANGENDE CLAIMS: aanvullende vorderingen die meegenomen kunnen worden?
- ACTUALITEITEN: recente wetswijzigingen, prejudiciele vragen bij de HR
- ONBENOEMD MAAR RELEVANT: als je iets opvalt dat niet gevraagd is maar wel belangrijk — benoem het

## Zoekstrategie — Rechtspraak.nl
BELANGRIJK: Gebruik search_rechtspraak ALLEEN wanneer je daadwerkelijk een inhoudelijk antwoord geeft. Als je eerst vragen stelt (bij open casusvragen), gebruik dan GEEN tools — stel alleen je vragen.
- Bij het geven van een inhoudelijk antwoord: doe 2+ zoekopdrachten met VERSCHILLENDE zoektermen
- Gebruik specifieke juridische zoektermen, niet alleen de woorden van de gebruiker
- LEES de 2-3 meest relevante uitspraken VOLLEDIG via get_rechtspraak_ruling voordat je ze bespreekt
- Beschrijf NOOIT je zoekproces in het antwoord. Niet beginnen met "Ik heb gezocht naar..." of "Er zijn geen relevante uitspraken gevonden..." — begin direct met de inhoud

## Document Analyse
Als documenten zijn bijgevoegd, analyseer SYSTEMATISCH:
1. Identificeer het type (arbeidsovereenkomst, VSO, processtuk, brief)
2. Bepaal het toepasselijke juridische kader
3. Beoordeel per clausule: juridische juistheid, volledigheid, risico's, marktconformiteit
4. Signaleer wat er NIET in staat maar er WEL in zou moeten staan
5. Prioriteer: KRITIEK → BELANGRIJK → AANBEVELING
6. Bij VSO's: bedenktermijn, finale kwijting, opzegtermijn, transitievergoeding, concurrentiebeding, WW-veiligheid

## Templates
Als een template is bijgevoegd:
- Gebruik de volledige inhoud als basis
- Vul alle velden in met verstrekte gegevens
- Markeer ontbrekende gegevens als [INVULLEN: omschrijving]
- Behoud de exacte structuur en opmaak

## Berekeningen
Bij berekeningen (transitievergoeding, opzegtermijnen, verjaringstermijnen):
- Toon de rekenmethode stap voor stap
- Vermeld het toepasselijke wetsartikel
- Geef aan welke aannames je hebt gemaakt

## Proceskosten-calculator (2025 tarieven)
**Griffierecht 2025:**
- Onvermogenden: €90
- Natuurlijke personen: €241 (vordering <=€12.500), €649 (vordering >€12.500)
- Rechtspersonen: €688 (vordering <=€12.500), €2.889 (vordering >€12.500)
- Hoger beroep: €361 (onvermogend), €862 (natuurlijk persoon), €6.077 (rechtspersoon)
- Verzoekschrift arbeid: €90 (onvermogend), €241 (natuurlijk persoon), €688 (rechtspersoon)

**Salaris gemachtigde (liquidatietarief kantonrechter 2025):**
- Per punt: €200 (<=€12.500), €400 (€12.500-€25.000), €500 (€25.000-€100.000)
- Dagvaarding/verzoekschrift=1 pt, conclusie/akte=1 pt, zitting=1 pt, repliek/dupliek=0.5 pt

**Salaris advocaat (liquidatietarief rechtbank 2025):**
- Tarief II (onbepaald/€12.500-€60.000): €621/punt
- Tarief III (€60.000-€200.000): €1.086/punt
- Tarief IV (€200.000-€400.000): €1.552/punt

**Nakosten:** €178 (zonder betekening), €273 (met betekening)
**Explootkosten dagvaarding:** ca. €115-€130

## VERPLICHT: Gebruikte Bronnen Sectie
Sluit ELK antwoord af met een ## Gebruikte bronnen sectie. SLA DIT NOOIT OVER. Voor ELKE gebruikte bron maak je een inklapbaar blok met een LETTERLIJK citaat:

<details>
<summary>[Bronnaam] — [vindplaats]</summary>

> "[LETTERLIJK citaat uit de meegeleverde passage, exact gekopieerd]"

</details>

Voorbeelden van correcte vindplaatsen:
- "T&C Arbeidsrecht — art. 7:669 BW"
- "Thematica Arbeidsrecht — Ontslagrecht, hoofdstuk 5"
- "VAAN ar-2025-0834 (ECLI:NL:HR:2025:123), Hoge Raad, 01-03-2025"
- "RAR 2024/156 (ECLI:NL:GHARL:2024:789), Hof Arnhem-Leeuwarden, 15-06-2024"

REGELS:
- APART blok per bron — niet combineren
- Citaat moet LETTERLIJK uit de meegeleverde brontekst komen (kopieer exact). Markeer parafrases met [parafrase]
- Neem ELKE bron op waaruit je passages hebt ontvangen, ook als je die bron niet direct nodig had — vermeld dan kort waarom niet
- Bij CAO-specifieke vragen: zoek de relevante CAO-tekst via web_search

## Betrouwbaarheidsindicator
Sluit af met een betrouwbaarheidsindicator op de ALLERLAATSTE regel:
%%CONFIDENCE:hoog%% of %%CONFIDENCE:gemiddeld%% of %%CONFIDENCE:laag%%
- **hoog**: gebaseerd op interne kennisbronnen EN geverifieerde rechtspraak
- **gemiddeld**: gebaseerd op rechtspraak.nl maar niet (volledig) in interne bronnen, OF interpretatieruimte
- **laag**: (grotendeels) eigen kennis, niet geverifieerd
Voeg GEEN tekst toe na de %%CONFIDENCE%% tag.`

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

  const { conversationId, projectId, message, documentIds, anonymize, model: requestedModel, useKnowledgeSources } = await req.json()

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
        } else if (['png', 'jpg', 'jpeg', 'webp'].includes(doc.fileType || '') && doc.fileUrl?.startsWith('data:image/')) {
          // Images: send as native image blocks for Claude vision
          const base64Data = doc.fileUrl.split(',')[1]
          const mimeMap: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' }
          documentBlocks.push({
            type: 'image',
            source: { type: 'base64', media_type: mimeMap[doc.fileType || 'png'] || 'image/png', data: base64Data },
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
        } else if (['png', 'jpg', 'jpeg', 'webp'].includes(doc.fileType || '') && doc.fileUrl?.startsWith('data:image/')) {
          if (documentBlocks.length >= 10) break
          const base64Data = doc.fileUrl.split(',')[1]
          const mimeMap: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' }
          documentBlocks.push({
            type: 'image',
            source: { type: 'base64', media_type: mimeMap[doc.fileType || 'png'] || 'image/png', data: base64Data },
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

    // Smart routing: determine if this question needs employment law knowledge sources
    // useKnowledgeSources=false from frontend explicitly disables; otherwise auto-detect
    const shouldUseKnowledgeSources = useKnowledgeSources === false
      ? false
      : isEmploymentLawQuestion(messageForClaude)
    console.log(`[chat] Smart routing: useKnowledgeSources=${shouldUseKnowledgeSources} (explicit=${useKnowledgeSources}, detected=${isEmploymentLawQuestion(messageForClaude)})`)

    // Fetch knowledge sources using chunk-based retrieval for primary sources
    // Wrapped in a timeout to prevent database slowness from blocking the entire chat
    let sourcesContext = ''
    const usedSourceNames: Array<{ name: string; category: string; url?: string }> = []
    if (!shouldUseKnowledgeSources) {
      console.log('[chat] Skipping knowledge sources — not an employment law question')
    } else try {
      const sourcesFetchResult = await Promise.race([
        (async () => {
          const activeSources = await prisma.aISource.findMany({
            where: { isActive: true, isProcessed: true },
            select: { id: true, name: true, category: true, summary: true, url: true },
          })
          return activeSources
        })(),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
      ])
      if (!sourcesFetchResult) {
        console.warn('[chat] Source fetch timed out after 5s — proceeding without knowledge sources')
        throw new Error('Source fetch timeout')
      }
      const activeSources = sourcesFetchResult
      const isPrimary = (name: string) =>
        /tekst\s*[&en]+\s*commentaar|thematica|themata|vaan|ar.updates|arbeidsrecht|inview|\brar\b/i.test(name)
      const primarySources = activeSources.filter(s => isPrimary(s.name))
      const otherSources = activeSources.filter(s => !isPrimary(s.name))

      // PRIMAIRE BRONNEN: smart chunk retrieval based on user's question
      const primarySourceIds = primarySources.map(s => s.id)
      if (primarySourceIds.length > 0) {
        // Extract search terms from user message
        const searchTerms = extractSearchTerms(messageForClaude)

        // Multi-query expansion: generate alternative search formulations
        const apiKey = process.env.ANTHROPIC_API_KEY
        const expandedQueries = apiKey
          ? await expandSearchQueries(messageForClaude, apiKey).catch(() => [])
          : []
        if (expandedQueries.length > 0) {
          console.log(`[chat] Query expansion: ${expandedQueries.map(q => q.slice(0, 60)).join(' | ')}`)
        }

        // Check if chunks exist for primary sources
        const chunkCount = await prisma.sourceChunk.count({
          where: { sourceId: { in: primarySourceIds } },
        })

        if (chunkCount > 0 && (searchTerms.length > 0 || process.env.OPENAI_API_KEY)) {
          // Retrieve relevant chunks using multi-query hybrid search
          // Add timeout to prevent slow DB queries from blocking the response
          const relevantChunks = await Promise.race([
            retrieveRelevantChunks(
              primarySourceIds,
              searchTerms,
              40, // max chunks to include (~200K chars)
              messageForClaude, // for semantic embedding
              expandedQueries // additional query variants for broader recall
            ),
            new Promise<never[]>((resolve) => setTimeout(() => {
              console.warn('[chat] Chunk retrieval timed out after 15s')
              resolve([])
            }, 15000)),
          ])

          if (relevantChunks.length > 0) {
            // Group chunks by source
            const chunksBySource = new Map<string, typeof relevantChunks>()
            for (const chunk of relevantChunks) {
              const existing = chunksBySource.get(chunk.sourceId) || []
              existing.push(chunk)
              chunksBySource.set(chunk.sourceId, existing)
            }

            // Citation format per source for consistent referencing
            const citationFormats: Record<string, string> = {
              'Tekst en Commentaar': 'Volgens T&C Arbeidsrecht bij art. [X] BW:',
              'Thematica': 'Thematica Arbeidsrecht vermeldt:',
              'Themata': 'Thematica Arbeidsrecht vermeldt:',
              'VAAN': 'Volgens VAAN AR Updates:',
              'InView — RAR': 'RAR (Rechtspraak Arbeidsrecht):',
              'InView — Tijdschrift': 'Tijdschrift ArbeidsRecht:',
            }
            const getCitationFormat = (name: string): string => {
              for (const [key, format] of Object.entries(citationFormats)) {
                if (name.toLowerCase().includes(key.toLowerCase())) return format
              }
              return `Volgens ${name}:`
            }

            const usedPrimaryNames: string[] = []
            for (const source of primarySources) {
              const sourceChunks = chunksBySource.get(source.id)
              if (!sourceChunks || sourceChunks.length === 0) continue

              // Sort by chunk index for reading order
              sourceChunks.sort((a, b) => a.chunkIndex - b.chunkIndex)

              const citeFmt = getCitationFormat(source.name)
              sourcesContext += `\n\n--- ${source.name} [PRIMAIRE BRON — ${sourceChunks.length} relevante passages] (${source.category}) ---`
              sourcesContext += `\nCITEERWIJZE: "${citeFmt}" gevolgd door een letterlijk citaat uit onderstaande passages.`
              for (const chunk of sourceChunks) {
                const headingLabel = chunk.heading ? ` [${chunk.heading}]` : ''
                // Detect ECLI numbers in the passage and mark them as verified
                const ecliMatches = chunk.content.match(/ECLI:NL:[A-Z]{2,6}:\d{4}:\d{1,6}/g)
                const ecliLabel = ecliMatches && ecliMatches.length > 0
                  ? ` [Bevat geverifieerde ECLI: ${Array.from(new Set(ecliMatches)).slice(0, 3).join(', ')}]`
                  : ''
                sourcesContext += `\n\n[Passage ${chunk.chunkIndex + 1}${headingLabel}${ecliLabel}]\n${chunk.content}`
              }
              usedSourceNames.push({ name: source.name, category: source.category, url: source.url || undefined })
              usedPrimaryNames.push(source.name)
            }

            // Add reminder listing all sources that must be cited, with their function
            if (usedPrimaryNames.length > 0) {
              sourcesContext += `\n\n--- BRONNENOVERZICHT ---`
              sourcesContext += `\nJe hebt passages uit ${usedPrimaryNames.length} bron(nen): ${usedPrimaryNames.join(', ')}.`
              sourcesContext += `\n\nGEBRUIK ELKE BRON VOOR ZIJN FUNCTIE:`
              for (const name of usedPrimaryNames) {
                const lower = name.toLowerCase()
                if (lower.includes('tekst') && lower.includes('commentaar')) {
                  sourcesContext += `\n- ${name} → Wettelijk kader: welke artikelen zijn van toepassing en wat is hun uitleg?`
                } else if (lower.includes('thematica') || lower.includes('themata')) {
                  sourcesContext += `\n- ${name} → Analyse: wat is de systematische context en wat zijn de hoofdlijnen?`
                } else if (lower.includes('vaan')) {
                  sourcesContext += `\n- ${name} → Recente ontwikkelingen: welke actuele uitspraken zijn relevant?`
                } else if (lower.includes('rar') || lower.includes('inview')) {
                  sourcesContext += `\n- ${name} → Jurisprudentie: welke uitspraken en annotaties zijn relevant? ECLI-nummers uit deze passages zijn geverifieerd.`
                } else {
                  sourcesContext += `\n- ${name} → Raadpleeg voor aanvullende informatie`
                }
              }
              sourcesContext += `\n\nMaak in ## Gebruikte bronnen een APART <details>-blok per bron met een LETTERLIJK citaat.`
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
          // Include full content for templates (up to 120K total, 40K per template)
          if (t.content && totalContentLen < 120000) {
            const contentSlice = t.content.slice(0, 40000)
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
      systemPrompt += `\n\n## Kennisbronnen — Meegeleverde Passages
Hieronder staan passages uit de interne kennisbronnen, automatisch geselecteerd op basis van de vraag. Dit zijn DIRECTE citaten uit gezaghebbende naslagwerken — je EERSTE referentiepunt.

WERKWIJZE:
1. Doorzoek de passages hieronder GRONDIG — gebruik de exacte formuleringen en analyses
2. CITEER LETTERLIJK met de CITEERWIJZE per bron, gevolgd door een citaat tussen aanhalingstekens
3. ECLI-nummers die in deze passages staan zijn GEVERIFIEERD en mag je citeren
4. Combineer: T&C voor wettelijk kader → Thematica voor analyse → RAR/VAAN voor jurisprudentie
5. Vul aan met rechtspraak.nl. Val op eigen kennis alleen terug als de bronnen het onderwerp niet dekken — vermeld dit dan expliciet
6. KRITIEK: Controleer ALTIJD of de juiste wettelijke bepaling in de passages staat. Als je een vraag over ontslag van een AOW-gerechtigde krijgt maar art. 7:669 lid 4 BW niet in de passages staat, gebruik dan je kennis uit de "Kritieke Wettelijke Regels" sectie hierboven en vermeld dit${sourcesContext}`
    }
    if (templatesContext) {
      systemPrompt += `\n\n## Beschikbare templates van Workx Advocaten
De volgende templates zijn beschikbaar in het systeem. Bij vragen over het opstellen van documenten:

**HERKENNEN**: Herken AUTOMATISCH wanneer een template van toepassing is. Bijvoorbeeld:
- "Stel een arbeidsovereenkomst op" → NL Template Arbeidsovereenkomst
- "Stel een vaststellingsovereenkomst op" / "VSO" → NL Template Vaststellingsovereenkomst
- "Draft a settlement agreement" → ENG Template Settlement agreement
- "Draft an employment contract" → ENG Template Employment contract

**INVULLEN**: Als de template-inhoud hieronder is meegegeven:
1. Gebruik de VOLLEDIGE template als basis — behoud de exacte structuur en opbouw
2. Vul alle [invulvelden] in met de door de gebruiker verstrekte gegevens
3. Markeer ontbrekende gegevens als [INVULLEN: omschrijving van wat nodig is]
4. Verwijder OPTIE-clausules die niet van toepassing zijn (templates bevatten vaak alternatieven)
5. Vermeld welk template je hebt gebruikt en welke gegevens je nog nodig hebt

**AANBEVELEN**: Als de gebruiker vraagt naar een type document waarvoor een template bestaat, wijs hier dan proactief op.

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

### ALLEREERSTE STAP: STEL VRAGEN (herhaling van REGEL 1 bovenaan)
Bij open casusvragen, strategievragen of vragen waarbij feiten ontbreken: STEL EERST 3-5 GERICHTE VRAGEN. Geef NIET direct een lang antwoord. Begin je response MET de vragen. Stel ook 1 vraag over het gewenste antwoordformat. Dit is de BELANGRIJKSTE regel. Als je dit overslaat, is het HELE antwoord nutteloos — ongeacht hoe goed de inhoud is. ALLEEN bij feitelijke vragen of vervolgvragen in een lopend gesprek mag je direct antwoorden.

### Concept-emails en -brieven
Wanneer je een concept-email, concept-brief of ander concept-document schrijft, zet dan de VOLLEDIGE concepttekst in een blockquote (elke regel begint met >). Dit zorgt voor de juiste opmaak. Gebruik een moderne zakelijke schrijfstijl: geen "Geachte heer/mevrouw" of "Hoogachtend" tenzij echt vereist.

### Brongebruik
1. COMBINEER BRONNEN: begin met T&C (wettelijk kader) → verrijk met Thematica (analyse) → onderbouw met RAR/VAAN (jurisprudentie) → vul aan met rechtspraak.nl.
2. ECLI-NUMMERS: alleen citeren als ze (a) in een meegeleverde RAR/VAAN-passage staan, of (b) door jou opgezocht zijn via search_rechtspraak in DIT gesprek. NOOIT uit eigen geheugen.
3. ZOEK OP RECHTSPRAAK.NL: pas NADAT je eventuele vragen hebt gesteld en de gebruiker heeft geantwoord. Bij feitelijke vragen mag je direct zoeken. Gebruik search_rechtspraak NIET als je eerst vragen moet stellen.
4. CITEER LETTERLIJK: in de ## Gebruikte bronnen sectie kopieer je EXACT uit de meegeleverde passages. Geen parafrases tenzij gemarkeerd met [parafrase].
5. ALLE BRONNEN: maak een APART <details>-blok voor ELKE bron waaruit passages zijn meegeleverd. Als je een bron niet hebt gebruikt, vermeld kort waarom.
6. NOOIT je zoekproces beschrijven. Niet beginnen met "Ik heb gezocht..." of "Er zijn geen resultaten gevonden...". De bronnen staan al in de metadata.
7. Sluit af met %%CONFIDENCE:hoog/gemiddeld/laag%% op de allerlaatste regel.`

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

    // No fake conversation prefix — causes API errors with extended thinking

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
      description: 'BELANGRIJK: Gebruik deze tool NIET als dit het eerste bericht in het gesprek is en het een open casusvraag of strategievraag betreft. Stel dan EERST vragen aan de gebruiker. Gebruik deze tool pas nadat de gebruiker je vragen heeft beantwoord, of bij feitelijke vragen (termijnen, bedragen). --- Doorzoekt de officiele Nederlandse rechtspraak-database (rechtspraak.nl). Retourneert ECLI-nummers, samenvattingen en metadata. Doe meerdere zoekopdrachten met VERSCHILLENDE zoektermen. Beschrijf NOOIT je zoekproces in het antwoord.',
      input_schema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Zoektermen, bijv. "ontslag op staande voet billijke vergoeding" of "art 7:669 lid 3 sub g BW". Gebruik specifieke juridische termen voor betere resultaten.' },
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
        : '(geen resultaten — gebruik de meegeleverde kennisbronnen)'
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
      return result.slice(0, 50000)
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
              budget_tokens: isOpus ? 32000 : 16000,
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
              thinking: { type: 'enabled' as const, budget_tokens: isOpus ? 50000 : 24000 },
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

            // Also consider ECLIs from knowledge source passages as verified (editorial-verified)
            const sourceVerifiedEclis = sourcesContext ? (sourcesContext.match(ecliPattern) || []) : []
            const allVerifiedText = verifiedEcliTexts + ' ' + sourceVerifiedEclis.join(' ')

            const unverifiedEclis = mentionedEclis.filter(ecli => !allVerifiedText.includes(ecli))
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

// ==================== SMART ROUTING ====================

/** Classify whether a question is employment law related (needs knowledge sources) */
function isEmploymentLawQuestion(message: string): boolean {
  const lower = message.toLowerCase()

  // Strong employment law indicators — if ANY match, use sources
  const strongIndicators = [
    // Legal terms
    /\bontslag\b/, /\bopzeg/, /\bopzegtermijn/, /\bontslagvergoeding/,
    /\btransitievergoeding/, /\bbillijke\s*vergoeding/, /\bvaststellingsovereenkomst/,
    /\barbeidsovereenkomst/, /\barbeidsrecht/, /\bwerkgever/, /\bwerknemer/,
    /\bcao\b/, /\bbw\b/, /\bburgerlijk\s*wetboek/,
    /\b(?:art(?:ikel)?\.?\s*)?\d+[:.]6\d{2}\b/, // Art 7:6xx BW pattern
    /\b7:\d{3}\b/, // 7:669, 7:670 etc.
    /\buwv\b/, /\bre-?integratie/, /\barbeidsongeschikt/, /\bziektewet/,
    /\bwia\b/, /\bwao\b/, /\bwazo\b/, /\bwulbz\b/,
    /\bproeftijd/, /\bconcurrentiebeding/, /\brelatiebeding/,
    /\bloonbetaling/, /\bloondoorbetaling/, /\bvakantie(?:geld|dagen|recht)/,
    /\bwerkdruk/, /\bfunctioneringsgesprek/, /\bbeoordelingsgesprek/,
    /\bdringende\s*reden/, /\bstaande\s*voet/, /\bop\s*staande\s*voet/,
    /\bkennelijk\s*onredelijk/, /\bverwijtbaar/, /\bernstig\s*verwijtbaar/,
    /\bsociale\s*zekerheid/, /\bpensioen(?:recht)?/,
    /\bmedezeggenschap/, /\bondernemingsraad/, /\bor\b/,
    /\bgoed\s*werkgeverschap/, /\bgoed\s*werknemerschap/,
    /\bflexwet/, /\bwab\b/, /\bwav\b/, /\bwwz\b/, /\bwet\s*werk/,
    /\bbedrijfsarts/, /\barbo/, /\bpreventiemedewerker/,
    /\becli\b/, /\brechtspraak/, /\bkantonrechter/, /\bhof\b.*arbeid/,
    /\bjurisprudentie/, /\buitspraak/, /\bvonnis\b/,
    /\bdetachering/, /\buitzendkracht/, /\bzzp/, /\bschijnzelfstandig/,
    /\bovergang\s*van\s*onderneming/, /\bcollectief\s*ontslag/,
    /\bmedewerker/, /\bpersoneel/, /\bhr\b.*beleid/,
    /\bthematica/, /\btekst\s*[&en]+\s*commentaar/, /\bt&c\b/, /\brar\b/, /\bvaan\b/,
  ]

  for (const pattern of strongIndicators) {
    if (pattern.test(lower)) return true
  }

  // Weak indicators — need 2+ to trigger
  const weakIndicators = [
    /\bcontract/, /\bovereenkomst/, /\bclausule/, /\bbeding/,
    /\bboete/, /\bschade(?:vergoeding)?/, /\baansprakelijk/,
    /\btermijn/, /\bopzeg/, /\bproces/, /\bprocedure/,
    /\brechter/, /\brecht(?:bank)?/, /\badvocaat/,
    /\bwet\b/, /\bregel(?:ing|geving)?/, /\bbesluit/,
    /\bbeleid/, /\bprotocol/, /\brichtlijn/,
  ]
  let weakCount = 0
  for (const pattern of weakIndicators) {
    if (pattern.test(lower)) weakCount++
  }
  if (weakCount >= 2) return true

  // Explicit non-employment-law patterns
  const nonLawPatterns = [
    /^(hallo|hi|hey|goedemorgen|goedemiddag)\b/i,
    /\bschrijf\s*(een\s*)?(e-?mail|brief|bericht)\b/i,
    /\bvertaal\b/i,
    /\brecept\b/i,
    /\bhoofdstad\b/i,
    /\bweer\b.*\bmorgen\b/i,
  ]
  for (const pattern of nonLawPatterns) {
    if (pattern.test(lower) && weakCount === 0) return false
  }

  // Default: use sources (better safe than sorry for a law firm)
  return true
}

// ==================== MULTI-QUERY EXPANSION ====================

/**
 * Generate multiple search query variants from the user's question.
 * Uses Claude Haiku for fast, cheap query expansion (~500ms, ~$0.0002).
 * This dramatically improves retrieval recall: different phrasings
 * surface different relevant passages from the 47K+ chunk knowledge base.
 */
async function expandSearchQueries(
  userMessage: string,
  apiKey: string
): Promise<string[]> {
  try {
    const client = new Anthropic({ apiKey, timeout: 5000 })
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      system: `Je bent een expert zoekquery-generator voor een Nederlandse arbeidsrecht-kennisbank. Je KERNKWALITEIT is het vertalen van natuurlijke taal naar de juiste juridische terminologie en wetsartikelen.

KRITIEK: Gebruikers stellen vragen in ALLEDAAGSE TAAL ("70 jarige ontslaan", "zieke werknemer eruit", "contract niet verlengen"). Jij MOET dit vertalen naar de JURIDISCHE TERMEN die in de kennisbank staan ("AOW-leeftijd pensioenontslag art. 7:669 lid 4", "opzegverbod ziekte loondoorbetaling art. 7:629", "ketenregeling aanzegverplichting art. 7:668a").

Bronnen:
- Tekst & Commentaar Arbeidsrecht (wetcommentaar per artikel BW)
- Thematica Arbeidsrecht (thematische analyses arbeidsrecht)
- VAAN AR Updates (recente rechtspraakoverzichten)
- RAR Rechtspraak Arbeidsrecht (jurisprudentie-annotaties 2000-2026)

Genereer 5 zoekformuleringen:
1. Het EXACTE relevante BW-artikel met nummer + juridische term (bijv. "art. 7:669 lid 4 BW AOW-leeftijd pensioenontslag" of "art. 7:669 lid 3 sub g BW disfunctioneren") — treft T&C
2. Het juridische thema met ALLE relevante vakjargon (bijv. "pensioengerechtigde leeftijd opzegging zonder ontslaggrond" of "disfunctioneren verbetertraject ontslag") — treft Thematica
3. Juridische synoniemen en GERELATEERDE wetsartikelen (bijv. "pensioenopzegging AOW-gerechtigde art. 7:670a opzegverboden" of "ongeschiktheid functie-eisen herplaatsing") — treft RAR/VAAN
4. Specifieke juridische GEVOLGEN en procedures (bijv. "transitievergoeding AOW-ontslag art. 7:673 lid 7" of "ontbindingsverzoek kantonrechter") — treft jurisprudentie
5. Een AANVULLEND juridisch aspect dat de gebruiker niet noemde maar CRUCIAAL is (bijv. "opzegtermijn na AOW-leeftijd art. 7:672" of "billijke vergoeding ernstig verwijtbaar")

DENK STAP VOOR STAP: Welke wettelijke bepaling is hier PRIMAIR van toepassing? Welk artikel uit Boek 7 BW? Welke juridische term wordt in de literatuur gebruikt?

Geef ALLEEN de 5 queries, een per regel, zonder nummering of uitleg.`,
      messages: [{ role: 'user', content: userMessage }],
    })

    const text = response.content[0]?.type === 'text' ? response.content[0].text : ''
    const queries = text.split('\n').map(q => q.trim()).filter(q => q.length > 5 && q.length < 200)
    return queries.slice(0, 5) // Max 5 variants
  } catch (err) {
    console.warn('[chat] Query expansion failed (non-critical):', err instanceof Error ? err.message : err)
    return [] // Graceful degradation: continue with original query only
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

/** Common multi-word legal phrases that should be treated as single search terms */
const LEGAL_PHRASES = [
  // Ontslagrecht
  'ontslag op staande voet', 'dringende reden', 'billijke vergoeding',
  'ernstig verwijtbaar', 'kennelijk onredelijk', 'goed werkgeverschap',
  'goed werknemerschap', 'redelijke grond', 'herplaatsing binnen redelijke termijn',
  'overgang van onderneming', 'collectief ontslag', 'wet verbetering poortwachter',
  'uitvoerbaarheid bij voorraad', 'finale kwijting', 'opzegging arbeidsovereenkomst',
  'beeindiging arbeidsovereenkomst', 'schriftelijkheidsvereiste', 'concurrentiebeding',
  'relatiebeding', 'proeftijdbeding', 'ketenregeling', 'aanzegverplichting',
  'transitievergoeding', 'loondoorbetaling bij ziekte', 'deskundigenoordeel',
  'wederzijds goedvinden', 'vaststellingsovereenkomst', 'opzegverbod',
  'cumulatiegrond', 'verstoorde arbeidsverhouding', 'disfunctioneren',
  'bedrijfseconomische redenen', 'vervaltermijn', 'verjaringstermijn',
  'bedenktermijn', 'wettelijke verhoging', 'vakantiegeld', 'vakantiedagen',
  'oproepovereenkomst', 'payrolling', 'uitzendovereenkomst',
  // Bekende arresten
  'new hairstyle', 'deliveroo', 'asscher-escape', 'xella', 'stoof chimney',
  'stoof mammoet', 'taxi hofman', 'mak holland', 'decor amsterdam',
  // AOW / pensioen
  'pensioenontslag', 'pensioengerechtigde leeftijd', 'aow-leeftijd',
  'aow-gerechtigde', 'pensioenopzegging', 'opzegging na aow',
  // Vergoedingen
  'ontslagvergoeding', 'gefixeerde schadevergoeding', 'new hairstyle factoren',
  'vergoeding wegens onregelmatige opzegging', 'hoogte billijke vergoeding',
  // Ziekte
  'plan van aanpak', 'spoor 1', 'spoor 2', 'eerstejaars evaluatie',
  'wia-aanvraag', 'loonsanctie', 'deskundigenoordeel uwv',
  // Arbeidsrelatie
  'rechtsvermoeden arbeidsovereenkomst', 'gezagsverhouding', 'holistische toets',
  'schijnzelfstandigheid', 'kwalificatie arbeidsrelatie', 'wet dba',
  // Flexibel
  'aanbod vaste uren', 'rechtsvermoeden arbeidsomvang', 'inlenersbeloning',
  'allocatiefunctie', 'fasensysteem', 'uitzendbeding',
  // Wijziging
  'eenzijdig wijzigingsbeding', 'redelijk voorstel', 'zwaarwichtig belang',
  // Integriteit
  'grensoverschrijdend gedrag', 'seksuele intimidatie', 'vertrouwenspersoon',
  'klachtenprocedure', 'ongewenste omgangsvormen',
  // Collectief
  'adviesrecht ondernemingsraad', 'instemmingsrecht', 'reorganisatie',
  'sociaal plan', 'afspiegelingsbeginsel', 'ontslagvolgorde',
  // Procedure
  'ontbinding arbeidsovereenkomst', 'ontbindingsverzoek', 'tegenverzoek',
  'kort geding arbeidsrecht', 'voorlopige voorziening', 'wedertewerkstelling',
  // Overig
  'studiekostenbeding', 'nevenwerkzaamhedenbeding', 'geheimhoudingsbeding',
  'werkgeversaansprakelijkheid', 'zorgplicht werkgever', 'privacy werknemer',
  'op non-actiefstelling', 'vrijstelling van werk', 'fictieve opzegtermijn',
  'verwijtbare werkloosheid', 'ww-uitkering', 'loongarantieregeling',
  'normalisering rechtspositie ambtenaren', 'statutair directeur',
]

/**
 * Map natural language to legal terminology.
 * This is CRITICAL: users say "70 jarige ontslaan" but the database contains
 * "AOW-leeftijd", "pensioenontslag", "art. 7:669 lid 4".
 * Without this mapping, retrieval fails on basic questions.
 */
const LEGAL_CONCEPT_MAP: Array<{ patterns: RegExp[]; terms: string[] }> = [
  // ===== ONTSLAGRECHT =====

  // 1. AOW / pensioen / oudere werknemer
  {
    patterns: [/\baow\b/i, /\bpensioen/i, /\b(?:6[5-9]|7[0-9]|8[0-9])[-\s]*(?:jaar|jarige?)\b/i, /\boudere?\s*(?:werk)?nemer/i, /\bpensioenleeftijd/i, /\bpensioengerechtigde?\b/i, /\bna\s*(?:de\s*)?pensioen/i],
    terms: ['AOW-leeftijd', 'pensioenontslag', 'art. 7:669 lid 4', 'pensioengerechtigde', 'AOW-gerechtigde', 'pensioenopzegging', 'opzegging AOW', 'opzegtermijn AOW'],
  },
  // 2. Ontslag op staande voet
  {
    patterns: [/\bstaande\s*voet/i, /\bdringende\s*reden/i, /\bop\s*stel\s*en\s*sprong/i, /\bsummier\s*ontslag/i, /\bsommatie.*ontslag/i, /\bontslag\s*(?:per\s*)?direct/i],
    terms: ['ontslag op staande voet', 'dringende reden', 'art. 7:677', 'art. 7:678', 'onverwijld', 'mededeling dringende reden', 'gefixeerde schadevergoeding'],
  },
  // 3. Disfunctioneren / niet functioneren
  {
    patterns: [/\bdisfunctioner/i, /functionee/i, /\bfunctioner/i, /\bniet\s*(?:goed\s*)?functione/i, /\bverbetertraject/i, /\bpip\b/i, /\bslecht\s*(?:prester|werk)/i, /\bonbekwaam/i, /\bongeschikt/i],
    terms: ['disfunctioneren', 'art. 7:669 lid 3 sub d', 'verbetertraject', 'ongeschiktheid', 'herplaatsing', 'verbeterplan', 'functioneringsgesprek'],
  },
  // 4. Verstoorde arbeidsverhouding
  {
    patterns: [/\bverstoorde?\s*(?:arbeids)?verhouding/i, /\bvertrouwensbreuk/i, /\bconflict\s*(?:op\s*)?(?:de\s*|het\s*)?(?:werk|werkvloer)/i, /\bruzie\b/i, /\bimpasse\b/i, /\bonwerkbare?\s*situatie/i],
    terms: ['verstoorde arbeidsverhouding', 'art. 7:669 lid 3 sub g', 'vertrouwensbreuk', 'mediation', 'onherstelbaar verstoord', 'ontbinding arbeidsovereenkomst'],
  },
  // 5. Reorganisatie / bedrijfseconomisch ontslag
  {
    patterns: [/\breorganisatie/i, /\bbedrijfseconomisch/i, /\bboventallig/i, /\bsociaal\s*plan/i, /\bafspiegeling/i, /\binkrimping/i, /\bherstructurering/i, /\bsanering/i, /\bbezuinig/i],
    terms: ['bedrijfseconomische redenen', 'art. 7:669 lid 3 sub a', 'afspiegelingsbeginsel', 'sociaal plan', 'UWV-procedure', 'herplaatsing', 'ontslagvolgorde', 'bedrijfsvestiging'],
  },
  // 6. Verwijtbaar handelen werknemer
  {
    patterns: [/\bverwijtbaar\s*(?:handel|gedrag)/i, /\b(?:e-?)grond\b/i, /\bintegriteit/i, /\bfraud/i, /\bgestolen\b/i, /\bstelen\b/i, /\bsteelt\b/i, /\bdiefstal/i, /\bgeheimhouding\s*(?:geschonden|overtreden)/i],
    terms: ['verwijtbaar handelen', 'art. 7:669 lid 3 sub e', 'ernstig verwijtbaar', 'integriteitsschending', 'ontbinding wegens verwijtbaar handelen'],
  },
  // 7. Cumulatiegrond (i-grond)
  {
    patterns: [/\bcumulatie/i, /\bi-?grond/i, /\bcombinatie\s*(?:van\s*)?gronden/i, /\bniet\s*voldragen/i],
    terms: ['cumulatiegrond', 'art. 7:669 lid 3 sub i', 'extra vergoeding', 'niet-voldragen gronden', 'combinatie ontslaggronden'],
  },
  // 8. Opzegverboden
  {
    patterns: [/\bopzegverbod/i, /\bmag\s*(?:je\s*)?niet\s*ontslaan/i, /\bbeschermd\s*(?:tegen\s*)?ontslag/i, /\bontslagbescherming/i, /\bzwanger/i],
    terms: ['opzegverbod', 'art. 7:670', 'opzegverbod ziekte', 'opzegverbod zwangerschap', 'opzegverbod OR', 'art. 7:670a', 'reflexwerking'],
  },
  // 9. Opzegtermijn
  {
    patterns: [/\bopzegtermijn/i, /\bopzeg(?:gen|ging)\b/i, /\bwanneer\s*(?:mag|kan)\s*(?:ik\s*)?opzeggen/i, /\bkunnen\s*opzeggen/i, /\beinddatum/i],
    terms: ['opzegtermijn', 'art. 7:672', 'opzegging arbeidsovereenkomst', 'art. 7:671', 'instemming werknemer', 'opzegging UWV'],
  },

  // ===== BEEINDIGINGSVERGOEDINGEN =====

  // 10. Transitievergoeding
  {
    patterns: [/\btransitievergoeding/i, /\bontslagvergoeding/i, /\bvergoeding\s*(?:bij\s*)?ontslag/i, /\bhoeveel\s*(?:krijg|kost)/i],
    terms: ['transitievergoeding', 'art. 7:673', 'berekening transitievergoeding', 'maandsalaris', 'dienstjaren', 'art. 7:673a', 'verval transitievergoeding'],
  },
  // 11. Billijke vergoeding
  {
    patterns: [/\bbillijke\s*vergoeding/i, /\bernstig\s*verwijtbaar/i, /\bnew\s*hairstyle/i, /\bfactoren\s*billijke/i],
    terms: ['billijke vergoeding', 'art. 7:681', 'art. 7:683', 'ernstig verwijtbaar handelen werkgever', 'New Hairstyle-factoren', 'hoogte billijke vergoeding'],
  },

  // ===== CONTRACT & ARBEIDSVOORWAARDEN =====

  // 12. VSO / vaststellingsovereenkomst
  {
    patterns: [/\bvso\b/i, /\bvaststellingsovereenkomst/i, /\bwederzijds\s*goedvinden/i, /\bbeeindigingsovereenkomst/i, /\bsettlement/i, /\bregeling\s*treffen/i, /\bschikking/i, /\bgolden\s*handshake/i],
    terms: ['vaststellingsovereenkomst', 'bedenktermijn', 'art. 7:670b', 'finale kwijting', 'WW-veiligheid', 'fictieve opzegtermijn', 'wederzijds goedvinden', 'verklaring geen dringende reden'],
  },
  // 13. Proeftijd
  {
    patterns: [/\bproeftijd/i, /\bproefperiode/i, /\bontslag\s*(?:in|tijdens)\s*proeftijd/i],
    terms: ['proeftijdbeding', 'art. 7:652', 'proeftijdontslag', 'nietigheid proeftijd', 'duur proeftijd', 'opvolgend werkgeverschap proeftijd'],
  },
  // 14. Concurrentiebeding / relatiebeding
  {
    patterns: [/\bconcurrentiebeding/i, /\brelatiebeding/i, /\bnon.?concurren/i, /\bverbod\s*(?:om\s*)?(?:te\s*)?werken/i, /\bniet\s*(?:bij|naar)\s*concurrent/i],
    terms: ['concurrentiebeding', 'relatiebeding', 'art. 7:653', 'zwaarwegende bedrijfsbelangen', 'schriftelijkheidsvereiste', 'gehele of gedeeltelijke vernietiging', 'belangenafweging'],
  },
  // 15. Ketenregeling / tijdelijk contract
  {
    patterns: [/\bketen/i, /\btijdelijk\s*contract/i, /\bbepaalde\s*tijd/i, /\bverlenging/i, /\baanzegg?/i, /\bcontract\s*(?:verloopt|afloopt|eindigt)/i, /\bniet\s*verlengen/i],
    terms: ['ketenregeling', 'art. 7:668a', 'aanzegverplichting', 'art. 7:668', 'bepaalde tijd', 'van rechtswege', 'tussenpozen', '3 contracten 36 maanden'],
  },
  // 16. Wijziging arbeidsvoorwaarden / eenzijdig wijzigingsbeding
  {
    patterns: [/\bwijziging\s*(?:arbeids)?voorwaarden/i, /\beenzijdig\s*wijzig/i, /\bfunctiewijziging/i, /\bdemotie/i, /\bsalarisverlaging/i, /\bloonsverlaging/i, /\bstandplaatswijziging/i, /\boverplaats/i],
    terms: ['eenzijdig wijzigingsbeding', 'art. 7:613', 'Stoof/Mammoet', 'goed werknemerschap', 'art. 7:611', 'wijziging arbeidsvoorwaarden', 'redelijk voorstel'],
  },
  // 17. Arbeidsovereenkomst / totstandkoming
  {
    patterns: [/\barbeidsovereenkomst\b/i, /\barbeidscontract\b/i, /\bwat\s*staat\s*(?:er\s*)?in/i, /\bverplichte\s*bepalingen/i, /\bessentialia/i],
    terms: ['arbeidsovereenkomst', 'art. 7:610', 'arbeid loon gezag', 'schriftelijke arbeidsovereenkomst', 'informatieplicht werkgever', 'art. 7:655'],
  },

  // ===== ZIEKTE & ARBEIDSONGESCHIKTHEID =====

  // 18. Ziekte / loondoorbetaling
  {
    patterns: [/\bziek\b/i, /\bziekte\b/i, /\barbeidsongeschikt/i, /\bre-?integratie/i, /\bbedrijfsarts/i, /\bwia\b/i, /\bwet\s*poortwachter/i, /\bziekmelding/i, /\bverzuim/i],
    terms: ['loondoorbetaling ziekte', 'art. 7:629', 'opzegverbod ziekte', 'art. 7:670', 're-integratie', 'deskundigenoordeel', 'Wet verbetering poortwachter', 'plan van aanpak', 'spoor 2'],
  },
  // 19. Burn-out / werkdruk / psychische klachten
  {
    patterns: [/\bburnout\b/i, /\bburn-?out\b/i, /\bwerkdruk/i, /\boverspannen/i, /\bstress\s*(?:op\s*)?werk/i, /\bpsychisch/i, /\buitgevallen/i, /\boverbelast/i],
    terms: ['burn-out', 'psychosociale arbeidsbelasting', 'werkdruk', 'art. 7:658', 'zorgplicht werkgever', 'arbeidsongeschiktheid', 'Arbowet', 'loondoorbetaling ziekte'],
  },
  // 20. Frequent ziekteverzuim (c-grond)
  {
    patterns: [/\bfrequent\s*(?:ziekte)?verzuim/i, /\bveelvuldig\s*ziek/i, /\bvaker\s*ziek/i, /\bc-?grond/i, /\bregelmatig\s*ziek/i],
    terms: ['frequent ziekteverzuim', 'art. 7:669 lid 3 sub c', 'regelmatig ziekteverzuim', 'deskundigenoordeel', 'onaanvaardbare gevolgen bedrijfsvoering'],
  },

  // ===== WERKGEVERSCHAP & FLEXIBELE ARBEID =====

  // 21. ZZP / schijnzelfstandigheid / kwalificatie arbeidsrelatie
  {
    patterns: [/\bzzp\b/i, /\bschijnzelfstandig/i, /\barbeidsrelatie/i, /\bwerknemer\s*of\s*zzp/i, /\bplatform/i, /\bdeliveroo\b/i, /\buber\b/i, /\bfreelance/i, /\bopdrachtovereenkomst/i, /\bmodelovereenkomst/i, /\bdba\b/i],
    terms: ['schijnzelfstandigheid', 'rechtsvermoeden arbeidsovereenkomst', 'art. 7:610a', 'gezagsverhouding', 'Deliveroo-arrest', 'kwalificatie arbeidsrelatie', 'Wet DBA', 'holistische toets'],
  },
  // 22. Oproepkracht / flexwerker
  {
    patterns: [/\boproep/i, /\bnul-?uren/i, /\bmin.?max/i, /\bflexwerker/i, /\bflexibel\s*contract/i, /\binvalkracht/i],
    terms: ['oproepovereenkomst', 'art. 7:628a', 'nul-urencontract', 'aanbod vaste uren', 'rechtsvermoeden arbeidsomvang', 'art. 7:610b', 'oproeptermijn'],
  },
  // 23. Uitzendkracht / detachering / payrolling
  {
    patterns: [/\buitzend/i, /\bdetacher/i, /\bpayroll/i, /\binlen/i, /\b(?:abu|nbbu)\b/i, /\ballocatie/i, /\buitzendbureau/i],
    terms: ['uitzendovereenkomst', 'art. 7:690', 'uitzendbeding', 'inlenersbeloning', 'payrolling', 'allocatiefunctie', 'detachering', 'WAB payroll'],
  },
  // 24. Overgang van onderneming
  {
    patterns: [/\bovergang\s*(?:van\s*)?onderneming/i, /\btupe\b/i, /\bovername\s*personeel/i, /\bbedrijfsovername/i, /\bfusie\b/i, /\bactivatransactie/i, /\basset\s*deal/i, /\bovernemen\b/i, /\bovername\b/i],
    terms: ['overgang van onderneming', 'art. 7:662', 'art. 7:663', 'identiteitsbehoud', 'TUPE', 'behoud arbeidsvoorwaarden', 'economische eenheid'],
  },

  // ===== LOON & VAKANTIE =====

  // 25. Loon / salaris geschil
  {
    patterns: [/\bloon\b/i, /\bsalaris/i, /\bwettelijke\s*verhoging/i, /\bniet\s*betaald/i, /\bachterstallig/i, /\bloonstrook/i, /\bloonspecificatie/i],
    terms: ['loonvordering', 'art. 7:616', 'wettelijke verhoging', 'art. 7:625', 'loonbetaling', 'art. 7:626', 'loonspecificatie'],
  },
  // 26. Vakantie / verlof
  {
    patterns: [/\bvakantie(?:dag|geld|recht|uren)/i, /\bverlof\b/i, /\bouderschapsverlof/i, /\bzwangerschapsverlof/i, /\bgeboorteverlof/i, /\bcalamiteitenverlof/i, /\bvakantietoeslag/i, /\bvrije\s*dagen/i],
    terms: ['vakantiedagen', 'art. 7:634', 'vakantiegeld', 'art. 7:639', 'wettelijke vakantiedagen', 'bovenwettelijke vakantiedagen', 'vervaltermijn vakantiedagen', 'vakantietoeslag', 'WAZO'],
  },
  // 27. Bonus / variabel loon / emolumenten
  {
    patterns: [/\bbonus/i, /\bvariabel\s*(?:loon|salaris)/i, /\btantieme/i, /\bwinstdeling/i, /\bcommissie\b/i, /\bdertiende\s*maand/i, /\b13e?\s*maand/i],
    terms: ['bonus', 'variabel loon', 'discretionaire bevoegdheid', 'goed werkgeverschap bonus', 'verworven recht', 'eenzijdige wijziging bonus'],
  },
  // 28. Studiekosten / terugbetaling
  {
    patterns: [/\bstudiekosten/i, /\bopleidingskosten/i, /\bterugbetaling\s*(?:studie|opleiding)/i, /\bstudiekostenbeding/i, /\bscholing/i],
    terms: ['studiekostenbeding', 'terugbetalingsregeling', 'scholingsplicht werkgever', 'art. 7:611a', 'opleidingskosten', 'Richtlijn transparante arbeidsvoorwaarden'],
  },

  // ===== GRENSOVERSCHRIJDEND GEDRAG & INTEGRITEIT =====

  // 29. Grensoverschrijdend gedrag / seksuele intimidatie / #MeToo
  {
    patterns: [/\bgrensoverschrijdend/i, /\bseksue(?:le|el)\s*intimidatie/i, /\bmetoo\b/i, /\bongewenst\s*gedrag/i, /\bpesten\b/i, /\bmobbing/i, /\bagressie\s*(?:op\s*)?werk/i, /\bdiscriminatie/i, /\bintimidatie/i],
    terms: ['grensoverschrijdend gedrag', 'seksuele intimidatie', 'ongewenste omgangsvormen', 'art. 7:646', 'AWGB', 'verwijtbaar handelen', 'zorgplicht werkgever', 'klachtenprocedure', 'vertrouwenspersoon'],
  },
  // 30. Alcohol / drugs op het werk
  {
    patterns: [/\balcohol/i, /\bdrug/i, /\bonder\s*invloed/i, /\bverslaving/i, /\bmiddelen\s*(?:gebruik|misbruik)/i, /\bdronken/i],
    terms: ['alcohol op het werk', 'drugs', 'verslaving', 'dringende reden', 'ontslag op staande voet', 'verslavingsbeleid', 'ziekte verslaving'],
  },
  // 31. Nevenwerkzaamheden
  {
    patterns: [/\bnevenwerkzaamhed/i, /\bbijbaan/i, /\bneven(?:functie|activiteit)/i, /\bbijverdien/i, /\beigen\s*bedrijf\s*(?:naast|ernaast)/i],
    terms: ['nevenwerkzaamhedenbeding', 'art. 7:653a', 'verbod nevenwerkzaamheden', 'objectieve rechtvaardiging', 'Richtlijn transparante arbeidsvoorwaarden'],
  },

  // ===== WERKGEVERSZORGPLICHT & AANSPRAKELIJKHEID =====

  // 32. Werkgeversaansprakelijkheid / arbeidsongeval
  {
    patterns: [/\barbeidsongeval/i, /\bongeval\s*(?:op\s*)?(?:het\s*)?werk/i, /\baansprakelijk\s*(?:werkgever)?/i, /\bletsel\s*(?:op\s*)?werk/i, /\b(?:art\.?\s*)?7:658/i, /\bberoepsziekte/i, /\bveiligheid\s*(?:op\s*)?werk/i],
    terms: ['werkgeversaansprakelijkheid', 'art. 7:658', 'zorgplicht werkgever', 'arbeidsongeval', 'bewijslast werkgever', 'beroepsziekte', 'veiligheidsnormen'],
  },
  // 33. Privacy / AVG op de werkvloer
  {
    patterns: [/\bprivacy/i, /\bavg\b/i, /\bcamera/i, /\bcontroleren\s*(?:van\s*)?(?:werk)?nemer/i, /\bmonitoring/i, /\bgps\s*track/i, /\be-?mail\s*controle/i, /\bpersoonsgegevens\s*(?:werk)?nemer/i],
    terms: ['privacy werknemer', 'AVG', 'controle werknemer', 'cameratoezicht', 'monitoring werkplek', 'gerechtvaardigd belang', 'proportionaliteit'],
  },
  // 34. Klokkenluiders / whistleblowing
  {
    patterns: [/\bklokkenluider/i, /\bwhistleblow/i, /\bmelding\s*misstand/i, /\bintegriteitsmelding/i, /\bhuis\s*voor\s*klokkenluiders/i],
    terms: ['klokkenluider', 'Wet bescherming klokkenluiders', 'melding misstand', 'benadelingsverbod', 'bewijslastomkering'],
  },

  // ===== MEDEZEGGENSCHAP & COLLECTIEF =====

  // 35. Ondernemingsraad / medezeggenschap
  {
    patterns: [/\bondernemingsraad/i, /\b(?:de\s+)?or\b/i, /\bmedezeggenschap/i, /\badviesrecht/i, /\binstemmingsrecht/i, /\bpvt\b/i, /\bpersoneelsvertegenwoordiging/i],
    terms: ['ondernemingsraad', 'WOR', 'adviesrecht', 'instemmingsrecht', 'art. 25 WOR', 'art. 27 WOR', 'ontslagbescherming OR-lid'],
  },
  // 36. Collectief ontslag (WMCO)
  {
    patterns: [/\bcollectief\s*ontslag/i, /\bwmco\b/i, /\bmassa-?ontslag/i, /\b20\s*(?:of\s*)?meer\s*(?:werk)?nemers/i, /\bgroepsontslag/i],
    terms: ['collectief ontslag', 'WMCO', 'Wet melding collectief ontslag', 'raadpleging vakbonden', 'melding UWV', 'wachttijd 1 maand'],
  },
  // 37. CAO / arbeidsvoorwaarden collectief
  {
    patterns: [/\bcao\b/i, /\bcollectieve\s*arbeidsovereenkomst/i, /\balgemeen\s*verbindend/i, /\bavv\b/i, /\bincorporatiebeding/i, /\bnawerking/i],
    terms: ['CAO', 'collectieve arbeidsovereenkomst', 'algemeen verbindend verklaring', 'incorporatiebeding', 'nawerking CAO', 'Wet AVV', 'WAVV'],
  },

  // ===== BIJZONDERE POSITIES =====

  // 38. Statutair directeur / bestuurder
  {
    patterns: [/\bstatutar/i, /\bdirecteur/i, /\bbestuurder/i, /\b(?:vennootschaps)?rechtelijk\s*ontslag/i, /\bdga\b/i, /\bgrote?\s*directeur/i],
    terms: ['statutair directeur', 'art. 2:244', 'vennootschapsrechtelijk ontslag', 'arbeidsrechtelijk ontslag bestuurder', 'ontslag directeur', '15 april-arresten', 'herstel dienstbetrekking'],
  },
  // 39. Ambtenaar / overheidspersoneel (Wnra)
  {
    patterns: [/\bambtenaar/i, /\boverheid/i, /\bwnra\b/i, /\bnormalisering/i, /\bgemeente\s*(?:als\s*)?werkgever/i, /\brijksoverheid/i],
    terms: ['Wnra', 'normalisering rechtspositie ambtenaren', 'ambtenaar', 'overheidswerkgever', 'cao Rijk', 'cao Gemeenten'],
  },

  // ===== PROCEDURE & PROCESRECHT =====

  // 40. WW-uitkering / sociale zekerheid
  {
    patterns: [/\bww\b/i, /\bww-?uitkering/i, /\bwerkloosheid/i, /\buitkering\s*na\s*ontslag/i, /\brecht\s*op\s*ww/i, /\bverwijtbare?\s*werkloos/i],
    terms: ['WW-uitkering', 'werkloosheidswet', 'verwijtbare werkloosheid', 'fictieve opzegtermijn', 'benadelingshandeling', 'referte-eis', 'wekeneis'],
  },
  // 41. Kort geding arbeidsrecht / voorlopige voorziening
  {
    patterns: [/\bkort\s*geding/i, /\bvoorlopige\s*voorziening/i, /\bspoed/i, /\btewerkstelling/i, /\bwedertewerkstelling/i, /\bloonvordering\s*(?:in\s*)?kort\s*geding/i],
    terms: ['kort geding arbeidsrecht', 'voorlopige voorziening', 'wedertewerkstelling', 'loonvordering kort geding', 'spoedeisend belang'],
  },
  // 42. Ontbinding door kantonrechter
  {
    patterns: [/\bontbinding/i, /\bkantonrechter/i, /\bontbindingsverzoek/i, /\btegenverzoek/i, /\bverzoekschrift\s*ontbinding/i, /\bverweerschrift\s*ontbinding/i],
    terms: ['ontbinding arbeidsovereenkomst', 'art. 7:671b', 'ontbindingsverzoek', 'tegenverzoek', 'nevenverzoeken', 'ontbindingsdatum', 'kantonrechter'],
  },

  // ===== SPECIFIEKE ARBEIDSOMSTANDIGHEDEN =====

  // 43. Schorsing / op non-actiefstelling
  {
    patterns: [/\bschors/i, /\bnon-?actief/i, /\bop\s*non-?actief/i, /\bvrijstelling\s*(?:van\s*)?werk/i, /\bsuspen/i, /\bgeschorst/i],
    terms: ['schorsing', 'op non-actiefstelling', 'vrijstelling van werk', 'loondoorbetaling schorsing', 'goed werkgeverschap', 'art. 7:628'],
  },
  // 44. Getuigschrift / referenties
  {
    patterns: [/\bgetuigschrift/i, /\breferentie/i, /\baanbeveling/i, /\bverklaring\s*(?:van\s*)?(?:goed\s*)?gedrag/i],
    terms: ['getuigschrift', 'art. 7:656', 'referenties', 'positieve referentieplicht', 'schadevergoeding onjuist getuigschrift'],
  },
  // 45. Arbeidstijden / overwerk
  {
    patterns: [/\barbeidstijd/i, /\boverwerk/i, /\boveruren/i, /\bwerktijd/i, /\brusttijd/i, /\bnachtdienst/i, /\bploegendienst/i, /\batw\b/i],
    terms: ['arbeidstijdenwet', 'ATW', 'overwerk', 'maximale arbeidstijd', 'rusttijd', 'nachtarbeid', 'compensatie overwerk'],
  },
  // 46. Thuiswerken / hybride werken
  {
    patterns: [/\bthuiswerk/i, /\bhybride\s*werk/i, /\bremote\s*work/i, /\bplaatsonafhankelijk/i, /\bwet\s*flexibel\s*werk/i, /\bwerken\s*(?:op\s*)?afstand/i, /\bverzoek\s*thuiswerk/i],
    terms: ['thuiswerken', 'Wet flexibel werken', 'aanpassing arbeidsplaats', 'arbobeleid thuiswerk', 'thuiswerkovereenkomst'],
  },
  // 47. Gelijke behandeling / discriminatie
  {
    patterns: [/\bdiscriminat/i, /\bgelijke\s*behandeling/i, /\bawgb\b/i, /\bwgbl\b/i, /\bleeftijdsdiscriminatie/i, /\bgeslachtsdiscriminatie/i, /\bgelijk\s*loon/i, /\bschwanger/i, /\bzwanger/i],
    terms: ['gelijke behandeling', 'AWGB', 'WGBL', 'discriminatie', 'verboden onderscheid', 'College voor de Rechten van de Mens', 'bewijslastomkering discriminatie'],
  },
  // 48. Faillissement / surseance
  {
    patterns: [/\bfaillissement/i, /\bsurseance/i, /\bfailliet/i, /\bcurator/i, /\binsolvent/i, /\bbankroet/i],
    terms: ['faillissement', 'art. 40 Fw', 'opzegging curator', 'opzegtermijn faillissement', 'boedelvorderingen', 'loongarantieregeling UWV', 'doorstart'],
  },
  // 49. Internationale arbeid / expats
  {
    patterns: [/\bexpat/i, /\binternational/i, /\bdetachering\s*buitenland/i, /\btewerkstellingsvergunning/i, /\brome\s*i+\b/i, /\bipr\b/i, /\bgrensarbeid/i, /\bbuitenlands\s*recht/i],
    terms: ['internationaal arbeidsrecht', 'Rome I-Verordening', 'rechtskeuze', 'tewerkstellingsvergunning', 'expat', 'detachering EU', 'gewoonlijk werkland'],
  },
  // 50. Geheimhouding / intellectueel eigendom
  {
    patterns: [/\bgeheimhouding/i, /\bvertrouwelijk/i, /\bintellectueel\s*eigendom/i, /\buitvinding/i, /\boctrooirecht/i, /\bauteursrecht\s*werk/i, /\bbedrijfsgeheim/i],
    terms: ['geheimhoudingsbeding', 'bedrijfsgeheimen', 'Wet bescherming bedrijfsgeheimen', 'intellectueel eigendom werknemer', 'art. 7:649', 'octrooirecht werknemer'],
  },
]

/**
 * Extract legal concepts from natural language and add them as search terms.
 * This bridges the gap between how users ask questions and how legal texts are written.
 */
function expandWithLegalConcepts(message: string): string[] {
  const additionalTerms: string[] = []
  const lower = message.toLowerCase()
  for (const concept of LEGAL_CONCEPT_MAP) {
    for (const pattern of concept.patterns) {
      if (pattern.test(lower)) {
        for (const term of concept.terms) {
          if (!additionalTerms.includes(term)) {
            additionalTerms.push(term)
          }
        }
        break // One pattern match is enough per concept
      }
    }
  }
  return additionalTerms
}

/**
 * Extract meaningful search terms from user's question.
 * Keeps legal terms, article numbers, multi-word phrases, and removes stop words.
 */
function extractSearchTerms(message: string): string[] {
  const terms: string[] = []
  const lowerMsg = message.toLowerCase()

  // Extract article references (e.g., "7:669", "art. 7:611 BW", "artikel 6")
  const articleMatches = message.match(/(?:art(?:ikel)?\.?\s*)?(\d+[.:]\d+(?:\s*(?:lid\s+\d+|sub\s+[a-z]))?(?:\s*BW)?)/gi)
  if (articleMatches) {
    for (const match of articleMatches) {
      terms.push(match.trim())
    }
  }

  // Extract known multi-word legal phrases (these get high priority in scoring)
  for (const phrase of LEGAL_PHRASES) {
    if (lowerMsg.includes(phrase)) {
      terms.push(phrase)
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

  // Add 3-word combinations (trigrams) for complex legal concepts
  for (let i = 0; i < words.length - 2; i++) {
    if (words[i].length >= 3 && words[i + 1].length >= 2 && words[i + 2].length >= 3) {
      terms.push(`${words[i]} ${words[i + 1]} ${words[i + 2]}`)
    }
  }

  // CRITICAL: Add legal concept mapping terms
  // This bridges natural language ("70 jarige ontslaan") to legal terms ("AOW-leeftijd", "art. 7:669 lid 4")
  const conceptTerms = expandWithLegalConcepts(message)
  if (conceptTerms.length > 0) {
    console.log(`[chat] Legal concept mapping: ${conceptTerms.join(', ')}`)
    terms.push(...conceptTerms)
  }

  return Array.from(new Set(terms))
}

/**
 * Retrieve the most relevant chunks using PER-SOURCE HYBRID search:
 * 1. Per-source semantic search: search EACH source separately to prevent large sources dominating
 * 2. Per-source keyword search: search EACH source separately for fair representation
 * 3. Multi-query: embed original + expanded queries for broader recall
 * Results from all queries are combined using Reciprocal Rank Fusion (RRF).
 *
 * Key insight: with 42K RAR chunks vs 1K T&C chunks, a global search always
 * returns 90%+ RAR. Per-source search guarantees each source gets top-N results.
 */
async function retrieveRelevantChunks(
  sourceIds: string[],
  searchTerms: string[],
  maxChunks: number,
  userMessage?: string,
  expandedQueries?: string[]
): Promise<Array<{ sourceId: string; chunkIndex: number; content: string; heading: string | null; score: number }>> {
  if (sourceIds.length === 0) return []

  // Build all search queries: original + expanded variants
  const allQueries = [userMessage, ...(expandedQueries || [])].filter(Boolean) as string[]
  console.log(`[chat] Per-source retrieval: ${allQueries.length} queries x ${sourceIds.length} sources`)

  // Results per source for semantic search (top-N per source per query)
  const SEMANTIC_PER_SOURCE = 15 // Top 15 per source guarantees diverse results

  // Run ALL semantic searches + keyword searches in parallel
  const [semanticResultSets, keywordResults] = await Promise.all([
    // 1. PER-SOURCE MULTI-QUERY SEMANTIC SEARCH
    (async () => {
      if (!userMessage || !process.env.OPENAI_API_KEY) return []
      try {
        // Generate embeddings for all queries in parallel
        const embeddings = await Promise.all(
          allQueries.map(q => generateEmbedding(q).catch(() => null))
        )
        const validEmbeddings = embeddings.filter((e): e is number[] => e !== null)
        if (validEmbeddings.length === 0) return []

        // Search EACH source separately for EACH query embedding
        const allResultSets: Array<Array<{ id: string; sourceId: string; chunkIndex: number; content: string; heading: string | null; similarity: number }>> = []
        for (const emb of validEmbeddings) {
          // Run per-source searches in parallel for this embedding
          const perSourceResults = await Promise.all(
            sourceIds.map(sid =>
              searchSimilarChunks(emb, [sid], SEMANTIC_PER_SOURCE).catch(() => [])
            )
          )
          // Flatten all per-source results into one result set for this query
          const combined = perSourceResults.flat()
          // Sort by similarity so RRF ranks work correctly
          combined.sort((a, b) => b.similarity - a.similarity)
          allResultSets.push(combined)
        }
        return allResultSets
      } catch (err) {
        console.error('Per-source semantic search fout:', err)
        return []
      }
    })(),

    // 2. PER-SOURCE KEYWORD SEARCH — search each source separately
    (async () => {
      // Combine search terms from original + expanded queries
      const allTerms = [...searchTerms]
      for (const query of expandedQueries || []) {
        const extraTerms = extractSearchTerms(query)
        for (const t of extraTerms) {
          if (!allTerms.includes(t)) allTerms.push(t)
        }
      }
      if (allTerms.length === 0) return []

      // Prioritize terms: legal phrases and article refs first
      const prioritized = allTerms.slice(0, 40).sort((a, b) => {
        const scoreA = LEGAL_PHRASES.includes(a.toLowerCase()) ? 8 : (a.includes(':') || /\d+[.:]\d+/.test(a)) ? 6 : a.includes(' ') ? 4 : 2
        const scoreB = LEGAL_PHRASES.includes(b.toLowerCase()) ? 8 : (b.includes(':') || /\d+[.:]\d+/.test(b)) ? 6 : b.includes(' ') ? 4 : 2
        return scoreB - scoreA
      })

      const orConditions = prioritized.slice(0, 30).map(term => ({
        content: { contains: term, mode: 'insensitive' as const },
      }))

      // Search EACH source separately with its own limit
      const KEYWORD_PER_SOURCE = 50
      const perSourceKeyword = await Promise.all(
        sourceIds.map(sid =>
          prisma.sourceChunk.findMany({
            where: {
              sourceId: sid,
              OR: orConditions,
            },
            select: {
              id: true,
              sourceId: true,
              chunkIndex: true,
              content: true,
              heading: true,
            },
            take: KEYWORD_PER_SOURCE,
          }).catch(() => [])
        )
      )

      // Flatten and score all keyword results
      const allMatches = perSourceKeyword.flat()

      // Score by matching terms — multi-word phrases and legal terms score higher
      // Use ALL terms (original + expanded) for scoring
      return allMatches.map(chunk => {
        const contentLower = chunk.content.toLowerCase()
        const headingLower = (chunk.heading || '').toLowerCase()
        let score = 0
        for (const term of allTerms) {
          const termLower = term.toLowerCase()
          const inContent = contentLower.includes(termLower)
          const inHeading = headingLower.includes(termLower)
          if (!inContent && !inHeading) continue

          // Base score by term type
          let termScore = 0
          if (LEGAL_PHRASES.includes(termLower)) {
            termScore = 8
          } else if (term.includes(':') || /\d+[.:]\d+/.test(term)) {
            termScore = 6
          } else if (term.includes(' ')) {
            termScore = 4
          } else if (term.length >= 8) {
            termScore = 3
          } else if (term.length >= 5) {
            termScore = 2
          } else {
            termScore = 1
          }

          // Heading match bonus: if a term appears in the heading, it's extra relevant
          if (inHeading) {
            termScore = Math.round(termScore * 1.5)
          }

          score += termScore
        }
        return { ...chunk, score }
      }).sort((a, b) => b.score - a.score)
    })(),
  ])

  // Flatten all semantic result sets into one for the has-results check
  const hasSemanticResults = semanticResultSets.length > 0 && semanticResultSets.some(s => s.length > 0)

  // Combine all results with Reciprocal Rank Fusion (multi-query aware)
  if (hasSemanticResults && keywordResults.length > 0) {
    const K = 60 // RRF constant
    const rrfScores = new Map<string, {
      sourceId: string; chunkIndex: number; content: string; heading: string | null; score: number
    }>()

    // Add semantic results from ALL query variants
    // Each variant contributes independently — chunks found by multiple variants get boosted
    const semanticWeight = 0.6 / Math.max(semanticResultSets.length, 1)
    for (const resultSet of semanticResultSets) {
      resultSet.forEach((result, rank) => {
        const key = `${result.sourceId}-${result.chunkIndex}`
        const rrfScore = semanticWeight / (K + rank + 1)
        const existing = rrfScores.get(key)
        if (existing) {
          existing.score += rrfScore // Found by multiple query variants → higher score
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
    }

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

    // Sort by combined RRF score
    const combined = Array.from(rrfScores.values())
    combined.sort((a, b) => b.score - a.score)

    // Balanced selection: ensure each source gets fair representation
    // Instead of just top-N globally (which lets one large source dominate),
    // guarantee each source gets at least MIN_PER_SOURCE if it has relevant chunks
    const MIN_PER_SOURCE = 4  // Increased: every source deserves representation
    const MAX_PER_SOURCE = 12
    const selected: typeof combined = []
    const perSource = new Map<string, number>()

    // First pass: pick top chunks but cap per source
    for (const chunk of combined) {
      if (selected.length >= maxChunks) break
      const count = perSource.get(chunk.sourceId) || 0
      if (count >= MAX_PER_SOURCE) continue
      selected.push(chunk)
      perSource.set(chunk.sourceId, count + 1)
    }

    // Second pass: ensure minimum representation for underrepresented sources
    const allSrcIds = Array.from(new Set(combined.map(c => c.sourceId)))
    for (const sid of allSrcIds) {
      const currentCount = perSource.get(sid) || 0
      if (currentCount >= MIN_PER_SOURCE) continue
      const needed = MIN_PER_SOURCE - currentCount
      const candidates = combined.filter(c => c.sourceId === sid && !selected.includes(c))
      for (let i = 0; i < Math.min(needed, candidates.length); i++) {
        if (selected.length >= maxChunks + 8) break // Allow slight overflow for balance
        selected.push(candidates[i])
        perSource.set(sid, (perSource.get(sid) || 0) + 1)
      }
    }

    selected.sort((a, b) => b.score - a.score)
    const finalSelected = selected.slice(0, maxChunks + 8) // Allow up to 48 for balanced sources

    // Log source distribution for debugging
    const dist = new Map<string, number>()
    for (const c of finalSelected) dist.set(c.sourceId, (dist.get(c.sourceId) || 0) + 1)
    console.log(`[chat] Source distribution: ${Array.from(dist.entries()).map(([k, v]) => `${k.slice(0, 8)}=${v}`).join(', ')} (total=${finalSelected.length})`)

    // Adjacent chunk inclusion: fetch N-1 and N+1 chunks for better context
    return await enrichWithAdjacentChunks(finalSelected, sourceIds)
  }

  // Fallback: if only semantic results (no keyword matches)
  if (hasSemanticResults) {
    // Merge all semantic result sets, deduplicating by chunk key
    const seen = new Set<string>()
    const allSemantic: Array<{ sourceId: string; chunkIndex: number; content: string; heading: string | null; score: number }> = []
    for (const resultSet of semanticResultSets) {
      for (const r of resultSet) {
        const key = `${r.sourceId}-${r.chunkIndex}`
        if (!seen.has(key)) {
          seen.add(key)
          allSemantic.push({ sourceId: r.sourceId, chunkIndex: r.chunkIndex, content: r.content, heading: r.heading, score: r.similarity })
        }
      }
    }
    allSemantic.sort((a, b) => b.score - a.score)
    return await enrichWithAdjacentChunks(allSemantic.slice(0, maxChunks), sourceIds)
  }

  // Fallback: if only keyword results (no embeddings available)
  return keywordResults.slice(0, maxChunks)
}

/**
 * Enrich selected chunks with adjacent chunks (N-1, N+1) for better context.
 * Only adds adjacent chunks if they're not already in the selection.
 * Merges adjacent content into the existing chunk to avoid bloating the count.
 */
async function enrichWithAdjacentChunks(
  chunks: Array<{ sourceId: string; chunkIndex: number; content: string; heading: string | null; score: number }>,
  sourceIds: string[]
): Promise<typeof chunks> {
  if (chunks.length === 0) return chunks

  // Collect all adjacent chunk indices we need
  const existingKeys = new Set(chunks.map(c => `${c.sourceId}-${c.chunkIndex}`))
  const adjacentNeeded: Array<{ sourceId: string; chunkIndex: number }> = []

  for (const chunk of chunks) {
    // Only fetch adjacents for top-scored chunks (top 10) to limit DB queries
    if (chunks.indexOf(chunk) >= 10) break
    const prevKey = `${chunk.sourceId}-${chunk.chunkIndex - 1}`
    const nextKey = `${chunk.sourceId}-${chunk.chunkIndex + 1}`
    if (!existingKeys.has(prevKey) && chunk.chunkIndex > 0) {
      adjacentNeeded.push({ sourceId: chunk.sourceId, chunkIndex: chunk.chunkIndex - 1 })
    }
    if (!existingKeys.has(nextKey)) {
      adjacentNeeded.push({ sourceId: chunk.sourceId, chunkIndex: chunk.chunkIndex + 1 })
    }
  }

  if (adjacentNeeded.length === 0) return chunks

  // Fetch adjacent chunks in one query (with 5s timeout to avoid blocking)
  try {
    const adjacentChunks = await Promise.race([
      prisma.sourceChunk.findMany({
        where: {
          sourceId: { in: sourceIds },
          OR: adjacentNeeded.map(a => ({
            sourceId: a.sourceId,
            chunkIndex: a.chunkIndex,
          })),
        },
        select: { sourceId: true, chunkIndex: true, content: true },
      }),
      new Promise<never[]>((resolve) => setTimeout(() => {
        console.warn('[chat] Adjacent chunk fetch timed out after 5s — skipping')
        resolve([])
      }, 5000)),
    ])

    // Build lookup map
    const adjacentMap = new Map<string, string>()
    for (const adj of adjacentChunks) {
      adjacentMap.set(`${adj.sourceId}-${adj.chunkIndex}`, adj.content)
    }

    // Merge adjacent content into existing chunks (prepend N-1, append N+1)
    // Use 800 chars for context — enough for a full legal paragraph
    return chunks.map((chunk, idx) => {
      if (idx >= 12) return chunk // Enrich top 12 chunks
      const prevContent = adjacentMap.get(`${chunk.sourceId}-${chunk.chunkIndex - 1}`)
      const nextContent = adjacentMap.get(`${chunk.sourceId}-${chunk.chunkIndex + 1}`)
      let enrichedContent = chunk.content
      if (prevContent) {
        const suffix = prevContent.length > 800 ? '...' + prevContent.slice(-800) : prevContent
        enrichedContent = `[context voor:] ${suffix}\n\n${enrichedContent}`
      }
      if (nextContent) {
        const prefix = nextContent.length > 800 ? nextContent.slice(0, 800) + '...' : nextContent
        enrichedContent = `${enrichedContent}\n\n[context na:] ${prefix}`
      }
      return { ...chunk, content: enrichedContent }
    })
  } catch (err) {
    console.error('[chat] Adjacent chunk fetch failed:', err)
    return chunks // Return original chunks on error
  }
}
