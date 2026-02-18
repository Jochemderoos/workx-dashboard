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

// Large PDFs as native document blocks can overflow the 200K context window
// (~1500 tokens/page). For files over this threshold, use extracted text instead.
// 7MB base64 ≈ 5MB file ≈ 80-100 pages — fits comfortably with system prompt.
const MAX_NATIVE_PDF_BASE64_LEN = 7_000_000

// Token budget for native PDF/image blocks — dynamically adjusted in POST handler.
// Generous budget: Claude's 200K context window can handle multiple large PDFs.
// Knowledge sources add ~30-60K tokens, so we leave room for both.
const NATIVE_BLOCK_BUDGET_WITH_SOURCES = 120_000
const NATIVE_BLOCK_BUDGET_WITHOUT_SOURCES = 160_000

// Extract and validate base64 data from a data URL (e.g. "data:application/pdf;base64,...")
function extractBase64FromDataUrl(dataUrl: string): string | null {
  const commaIdx = dataUrl.indexOf(',')
  if (commaIdx === -1 || commaIdx > 100) return null // prefix should be short
  const prefix = dataUrl.slice(0, commaIdx)
  if (!prefix.includes('base64')) return null

  // Use slice instead of split to avoid allocating huge arrays
  let data = dataUrl.slice(commaIdx + 1)

  // Strip any whitespace/newlines that may have been introduced during storage
  if (/\s/.test(data.slice(0, 1000))) {
    data = data.replace(/[\s\r\n]/g, '')
  }

  // Fix padding if needed
  const padNeeded = data.length % 4
  if (padNeeded) data += '='.repeat(4 - padNeeded)

  // Quick validation: check a sample of characters (full regex on multi-MB string is slow)
  const sample = data.slice(0, 200) + data.slice(-200)
  if (!/^[A-Za-z0-9+/=]+$/.test(sample)) {
    console.warn(`[chat] Base64 validation failed — invalid chars in sample: ${sample.slice(0, 50)}...`)
    return null
  }

  return data.length > 100 ? data : null // Minimum size sanity check
}

function estimatePdfBlockTokens(base64Len: number): number {
  // Scanned PDFs: large base64 (~200-500KB/page) but only ~1500-3000 tokens/page.
  // Text PDFs: smaller base64 (~30-80KB/page) with similar token cost.
  // Use 150KB/page as a middle-ground estimate for base64 → page count.
  const estimatedPages = Math.max(1, Math.ceil(base64Len / 150000))
  return estimatedPages * 2000 // ~2000 tokens/page average (conservative but realistic)
}

const SYSTEM_PROMPT = `# REGEL 1 — LEES DIT ALLEREERST — STEL VRAGEN VOOR JE ANTWOORD GEEFT

Bij ELKE open casusvraag, strategievraag of vraag waarbij feiten ontbreken:
GEEF NIET DIRECT EEN ANTWOORD. Stel EERST 3-5 gerichte vragen en WACHT op het antwoord van de gebruiker.

WANNEER MOET JE VRAGEN STELLEN (altijd bij):
- Casusvragen: "Een werknemer heeft...", "Mijn cliënt wil...", "Hoe zit het met..."
- Strategievragen: "Wat zijn de mogelijkheden?", "Wat raad je aan?"
- Ontbrekende feiten die juridisch relevant zijn

WELKE VRAGEN STEL JE — METHODOLOGIE:
Denk na als een ervaren advocaat die een intake doet. Stel jezelf de vraag: "Welke informatie zou, als ik die WEL of NIET heb, tot een FUNDAMENTEEL ANDER advies leiden?" Stel vragen over DIE informatie. Dit zijn altijd 3 categorieën:

**Categorie 1: De feiten die het juridisch oordeel bepalen**
Elke zaak heeft 3-5 kernfeiten die het verschil maken. Voorbeelden per onderwerp:
- Ontslag: duur dienstverband, dossieropbouw, CAO, eerdere waarschuwingen, functioneringsgesprekken
- Grensoverschrijdend gedrag: wat is er precies gezegd/gedaan, getuigen/bewijs, hoor en wederhoor, eerdere incidenten
- Ziekte: duur ziekte, plan van aanpak, standpunt bedrijfsarts, re-integratie-inspanningen
- VSO: wie nam initiatief, is er al onderhandeld, loopt er een procedure
- Concurrentiebeding: bepaalde/onbepaalde tijd, schriftelijke motivering, belang werkgever vs. werknemer

**Categorie 2: Intern beleid en procedures (ALTIJD vragen)**
Bij ELKE casusvraag: vraag of er relevant intern beleid, protocol of reglement is. Dit is VAAK doorslaggevend bij de rechterlijke toetsing. Voorbeelden:
- Gedragscode, integriteitscode, beleid ongewenste omgangsvormen
- Sanctiebeleid, verzuimprotocol, re-integratiebeleid
- Klokkenluidersregeling, vertrouwenspersoon, klachtencommissie
- Personeelshandboek, arbeidsvoorwaardenreglement
- Is het beleid aan betrokkene bekend gemaakt? Heeft het bedrijf eerder op basis hiervan gehandhaafd?

**Categorie 3: Context en format**
- "Wil je een kort praktisch advies, een uitgebreid juridisch memo, of een concept-brief/e-mail?"
- "Heb je relevante documenten die ik kan bekijken? (arbeidsovereenkomst, waarschuwingen, gespreksverslagen, medische stukken, correspondentie) — je kunt ze uploaden via de paperclip."

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
- ABSOLUUT GEEN EMOJI'S, ICONEN OF UNICODE-SYMBOLEN. Dit betekent: geen ❌, ✅, ⚠️, 💡, 📌, 🔍, ⏰, 💰, ⚖️, 📄, 🔒, 📝, 🏛️, 👉, ➡️, ✔️, ❗, ⭐ of WELK ANDER SYMBOOL dan ook. OOK NIET aan het begin van opsommingen of bullet points. Gebruik ALLEEN letters, cijfers en standaard leestekens. Dit is een professioneel juridisch systeem.
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

## Kennisbronnen (CRUCIAAL)

Je PRIMAIRE kennisbron is de interne database met 48.000+ passages uit gezaghebbende arbeidsrechtelijke literatuur, wetcommentaar, jurisprudentie-annotaties en artikelen. Deze passages worden automatisch meegeleverd bij elke vraag. Dit is je EERSTE en BELANGRIJKSTE referentiepunt.

### De 4 interne bronnen (meegeleverd als passages)
1. **T&C Arbeidsrecht** — Wetcommentaar: wettelijk kader, artikelsgewijze uitleg, wetgeving. Citeer als: "Volgens T&C Arbeidsrecht bij art. [X] BW: '[citaat]'"
2. **Thematica Arbeidsrecht** — Diepgaande thematische analyses, literatuur, doctrine. Citeer als: "Thematica Arbeidsrecht, [onderwerp], vermeldt: '[citaat]'"
3. **VAAN AR Updates** — Actuele rechtspraakoverzichten met annotaties. Citeer als: "Volgens VAAN [nummer] ([ECLI]): '[citaat]'"
4. **RAR** — 26 jaar jurisprudentie-annotaties (2000-2026). Citeer als: "Volgens RAR [referentie] ([ECLI]): '[citaat]'"

ECLI-nummers uit deze passages zijn GEVERIFIEERD door de redactie en mag je citeren. Noem NOOIT een ECLI uit je eigen geheugen — deze kunnen onjuist zijn.

### Aanvullende tools (OPTIONEEL, NIET verplicht)
- **search_rechtspraak**: zoekt op rechtspraak.nl. Alleen gebruiken als AANVULLING wanneer de meegeleverde passages onvoldoende zijn. NIET verplicht bij elk antwoord.
- **web_search**: voor actuele wetteksten, CAO-teksten, beleidsregels.

### Hoe je bronnen gebruikt
1. Begin ALTIJD met de meegeleverde passages — dit is je fundament
2. Combineer: T&C (wettelijk kader) + Thematica (analyse) + RAR/VAAN (jurisprudentie)
3. Zoek OPTIONEEL aanvullend op rechtspraak.nl als de passages niet genoeg dekken
4. Beschrijf NOOIT je zoekproces. Niet beginnen met "Ik heb gezocht..." of "Er zijn geen resultaten..."
5. Bij conflicterende bronnen: vermeld BEIDE standpunten, geef aan welke recenter is

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

## Zoekstrategie
- Je PRIMAIRE bron is de meegeleverde passages (T&C, Thematica, RAR, VAAN). Gebruik deze ALTIJD EERST.
- search_rechtspraak is OPTIONEEL — alleen als aanvulling wanneer de passages niet genoeg dekken.
- Als je vragen stelt (bij open casusvragen): gebruik GEEN tools. Stel alleen je vragen.
- Beschrijf NOOIT je zoekproces. Begin DIRECT met de inhoud.

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

    // Anonymize message for knowledge source detection (document context anonymized later, inside stream)
    let messageForClaude = message
    if (anonymize) {
      const anonMessage = anonymizeText(message)
      messageForClaude = anonMessage.text
    }

    // Check API key early (before starting stream)
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY niet geconfigureerd' }, { status: 500 })
    }

    // Determine native block budget: generous when knowledge sources are off,
    // conservative when they'll add ~80K+ tokens of source passages.
    const willUseKnowledgeSources = useKnowledgeSources === false
      ? false
      : isEmploymentLawQuestion(message)
    const maxNativeBlockTokens = willUseKnowledgeSources
      ? NATIVE_BLOCK_BUDGET_WITH_SOURCES
      : NATIVE_BLOCK_BUDGET_WITHOUT_SOURCES

    // Start SSE stream IMMEDIATELY so client fetch() resolves in <1 second.
    // ALL heavy processing (document loading, RAG, embeddings, Claude API) runs
    // INSIDE the stream with status updates. This prevents Vercel gateway timeouts.
    //
    // Uses TransformStream (not ReadableStream) for reliable streaming on Vercel.
    // The readable side is returned immediately; the writable side is written to
    // asynchronously from a background task. This ensures Vercel's proxy forwards
    // each chunk to the client as soon as it's written.
    const encoder = new TextEncoder()
    const { readable, writable } = new TransformStream()
    const writer = writable.getWriter()

    // Helper: write an SSE event and flush immediately
    const send = (data: string) => writer.write(encoder.encode(`data: ${data}\n\n`))

    // Start the async processing in the background (not awaited — response returns immediately)
    ;(async () => {
        let fullText = ''
        let hasWebSearch = false
        const citations: Array<{ url: string; title: string }> = []
        const docLoadErrors: string[] = []
        let lastStep = 'init'

        // Watchdog: if stream hasn't produced ANY delta content within 120s, send diagnostic error.
        // 120s is generous to handle cold starts + heavy document loading + knowledge sources.
        // The watchdog is CANCELLED when the first delta arrives (Claude started responding).
        let watchdogFired = false
        let watchdogTimer: ReturnType<typeof setTimeout> | null = setTimeout(async () => {
          watchdogFired = true
          console.error(`[chat] Watchdog fired at step: ${lastStep}`)
          try {
            await send(JSON.stringify({
              type: 'error',
              error: `Het laden duurde te lang (>120s). Laatste stap: "${lastStep}". ${docLoadErrors.length > 0 ? `Fouten: ${docLoadErrors.join('; ').slice(0, 150)}` : 'Geen fouten gelogd.'} Probeer het opnieuw.`,
            }))
            await writer.close()
          } catch { /* stream may already be closed */ }
        }, 120000)

        // Heartbeat: send periodic keepalive events to prevent Vercel/browser idle timeout.
        // Uses .catch() to swallow async rejections — without this, writer.write()
        // on a closed stream causes unhandled promise rejection that crashes the process.
        const heartbeat = setInterval(() => {
          writer.write(encoder.encode(`: heartbeat\n\n`)).catch(() => {})
        }, 8000)

        try {
          // Notify client immediately that connection is alive
          await send(JSON.stringify({ type: 'start', conversationId: convId }))
          lastStep = 'start'

          // === DOCUMENT LOADING (inside stream to prevent gateway timeout) ===
          await send(JSON.stringify({ type: 'status', text: 'Documenten laden...' }))
          lastStep = 'doc-load-start'

          let documentContext = ''
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const documentBlocks: any[] = []
          let hasDocxAttachments = false
          let pdfTextFallback = ''
          let nativeBlockTokens = 0
          console.log(`[chat] Native block budget: ${maxNativeBlockTokens} tokens (sources=${willUseKnowledgeSources})`)

          const hasUsableContent = (d: { content: string | null }) =>
            d.content != null && d.content.length > 50 && !d.content.startsWith('[')

          // Helper: load fileUrl for a single document (one at a time to control memory)
          const loadFileUrl = async (docId: string): Promise<string | null> => {
            try {
              const result = await Promise.race([
                prisma.aIDocument.findUnique({
                  where: { id: docId },
                  select: { fileUrl: true },
                }),
                new Promise<null>((resolve) => setTimeout(() => resolve(null), 15000)),
              ])
              return result?.fileUrl || null
            } catch (e) {
              const msg = e instanceof Error ? e.message : String(e)
              console.warn(`[chat] Failed to load fileUrl for ${docId}: ${msg}`)
              docLoadErrors.push(`loadFileUrl(${docId}): ${msg}`)
              return null
            }
          }

          // Process a single PDF document: use extracted text, or send as native
          // document block so Claude can "see" scanned PDFs via vision.
          const processPdfDoc = async (
            doc: { id: string; name: string; fileType: string; fileSize: number; content: string | null },
            prefix: string,
          ) => {
            try {
              if (hasUsableContent(doc)) {
                // Text-based PDF: use extracted text (fast, no base64 needed)
                documentContext += `\n\n--- ${prefix}${doc.name} (id: ${doc.id}) ---\n${doc.content!.slice(0, 50000)}\n--- Einde ---`
                pdfTextFallback += `\n\n--- ${prefix}${doc.name} ---\n${doc.content!.slice(0, 50000)}\n--- Einde ---`
                console.log(`[chat] PDF ${doc.name}: using extracted text (${doc.content!.length} chars)`)
              } else {
                // Scanned PDF: send as native document block so Claude can read it via vision.
                // Only for PDFs under 5MB to avoid Vercel memory issues.
                const sizeMB = (doc.fileSize || 0) / (1024 * 1024)
                const estimatedTokens = estimatePdfBlockTokens(Math.ceil(sizeMB * 1.37 * 1_000_000)) // base64 is ~37% larger
                if (sizeMB <= 5 && nativeBlockTokens + estimatedTokens <= maxNativeBlockTokens) {
                  const fileUrl = await loadFileUrl(doc.id)
                  const base64Data = fileUrl ? extractBase64FromDataUrl(fileUrl) : null
                  if (base64Data && base64Data.length <= MAX_NATIVE_PDF_BASE64_LEN) {
                    documentBlocks.push({
                      type: 'document',
                      source: { type: 'base64', media_type: 'application/pdf', data: base64Data },
                    })
                    nativeBlockTokens += estimatedTokens
                    // Don't add misleading system prompt text — let the native block speak for itself
                    pdfTextFallback += `\n\n--- ${prefix}${doc.name} ---\n[PDF-document — de inhoud is alleen beschikbaar als bijgevoegd document.]\n--- Einde ---`
                    console.log(`[chat] PDF ${doc.name}: scanned — sent as native document block (${sizeMB.toFixed(1)}MB, ~${estimatedTokens} tokens)`)
                  } else {
                    // Base64 load failed or too large
                    documentContext += `\n\n--- ${prefix}${doc.name} (id: ${doc.id}) ---\n[GESCAND PDF (${sizeMB.toFixed(1)}MB) — kon niet worden geladen als document block. Splits het document op in kleinere stukken via het schaartje-icoon (✂️) bij Documenten.]\n--- Einde ---`
                    console.log(`[chat] PDF ${doc.name}: scanned — base64 load failed or too large (${sizeMB.toFixed(1)}MB, base64: ${base64Data ? base64Data.length : 'null'})`)
                  }
                } else {
                  // Too large for native blocks — give clear instructions
                  documentContext += `\n\n--- ${prefix}${doc.name} (id: ${doc.id}) ---\n[GESCAND PDF (${sizeMB.toFixed(1)}MB) — te groot om als geheel te verwerken. Splits het document op in kleinere stukken via het schaartje-icoon (✂️) bij Documenten.]\n--- Einde ---`
                  console.log(`[chat] PDF ${doc.name}: scanned PDF too large for native block (${sizeMB.toFixed(1)}MB, ~${estimatedTokens} tokens)`)
                }
              }
            } catch (e) {
              const msg = e instanceof Error ? e.message : String(e)
              console.error(`[chat] processPdfDoc error for ${doc.name}: ${msg}`)
              docLoadErrors.push(`processPdf(${doc.name}): ${msg}`)
              documentContext += `\n\n--- ${prefix}${doc.name} (id: ${doc.id}) ---\n[Fout bij laden: ${msg.slice(0, 100)}]\n--- Einde ---`
            }
          }

          try {
          // Collect all docs first, then pre-load base64 for scanned PDFs in parallel.
          // Track isAttached: true for explicitly selected docs, false for auto-included project docs.
          // Only attached scanned PDFs get base64-loaded (project scanned PDFs are too slow to load every time).
          type DocInfo = { id: string; name: string; fileType: string; fileSize: number; content: string | null }
          let allDocs: Array<{ doc: DocInfo; prefix: string; isAttached: boolean }> = []

          if (documentIds?.length) {
            const docs = await prisma.aIDocument.findMany({
              where: {
                id: { in: documentIds },
                OR: [
                  { userId },
                  { project: { members: { some: { userId } } } },
                ],
              },
              select: { id: true, name: true, fileType: true, fileSize: true, content: true },
            })
            console.log(`[chat] Attached docs found: ${docs.length} (requested: ${documentIds.length})`)
            for (const doc of docs) {
              allDocs.push({ doc, prefix: 'Document: ', isAttached: true })
            }
          }

          if (projectId) {
            const projectDocs = await prisma.aIDocument.findMany({
              where: { projectId },
              take: 20,
              select: { id: true, name: true, fileType: true, fileSize: true, content: true },
            })
            console.log(`[chat] Project docs found: ${projectDocs.length} (projectId: ${projectId})`)
            for (const doc of projectDocs) {
              if (documentIds?.includes(doc.id)) continue
              allDocs.push({ doc, prefix: '', isAttached: false })
            }
          }

          // Pre-load base64 for ALL ATTACHED PDFs and images (not project docs).
          // This ensures native document blocks work for ALL attached PDFs —
          // including PDFs with some OCR text that would otherwise skip the native path.
          const docsNeedingBase64 = allDocs.filter(({ doc, isAttached }) => {
            if (!isAttached) return false // Never pre-load project docs
            if (['png', 'jpg', 'jpeg', 'webp'].includes(doc.fileType || '')) return true
            if (doc.fileType === 'pdf' && (doc.fileSize || 0) <= 5 * 1024 * 1024) return true
            return false
          })
          const base64Map = new Map<string, string | null>()
          if (docsNeedingBase64.length > 0) {
            console.log(`[chat] Pre-loading base64 for ${docsNeedingBase64.length} docs in parallel...`)
            const results = await Promise.all(
              docsNeedingBase64.map(async ({ doc }) => {
                const url = await loadFileUrl(doc.id)
                return [doc.id, url] as const
              })
            )
            for (const [id, url] of results) {
              base64Map.set(id, url || null)
            }
            console.log(`[chat] Base64 pre-load done: ${base64Map.size} docs`)
          }

          // Now process all docs using pre-loaded base64 data
          for (const { doc, prefix, isAttached } of allDocs) {
            if (doc.fileType === 'docx') hasDocxAttachments = true
            if (doc.fileType === 'pdf') {
              const hasText = hasUsableContent(doc)

              // ATTACHED PDFs with pre-loaded base64: ALWAYS send as native block.
              // This ensures Claude can "see" the actual pages — even if the PDF has
              // some OCR text, the native block gives vision access to the full document.
              if (isAttached && base64Map.has(doc.id)) {
                const fileUrl = base64Map.get(doc.id)
                const base64Data = fileUrl ? extractBase64FromDataUrl(fileUrl) : null
                const sizeMB = (doc.fileSize || 0) / (1024 * 1024)
                const estimatedTokens = estimatePdfBlockTokens(Math.ceil(sizeMB * 1.37 * 1_000_000))
                if (base64Data && base64Data.length <= MAX_NATIVE_PDF_BASE64_LEN && nativeBlockTokens + estimatedTokens <= maxNativeBlockTokens) {
                  documentBlocks.push({
                    type: 'document',
                    source: { type: 'base64', media_type: 'application/pdf', data: base64Data },
                  })
                  nativeBlockTokens += estimatedTokens
                  // Do NOT add system prompt text about this doc being "scanned" or "native" —
                  // that misleads Claude into thinking the document is unreadable.
                  // The native block in the user message speaks for itself.
                  if (hasText) {
                    // Include extracted text as additional context (useful for search/fallback)
                    documentContext += `\n\n--- ${prefix}${doc.name} (id: ${doc.id}) ---\n${doc.content!.slice(0, 50000)}\n--- Einde ---`
                    pdfTextFallback += `\n\n--- ${prefix}${doc.name} ---\n${doc.content!.slice(0, 50000)}\n--- Einde ---`
                  } else {
                    // No text fallback for retry (native block is the only representation)
                    pdfTextFallback += `\n\n--- ${prefix}${doc.name} ---\n[PDF-document — de inhoud is alleen beschikbaar als bijgevoegd document.]\n--- Einde ---`
                  }
                  console.log(`[chat] PDF ${doc.name}: native block (${sizeMB.toFixed(1)}MB, ~${estimatedTokens} tokens, text=${hasText ? doc.content!.length : 0})`)
                } else if (hasText) {
                  // Too large for native block but has text: use text
                  documentContext += `\n\n--- ${prefix}${doc.name} (id: ${doc.id}) ---\n${doc.content!.slice(0, 50000)}\n--- Einde ---`
                  pdfTextFallback += `\n\n--- ${prefix}${doc.name} ---\n${doc.content!.slice(0, 50000)}\n--- Einde ---`
                  console.log(`[chat] PDF ${doc.name}: too large for native block, using text (${doc.content!.length} chars)`)
                } else {
                  documentContext += `\n\n--- ${prefix}${doc.name} (id: ${doc.id}) ---\n[GESCAND PDF (${sizeMB.toFixed(1)}MB) — splits het document op via ✂️ bij Documenten.]\n--- Einde ---`
                  console.log(`[chat] PDF ${doc.name}: too large for native block, no text (${sizeMB.toFixed(1)}MB)`)
                }
              } else if (hasText) {
                // Text-based PDF (not in base64Map or project doc): use extracted text
                documentContext += `\n\n--- ${prefix}${doc.name} (id: ${doc.id}) ---\n${doc.content!.slice(0, 50000)}\n--- Einde ---`
                pdfTextFallback += `\n\n--- ${prefix}${doc.name} ---\n${doc.content!.slice(0, 50000)}\n--- Einde ---`
                console.log(`[chat] PDF ${doc.name}: text (${doc.content!.length} chars)`)
              } else if (isAttached) {
                // Attached PDF without pre-loaded base64: try loading (sequential fallback)
                await processPdfDoc(doc, prefix)
              } else {
                // Project scanned PDF (NOT attached): skip base64 loading entirely.
                const sizeMB = (doc.fileSize || 0) / (1024 * 1024)
                documentContext += `\n\n--- ${doc.name} (id: ${doc.id}) ---\n[Gescand PDF-document (${sizeMB.toFixed(1)}MB) — niet automatisch geladen. Upload het document opnieuw om het te laten splitsen, of voeg het expliciet toe aan je vraag.]\n--- Einde ---`
                console.log(`[chat] PDF ${doc.name}: project scanned — skipped (${sizeMB.toFixed(1)}MB, not attached)`)
              }
            } else if (['png', 'jpg', 'jpeg', 'webp'].includes(doc.fileType || '')) {
              if (!isAttached) continue // Skip project images (not attached)
              if (nativeBlockTokens + 1600 > maxNativeBlockTokens) continue
              const fileUrl = base64Map.get(doc.id) ?? await loadFileUrl(doc.id)
              const base64Data = fileUrl ? extractBase64FromDataUrl(fileUrl) : null
              if (base64Data) {
                const mimeMap: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' }
                documentBlocks.push({
                  type: 'image',
                  source: { type: 'base64', media_type: mimeMap[doc.fileType || 'png'] || 'image/png', data: base64Data },
                })
                nativeBlockTokens += 1600
              }
            } else if (doc.content) {
              if (documentContext.length > 200000) continue
              documentContext += `\n\n--- ${prefix}${doc.name} (id: ${doc.id}) ---\n${doc.content.slice(0, 50000)}\n--- Einde ---`
            }
          }
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e)
            console.error(`[chat] Document loading failed: ${msg}`)
            docLoadErrors.push(`docLoading: ${msg}`)
            // Continue without documents rather than crashing the entire stream
          }

          // Anonymize document context if requested
          if (anonymize && documentContext) {
            const anonDocs = anonymizeText(documentContext)
            documentContext = anonDocs.text
          }

          const docSummary = `${documentBlocks.length} native blocks (~${nativeBlockTokens} tokens), ${documentContext.length} chars text, ${docLoadErrors.length} errors`
          console.log(`[chat] Documents loaded: ${docSummary}`)
          // Send diagnostic info to client via SSE so user can see what happened
          await send(JSON.stringify({ type: 'status', text: `Documenten: ${documentBlocks.length} als PDF block, ${Math.round(documentContext.length / 1000)}K chars tekst${docLoadErrors.length > 0 ? `, ${docLoadErrors.length} fouten` : ''}` }))
          if (docLoadErrors.length > 0) {
            console.warn(`[chat] Document load errors:`, docLoadErrors)
          }
          lastStep = 'doc-load-done'

          // === KNOWLEDGE SOURCES ===
          await send(JSON.stringify({ type: 'status', text: 'Kennisbronnen doorzoeken...' }))
          lastStep = 'sources-start'

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
      docLoadErrors.push(`sources: ${err instanceof Error ? err.message : String(err)}`)
    }
    lastStep = 'sources-done'

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
    lastStep = 'templates-done'

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
    lastStep = 'memory-done'

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
Bij open casusvragen, strategievragen of vragen waarbij feiten ontbreken: STEL EERST 3-5 GERICHTE VRAGEN. Geef NIET direct een lang antwoord. Begin je response MET de vragen. Vraag ALTIJD naar: (1) de relevante feiten, (2) of er intern beleid, gedragscode, protocol of reglement van toepassing is, (3) het gewenste antwoordformat, (4) relevante documenten. Dit is de BELANGRIJKSTE regel. Als je dit overslaat, is het HELE antwoord nutteloos. ALLEEN bij feitelijke vragen of vervolgvragen mag je direct antwoorden.

### Concept-emails en -brieven
Wanneer je een concept-email, concept-brief of ander concept-document schrijft, zet dan de VOLLEDIGE concepttekst in een blockquote (elke regel begint met >). Dit zorgt voor de juiste opmaak. Gebruik een moderne zakelijke schrijfstijl: geen "Geachte heer/mevrouw" of "Hoogachtend" tenzij echt vereist.

### Brongebruik
1. PRIMAIRE BRON: de meegeleverde passages uit T&C, Thematica, RAR en VAAN. Dit is je fundament.
2. search_rechtspraak is OPTIONEEL — alleen als aanvulling. NIET verplicht.
3. ECLI-NUMMERS: alleen uit meegeleverde passages of via search_rechtspraak in DIT gesprek. NOOIT uit eigen geheugen.
4. NOOIT je zoekproces beschrijven. Begin DIRECT met de inhoud.
5. Sluit af met %%CONFIDENCE:hoog/gemiddeld/laag%% op de allerlaatste regel.

### GEEN EMOJI'S — ABSOLUUT VERBOD
Gebruik NOOIT emoji's, iconen of unicode-symbolen in je antwoord. Geen ⚠️, ❌, ✅, 💡, 📌, ⚖️ of welk symbool dan ook. OOK NIET als bullet-marker of voor nadruk. Alleen letters, cijfers en standaard leestekens (.,:;-!?).`

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

    // QUESTION-ASKING ENFORCEMENT: On first message, inject instruction directly into user message
    // This is more effective than system prompt alone because it's right next to the user's question
    // SKIP when documents are attached: user wants document analysis, not more questions
    const isFirstMessage = history.length <= 1
    const hasDocumentAttachments = documentBlocks.length > 0 || (documentIds?.length ?? 0) > 0
    if (isFirstMessage && !hasDocumentAttachments && msgs.length > 0) {
      const lastMsg = msgs[msgs.length - 1]
      if (lastMsg && lastMsg.role === 'user') {
        const questionInstruction = `[SYSTEEM: Dit is het EERSTE bericht in dit gesprek. REAGEER MET 3-5 GERICHTE VRAGEN — geef GEEN inhoudelijk antwoord. Stel vragen om de casus te begrijpen: de relevante feiten, of er intern beleid/gedragscode/protocol is dat van toepassing is, vraag naar het gewenste antwoordformat, en vraag of er relevante documenten zijn. UITZONDERING: alleen bij puur feitelijke vragen over termijnen, bedragen of berekeningen mag je direct antwoorden.]\n\n`
        if (typeof lastMsg.content === 'string') {
          lastMsg.content = questionInstruction + lastMsg.content
        } else if (Array.isArray(lastMsg.content)) {
          for (const block of lastMsg.content) {
            if (block.type === 'text') {
              block.text = questionInstruction + block.text
              break
            }
          }
        }
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
          if (block.type === 'document') {
            totalTokens += estimatePdfBlockTokens(block.source?.data?.length || 0)
          }
          if (block.type === 'image') totalTokens += 1600
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
    // If still over limit and we have native PDF blocks, convert them to text
    // This is seamless for the user — the document is still fully analyzed, just as text
    if (totalTokens > MAX_CONTEXT && documentBlocks.length > 0 && pdfTextFallback) {
      console.log(`[chat] Context over limit (~${totalTokens} tokens). Converting PDF blocks to text.`)
      pdfTextFallback += `\n\n[DEBUG: PDF blocks verwijderd door context limiet. Tokens: ~${totalTokens}, limiet: ${MAX_CONTEXT}]`
      // Remove document blocks from messages (keep images)
      for (const msg of msgs) {
        if (Array.isArray(msg.content)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          msg.content = msg.content.filter((b: any) => b.type !== 'document')
          // If only text blocks remain, simplify back to string
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const textParts = msg.content.filter((b: any) => b.type === 'text')
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const nonTextParts = msg.content.filter((b: any) => b.type !== 'text')
          if (nonTextParts.length === 0 && textParts.length === 1) {
            msg.content = textParts[0].text
          }
        }
      }
      // Add PDF text to system prompt
      if (systemPrompt.includes('## Documenten')) {
        systemPrompt += pdfTextFallback
      } else {
        systemPrompt += `\n\n## Documenten${pdfTextFallback}`
      }
      documentBlocks.length = 0 // Clear so they're not re-attached
      // Recalculate tokens
      totalTokens = estimateTokens(systemPrompt)
      for (const msg of msgs) {
        if (typeof msg.content === 'string') {
          totalTokens += estimateTokens(msg.content)
        } else if (Array.isArray(msg.content)) {
          for (const block of msg.content) {
            if (block.type === 'text') totalTokens += estimateTokens(block.text || '')
            if (block.type === 'image') totalTokens += 1600
          }
        }
      }
      console.log(`[chat] After text conversion: ~${totalTokens} tokens`)
    }
    // If still over limit, aggressively trim system prompt (knowledge sources are largest contributor)
    if (totalTokens > MAX_CONTEXT) {
      console.warn(`[chat] Context still over limit (~${totalTokens} tokens). Trimming system prompt.`)
      // Trim sources context: keep only first 100K chars (most relevant passages)
      const sourceMarker = '## Kennisbronnen — Meegeleverde Passages'
      const sourceIdx = systemPrompt.indexOf(sourceMarker)
      if (sourceIdx > -1) {
        const beforeSources = systemPrompt.slice(0, sourceIdx)
        const afterSourcesMatch = systemPrompt.indexOf('\n\n## ', sourceIdx + sourceMarker.length)
        const sourcesSection = afterSourcesMatch > -1
          ? systemPrompt.slice(sourceIdx, afterSourcesMatch)
          : systemPrompt.slice(sourceIdx)
        const restOfPrompt = afterSourcesMatch > -1 ? systemPrompt.slice(afterSourcesMatch) : ''
        // Keep only first 100K chars of sources (vs up to 300K+ normally)
        const trimmedSources = sourcesSection.slice(0, 100000)
        systemPrompt = beforeSources + trimmedSources + (trimmedSources.length < sourcesSection.length ? '\n\n[Kennisbronnen ingekort wegens documentgrootte]' : '') + restOfPrompt
        // Recalculate
        totalTokens = estimateTokens(systemPrompt)
        for (const msg of msgs) {
          if (typeof msg.content === 'string') {
            totalTokens += estimateTokens(msg.content)
          } else if (Array.isArray(msg.content)) {
            for (const block of msg.content) {
              if (block.type === 'text') totalTokens += estimateTokens(block.text || '')
              if (block.type === 'document') totalTokens += estimatePdfBlockTokens(block.source?.data?.length || 0)
              if (block.type === 'image') totalTokens += 1600
            }
          }
        }
        console.log(`[chat] After source trimming: ~${totalTokens} tokens`)
      }
    }
    if (totalTokens > MAX_CONTEXT) {
      console.warn(`[chat] Context still over limit after all trimming: ~${totalTokens} tokens`)
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

    lastStep = 'build-messages-done'
    const client = new Anthropic({ apiKey, timeout: 300000 })
    console.log(`[chat] Streaming: ${systemPrompt.length} chars, ${msgs.length} messages, tools=${tools.length}, native blocks=${documentBlocks.length} (~${nativeBlockTokens} tokens), est total=~${totalTokens} tokens`)

          await send(JSON.stringify({ type: 'status', text: 'Claude starten...' }))
          lastStep = 'claude-api-start'

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

          // Helper: set up stream event listeners and await final message
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const runStream = async (params: any): Promise<any> => {
            const stream = client.messages.stream(params)

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            stream.on('streamEvent' as any, (event: any) => {
              try {
                if (event.type === 'content_block_start') {
                  if (event.content_block?.type === 'thinking') {
                    writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'thinking_start' })}\n\n`))
                  }
                }
                if (event.type === 'content_block_delta') {
                  if (event.delta?.type === 'thinking_delta' && event.delta.thinking) {
                    writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'thinking', text: event.delta.thinking })}\n\n`))
                  }
                }
              } catch { /* ignore thinking stream errors */ }
            })

            stream.on('text', (text: string) => {
              fullText += text
              if (fullText.length === text.length) {
                // First delta arrived — Claude is responding. Cancel the watchdog.
                if (watchdogTimer) { clearTimeout(watchdogTimer); watchdogTimer = null }
                lastStep = 'claude-streaming'
              }
              writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'delta', text })}\n\n`))
            })

            stream.on('contentBlock', (block: { type: string }) => {
              if (block.type === 'web_search_tool_use' || block.type === 'server_tool_use') {
                hasWebSearch = true
                writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'status', text: 'AI Search...' })}\n\n`))
              }
            })

            return await stream.finalMessage()
          }

          // Try streaming with native blocks; auto-retry without if base64 fails
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let finalMessage: any
          try {
            finalMessage = await runStream(streamParams)
          } catch (apiErr) {
            const apiErrMsg = apiErr instanceof Error ? apiErr.message : String(apiErr)
            // Only retry without document blocks for errors clearly related to document/image content.
            // Do NOT catch generic 'Invalid' — that strips blocks for unrelated API errors.
            const isDocError = documentBlocks.length > 0 && !fullText && (
              apiErrMsg.includes('base64') ||
              apiErrMsg.includes('Could not process') ||
              apiErrMsg.includes('media_type') ||
              apiErrMsg.includes('too many images') ||
              apiErrMsg.includes('image size') ||
              apiErrMsg.includes('document is too large')
            )
            if (!isDocError) throw apiErr // Re-throw non-document errors

            console.log(`[chat] API error with native blocks (retrying without): ${apiErrMsg.slice(0, 200)}. Blocks: ${documentBlocks.length}`)
            pdfTextFallback += `\n\n[DEBUG: PDF blocks verwijderd door API error. Fout: ${apiErrMsg.slice(0, 120)}]`
            await send(JSON.stringify({ type: 'status', text: 'Documenten opnieuw verwerken...' }))

            // Strip document blocks from messages
            for (const msg of msgs) {
              if (Array.isArray(msg.content)) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                msg.content = msg.content.filter((b: any) => b.type !== 'document')
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const textParts = msg.content.filter((b: any) => b.type === 'text')
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const nonTextParts = msg.content.filter((b: any) => b.type !== 'text')
                if (nonTextParts.length === 0 && textParts.length === 1) {
                  msg.content = textParts[0].text
                }
              }
            }
            // Add text fallback for documents that were native blocks
            if (pdfTextFallback) {
              streamParams.system += `\n\n## DOCUMENTEN (als tekst)\n${pdfTextFallback}`
            }
            streamParams.messages = msgs
            documentBlocks.length = 0

            finalMessage = await runStream(streamParams)
          }

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
              await send(JSON.stringify({ type: 'status', text: `Rechtspraak.nl doorzoeken... (${toolRound})` }))

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
            await send(JSON.stringify({ type: 'status', text: 'Resultaten analyseren...' }))
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
                  writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'thinking_start' })}\n\n`))
                  writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'status', text: 'Claude analyseert resultaten...' })}\n\n`))
                }
                if (event.type === 'content_block_delta' && event.delta?.type === 'thinking_delta' && event.delta.thinking) {
                  writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'thinking', text: event.delta.thinking })}\n\n`))
                }
              } catch { /* ignore */ }
            })

            continueStream.on('text', (text) => {
              fullText += text
              writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'delta', text })}\n\n`))
            })

            // Detect web search in continuation
            continueStream.on('contentBlock', (block) => {
              const blockType = (block as { type: string }).type
              if (blockType === 'web_search_tool_use' || blockType === 'server_tool_use') {
                hasWebSearch = true
                writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'status', text: 'AI Search...' })}\n\n`))
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
                await send(JSON.stringify({ type: 'delta', text: warningText }))
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
          await send(JSON.stringify({
            type: 'done',
            hasWebSearch,
            citations,
            sources: usedSourceNames,
            model: modelId,
          }))

        } catch (error) {
          const errMsg = error instanceof Error ? error.message : String(error)
          const errStack = error instanceof Error ? error.stack?.split('\n').slice(0, 3).join(' > ') : ''
          console.error('[chat] Stream error:', errMsg, errStack)

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
            userError = 'De analyse duurde langer dan verwacht. Probeer het opnieuw — het lukt vaak bij een tweede poging.'
          } else if (errMsg.includes('rate_limit') || errMsg.includes('429')) {
            userError = 'Even rustig aan — te veel verzoeken tegelijk. Wacht een minuut en probeer het opnieuw.'
          } else if (errMsg.includes('overloaded') || errMsg.includes('529')) {
            userError = 'Claude is momenteel overbelast. Probeer het over een paar seconden opnieuw.'
          } else if (errMsg.includes('invalid_request') || errMsg.includes('max_tokens') || errMsg.includes('too large') || errMsg.includes('400')) {
            userError = 'Het verzoek was te groot om in één keer te verwerken. Probeer het opnieuw — het document wordt automatisch geoptimaliseerd.'
          } else if (errMsg.includes('authentication') || errMsg.includes('401') || errMsg.includes('api_key')) {
            userError = 'Er is een probleem met de API-configuratie. Neem contact op met de beheerder.'
          } else if (errMsg.includes('credit') || errMsg.includes('billing') || errMsg.includes('402')) {
            userError = 'De API-limieten zijn bereikt. Neem contact op met de beheerder.'
          }

          // Include technical details so we can debug — visible in error event
          const debugInfo = `[DEBUG: ${errMsg.slice(0, 150)}${docLoadErrors.length > 0 ? ` | docErrors: ${docLoadErrors.join('; ').slice(0, 100)}` : ''}]`
          await send(JSON.stringify({ type: 'error', error: `${userError}\n\n${debugInfo}` }))
        } finally {
          if (watchdogTimer) { clearTimeout(watchdogTimer); watchdogTimer = null }
          clearInterval(heartbeat)
          if (!watchdogFired) {
            try { await writer.close() } catch { /* may already be closed */ }
          }
        }
    })() // End of async IIFE — runs in background, not awaited

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'X-Accel-Buffering': 'no',
        'X-Build-Id': process.env.NEXT_PUBLIC_BUILD_ID || '',
        'X-Conversation-Id': convId, // Client reads this for polling fallback
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

  // ===== INFORMELE / COLLOQUIALE VARIANTEN =====

  // 51. "Eruit gegooid" / informeel ontslag
  {
    patterns: [/\beruit\s*(?:ge)?gooid/i, /\bde\s*laan\s*uit(?:gestuurd)?/i, /\bop\s*straat\s*(?:ge)?zet/i, /\bweggestuurd/i, /\bweg\s*moeten/i, /\bafgedankt/i, /\bdeur\s*(?:ge)?wezen/i, /\bkwijd\s*(?:willen|wil)/i, /\bmij\s*(?:eruit|weg)\b/i],
    terms: ['ontslag', 'opzegging arbeidsovereenkomst', 'art. 7:669', 'ontslagrecht', 'beeindiging arbeidsovereenkomst', 'transitievergoeding', 'opzegverboden'],
  },
  // 52. "Baas wil me weg" / werkgever wil beeindiging
  {
    patterns: [/\bbaas\s*(?:wil|zegt|dreigt)/i, /\bwerkgever\s*wil\s*(?:me\s*)?(?:weg|kwijt|eruit|ontslaan)/i, /\bwillen\s*(?:dat\s*ik\s*)?(?:vertrek|opsta|wegga)/i, /\bmoet\s*(?:ik\s*)?(?:weg|vertrekken|opstappen)/i, /\bgedwongen\s*(?:om\s*)?(?:te\s*)?vertrekken/i, /\bweg\s*gepest/i, /\bwegpesten/i],
    terms: ['beeindiging arbeidsovereenkomst', 'onvrijwillig ontslag', 'vaststellingsovereenkomst', 'ontslag', 'intimidatie werkgever', 'goed werkgeverschap', 'art. 7:611'],
  },
  // 53. "Mag dat zomaar" / rechtmatigheid werkgevershandelen
  {
    patterns: [/\bmag\s*(?:dat|dit)\s*(?:zo\s*maar|zomaar)/i, /\bis\s*dat\s*(?:wel\s*)?(?:toegestaan|legaal|rechts?matig|wettelijk)/i, /\bkan\s*dat\s*(?:zo\s*maar|zomaar)/i, /\bhebben?\s*(?:ze|zij)\s*(?:het\s*)?recht/i, /\bmogen\s*(?:ze|zij)\s*(?:dat|dit)/i, /\bis\s*(?:dat|dit)\s*(?:wel\s*)?(?:te)?recht/i],
    terms: ['rechtmatigheid', 'goed werkgeverschap', 'art. 7:611', 'redelijkheid en billijkheid', 'vernietigbaarheid', 'nietigheid'],
  },
  // 54. "Hoeveel krijg ik" / vergoeding berekening
  {
    patterns: [/\bhoeveel\s*(?:krijg|ontvang|kost)/i, /\bwat\s*(?:krijg|ontvang)\s*ik/i, /\bwaar\s*heb\s*ik\s*recht\s*op/i, /\bhoe\s*(?:bereken|reken)/i, /\bberekening\b/i, /\bbedrag\b/i, /\bhoogte\s*(?:van\s*)?(?:de\s*)?vergoeding/i],
    terms: ['transitievergoeding', 'billijke vergoeding', 'berekening vergoeding', 'eindafrekening', 'vergoeding', 'art. 7:673', 'maandsalaris'],
  },
  // 55. "Wanneer moet ik" / termijnen en deadlines
  {
    patterns: [/\bwanneer\s*(?:moet|kan|mag)\s*ik/i, /\bhoe\s*lang\s*(?:heb\s*ik|duurt|is)/i, /\btermijn\b/i, /\bdeadline/i, /\bvervaltermijn/i, /\bte\s*laat\b/i, /\btijdig\b/i, /\bbinnen\s*(?:welke\s*)?termijn/i, /\bverjaart?\b/i, /\bverjaring/i],
    terms: ['vervaltermijn', 'verjaringstermijn', 'art. 7:686a', 'bedenktermijn', 'aanzegtermijn', 'opzegtermijn', 'twee maanden', 'drie maanden', 'bezwaartermijn'],
  },
  // 56. "Mijn baas zegt dat..." / werkgeversinstructie en claims
  {
    patterns: [/\bmijn\s*(?:baas|werkgever|chef|leidinggevende|manager)\s*(?:zegt|beweert|claimt|vindt|stelt)\b/i, /\bvolgens\s*(?:mijn\s*)?(?:baas|werkgever|chef)/i, /\bze\s*(?:zeggen|beweren|claimen)\s*(?:op\s*)?(?:mijn\s*)?werk/i],
    terms: ['werkgeversinstructie', 'instructierecht', 'art. 7:660', 'goed werkgeverschap', 'art. 7:611', 'redelijk voorschrift'],
  },
  // 57. "Kan ik gedwongen worden" / instructierecht en dwang
  {
    patterns: [/\bkan\s*ik\s*(?:ge)?dwongen\s*(?:worden)?/i, /\bgedwongen\s*(?:om\s*)?(?:te\s*)?/i, /\bverplicht\s*(?:om\s*)?(?:te\s*)?/i, /\bmoet\s*ik\s*(?:verplicht|per\s*se|altijd)/i, /\bweiger(?:en|ing)?\s*(?:mag|kan)/i, /\bmag\s*ik\s*weigeren/i],
    terms: ['instructierecht werkgever', 'art. 7:660', 'werkweigering', 'art. 7:678 lid 2 sub j', 'redelijk voorschrift', 'goed werknemerschap', 'art. 7:611'],
  },
  // 58. "Contract opgezegd" / opzegging door werkgever of werknemer
  {
    patterns: [/\bcontract\s*(?:op)?gezegd/i, /\bcontract\s*(?:op)?zeggen/i, /\bopzegging\s*(?:ontvangen|gekregen|gedan)/i, /\bopzegg?brief/i, /\bbrief\s*(?:van\s*)?ontslag/i, /\bontslagbrief/i],
    terms: ['opzegging arbeidsovereenkomst', 'art. 7:671', 'opzegtermijn', 'art. 7:672', 'instemming werknemer', 'schriftelijkheidsvereiste opzegging', 'herroeping instemming'],
  },
  // 59. "Niet meer welkom" / op non-actiefstelling informeel
  {
    patterns: [/\bniet\s*meer\s*welkom/i, /\bthuiszitten/i, /\bthuis\s*zitten/i, /\bniet\s*(?:meer\s*)?(?:hoeven|mogen)\s*(?:komen|werken)/i, /\bbuitengesloten/i, /\btoegang\s*(?:ge)?weigerd/i, /\bbadge\s*(?:ge)?blokkeerd/i, /\bniet\s*(?:meer\s*)?(?:op\s*)?kantoor/i],
    terms: ['op non-actiefstelling', 'schorsing', 'vrijstelling van werk', 'loondoorbetaling', 'art. 7:628', 'goed werkgeverschap', 'wedertewerkstellingsvordering'],
  },
  // 60. "Dreigt met ontslag" / intimidatie en dreigementen
  {
    patterns: [/\bdreig(?:t|en|de|ing)\s*(?:met\s*)?ontslag/i, /\bontslag\s*dreig/i, /\bonder\s*druk\s*(?:ge)?zet/i, /\bchantage/i, /\bintimid(?:atie|eer|eerd)/i, /\bbedreig(?:d|ing|en)/i, /\bgedwongen\s*(?:te\s*)?tekenen/i, /\bmoest\s*tekenen/i],
    terms: ['intimidatie', 'bedreiging ontslag', 'wilsgebrek', 'dwaling', 'bedreiging', 'misbruik van omstandigheden', 'vernietiging rechtshandeling', 'art. 3:44 BW', 'goed werkgeverschap'],
  },
  // 61. "Mondeling afgesproken" / mondelinge bedingen en toezeggingen
  {
    patterns: [/\bmondeling\s*(?:af)?gesproken/i, /\bmondeling\s*(?:be)?loof/i, /\bniets\s*op\s*papier/i, /\bniet\s*(?:op\s*)?schrift/i, /\bschriftelijk\s*vastgelegd/i, /\bgeen\s*(?:schriftelijk\s*)?bewijs/i, /\bmondelinge?\s*(?:afspraak|overeenkomst|beding|toezegging)/i],
    terms: ['mondeling beding', 'mondelinge arbeidsovereenkomst', 'bewijslast', 'schriftelijkheidsvereiste', 'art. 7:653', 'concurrentiebeding schriftelijk', 'proeftijd schriftelijk'],
  },
  // 62. "Beloofd maar niet gekregen" / toezegging werkgever
  {
    patterns: [/\bbeloof(?:d|de|t)\s*(?:maar\s*)?(?:niet\s*)?(?:gekregen|ontvangen|gehouden)/i, /\btoezegging/i, /\bbelofte\b/i, /\bafspraak\s*(?:niet\s*)?nagekomen/i, /\bwanprestatie/i, /\bniet\s*nakomen/i, /\bverworven\s*recht/i, /\bgewekt(?:e)?\s*verwachting/i],
    terms: ['toezegging werkgever', 'verworven recht', 'gerechtvaardigd vertrouwen', 'nakoming', 'wanprestatie', 'art. 6:248 BW', 'goed werkgeverschap'],
  },

  // ===== CROSS-REFERENCING GERELATEERDE CONCEPTEN =====

  // 63. Transitievergoeding cross-references (eindafrekening, billijke vergoeding)
  {
    patterns: [/\btransitievergoeding\s*(?:en|of|plus|naast)/i, /\beindafrekening/i, /\bfinale?\s*(?:af)?rekening/i, /\blaatste\s*(?:loon|salaris)/i, /\buitbetaling\s*(?:bij\s*)?einde/i, /\bnog\s*tegoed/i],
    terms: ['eindafrekening', 'transitievergoeding', 'billijke vergoeding', 'vakantiegeld', 'niet-genoten vakantiedagen', 'uitbetaling vakantiedagen', 'pro rata bonus', 'art. 7:641'],
  },
  // 64. Ontslag cross-references (opzegtermijn, transitievergoeding, WW)
  {
    patterns: [/\bontslag(?:en)?\s*(?:en|of)\s*(?:dan|daarna|vervolgens)/i, /\bna\s*(?:mijn\s*)?ontslag/i, /\bgevolgen\s*(?:van\s*)?ontslag/i, /\bwat\s*(?:nu|doe\s*ik)\s*(?:na|bij|met)\s*ontslag/i, /\bstappen\s*(?:na|bij)\s*ontslag/i],
    terms: ['ontslag', 'opzegtermijn', 'transitievergoeding', 'WW-uitkering', 'eindafrekening', 'getuigschrift', 'concurrentiebeding', 'bedenktermijn'],
  },
  // 65. Ziekte cross-references (re-integratie, opzegverbod, loondoorbetaling, WIA)
  {
    patterns: [/\blang(?:durig)?\s*ziek/i, /\b(?:al\s*)?(?:twee|2)\s*jaar\s*ziek/i, /\b104\s*weken/i, /\beinde\s*wachttijd/i, /\bwia-?(?:beoordeling|aanvraag|keuring)/i, /\bwga\b/i, /\biva\b/i, /\b35-?min/i],
    terms: ['langdurige arbeidsongeschiktheid', 'loondoorbetaling 104 weken', 'art. 7:629', 'WIA', 'WGA', 'IVA', 're-integratie', 'opzegverbod ziekte', 'art. 7:670', 'deskundigenoordeel UWV', 'slapend dienstverband'],
  },

  // ===== SPECIFIEKE SUB-TOPICS =====

  // 66. Werkweigering
  {
    patterns: [/\bwerkweigering/i, /\bwerk\s*(?:ge)?weigerd/i, /\bweiger(?:t|en|de)?\s*(?:te\s*)?(?:werken|komen)/i, /\bniet\s*(?:op\s*)?(?:komen\s*)?(?:dag|werk)en/i, /\bongeoorloofd\s*(?:afwezig|verzuim)/i],
    terms: ['werkweigering', 'art. 7:678 lid 2 sub j', 'dringende reden', 'hardnekkige werkweigering', 'ongeoorloofde afwezigheid', 'loonopschorting', 'art. 7:629 lid 3'],
  },
  // 67. Nevenarbeid na WAB / Wet transparante arbeidsvoorwaarden
  {
    patterns: [/\bnevenarbeid/i, /\bnevenwerkzaamheden\s*(?:na\s*)?wab/i, /\bverbod\s*nevenwerkzaamheden\s*(?:nietig|ongeldig)/i, /\bneven(?:werk|arbeid)\s*(?:beding|clausule)/i, /\btransparante\s*(?:en\s*voorspelbare\s*)?arbeidsvoorwaarden\s*(?:neven|bijbaan)/i],
    terms: ['nevenwerkzaamhedenbeding', 'art. 7:653a', 'Wet transparante en voorspelbare arbeidsvoorwaarden', 'objectieve rechtvaardiging', 'nietigheid nevenwerkzaamhedenbeding', 'WAB'],
  },
  // 68. Detachering EU / Posted Workers
  {
    patterns: [/\bposted\s*workers/i, /\bdetacherings?richtlijn/i, /\bwaga\b/i, /\bgedetacheerde?\s*werk(?:nemer)?/i, /\bkernarb?eidsvoorwaarden/i, /\beu-?detachering/i, /\bwerken\s*(?:in\s*)?(?:het\s*)?buitenland\s*(?:eu|europa)/i],
    terms: ['Detacheringsrichtlijn', 'Posted Workers Directive', 'WagwEU', 'kernarbeidsvoorwaarden', 'harde kern arbeidsvoorwaarden', 'detachering EU', 'melding detachering'],
  },
  // 69. Seizoensarbeid en ketenregeling
  {
    patterns: [/\bseizoen(?:s)?(?:arbeid|werk|kracht)/i, /\bseizoens?(?:contract|overeenkomst)/i, /\btussen(?:poos|pozen)\b/i, /\b(?:3|drie)\s*maanden\s*(?:tussenpoos|pauze|onderbreking)/i, /\bketen\s*(?:onderbreking|pauze|tussenperiode)/i],
    terms: ['seizoensarbeid', 'ketenregeling', 'art. 7:668a', 'tussenpozen', 'tussenpoos 6 maanden', 'CAO-afwijking ketenregeling', 'seizoenswerker'],
  },
  // 70. Pensioenvraagstukken (nabestaandenpensioen, waardeoverdracht)
  {
    patterns: [/\bnabestaandenpensioen/i, /\bwaardeoverdracht/i, /\bpensioenregeling/i, /\bpensioen(?:fonds|uitvoerder|premie)/i, /\bpensioenopbouw/i, /\beigen\s*bijdrage\s*pensioen/i, /\bpensioenvraag/i, /\bpensioenrecht/i, /\bwtp\b/i, /\bpensioen(?:wet|akkoord)/i],
    terms: ['pensioenregeling', 'Pensioenwet', 'nabestaandenpensioen', 'waardeoverdracht', 'pensioenopbouw', 'premievrije voortzetting', 'Wet toekomst pensioenen', 'pensioenuitvoerder', 'eigendomsrecht pensioen'],
  },
  // 71. Medisch beroepsgeheim bedrijfsarts
  {
    patterns: [/\bberoepsgeheim\s*(?:bedrijfs)?arts/i, /\bmedisch\s*(?:geheim|dossier|informatie)\s*(?:bedrijfs)?arts/i, /\bbedrijfsarts\s*(?:mag\s*(?:niet\s*)?)?(?:vertellen|delen|informeren)/i, /\bmedische\s*gegevens\s*(?:werkgever|werk)/i, /\bwat\s*mag\s*(?:de\s*)?bedrijfsarts\s*(?:vertellen|zeggen|delen)/i],
    terms: ['medisch beroepsgeheim', 'bedrijfsarts', 'KNMG-richtlijn', 'medische informatie werkgever', 'privacy medische gegevens', 'art. 7:629 lid 3', 'beperkingen en mogelijkheden'],
  },
  // 72. Second opinion bedrijfsarts
  {
    patterns: [/\bsecond\s*opinion/i, /\btweede\s*(?:mening|oordeel)\s*(?:bedrijfs)?arts/i, /\bniet\s*eens\s*(?:met\s*)?(?:de\s*)?bedrijfsarts/i, /\bbedrijfsarts\s*(?:niet\s*)?eens/i, /\bdeskundigenoordeel/i, /\bonafhankelijk\s*oordeel/i],
    terms: ['second opinion bedrijfsarts', 'deskundigenoordeel UWV', 'art. 7:629a', 'geschil bedrijfsarts', 'onafhankelijk oordeel', 'klacht bedrijfsarts'],
  },
  // 73. Arbeidsongeschiktheidspensioen
  {
    patterns: [/\barbeidsongeschiktheidspensioen/i, /\bao-?pensioen/i, /\bpremievrijstelling\s*(?:bij\s*)?arbeidsongeschiktheid/i, /\binvaliditeitspensioen/i, /\bwia\s*(?:en|plus|naast)\s*pensioen/i],
    terms: ['arbeidsongeschiktheidspensioen', 'premievrijstelling', 'WIA-excedentregeling', 'invaliditeitspensioen', 'Pensioenwet', 'aanvullende arbeidsongeschiktheidsverzekering'],
  },
  // 74. Wet transparante en voorspelbare arbeidsvoorwaarden (2022)
  {
    patterns: [/\btransparante\s*(?:en\s*)?(?:voorspelbare\s*)?arbeidsvoorwaarden/i, /\bwtva\b/i, /\brichtlijn\s*transparante/i, /\bvoorspelbaar\s*werkpatroon/i, /\binformatieplicht\s*werkgever/i, /\bkosteloze\s*opleiding/i, /\bverplichte\s*scholing/i],
    terms: ['Wet transparante en voorspelbare arbeidsvoorwaarden', 'implementatiewet EU-richtlijn', 'informatieplicht werkgever', 'art. 7:655', 'voorspelbaar werkpatroon', 'kosteloze scholing', 'studiekostenbeding nietig', 'nevenwerkzaamhedenbeding'],
  },
  // 75. Wet werken waar je wilt / aanpassing arbeidsplaats
  {
    patterns: [/\bwerken\s*waar\s*(?:je|ik)\s*wil/i, /\baanpassing\s*arbeidsplaats/i, /\bverzoek\s*(?:om\s*)?(?:thuis|remote|hybride)\s*(?:te\s*)?werken/i, /\bwerkplek\s*aanpassen/i, /\brecht\s*(?:op\s*)?thuiswerk/i],
    terms: ['Wet werken waar je wilt', 'Wet flexibel werken', 'aanpassing arbeidsplaats', 'thuiswerken', 'redelijkheid en billijkheid', 'verzoek aanpassing'],
  },
  // 76. Platformarbeid / digitale arbeid
  {
    patterns: [/\bplatformarbeid/i, /\bplatformwerk(?:er)?/i, /\bgig\s*(?:economy|werk|worker)/i, /\bapp-?(?:chauffeur|bezorger|werker)/i, /\bbezorg(?:er|ing)\s*(?:app|platform)/i, /\bthuis?bezorg/i, /\bgorillas\b/i, /\bgetir\b/i, /\bbolt\b/i, /\btemper\b/i],
    terms: ['platformarbeid', 'platformwerker', 'rechtsvermoeden arbeidsovereenkomst', 'art. 7:610a', 'schijnzelfstandigheid', 'Deliveroo-arrest', 'EU-richtlijn platformwerk', 'algoritmisch management'],
  },
  // 77. Loonbeslag / cessie / derdenbeslag
  {
    patterns: [/\bloonbeslag/i, /\bbeslag\s*(?:op\s*)?(?:mijn\s*)?(?:loon|salaris)/i, /\ccessie/i, /\bderdenbeslag/i, /\bbeslagvrije\s*voet/i, /\bdeurwaarder\s*(?:loon|salaris)/i, /\binhouding\s*(?:op\s*)?(?:loon|salaris)/i],
    terms: ['loonbeslag', 'beslagvrije voet', 'derdenbeslag', 'cessie loonvordering', 'art. 7:633', 'Wet vereenvoudiging beslagvrije voet', 'verplichtingen werkgever loonbeslag'],
  },
  // 78. Verrekening met loon
  {
    patterns: [/\bverrekening\s*(?:met\s*)?(?:loon|salaris)/i, /\bloon\s*verrekenen/i, /\binhouding\s*(?:op\s*)?loon/i, /\bschade\s*(?:verrekenen|inhouden)\s*(?:op\s*)?(?:loon|salaris)/i, /\bteveel\s*(?:be)?taald/i, /\bonverschuldigde?\s*betaling/i],
    terms: ['verrekening loon', 'art. 7:632', 'verrekeningsbevoegdheid', 'onverschuldigde betaling', 'art. 6:203 BW', 'beperkingen verrekening loon', 'instemming werknemer verrekening'],
  },
  // 79. Boetebeding arbeidsovereenkomst
  {
    patterns: [/\bboetebeding/i, /\bboete\s*(?:in\s*)?(?:arbeids)?(?:contract|overeenkomst)/i, /\bboete\s*(?:van\s*)?(?:de\s*)?werkgever/i, /\bcontractuele?\s*boete/i, /\bpenalty\s*clause/i, /\bboete\s*overtreding/i],
    terms: ['boetebeding', 'art. 7:650', 'boete arbeidsovereenkomst', 'schriftelijkheidsvereiste', 'matiging boete', 'bestemming boete', 'maximum boetebedrag'],
  },
  // 80. Gewetensbezwaar
  {
    patterns: [/\bgewetensbezwaar/i, /\bgewetens?bezwaard/i, /\bweigering\s*(?:uit|op|vanwege)\s*(?:geloof|geweten|overtuiging)/i, /\breligieuze?\s*(?:bezwaar|overtuiging)\s*(?:op\s*)?werk/i, /\bzondag\s*(?:werken|werk)/i, /\bf-?grond/i],
    terms: ['gewetensbezwaar', 'art. 7:669 lid 3 sub f', 'f-grond', 'gewetensbezwaarde werknemer', 'herplaatsing', 'redelijke aanpassing'],
  },
  // 81. Vervroegde IVA
  {
    patterns: [/\bvervroegde?\s*iva/i, /\biva\s*(?:aanvraag|aanvragen|vervroegd)/i, /\bvolledig(?:e)?\s*(?:en\s*)?duurzaam\s*arbeidsongeschikt/i, /\b80-?100\s*(?:procent|%)\s*(?:arbeids)?ongeschikt/i, /\bgeen\s*kans\s*(?:op\s*)?herstel/i],
    terms: ['vervroegde IVA', 'IVA-uitkering', 'volledig en duurzaam arbeidsongeschikt', 'art. 47 WIA', 'WIA', 'loondoorbetaling', 'slapend dienstverband'],
  },
  // 82. STAP-budget / scholingsrechten
  {
    patterns: [/\bstap-?budget/i, /\bscholingsrecht/i, /\brecht\s*(?:op\s*)?(?:opleiding|scholing|studie)/i, /\bopleidingsbudget/i, /\bscholingsplicht/i, /\bscholing\s*(?:werk(?:gever|nemer))?/i, /\blevenlang\s*(?:leren|ontwikkelen)/i],
    terms: ['scholingsrecht', 'STAP-budget', 'scholingsplicht werkgever', 'art. 7:611a', 'kosteloze scholing', 'studiekostenbeding', 'Wet transparante en voorspelbare arbeidsvoorwaarden'],
  },
  // 83. Slapend dienstverband / Xella
  {
    patterns: [/\bslapend\s*dienstverband/i, /\bxella\b/i, /\bniet\s*(?:willen\s*)?ontslaan\s*(?:na\s*)?(?:2\s*jaar|twee\s*jaar)\s*ziek/i, /\bwerkgever\s*(?:weigert|wil\s*niet)\s*(?:ontslaan|beeindigen)/i, /\b(?:na\s*)?104\s*weken\s*(?:niet\s*)?(?:ontslag|beeindig)/i],
    terms: ['slapend dienstverband', 'Xella-arrest', 'transitievergoeding langdurige arbeidsongeschiktheid', 'compensatieregeling transitievergoeding', 'art. 7:673e', 'goed werkgeverschap', 'ernstig verwijtbaar'],
  },
  // 84. Werkgeversgezag / instructierecht
  {
    patterns: [/\bwerkgeversgezag/i, /\binstructierecht\s*werkgever/i, /\bredelijk\s*(?:voor)?schrift/i, /\bbevel\s*(?:van\s*)?(?:de\s*)?werkgever/i, /\bgezagsverhouding/i, /\borganisat(?:ie|orisch)\s*(?:wijziging|aanpassing)/i, /\bfunctie-?eisen/i],
    terms: ['instructierecht', 'art. 7:660', 'werkgeversgezag', 'redelijk voorschrift', 'gezagsverhouding', 'goed werknemerschap', 'functiewijziging'],
  },
  // 85. Relatiebeding vs concurrentiebeding (verschil)
  {
    patterns: [/\brelatiebeding\s*(?:vs|versus|of|en)\s*concurrentiebeding/i, /\bconcurrentiebeding\s*(?:vs|versus|of|en)\s*relatiebeding/i, /\bverschil\s*(?:tussen\s*)?(?:relatie|concurrentie)beding/i, /\brelatiebeding\s*(?:omzetten|aanpassen|herschrijven)/i],
    terms: ['relatiebeding', 'concurrentiebeding', 'art. 7:653', 'verschil relatiebeding concurrentiebeding', 'schriftelijkheidsvereiste', 'zwaarwegende bedrijfsbelangen', 'belangenafweging', 'beperking relatiebeding'],
  },

  // ===== VEELVOORKOMENDE SPELFOUTEN =====

  // 86. Spelfouten transitievergoeding
  {
    patterns: [/\btransitie\s+vergoeding/i, /\btransitievergoedng/i, /\btransitevergoeding/i, /\btrantisievergoeding/i, /\btransitie-vergoeding/i, /\btransitiefvergoeding/i, /\btransistievergoeding/i],
    terms: ['transitievergoeding', 'art. 7:673', 'berekening transitievergoeding', 'ontslagvergoeding'],
  },
  // 87. Spelfouten vaststellingsovereenkomst
  {
    patterns: [/\bvaststellings\s+overeenkomst/i, /\bvastellingsovereenkomst/i, /\bvaststellingsoverenkomst/i, /\bvasstellingsovereenkomst/i, /\bvast-?stellingsovereenkomst/i, /\bvastelling(?:s)?overeenkomst/i],
    terms: ['vaststellingsovereenkomst', 'bedenktermijn', 'art. 7:670b', 'wederzijds goedvinden', 'finale kwijting'],
  },
  // 88. Spelfouten opzegtermijn / disfunctioneren / concurrentiebeding
  {
    patterns: [/\boppzegtermijn/i, /\bopzeg\s+termijn/i, /\bopzeggingstermijn/i, /\bdischfunctioneren/i, /\bdysfunctioneren/i, /\bdisfuntioneren/i, /\bdisfunctionern/i, /\bconcurrentiebedng/i, /\bconcurentie\s*beding/i, /\bconcurrrentie/i, /\bconcurentie(?:beding)?/i],
    terms: ['opzegtermijn', 'art. 7:672', 'disfunctioneren', 'art. 7:669 lid 3 sub d', 'concurrentiebeding', 'art. 7:653'],
  },
  // 89. Spelfouten proeftijd / arbeidsovereenkomst
  {
    patterns: [/\bproeftyd/i, /\bproef\s+tijd/i, /\bproefperiode\b/i, /\barbeids\s+overeenkomst/i, /\barbeidsoverreenkomst/i, /\barbeids-overeenkomst/i, /\barbeitsovereenkomst/i],
    terms: ['proeftijdbeding', 'art. 7:652', 'arbeidsovereenkomst', 'art. 7:610'],
  },
  // 90. Spelfouten ontslagvergoeding / beeindiging
  {
    patterns: [/\bontslagvergoe?ding/i, /\bontslag\s+vergoeding/i, /\bbeeindeging/i, /\bbeeindiging/i, /\bbeeindigings?\s*overeenkomst/i, /\bbeeindegen/i, /\bontbindingvergoeding/i],
    terms: ['ontslagvergoeding', 'transitievergoeding', 'beeindiging arbeidsovereenkomst', 'art. 7:673', 'billijke vergoeding'],
  },

  // ===== AANVULLENDE SPECIFIEKE ONDERWERPEN =====

  // 91. Loonsanctie UWV
  {
    patterns: [/\bloonsanctie/i, /\bverlenging\s*loondoorbetaling/i, /\bderde\s*(?:ziekte)?jaar/i, /\bre-?integratie\s*(?:inspanning|verplichting)\s*(?:onvoldoende|niet)/i, /\buwv\s*(?:straf|sanctie|boete)/i, /\b(?:verlenging|verlengde)\s*wachttijd/i],
    terms: ['loonsanctie', 'verlenging loondoorbetaling', 'derde ziektejaar', 'art. 25 lid 9 WIA', 'onvoldoende re-integratie-inspanningen', 'bezwaar loonsanctie', 'bekortingsverzoek'],
  },
  // 92. Wet arbeid en zorg (WAZO) / diverse verlofvormen
  {
    patterns: [/\bwazo\b/i, /\bzorgverlof/i, /\bkortdurend\s*(?:zorg)?verlof/i, /\blangdurend\s*(?:zorg)?verlof/i, /\badoptie(?:verlof)?/i, /\bpleegzorg(?:verlof)?/i, /\brouwverlof/i, /\bbijzonder\s*verlof/i, /\bverlof\s*(?:bij\s*)?overlijden/i],
    terms: ['WAZO', 'Wet arbeid en zorg', 'zwangerschapsverlof', 'bevallingsverlof', 'geboorteverlof', 'aanvullend geboorteverlof', 'ouderschapsverlof', 'kortdurend zorgverlof', 'langdurend zorgverlof', 'adoptieverlof', 'calamiteitenverlof'],
  },
  // 93. Ontslag tijdens proeftijd / misbruik proeftijd
  {
    patterns: [/\bproeftijd\s*(?:ontslag|ontslagen|misbruik)/i, /\bmisbruik\s*proeftijd/i, /\bdiscriminatie\s*proeftijd/i, /\bontslagen\s*(?:in|tijdens)\s*(?:de\s*)?proeftijd/i, /\bproeftijd\s*(?:reden|motivering|opgeven)/i],
    terms: ['proeftijdontslag', 'art. 7:652', 'misbruik proeftijdbeding', 'discriminatie proeftijd', 'opzegverboden proeftijd', 'reden proeftijdontslag', 'mededeling reden'],
  },
  // 94. Overwerk / overwerkvergoeding / ATW
  {
    patterns: [/\boverwerk(?:vergoeding)?/i, /\boveruren\s*(?:uitbetalen|betaald|vergoeding)/i, /\bverplicht\s*(?:over(?:werk|uren)|langer\s*werk)/i, /\bstructureel\s*overwerk/i, /\bcompensatie\s*overwerk/i, /\boveruren\s*(?:opnemen|opsparen)/i],
    terms: ['overwerk', 'overwerkvergoeding', 'arbeidstijdenwet', 'ATW', 'structureel overwerk', 'arbeidsomvang', 'art. 7:610b', 'compensatie-uren'],
  },
  // 95. Eenzijdig wijzigingsbeding (art. 7:613) specifiek
  {
    patterns: [/\b(?:art\.?\s*)?7:613/i, /\beenzijdig\s*wijzig(?:en|ing)/i, /\bwijzigingsbeding/i, /\barbeidsvoorwaarden\s*(?:eenzijdig\s*)?(?:verand|wijzig|aanpas)/i, /\bsalaris\s*(?:verlag|verminder|korten)/i],
    terms: ['eenzijdig wijzigingsbeding', 'art. 7:613', 'zwaarwichtig belang', 'Stoof/Mammoet', 'art. 7:611', 'redelijk voorstel', 'goed werknemerschap', 'wijziging arbeidsvoorwaarden'],
  },
  // 96. Aansprakelijkheid werknemer / schade door werknemer
  {
    patterns: [/\bschade\s*(?:door|van)\s*(?:de\s*)?werk(?:nemer)?/i, /\baansprakelijk(?:heid)?\s*werk(?:nemer)?/i, /\bschade\s*(?:aan\s*)?(?:bedrijfs)?(?:auto|eigendom|materiaal)/i, /\bwn-?aansprakelijkheid/i, /\bopzet\s*(?:of\s*)?bewuste\s*roekeloosheid/i, /\b(?:art\.?\s*)?7:661/i],
    terms: ['aansprakelijkheid werknemer', 'art. 7:661', 'opzet of bewuste roekeloosheid', 'schade door werknemer', 'regresrecht werkgever', 'bedrijfsauto schade'],
  },
  // 97. Goed werknemerschap / goed werkgeverschap
  {
    patterns: [/\bgoed\s*werknemerschap/i, /\bgoed\s*werkgeverschap/i, /\b(?:art\.?\s*)?7:611\b/i, /\bredelijkheid\s*(?:en\s*)?billijkheid/i, /\bfatsoenlijk\s*(?:werkgever|behandel)/i, /\bonredelijk\s*(?:van\s*)?(?:de\s*)?werkgever/i, /\bwerkgever\s*(?:is\s*)?onredelijk/i],
    terms: ['goed werkgeverschap', 'goed werknemerschap', 'art. 7:611', 'redelijkheid en billijkheid', 'aanvullende werking', 'beperkende werking', 'Stoof/Mammoet'],
  },
  // 98. Bedenktermijn VSO / ontbinding
  {
    patterns: [/\bbedenktermijn/i, /\b(?:14|veertien)\s*dagen\s*(?:bedenk|terug|herroep)/i, /\bherroep(?:ing|en|ingsrecht)/i, /\bterugkom(?:en|ing)\s*(?:op\s*)?(?:de\s*)?(?:vso|vaststellings)/i, /\bontbinding\s*(?:terug|herroep)/i, /\bnog\s*terug\s*(?:kunnen\s*)?komen/i],
    terms: ['bedenktermijn', 'art. 7:670b lid 2', 'herroepingsrecht', 'veertien dagen', 'schriftelijke herroeping', 'informatieplicht werkgever bedenktermijn', 'nieuwe bedenktermijn'],
  },
  // 99. Aanzegverplichting / aanzegtermijn
  {
    patterns: [/\baanzeg(?:g)?(?:verplichting|termijn|vergoeding)/i, /\baanzegg?en\b/i, /\bniet\s*(?:tijdig\s*)?(?:aan)?gezegd/i, /\b(?:een|1)\s*maand\s*(?:voor\s*)?(?:einde|afloop)/i, /\bcontract\s*loopt\s*af/i, /\bverlenging\s*(?:niet\s*)?(?:aangeboden|medegedeeld)/i],
    terms: ['aanzegverplichting', 'art. 7:668', 'aanzegvergoeding', 'aanzegtermijn', 'een maand', 'bepaalde tijd', 'schadevergoeding aanzegging'],
  },
  // 100. Non-actiefstelling en vrijstelling van werk (detail)
  {
    patterns: [/\bvrijstelling\s*(?:van\s*)?werkzaamheden/i, /\bgarden\s*leave/i, /\btuin(?:verlof|leave)/i, /\bvrijgesteld\s*(?:van\s*)?werk/i, /\bniet\s*meer\s*(?:hoeven\s*)?(?:te\s*)?werken\s*(?:in\s*)?(?:de\s*)?opzegtermijn/i],
    terms: ['vrijstelling van werk', 'garden leave', 'loondoorbetaling', 'art. 7:628', 'concurrentiebeding vrijstelling', 'goed werkgeverschap', 'wedertewerkstellingsvordering'],
  },

  // ===== PROCESSUEEL EN PROCEDURES =====

  // 101. UWV-procedure (ontslagvergunning)
  {
    patterns: [/\buwv-?procedure/i, /\bontslagvergunning/i, /\buwv\s*(?:ontslagaanvraag|toestemming|vergunning)/i, /\btoestemming\s*(?:uwv|ontslagaanvraag)/i, /\bontslagaanvraag\b/i, /\buwv\s*werkbedrijf/i],
    terms: ['UWV-procedure', 'ontslagvergunning', 'Uitvoeringsregels ontslag', 'ontslagaanvraag', 'verweer UWV-procedure', 'opzeggen na toestemming', 'art. 7:671a'],
  },
  // 102. Hoger beroep arbeidsrecht
  {
    patterns: [/\bhoger\s*beroep/i, /\bappel\b/i, /\bcassatie/i, /\bgerechtshof/i, /\bhoge\s*raad/i, /\bberoep\s*(?:instellen|aantekenen)/i, /\brechtsmiddel/i],
    terms: ['hoger beroep', 'art. 7:683', 'gerechtshof', 'cassatie', 'Hoge Raad', 'appeltermijn', 'drie maanden', 'herstel arbeidsovereenkomst', 'billijke vergoeding hoger beroep'],
  },
  // 103. Mediation arbeidsconflict
  {
    patterns: [/\bmediation/i, /\bmediator\b/i, /\bbemiddeling\s*(?:arbeids)?conflict/i, /\bgesprek\s*(?:onder\s*)?begeleiding/i, /\bconflictbemiddeling/i, /\bexit-?mediation/i],
    terms: ['mediation', 'mediator', 'arbeidsconflict', 'verstoorde arbeidsverhouding', 'mediationclausule', 'geheimhouding mediation', 'pre-mediation'],
  },
  // 104. Verzoekschriftprocedure arbeidsrecht
  {
    patterns: [/\bverzoekschrift(?:procedure)?/i, /\bverweerschrift\b/i, /\bmondelinge\s*behandeling/i, /\bzitting\s*(?:kantonrechter|rechtbank)/i, /\bprocedure\s*(?:bij\s*)?(?:de\s*)?(?:kanton)?rechter/i, /\btegenverzoek/i],
    terms: ['verzoekschriftprocedure', 'verweerschrift', 'mondelinge behandeling', 'tegenverzoek', 'nevenverzoeken', 'art. 7:686a', 'proceskosten arbeidsrecht'],
  },

  // ===== SPECIFIEKE SITUATIES EN DOELGROEPEN =====

  // 105. Zwangerschap en werk / zwangerschapsdiscriminatie
  {
    patterns: [/\bzwanger\s*(?:en|op)\s*(?:het\s*)?werk/i, /\bzwangerschap(?:s)?(?:discriminatie|verlof|uitkering)/i, /\bontslag\s*(?:tijdens|vanwege)\s*zwangerschap/i, /\bzwangerschaps-?\s*(?:en\s*)?(?:bevallingsuitkering|verlof)/i, /\bwazo\s*(?:zwanger|bevalling)/i, /\bamning/i],
    terms: ['zwangerschap', 'opzegverbod zwangerschap', 'art. 7:670 lid 2', 'zwangerschapsdiscriminatie', 'WAZO', 'zwangerschapsverlof', 'bevallingsverlof', 'risicoverlof'],
  },
  // 106. Vakbond / lidmaatschap en bescherming
  {
    patterns: [/\bvakbond/i, /\bvakvereniging/i, /\bfnv\b/i, /\bcnv\b/i, /\bvakbondslidmaatschap/i, /\bstaking/i, /\bcollectieve?\s*actie/i, /\bstakingsrecht/i],
    terms: ['vakbond', 'vakvereniging', 'stakingsrecht', 'art. 6 lid 4 ESH', 'collectieve actie', 'ontslagbescherming vakbondslid', 'CAO-onderhandelingen'],
  },
  // 107. Wet werk en inkomen naar arbeidsvermogen (WIA) detail
  {
    patterns: [/\bwia\s*(?:aanvraag|keuring|beoordeling|uitkering)/i, /\bwga-?(?:uitkering|loonaanvulling|vervolguitkering)/i, /\biva-?uitkering/i, /\b(?:35|vijfendertig)\s*(?:procent|%)\s*(?:arbeids)?ongeschikt/i, /\bwia-?beschikking/i, /\bbezwaar\s*(?:tegen\s*)?(?:wia|uwv)/i],
    terms: ['WIA', 'WGA', 'IVA', 'WGA-loonaanvulling', 'WGA-vervolguitkering', 'art. 4 WIA', 'arbeidsongeschiktheidsbeoordeling', 'bezwaar WIA-beschikking', '35-min'],
  },
  // 108. Detentie / strafrechtelijke veroordeling en ontslag
  {
    patterns: [/\bdetentie/i, /\bgevangenis/i, /\bstrafrechtelijk/i, /\bveroordeel/i, /\bvog\b/i, /\bverklaring\s*(?:omtrent|van)\s*(?:het\s*)?gedrag/i, /\bantecedent/i, /\bstrafbaar\s*feit\s*(?:en\s*)?(?:werk|ontslag)/i],
    terms: ['detentie', 'ontslag wegens detentie', 'VOG', 'verklaring omtrent het gedrag', 'strafrechtelijke veroordeling', 'h-grond', 'art. 7:669 lid 3 sub h', 'dringende reden'],
  },
  // 109. Arbobeleidsmaatregelen / RI&E / preventiemedewerker
  {
    patterns: [/\barbo(?:wet|beleid|dienst)?/i, /\bri&?e\b/i, /\brisico-?inventarisatie/i, /\bpreventiemedewerker/i, /\bveiligheid\s*(?:en\s*)?gezondheid/i, /\barbeidsinspectie/i, /\bnla\b/i, /\bgevaarlijke\s*(?:stoffen|situatie)/i],
    terms: ['Arbowet', 'RI&E', 'risico-inventarisatie en -evaluatie', 'preventiemedewerker', 'arbodienst', 'Nederlandse Arbeidsinspectie', 'art. 3 Arbowet', 'zorgplicht werkgever'],
  },
  // 110. Werktijdverkorting / deeltijd-WW / noodmaatregelen
  {
    patterns: [/\bwerktijdverkorting/i, /\bwtv\b/i, /\bdeeltijd-?ww/i, /\bnow\b/i, /\bnoodmaatregel\s*overbrugging/i, /\bcrisis\s*(?:regeling|maatregel)/i, /\bkorte?\s*werktijd/i],
    terms: ['werktijdverkorting', 'Noodmaatregel Overbrugging Werkgelegenheid', 'NOW', 'deeltijd-WW', 'ontheffing werktijdverkorting', 'loonkostensubsidie'],
  },
  // 111. Inlenersaansprakelijkheid / ketenaansprakelijkheid
  {
    patterns: [/\binlenersaansprakelijkheid/i, /\bketenaansprakelijkheid/i, /\baansprakelijkheid\s*(?:inlener|opdrachtgever|hoofd(?:aannemer)?)/i, /\bwka\b/i, /\bwaadi\b/i, /\bg-?rekening/i, /\bverklaring\s*betalingsgedrag/i],
    terms: ['inlenersaansprakelijkheid', 'ketenaansprakelijkheid', 'WAADI', 'WKA', 'g-rekening', 'verklaring betalingsgedrag', 'hoofdelijke aansprakelijkheid loon'],
  },
  // 112. Gelijkwaardige voorziening (pensioen/CAO)
  {
    patterns: [/\bgelijkwaardig(?:e)?\s*voorziening/i, /\bafwijking\s*(?:bij\s*)?cao/i, /\bdriekwart\s*(?:dwingend|regeling)/i, /\bsemidwingend/i, /\bafwijking\s*(?:bij\s*)?overeenkomst/i],
    terms: ['gelijkwaardige voorziening', 'driekwart dwingend recht', 'semi-dwingend recht', 'afwijking bij CAO', 'art. 7:668a lid 5'],
  },
  // 113. Werknemersverzoek / initiatief werknemer
  {
    patterns: [/\bwerknemer\s*(?:vraagt|verzoekt|wil)\s*(?:om\s*)?ontbinding/i, /\bself\s*(?:ontslag|resign)/i, /\bzelf\s*(?:ontslag|opstappen|vertrekken)/i, /\beigen\s*(?:ontslag|initiatief)/i, /\bopzeggen\s*(?:door|als)\s*(?:de\s*)?werknemer/i, /\bneem\s*(?:ik\s*)?ontslag/i],
    terms: ['opzegging door werknemer', 'art. 7:671', 'ontbindingsverzoek werknemer', 'art. 7:671c', 'opzegtermijn werknemer', 'WW-risico', 'verwijtbare werkloosheid', 'dringende reden werknemer'],
  },
  // 114. Onbereikbaarheid / niet op komen dagen
  {
    patterns: [/\bonbereikbaar/i, /\bniet\s*(?:meer\s*)?bereikbaar/i, /\bspoorloos/i, /\bvermist/i, /\bcontact\s*(?:kwijt|verloren|verbroken)/i, /\bniet\s*(?:op\s*komen\s*)?dagen/i, /\bno.?show\s*werk/i],
    terms: ['ongeoorloofde afwezigheid', 'werkweigering', 'dringende reden', 'art. 7:678', 'loonopschorting', 'loonstop', 'art. 7:629 lid 3'],
  },
  // 115. Verschil bepaalde en onbepaalde tijd
  {
    patterns: [/\bbepaalde\s*(?:vs|versus|of|en)\s*onbepaalde\s*tijd/i, /\bverschil\s*(?:tussen\s*)?(?:bepaalde|vaste)\s*(?:en\s*)?(?:onbepaalde|tijdelijk)/i, /\bvast\s*contract\b/i, /\bvaste?\s*(?:dienst|aanstelling|baan)\b/i, /\bonbepaalde\s*tijd/i, /\btijdelijk\s*(?:naar|worden|omzetten)\s*vast/i],
    terms: ['arbeidsovereenkomst bepaalde tijd', 'arbeidsovereenkomst onbepaalde tijd', 'ketenregeling', 'art. 7:668a', 'conversie', 'vast contract', 'opvolgend werkgeverschap'],
  },
  // 116. Loonstrook / specificatie / onderbetaling
  {
    patterns: [/\bloonstrook/i, /\bloonspecificatie/i, /\bloon\s*(?:te\s*)?laag/i, /\bonderbetal/i, /\bminimum\s*loon/i, /\bwml\b/i, /\bwettelijk\s*minimumloon/i, /\bniet\s*(?:het\s*)?juiste?\s*(?:loon|salaris)/i],
    terms: ['loonspecificatie', 'art. 7:626', 'minimumloon', 'Wet minimumloon', 'WML', 'onderbetaling', 'loonvordering', 'wettelijke verhoging', 'art. 7:625'],
  },
  // 117. Pensioenontslag en doorwerken na AOW
  {
    patterns: [/\bdoorwerken\s*(?:na\s*)?(?:aow|pensioen|65|67)/i, /\b(?:na\s*)?aow\s*(?:door)?werken/i, /\bpensioen\s*(?:maar\s*)?(?:doorwerk|wil\s*blijven)/i, /\bcontract\s*(?:na\s*)?(?:aow|pensioen)/i, /\bwet\s*(?:werken\s*)?na\s*(?:de\s*)?aow/i],
    terms: ['doorwerken na AOW', 'Wet werken na de AOW-gerechtigde leeftijd', 'pensioenontslag', 'art. 7:669 lid 4', 'loondoorbetaling ziekte AOW', '13 weken', 'ketenregeling AOW'],
  },
  // 118. Recht op werk / wedertewerkstelling
  {
    patterns: [/\brecht\s*(?:op\s*)?(?:werk|arbeid)/i, /\bwedertewerkstelling/i, /\btewerkgesteld/i, /\bwerk\s*(?:eis|vorderen|afdwingen)/i, /\bwerknemer\s*(?:wil|eist)\s*(?:terug\s*)?werken/i, /\bniet\s*(?:mogen|kunnen)\s*werken\s*(?:terwijl|maar)/i],
    terms: ['recht op arbeid', 'wedertewerkstellingsvordering', 'art. 7:611', 'goed werkgeverschap', 'kort geding', 'identiteitswaarde arbeid'],
  },
  // 119. Ontslag en leeftijd / WGBL
  {
    patterns: [/\bontslag\s*(?:vanwege|wegens|om)\s*(?:mijn\s*)?leeftijd/i, /\bleeftijd(?:s)?(?:discriminatie|ontslag)/i, /\bte\s*oud\s*(?:voor|om)/i, /\bjong(?:ere)?\s*(?:werknemer|collega)\s*(?:voorkeur|aangenomen)/i, /\boud\s*(?:voor|om)\s*(?:te\s*)?(?:werk|sollicit)/i],
    terms: ['leeftijdsdiscriminatie', 'WGBL', 'Wet gelijke behandeling op grond van leeftijd', 'verboden onderscheid', 'objectieve rechtvaardiging', 'College voor de Rechten van de Mens'],
  },
  // 120. Ziekmelding / procedure en rechten
  {
    patterns: [/\bziekmelding/i, /\bziek\s*(?:ge)?meld/i, /\bhoe\s*(?:moet\s*ik\s*)?(?:me\s*)?ziekmelden/i, /\bte\s*laat\s*(?:ziek\s*)?(?:ge)?meld/i, /\bwerkgever\s*(?:accepteert|gelooft)\s*(?:niet|geen)\s*(?:ziek|ziekte)/i, /\barbeids(?:on)?geschikt\s*(?:of\s*)?niet/i],
    terms: ['ziekmelding', 'verzuimprotocol', 'controlevoorschriften', 'art. 7:629 lid 3', 'loonopschorting', 'bedrijfsarts', 'deskundigenoordeel', 'art. 7:629a'],
  },

  // ===== MEER INFORMELE VARIANTEN EN SITUATIES =====

  // 121. Ontslag met wederzijds goedvinden (informeel)
  {
    patterns: [/\bin\s*goed\s*overleg\s*(?:uit\s*elkaar|stoppen)/i, /\bonderling\s*(?:regelen|afspreken)/i, /\bregeling\s*treffen/i, /\bbuitengerechtelijk\s*(?:regelen|oplossen)/i, /\bmet\s*een\s*regeling\s*(?:weg|vertrekken)/i, /\bdealen?\b/i, /\bwegsturen\s*(?:met\s*)?(?:een\s*)?(?:zak\s*)?geld/i],
    terms: ['vaststellingsovereenkomst', 'wederzijds goedvinden', 'bedenktermijn', 'art. 7:670b', 'onderhandeling', 'finale kwijting', 'transitievergoeding'],
  },
  // 122. Concurrentiebeding tijdelijk contract (na WAB)
  {
    patterns: [/\bconcurrentiebeding\s*(?:bij\s*)?(?:tijdelijk|bepaalde\s*tijd)/i, /\btijdelijk\s*(?:contract\s*)?(?:met\s*)?concurrentiebeding/i, /\bconcurrentiebeding\s*(?:bepaalde\s*tijd|flex)/i, /\bbeperkend\s*beding\s*(?:bij\s*)?(?:tijdelijk|bepaalde)/i],
    terms: ['concurrentiebeding bepaalde tijd', 'art. 7:653 lid 2', 'zwaarwegende bedrijfs- of dienstbelangen', 'schriftelijke motivering', 'nietigheid concurrentiebeding'],
  },
  // 123. Reorganisatie en herplaatsing
  {
    patterns: [/\bherplaats(?:ing|en|baar)/i, /\bpassende?\s*(?:functie|werk)/i, /\bherplaatsingsinspanning/i, /\bgeen\s*(?:andere|passende)\s*(?:functie|plek)/i, /\bander(?:e)?\s*(?:functie|werk)\s*(?:aan)?(?:ge)?boden/i],
    terms: ['herplaatsing', 'herplaatsingsplicht', 'passende functie', 'art. 7:669 lid 1', 'redelijke termijn', 'scholing', 'herplaatsingsinspanning werkgever'],
  },
  // 124. Opvolgend werkgeverschap
  {
    patterns: [/\bopvolgend\s*werkgever/i, /\bzelfde\s*werk\s*(?:ander|nieuw)\s*(?:werkgever|bedrijf)/i, /\bdoorstart\s*(?:na\s*)?faillissement/i, /\bovergenomen\s*(?:door\s*)?(?:ander|nieuw)\s*(?:bedrijf|werkgever)/i, /\binsight\s*(?:share|toets)/i],
    terms: ['opvolgend werkgeverschap', 'art. 7:668a lid 2', 'ketenregeling opvolgend werkgever', 'proeftijdverbod', 'doorstart', 'overgang van onderneming'],
  },
  // 125. Verval en verjaring / te laat procederen
  {
    patterns: [/\bte\s*laat\s*(?:ge)?(?:procedeerd|gevorder|actie\s*ondernomen)/i, /\bvervallen?\b/i, /\bverjaard?\b/i, /\b(?:2|twee)\s*maanden\s*(?:termijn|vervaltermijn)/i, /\b(?:3|drie)\s*maanden\s*(?:termijn|vervaltermijn)/i, /\bnog\s*(?:op\s*)?tijd/i, /\btijdig\s*(?:actie|procedure|vordering)/i],
    terms: ['vervaltermijn', 'verjaringstermijn', 'art. 7:686a lid 4', 'twee maanden vervaltermijn', 'drie maanden vervaltermijn', 'vernietiging opzegging', 'transitievergoeding vervaltermijn'],
  },
  // 126. Concurrentiebeding vernietiging / matiging
  {
    patterns: [/\bconcurrentiebeding\s*(?:vernietig|matig|opheffen|beperk|ongeldig)/i, /\bonder\s*(?:het\s*)?concurrentiebeding\s*(?:uit|vandaan)/i, /\bvan\s*(?:het\s*)?concurrentiebeding\s*af/i, /\bconcurrentiebeding\s*(?:geldig|houdt\s*dat\s*stand)/i],
    terms: ['vernietiging concurrentiebeding', 'matiging concurrentiebeding', 'art. 7:653 lid 3', 'belangenafweging', 'onbillijke benadeling', 'gehele of gedeeltelijke vernietiging', 'voorlopige voorziening concurrentiebeding'],
  },
  // 127. Werkgever gaat failliet / loongarantie
  {
    patterns: [/\bwerkgever\s*(?:gaat\s*)?failliet/i, /\bbedrijf\s*failliet/i, /\bloongarantie/i, /\buitkering\s*(?:bij\s*)?faillissement/i, /\buwv\s*(?:bij\s*)?faillissement/i, /\bcurator\s*(?:ontslag|opzeg)/i, /\bfaillissements(?:uitkering|vergoeding)/i],
    terms: ['faillissement', 'loongarantieregeling UWV', 'art. 40 Fw', 'opzegging curator', 'opzegtermijn faillissement', 'boedelvorderingen', 'preferente vordering', 'doorstart'],
  },
  // 128. Emotioneel / hulpzoekend taalgebruik
  {
    patterns: [/\bwat\s*(?:kan|moet)\s*ik\s*(?:nu\s*)?doen/i, /\bhelp\b/i, /\bwanhopig/i, /\bik\s*(?:word|ben)\s*(?:gek|gestoord|horendol)/i, /\bnergens\s*recht\s*op/i, /\bmachteloos/i, /\bsta\s*(?:ik\s*)?(?:er\s*)?alleen\s*voor/i, /\bgeen\s*(?:idee|flauw\s*benul)\s*(?:wat|hoe)/i],
    terms: ['rechtsbijstand', 'juridisch advies', 'rechtshulp', 'juridisch loket', 'advocaat arbeidsrecht', 'vakbond', 'procederen'],
  },
  // 129. Arbeidsconflict en ziekte (situatieve arbeidsongeschiktheid)
  {
    patterns: [/\bsituatieve?\s*(?:arbeids)?ongeschiktheid/i, /\bziek\s*(?:door|vanwege|van)\s*(?:het\s*)?(?:conflict|werk|stress|ruzie)/i, /\bconflict\s*(?:en|plus)\s*(?:ziek|ziekte)/i, /\bniet\s*(?:kunnen|durven)\s*(?:werken\s*)?(?:door|vanwege)\s*(?:conflict|sfeer|angst)/i],
    terms: ['situatieve arbeidsongeschiktheid', 'arbeidsconflict', 'STECR-werkwijzer', 'mediation', 'bedrijfsarts', 'deskundigenoordeel', 'loondoorbetaling', 'art. 7:629'],
  },
  // 130. Ontslag tijdens ziekte / het opzegverbod
  {
    patterns: [/\bontslag\s*(?:tijdens|bij|in)\s*(?:mijn\s*)?(?:ziekte|ziek\s*zijn)/i, /\bziek\s*(?:en\s*)?(?:ook\s*)?(?:ontslagen|ontslag)/i, /\bmag\s*(?:je\s*)?(?:iemand\s*)?ontslaan\s*(?:als|die|wanneer|bij)\s*(?:die\s*)?ziek/i, /\bopzegverbod\s*(?:tijdens\s*)?ziekte/i],
    terms: ['opzegverbod ziekte', 'art. 7:670 lid 1', 'ontslag tijdens ziekte', 'uitzonderingen opzegverbod', 'reflexwerking', 'ontbinding tijdens ziekte', 'art. 7:671b lid 6'],
  },

  // ===== NOG MEER SPECIFIEKE TOPICS =====

  // 131. Recht op deeltijdwerk / aanpassing arbeidsduur
  {
    patterns: [/\bdeeltijd/i, /\bminder\s*(?:uren|werken|dagen)/i, /\baanpassing\s*arbeidsduur/i, /\bwet\s*flexibel\s*werken/i, /\bwfw\b/i, /\bpart-?time/i, /\burenvermindering/i, /\bmeer\s*uren\s*(?:werken|willen)/i],
    terms: ['aanpassing arbeidsduur', 'Wet flexibel werken', 'deeltijdwerk', 'art. 2 Wfw', 'verzoek aanpassing', 'zwaarwegende bedrijfsbelangen', 'deeltijdontslag'],
  },
  // 132. Ontslag wegens bedrijfssluiting
  {
    patterns: [/\bbedrijfssluiting/i, /\bbedrijf\s*(?:sluit|stopt|gaat\s*dicht)/i, /\bsluiting\s*(?:van\s*)?(?:het\s*)?(?:bedrijf|vestiging|filiaal)/i, /\bopheffing\s*(?:van\s*)?(?:het\s*)?bedrijf/i, /\bverplaatsing\s*(?:van\s*)?(?:het\s*)?bedrijf/i],
    terms: ['bedrijfssluiting', 'bedrijfseconomische redenen', 'art. 7:669 lid 3 sub a', 'UWV-procedure', 'transitievergoeding', 'sociaal plan', 'herplaatsing'],
  },
  // 133. Geweigerde toestemming UWV / pro-forma ontbinding
  {
    patterns: [/\buwv\s*(?:geweigerd|afgewezen|niet\s*akkoord)/i, /\bpro-?forma\s*(?:ontbinding|procedure)/i, /\btoestemming\s*(?:uwv\s*)?(?:geweigerd|afgewezen)/i, /\bna\s*weigering\s*uwv/i],
    terms: ['weigering ontslagvergunning', 'pro-forma ontbinding', 'art. 7:671b', 'kantonrechter na UWV', 'herstelprocedure'],
  },
  // 134. Gratificatie / jubileumuitkering / dienstjaren
  {
    patterns: [/\bgratificatie/i, /\bjubileum(?:uitkering)?/i, /\bdienstjubileum/i, /\bdienstjaren\s*(?:beloning|uitkering)/i, /\bjaren\s*(?:in\s*)?dienst\s*(?:beloning|bonus)/i, /\bloyaliteitsbonus/i],
    terms: ['gratificatie', 'jubileumuitkering', 'dienstjaren', 'verworven recht', 'eenzijdige wijziging', 'bestendige gedragslijn'],
  },
  // 135. Wet arbeidsmarkt in balans (WAB) specifiek
  {
    patterns: [/\bwab\b/i, /\bwet\s*arbeidsmarkt\s*(?:in\s*)?balans/i, /\bwab-?wijziging/i, /\bcumulatie(?:grond)?\s*wab/i, /\boproep(?:kracht)?\s*wab/i, /\bpayroll\s*wab/i],
    terms: ['WAB', 'Wet arbeidsmarkt in balans', 'cumulatiegrond', 'i-grond', 'oproepovereenkomst WAB', 'payroll WAB', 'WW-premiedifferentiatie', 'schriftelijkheidsvereiste'],
  },
  // 136. Werkgever houdt zich niet aan de CAO
  {
    patterns: [/\bcao\s*(?:niet\s*)?(?:nageleefd|overtreden|geschonden)/i, /\bwerkgever\s*(?:houdt\s*(?:zich\s*)?)?niet\s*(?:aan\s*)?(?:de\s*)?cao/i, /\bcao-?naleving/i, /\bafwijking\s*(?:van\s*)?(?:de\s*)?cao/i, /\bfnv\s*(?:naleving|controle|actie)/i],
    terms: ['CAO-naleving', 'nalevingsvordering', 'incorporatiebeding', 'algemeen verbindend verklaring', 'schadevergoeding CAO', 'vakbond naleving'],
  },
  // 137. Overeenkomst van opdracht vs arbeidsovereenkomst
  {
    patterns: [/\bovereenkomst\s*(?:van\s*)?opdracht/i, /\bopdracht(?:gever|nemer)/i, /\bverschil\s*(?:tussen\s*)?(?:opdracht|zzp)\s*(?:en\s*)?(?:arbeids)?(?:overeenkomst|contract)/i, /\b(?:art\.?\s*)?7:400/i, /\bfictieve?\s*dienstbetrekking/i],
    terms: ['overeenkomst van opdracht', 'art. 7:400', 'arbeidsovereenkomst', 'art. 7:610', 'kwalificatie arbeidsrelatie', 'gezagsverhouding', 'fictieve dienstbetrekking', 'schijnzelfstandigheid'],
  },
  // 138. Getuigen / bewijs in arbeidszaken
  {
    patterns: [/\bgetuige(?:n)?(?:bewijs|verklaring|verhoor)?/i, /\bbewijs(?:last|positie|middel)/i, /\bwhatsapp\s*(?:als\s*)?bewijs/i, /\be-?mail\s*(?:als\s*)?bewijs/i, /\bopname\s*(?:als\s*)?bewijs/i, /\bstiekem\s*opgenomen/i, /\bbewijs\s*(?:verzamelen|vergaren)/i],
    terms: ['bewijslast', 'bewijsmiddelen', 'getuigenbewijs', 'WhatsApp-berichten bewijs', 'heimelijke opname', 'onrechtmatig bewijs', 'vrije bewijsleer'],
  },
  // 139. Arbeidstijdenwet / nachtwerk / rustperioden
  {
    patterns: [/\bnachtwerk/i, /\bnachtdienst\s*(?:recht|vergoeding|weigeren)/i, /\brusttijd\s*(?:tussen|na|voor)/i, /\b(?:11|elf)\s*uur(?:s)?\s*(?:rust|pauze)/i, /\bpauze(?:recht|regeling|tijd)/i, /\bmaximale?\s*(?:werk)?(?:uur|uren|tijd)\s*(?:per\s*)?(?:dag|week)/i],
    terms: ['Arbeidstijdenwet', 'nachtarbeid', 'rusttijd', 'pauze', 'maximale arbeidstijd', 'art. 5:8 ATW', 'art. 5:3 ATW', 'zondagsarbeid'],
  },
  // 140. Mantelzorg en werk
  {
    patterns: [/\bmantelzorg/i, /\bmantelzorger/i, /\bzorg\s*(?:voor\s*)?(?:ziek\s*)?(?:kind|ouder|partner|familielid)/i, /\bkortdurend\s*zorgverlof/i, /\blangdurend\s*zorgverlof/i, /\bverlof\s*(?:voor\s*)?mantelzorg/i],
    terms: ['mantelzorg', 'kortdurend zorgverlof', 'langdurend zorgverlof', 'WAZO', 'calamiteitenverlof', 'art. 5:1 WAZO', 'art. 5:9 WAZO'],
  },

  // ===== EXTRA INFORMELE / SITUATIE-GEBASEERDE VARIANTEN =====

  // 141. "Ik word gepest op het werk"
  {
    patterns: [/\bgepest\s*(?:op\s*)?(?:het\s*)?werk/i, /\bpesten\s*(?:op\s*)?(?:de\s*)?(?:werk(?:plek|vloer))?/i, /\bmobbing/i, /\btreiteren/i, /\bbuitengesloten\s*(?:door\s*)?(?:collega|team)/i, /\bsociale?\s*isolatie\s*(?:op\s*)?werk/i, /\bvernedering/i],
    terms: ['pesten op het werk', 'psychosociale arbeidsbelasting', 'art. 3 Arbowet', 'zorgplicht werkgever', 'art. 7:658', 'grensoverschrijdend gedrag', 'klacht', 'vertrouwenspersoon'],
  },
  // 142. "Mijn werkgever betaalt niet" / loonvordering
  {
    patterns: [/\bbetaalt?\s*(?:mij\s*)?niet/i, /\bgeen\s*(?:loon|salaris)\s*(?:ontvangen|gekregen|betaald)/i, /\bloon\s*(?:niet\s*)?(?:be)?taald/i, /\bachterstall?ig\s*(?:loon|salaris)/i, /\bloon\s*te\s*laat/i, /\bsalaris\s*(?:nog\s*)?(?:steeds\s*)?niet/i],
    terms: ['loonvordering', 'art. 7:616', 'wettelijke verhoging', 'art. 7:625', 'wettelijke rente', 'incassokosten', 'kort geding loonvordering'],
  },
  // 143. "Mag mijn werkgever mij controleren" / surveillance
  {
    patterns: [/\bmag\s*(?:mijn\s*)?werkgever\s*(?:mij\s*)?(?:controleren|volgen|monitoren|bespioneren)/i, /\bcontrole\s*(?:door\s*)?werkgever/i, /\bkeylogger/i, /\bscreen(?:shot|monitoring)/i, /\btelefoon\s*(?:afluisteren|controleren|uitlezen)/i, /\bsurveillance\s*(?:op\s*)?werk/i, /\bprive\s*(?:telefoon|laptop|e-?mail)\s*(?:werkgever|controleren)/i],
    terms: ['controle werknemer', 'privacy werknemer', 'AVG', 'gerechtvaardigd belang', 'proportionaliteit', 'subsidiariteit', 'Europees Hof Barbulescu', 'monitoring werkplek'],
  },
  // 144. Uitsluiting van werk / schadelijk gedrag werkgever
  {
    patterns: [/\bbuitensluiting/i, /\bgeisoleerd/i, /\bgeen\s*werk\s*(?:meer\s*)?(?:krijgen|krijg|gekregen)/i, /\bleegloop/i, /\bniets\s*(?:meer\s*)?(?:te\s*)?doen\s*(?:op\s*)?werk/i, /\btaken\s*(?:af)?genomen/i, /\bfunctie\s*(?:uitgehold|leeg(?:gehaald)?)/i],
    terms: ['uitsluiting', 'leegloop', 'functie-uitholling', 'goed werkgeverschap', 'art. 7:611', 'wedertewerkstellingsvordering', 'ernstig verwijtbaar werkgever', 'billijke vergoeding'],
  },
  // 145. Relatie op het werk / romantische relatie collega
  {
    patterns: [/\brelatie\s*(?:op\s*)?(?:het\s*)?werk/i, /\brelatie\s*(?:met\s*)?(?:collega|leidinggevende|chef|baas)/i, /\bliefdesrelatie\s*werk/i, /\bsamenwerkingsverbod/i, /\bantiroulatie/i, /\banti-?relatie/i, /\bpartner\s*(?:op\s*)?werk/i],
    terms: ['relatie op het werk', 'instructierecht', 'art. 7:660', 'privacy werknemer', 'overplaatsing', 'belangenverstrengeling', 'gedragscode'],
  },
  // 146. Social media en ontslag / online gedrag
  {
    patterns: [/\bsocial\s*media\s*(?:en\s*)?(?:ontslag|werk)/i, /\bfacebook\s*(?:bericht|post|ontslag)/i, /\btwitter\s*(?:bericht|ontslag)/i, /\blinkedin\s*(?:bericht|ontslag)/i, /\bonline\s*(?:gedrag|uitlating|uitspraak)\s*(?:en\s*)?(?:ontslag|werk)/i, /\buitlating\s*(?:op\s*)?(?:social|internet)/i],
    terms: ['social media ontslag', 'uitingsvrijheid werknemer', 'dringende reden', 'verwijtbaar handelen', 'goed werknemerschap', 'art. 7:611', 'vrijheid van meningsuiting', 'art. 10 EVRM'],
  },
  // 147. Zieke werknemer en vakantie
  {
    patterns: [/\bziek\s*(?:en|op|tijdens)\s*vakantie/i, /\bvakantie\s*(?:tijdens|bij)\s*(?:ziekte|ziek)/i, /\bvakantiedagen\s*(?:tijdens|bij|en)\s*(?:ziekte|ziek)/i, /\bopbouw\s*vakantie(?:dagen)?\s*(?:tijdens|bij)\s*(?:ziekte|ziek)/i, /\bop\s*vakantie\s*(?:als|terwijl|wanneer)\s*(?:je\s*)?ziek/i],
    terms: ['vakantiedagen ziekte', 'opbouw vakantiedagen ziekte', 'art. 7:637', 'art. 7:638', 'minimum vakantiedagen ziekte', 'bovenwettelijke dagen ziekte', 'ziek op vakantie'],
  },
  // 148. Ouderschapsverlof detail (betaald/onbetaald)
  {
    patterns: [/\bouderschapsverlof\s*(?:betaald|onbetaald|uitkering|aanvragen)/i, /\bbetaald\s*ouderschapsverlof/i, /\bwazo\s*ouderschaps/i, /\b(?:9|negen)\s*weken\s*(?:betaald\s*)?ouderschaps/i, /\brecht\s*(?:op\s*)?ouderschapsverlof/i],
    terms: ['ouderschapsverlof', 'betaald ouderschapsverlof', 'WAZO', 'art. 6:1 WAZO', 'UWV-uitkering ouderschapsverlof', '9 weken betaald', '70% dagloon'],
  },
  // 149. Relocation / verhuisplicht / standplaatswijziging
  {
    patterns: [/\bverhuisplicht/i, /\bverhuizen\s*(?:voor\s*)?(?:het\s*)?werk/i, /\bstandplaats(?:wijziging)?/i, /\bkantoor\s*(?:ver)?(?:huist|plaatst)/i, /\boveplaatsing\b/i, /\bgedwongen\s*(?:ver)?huiz/i, /\bverhuiskosten(?:vergoeding)?/i],
    terms: ['standplaatswijziging', 'overplaatsing', 'art. 7:613', 'eenzijdig wijzigingsbeding', 'Stoof/Mammoet', 'redelijk voorstel', 'verhuiskostenvergoeding'],
  },
  // 150. Uitbetaling niet-genoten vakantiedagen bij einde
  {
    patterns: [/\buitbetaling\s*vakantie(?:dagen)?/i, /\bvakantiedagen\s*(?:uitbet|uitkeren|geld)/i, /\bniet-?genoten\s*(?:vakantie)?dagen/i, /\bvakantiedagen\s*(?:bij\s*)?(?:einde|ontslag|uit\s*dienst)/i, /\btegoed\s*(?:aan\s*)?vakantiedagen/i],
    terms: ['uitbetaling vakantiedagen', 'art. 7:641', 'niet-genoten vakantiedagen', 'eindafrekening', 'vervaltermijn vakantiedagen', 'bovenwettelijke vakantiedagen'],
  },

  // ===== MODERNE WERKPLEK =====

  // 151. AI / algoritmes op de werkvloer
  {
    patterns: [/\b(?:ai|kunstmatige\s*intelligentie)\s*(?:op\s*)?(?:de\s*)?(?:werk|werkvloer)/i, /\balgoritm(?:e|isch)\s*(?:management|aansturing|beslissing|selectie)/i, /\bai\s*(?:bij\s*)?(?:sollicitatie|werving|selectie|ontslag|beoordeling)/i, /\bchatgpt\s*(?:op\s*)?werk/i, /\bautomatische?\s*(?:besluit|beslissing)(?:vorming)?/i, /\bai-?tool\s*(?:op\s*)?werk/i],
    terms: ['AI op de werkvloer', 'algoritmisch management', 'AVG', 'geautomatiseerde besluitvorming', 'art. 22 AVG', 'menselijke tussenkomst', 'EU AI Act', 'transparantie algoritme'],
  },
  // 152. Quiet quitting / stille ontkoppeling
  {
    patterns: [/\bquiet\s*quitting/i, /\bstille?\s*(?:ontkoppel|ontslag)/i, /\bminimum\s*(?:doen|presteren|werken)/i, /\balleen\s*(?:doen\s*)?(?:wat|waarvoor)\s*(?:ik\s*)?(?:betaald|moet)/i, /\bgeen\s*extra\s*(?:inzet|moeite)/i, /\bact\s*(?:your\s*)?wage/i, /\bniet\s*meer\s*(?:gemotiveerd|betrokken)/i],
    terms: ['goed werknemerschap', 'art. 7:611', 'instructierecht', 'art. 7:660', 'functieomschrijving', 'disfunctioneren', 'verbetertraject'],
  },
  // 153. Digitale nomaden / werken vanuit het buitenland
  {
    patterns: [/\bdigitale?\s*nomad/i, /\bwerken\s*(?:vanuit|in)\s*(?:het\s*)?buitenland/i, /\bremote\s*(?:werken\s*)?(?:vanuit|in)\s*(?:het\s*)?buitenland/i, /\bworkation/i, /\bwerk(?:en)?\s*(?:vanuit|in)\s*(?:spanje|portugal|thailand|bali|griekenland)/i, /\bwerken\s*(?:op\s*)?afstand\s*(?:vanuit\s*)?(?:het\s*)?buitenland/i],
    terms: ['werken vanuit buitenland', 'sociale zekerheid', 'A1-verklaring', 'belastingplicht', 'Rome I-Verordening', 'toepasselijk recht', 'thuiswerkland', 'Raamovereenkomst telewerk'],
  },
  // 154. Platformwerk uitbreiding / gig-economie rechten
  {
    patterns: [/\bgig\s*(?:werk|worker|economie|economy)/i, /\bplatform(?:werk|arbeid)(?:er)?\s*(?:recht|bescherm|status)/i, /\bbezorger\s*(?:recht|status|werknemer|zzp)/i, /\bmaaltijdbezorg/i, /\btaxichauffeur\s*(?:app|platform|zzp)/i, /\beu-?richtlijn\s*platform/i, /\brechtsvermoeden\s*platform/i],
    terms: ['platformarbeid', 'EU-richtlijn platformwerk', 'rechtsvermoeden arbeidsovereenkomst', 'art. 7:610a', 'Deliveroo-arrest', 'algoritmisch management', 'schijnzelfstandigheid', 'bewijsvermoeden platformwerk'],
  },
  // 155. Remote monitoring / digitale controle werknemers
  {
    patterns: [/\bremote\s*monitor/i, /\bdigitale?\s*(?:controle|surveillance|toezicht)/i, /\bemployee\s*monitor/i, /\bscreen\s*(?:monitoring|recording|capture)/i, /\bkeylogg/i, /\bwebcam\s*(?:controle|aan|verplicht)/i, /\bmuis(?:beweging|activiteit)\s*(?:bijhouden|track|volg)/i, /\bbossware/i],
    terms: ['digitale monitoring', 'privacy werknemer', 'AVG', 'gerechtvaardigd belang', 'proportionaliteit', 'subsidiariteit', 'DPIA', 'gegevensbeschermingseffectbeoordeling', 'instemmingsrecht OR', 'art. 27 WOR'],
  },
  // 156. Werkdruk / psychosociale arbeidsbelasting (PSA)
  {
    patterns: [/\bpsychosociale?\s*arbeidsbelasting/i, /\bpsa\b/i, /\bwerkdruk\s*(?:te\s*)?hoog/i, /\bwerk(?:stress|belasting|druk)\s*(?:klacht|melding)/i, /\bte\s*(?:veel|hoge?)\s*werkdruk/i, /\bonredelijke?\s*werkdruk/i, /\bstructurele?\s*overbelast/i, /\bri&?e\s*(?:psa|werkdruk)/i],
    terms: ['psychosociale arbeidsbelasting', 'PSA', 'Arbowet', 'art. 3 Arbowet', 'RI&E', 'werkdruk', 'arbeidsinspectie', 'zorgplicht werkgever', 'burn-out preventie', 'plan van aanpak werkdruk'],
  },
  // 157. Recht op onbereikbaarheid / disconnectie
  {
    patterns: [/\brecht\s*(?:op\s*)?onbereikbaarheid/i, /\bonbereikbaar(?:heid)?\s*(?:buiten\s*)?(?:werk|kantoor)/i, /\bdisconnect(?:ie|ierecht)/i, /\brecht\s*(?:om\s*)?(?:niet\s*)?(?:te\s*)?bereikbaar/i, /\b(?:s\s*avonds|weekend|vakantie)\s*(?:niet\s*)?(?:bereikbaar|mailen|bellen|appen)/i, /\bverplicht\s*(?:bereikbaar|telefoon\s*aan)/i, /\b(?:mail|app|whatsapp)\s*(?:buiten\s*)?(?:werk)?(?:tijd|uren)/i],
    terms: ['recht op onbereikbaarheid', 'disconnectierecht', 'Arbeidstijdenwet', 'rusttijd', 'art. 7:611', 'goed werkgeverschap', 'Wet flexibel werken', 'SER-advies', 'instemmingsrecht OR'],
  },
  // 158. Hybride werken / thuiswerkbeleid
  {
    patterns: [/\bhybride\s*werk(?:en|beleid|regeling|model)/i, /\bthuis(?:werk)?beleid/i, /\bkantoor(?:plicht|dagen|verplichting)/i, /\bverplicht\s*(?:op\s*)?kantoor/i, /\b(?:2|3|twee|drie)\s*dagen\s*(?:thuis|kantoor)/i, /\bterug\s*(?:naar\s*)?(?:het\s*)?kantoor/i, /\breturn\s*to\s*office/i],
    terms: ['hybride werken', 'thuiswerkbeleid', 'Wet flexibel werken', 'aanpassing arbeidsplaats', 'eenzijdig wijzigingsbeding', 'art. 7:613', 'instructierecht', 'art. 7:660', 'arbobeleid thuiswerk'],
  },
  // 159. Bring your own device (BYOD) / ICT-beleid
  {
    patterns: [/\bbyod\b/i, /\bbring\s*your\s*own\s*device/i, /\beigen\s*(?:laptop|telefoon|device)\s*(?:voor\s*)?werk/i, /\bict-?beleid/i, /\bwerk(?:telefoon|laptop)\s*(?:prive|controleren|inleveren)/i, /\bprive\s*(?:gebruik\s*)?(?:werk)?(?:laptop|telefoon)/i, /\bdata\s*(?:op\s*)?(?:prive|eigen)\s*(?:device|apparaat)/i],
    terms: ['BYOD', 'ICT-beleid', 'privacy werknemer', 'AVG', 'instructierecht', 'art. 7:660', 'eigendomsrecht', 'inleverplicht bedrijfsmiddelen', 'kostenvergoeding'],
  },
  // 160. Algoritmische aansturing / geautomatiseerd HR
  {
    patterns: [/\balgoritm(?:e|isch)\s*(?:aanstur|hr|personeels)/i, /\bgeautomatiseerde?\s*(?:hr|personeels|rooster|planning)/i, /\brobot\s*(?:baas|manager)/i, /\bai\s*(?:hr|personeels|beoordelings)/i, /\bautomatisch\s*(?:rooster|planning|beoordeling|ontslag)/i],
    terms: ['algoritmisch management', 'geautomatiseerde besluitvorming', 'art. 22 AVG', 'transparantie', 'EU AI Act', 'instemmingsrecht OR', 'art. 27 WOR', 'menselijke tussenkomst'],
  },

  // ===== MENTALE GEZONDHEID SPECIFIEK =====

  // 161. PTSD werkgerelateerd / posttraumatische stress
  {
    patterns: [/\bptsd\b/i, /\bptss\b/i, /\bposttraumatisch/i, /\btrauma\s*(?:op|door|van(?:wege)?)\s*(?:het\s*)?werk/i, /\btraumatische?\s*(?:ervaring|gebeurtenis)\s*(?:op\s*)?werk/i, /\boverval\s*(?:op\s*)?werk/i, /\bgeweld(?:sincident)?\s*(?:op\s*)?werk/i, /\bbedrijfsongeval\s*(?:en\s*)?(?:trauma|ptsd|ptss)/i],
    terms: ['PTSD werkgerelateerd', 'posttraumatische stressstoornis', 'beroepsziekte', 'art. 7:658', 'werkgeversaansprakelijkheid', 'arbeidsongeschiktheid', 'smartengeld', 'bedrijfsongeval'],
  },
  // 162. Depressie vs burnout / onderscheid psychische klachten
  {
    patterns: [/\bdepressie\s*(?:of|vs|versus|en)\s*burn-?out/i, /\bburn-?out\s*(?:of|vs|versus|en)\s*depressie/i, /\bdepressie\s*(?:op|door|van(?:wege)?)\s*(?:het\s*)?werk/i, /\bdepressief\s*(?:door|van(?:wege)?)\s*werk/i, /\bwerkgerelateerde?\s*depressie/i, /\bdepressieve?\s*(?:klacht|stoornis)\s*(?:en\s*)?werk/i],
    terms: ['depressie', 'burn-out', 'arbeidsongeschiktheid', 'loondoorbetaling ziekte', 'art. 7:629', 'bedrijfsarts', 'psychische klachten', 're-integratie', 'beroepsziekte'],
  },
  // 163. Angststoornis en werk
  {
    patterns: [/\bangststoornis\s*(?:en|op|door)\s*werk/i, /\bangst\s*(?:op|voor|van(?:wege)?)\s*(?:het\s*)?werk/i, /\bpaniek(?:aanval|stoornis)\s*(?:op|door)\s*werk/i, /\bsociale?\s*(?:angst|fobie)\s*(?:op\s*)?werk/i, /\bangst\s*(?:voor\s*)?(?:baas|werkgever|collega|werkvloer)/i],
    terms: ['angststoornis', 'arbeidsongeschiktheid', 'psychische klachten', 'bedrijfsarts', 'loondoorbetaling ziekte', 'art. 7:629', 'werkgeversaansprakelijkheid', 'art. 7:658', 're-integratie psychisch'],
  },
  // 164. Psychische revalidatie en werkhervatting
  {
    patterns: [/\bpsychische?\s*revalidatie/i, /\bwerkhervatting\s*(?:na|bij)\s*(?:psychische?|mentale?)/i, /\bterugkeer\s*(?:na\s*)?(?:psychische?|mentale?|burn-?out|depressie)/i, /\bopbouw(?:schema)?\s*(?:na\s*)?(?:burn-?out|psychisch|mentaal)/i, /\barbeidstherapeutisch\s*(?:werken|opbouw|hervatten)/i],
    terms: ['re-integratie psychische klachten', 'arbeidstherapeutisch werken', 'opbouwschema', 'bedrijfsarts', 'plan van aanpak', 'Wet verbetering poortwachter', 'belastbaarheid', 'werkhervatting'],
  },
  // 165. Werkgerelateerde stress claims / aansprakelijkheid psychisch
  {
    patterns: [/\bstress\s*claim/i, /\bschadeclaim\s*(?:werkdruk|stress|burn-?out|psychisch)/i, /\baansprakelijk(?:heid)?\s*(?:burn-?out|stress|psychisch|werkdruk)/i, /\bschade(?:vergoeding)?\s*(?:burn-?out|stress|werkdruk)/i, /\bwerkgever\s*aansprakelijk\s*(?:voor\s*)?(?:burn-?out|stress|psychisch)/i],
    terms: ['werkgeversaansprakelijkheid psychisch', 'art. 7:658', 'zorgplicht werkgever', 'psychosociale arbeidsbelasting', 'bewijslast', 'schadevergoeding burn-out', 'smartengeld', 'causaal verband'],
  },
  // 166. Arbeidsongeschiktheid psychisch / WIA psychisch
  {
    patterns: [/\barbeidsongeschikt(?:heid)?\s*psychisch/i, /\bwia\s*(?:aanvraag\s*)?(?:psychisch|mentaal|depressie|burn-?out)/i, /\bpsychische?\s*arbeidsongeschiktheid/i, /\bkeuring\s*(?:psychisch|mentaal)/i, /\bverzekeringsarts\s*(?:psychisch|mentaal)/i, /\bbeperk(?:ing|t)\s*(?:psychisch|mentaal)/i],
    terms: ['arbeidsongeschiktheid psychisch', 'WIA', 'WGA', 'IVA', 'verzekeringsarts', 'FML', 'functionele mogelijkhedenlijst', 'psychische beperkingen', 'bezwaar WIA-beschikking'],
  },
  // 167. EMDR / behandeling en werk / therapeutische afspraken
  {
    patterns: [/\bemdr\b/i, /\btherapie\s*(?:en|tijdens|onder)\s*(?:werk|werktijd)/i, /\bbehandeling\s*(?:tijdens|onder)\s*(?:werk|werktijd)/i, /\bpsycholoog\s*(?:tijdens|onder)\s*(?:werk|werktijd)/i, /\bverlof\s*(?:voor\s*)?(?:therapie|behandeling|psycholoog)/i, /\btherapeutische?\s*(?:afspraak|sessie)\s*(?:en\s*)?werk/i],
    terms: ['therapie en werk', 'behandeling werktijd', 'ziekteverzuim', 're-integratie', 'bedrijfsarts', 'plan van aanpak', 'medisch beroepsgeheim', 'privacy medische gegevens'],
  },
  // 168. Re-integratie bij psychische klachten (specifiek)
  {
    patterns: [/\bre-?integratie\s*(?:bij|na|psychisch|mentaal|burn-?out|depressie|angst)/i, /\bspoor\s*(?:1|2|een|twee)\s*(?:psychisch|mentaal|burn-?out)/i, /\bpassend\s*werk\s*(?:psychisch|mentaal)/i, /\bbelastbaarheid\s*(?:psychisch|mentaal)/i, /\bstecr\b/i, /\bwerkwijzer\s*(?:psychisch|arbeidsconflict)/i],
    terms: ['re-integratie psychische klachten', 'STECR-werkwijzer', 'belastbaarheid', 'functionele mogelijkhedenlijst', 'spoor 1', 'spoor 2', 'passend werk', 'bedrijfsarts', 'plan van aanpak'],
  },

  // ===== DIVERSITEIT & INCLUSIE =====

  // 169. Neurodiversiteit / ADHD / autisme op het werk
  {
    patterns: [/\bneurodiversiteit/i, /\badhd\s*(?:op|en|bij)\s*(?:het\s*)?werk/i, /\bautisme\s*(?:op|en|bij)\s*(?:het\s*)?werk/i, /\bautistisch\s*(?:en\s*)?werk/i, /\badd\s*(?:op|en)\s*werk/i, /\basperger\s*(?:en\s*)?werk/i, /\bdyslexie\s*(?:op|en)\s*werk/i, /\bhoogbegaafd(?:heid)?\s*(?:en|op)\s*werk/i, /\bneurodivergent/i],
    terms: ['neurodiversiteit', 'ADHD op het werk', 'autisme', 'redelijke aanpassing', 'Wet gelijke behandeling handicap', 'WGBH/CZ', 'doeltreffende aanpassing', 'discriminatie handicap', 'chronische aandoening'],
  },
  // 170. Religieuze accommodatie op het werk
  {
    patterns: [/\breligieu(?:ze|s)\s*(?:accommodatie|aanpassing|vrijheid|uiting)/i, /\bhoofdoek\s*(?:op|bij|en)\s*werk/i, /\bgebed(?:sruimte|stijd)?\s*(?:op|bij)\s*werk/i, /\bramadan\s*(?:en|op)\s*werk/i, /\breligieuze?\s*(?:feestdag|vrij|verlof|kleding)/i, /\bgeloof\s*(?:en|op)\s*(?:het\s*)?werk/i, /\bkruisje\s*(?:op|bij)\s*werk/i],
    terms: ['religieuze discriminatie', 'AWGB', 'godsdienstvrijheid', 'art. 6 Grondwet', 'art. 9 EVRM', 'redelijke aanpassing', 'indirect onderscheid', 'objectieve rechtvaardiging', 'kledingvoorschrift'],
  },
  // 171. Etnische discriminatie op het werk
  {
    patterns: [/\betnische?\s*discriminatie/i, /\bracisme\s*(?:op|bij)\s*(?:het\s*)?werk/i, /\bracistisch\s*(?:op|bij)\s*(?:het\s*)?werk/i, /\bdiscriminatie\s*(?:huidskleur|afkomst|ras|nationaliteit)/i, /\bherkomst\s*(?:discriminatie|onderscheid)/i, /\bnaam\s*(?:discriminatie|afgewezen|achternaam)/i, /\ballochto(?:on|nen)\s*(?:discriminatie|kans)/i],
    terms: ['etnische discriminatie', 'AWGB', 'rassendiscriminatie', 'art. 1 Grondwet', 'verboden onderscheid', 'College voor de Rechten van de Mens', 'indirect onderscheid', 'bewijslast discriminatie'],
  },
  // 172. LHBTQ+ rechten op de werkvloer
  {
    patterns: [/\blhbt(?:q|i|qi?\+?|iq?\+?)?\s*(?:recht|discriminatie|werk)/i, /\bhomoseksu(?:eel|aliteit)\s*(?:en\s*)?(?:werk|discriminatie|ontslag)/i, /\btransgender\s*(?:en|op)\s*(?:het\s*)?werk/i, /\bgenderidentiteit\s*(?:en\s*)?werk/i, /\bseksuele?\s*(?:geaardheid|orientatie)\s*(?:discriminatie|werk)/i, /\bcoming\s*out\s*(?:op\s*)?werk/i],
    terms: ['discriminatie seksuele geaardheid', 'AWGB', 'genderidentiteit', 'transgenderrechten', 'verboden onderscheid', 'College voor de Rechten van de Mens', 'gelijke behandeling'],
  },
  // 173. Zwangerschapsdiscriminatie specifiek
  {
    patterns: [/\bzwangerschapsdiscriminatie/i, /\bafgewezen\s*(?:vanwege|wegens|om)\s*(?:mijn\s*)?zwangerschap/i, /\bniet\s*(?:aangenomen|verlengd|bevorderd)\s*(?:vanwege|wegens|door)\s*(?:mijn\s*)?zwangerschap/i, /\bcontract\s*(?:niet\s*)?(?:verlengd\s*)?(?:vanwege|wegens)\s*zwanger/i, /\bontslag\s*(?:vanwege|wegens|door)\s*zwanger/i, /\bzwanger\s*(?:en\s*)?(?:niet\s*)?(?:aangenomen|geweigerd)/i],
    terms: ['zwangerschapsdiscriminatie', 'art. 7:646', 'opzegverbod zwangerschap', 'art. 7:670 lid 2', 'AWGB', 'gelijke behandeling', 'College voor de Rechten van de Mens', 'bewijslast discriminatie'],
  },
  // 174. Leeftijdsdiscriminatie (WGBL) detail
  {
    patterns: [/\bwgbl\s*(?:procedure|klacht|melding)/i, /\bleeftijds?(?:discriminatie|onderscheid)\s*(?:bij\s*)?(?:sollicitatie|werving|ontslag|promotie)/i, /\bte\s*(?:oud|jong)\s*(?:voor\s*)?(?:de\s*)?(?:functie|baan|werk|promotie)/i, /\bmaximum\s*leeftijd\s*(?:vacature|functie)/i, /\bjongere\s*(?:werknemer\s*)?(?:voorkeur|aangenomen|goedkoper)/i, /\b(?:50|55|60)\s*(?:plus|\+)\s*(?:discriminatie|kansen)/i],
    terms: ['leeftijdsdiscriminatie', 'WGBL', 'Wet gelijke behandeling op grond van leeftijd', 'verboden onderscheid', 'objectieve rechtvaardiging', 'College voor de Rechten van de Mens', 'sollicitatiediscriminatie'],
  },
  // 175. Handicap / chronische ziekte accommodatie
  {
    patterns: [/\bhandicap\s*(?:en|op)\s*(?:het\s*)?werk/i, /\bchronische?\s*(?:ziekte|aandoening)\s*(?:en|op)\s*(?:het\s*)?werk/i, /\baanpassing\s*(?:voor\s*)?(?:handicap|beperking|chronisch)/i, /\bwgbh\b/i, /\bdoeltreffende?\s*aanpassing/i, /\brolstoel\s*(?:op|bij)\s*werk/i, /\btoegankelijkheid\s*(?:werk|kantoor)/i, /\bergo(?:nomische?)?\s*(?:aanpassing|werkplek)/i, /\bdoof\s*(?:en|op)\s*werk/i, /\bblind\s*(?:en|op)\s*werk/i],
    terms: ['handicap discriminatie', 'WGBH/CZ', 'Wet gelijke behandeling handicap', 'doeltreffende aanpassing', 'redelijke aanpassing', 'chronische ziekte', 'participatiewet', 'loonkostensubsidie', 'no-riskpolis'],
  },
  // 176. Taalvereisten op het werk / taaldiscriminatie
  {
    patterns: [/\btaalvereist/i, /\btaal(?:eis|beleid)\s*(?:op\s*)?werk/i, /\bnederlands\s*(?:spreken\s*)?(?:verplicht|eis|vereist)/i, /\bengels\s*(?:spreken\s*)?(?:verplicht|eis|voertaal)/i, /\bvoertaal\s*(?:op\s*)?(?:het\s*)?werk/i, /\btaaldiscriminatie/i, /\beigen\s*taal\s*(?:spreken\s*)?(?:op\s*)?werk/i, /\bgeen\s*(?:goed\s*)?nederlands\s*(?:spreken|kunnen)/i],
    terms: ['taalvereisten', 'indirect onderscheid', 'AWGB', 'objectieve rechtvaardiging', 'instructierecht', 'art. 7:660', 'proportionaliteit', 'discriminatie nationaliteit'],
  },

  // ===== SECTOR-SPECIFIEK =====

  // 177. Zorg / verpleging sector
  {
    patterns: [/\b(?:zorg|verpleeg|verpleging|verplegend)\s*(?:en\s*)?(?:arbeidsrecht|ontslag|contract|cao)/i, /\bcao\s*(?:zorg|vvt|ggz|ziekenhuis|umc)/i, /\b(?:verpleegkundige?|verzorgende?|arts)\s*(?:ontslag|contract|recht)/i, /\bonregelmatig(?:heids)?(?:toeslag)?/i, /\bbig-?registratie/i, /\bdienst(?:rooster)?\s*(?:zorg|verpleging)/i, /\bnachtdienst\s*(?:zorg|verpleging)/i],
    terms: ['CAO zorg', 'CAO VVT', 'CAO GGZ', 'onregelmatigheidstoeslag', 'BIG-registratie', 'arbeidstijdenwet zorg', 'nachtdienst', 'zorgplicht', 'dienstrooster'],
  },
  // 178. Bouw / veiligheid sector
  {
    patterns: [/\bbouw\s*(?:sector|cao|veiligheid|arbeidsrecht|ontslag)/i, /\bcao\s*(?:bouw|bouwend\s*nederland)/i, /\bveiligheid\s*(?:op\s*)?(?:de\s*)?bouw/i, /\bvca\b/i, /\bhelm(?:plicht)?/i, /\bsteiger/i, /\bval(?:gevaar|bescherming|beveiliging)/i, /\basbest\s*(?:en\s*)?werk/i, /\bbouw(?:vak|plaats)\s*(?:veiligheid|ongeval)/i],
    terms: ['CAO bouw', 'Arbobesluit bouw', 'VCA', 'veiligheidsvoorschriften', 'arbeidsinspectie', 'arbeidsongeval bouw', 'aansprakelijkheid', 'art. 7:658', 'Arbowet', 'bouwplaatsveiligheid'],
  },
  // 179. Transport / chauffeurs sector
  {
    patterns: [/\btransport\s*(?:sector|cao|arbeidsrecht|chauffeur)/i, /\bcao\s*(?:transport|beroepsgoederenvervoer|taxi)/i, /\bchauffeur\s*(?:ontslag|contract|recht|rij(?:bewijs|tijd))/i, /\brij-?\s*en\s*rusttijd/i, /\btachograaf/i, /\brijbewijs\s*(?:kwijt|ingetrokken|verlopen)\s*(?:en\s*)?(?:ontslag|werk)/i, /\badr\b/i, /\bvrachtwagenchauffeur/i],
    terms: ['CAO transport', 'rij- en rusttijden', 'tachograaf', 'Arbeidstijdenwet vervoer', 'rijbewijs ontslag', 'art. 7:669 lid 3 sub h', 'chauffeur arbeidsrecht', 'rijtijdenwet'],
  },
  // 180. Onderwijs sector
  {
    patterns: [/\bonderwijs\s*(?:sector|cao|arbeidsrecht|ontslag)/i, /\bcao\s*(?:onderwijs|po|vo|mbo|hbo|universiteit)/i, /\bleraar\s*(?:ontslag|contract|recht)/i, /\bdocent\s*(?:ontslag|contract|recht)/i, /\bleerkracht\s*(?:ontslag|contract|tijdelijk)/i, /\bonderwijspersoneel/i, /\bbij(?:les)?baan\s*leraar/i, /\bnormjaartaak/i],
    terms: ['CAO onderwijs', 'CAO PO', 'CAO VO', 'onderwijspersoneel', 'tijdelijke aanstelling onderwijs', 'bovenwettelijke uitkering', 'normjaartaak', 'Participatiefonds'],
  },
  // 181. Horeca sector
  {
    patterns: [/\bhoreca\s*(?:sector|cao|arbeidsrecht|ontslag|contract)/i, /\bcao\s*horeca/i, /\bkok\s*(?:ontslag|contract)/i, /\bkelner\s*(?:ontslag|contract)/i, /\bfooien\s*(?:en\s*)?(?:loon|belasting|recht)/i, /\bnul-?uren\s*(?:contract\s*)?horeca/i, /\bhorecawerknemer/i, /\bcatering\s*(?:personeel|sector)/i],
    terms: ['CAO horeca', 'nul-urencontract', 'oproepovereenkomst', 'fooien', 'seizoensarbeid', 'arbeidstijden horeca', 'ketenregeling', 'minimumloon horeca'],
  },
  // 182. Detailhandel sector
  {
    patterns: [/\bdetailhandel\s*(?:sector|cao|arbeidsrecht|ontslag)/i, /\bcao\s*detailhandel/i, /\bwinkel(?:personeel|medewerker)\s*(?:ontslag|contract|recht)/i, /\bkoopavond(?:en)?\s*(?:werken|verplicht)/i, /\bzondag\s*(?:werken\s*)?(?:winkel|detailhandel|verplicht)/i, /\bkassamedewerker/i, /\bwinkelsluiting/i],
    terms: ['CAO detailhandel', 'koopzondag', 'zondagstoeslag', 'arbeidstijden detailhandel', 'instructierecht', 'oproepovereenkomst', 'gewetensbezwaar zondagswerk'],
  },
  // 183. IT / tech sector
  {
    patterns: [/\bit-?sector\s*(?:arbeidsrecht|cao|ontslag|contract)/i, /\btech\s*(?:sector|bedrijf|startup)\s*(?:arbeidsrecht|ontslag|contract)/i, /\bsoftware\s*(?:developer|ontwikkelaar)\s*(?:ontslag|contract)/i, /\bstock\s*options?\s*(?:en\s*)?(?:ontslag|werk)/i, /\bintellectueel\s*eigendom\s*(?:it|software|code)/i, /\b(?:saa|startup)\s*(?:en\s*)?(?:ontslag|arbeidsrecht)/i, /\bgarden\s*leave\s*(?:it|tech)/i],
    terms: ['IT-sector arbeidsrecht', 'concurrentiebeding IT', 'intellectueel eigendom', 'stock options', 'vesting', 'geheimhoudingsbeding', 'garden leave', 'auteursrecht software'],
  },
  // 184. Overheid / semi-overheid sector
  {
    patterns: [/\boverheid\s*(?:sector|cao|arbeidsrecht|ontslag)/i, /\bsemi-?overheid/i, /\bcao\s*(?:rijk|gemeenten|provincies|waterschappen)/i, /\bgemeente(?:ambtenaar|personeel)\s*(?:ontslag|recht)/i, /\brijks(?:ambtenaar|overheid)\s*(?:ontslag|recht)/i, /\bintegriteit\s*(?:overheid|ambtenaar)/i, /\bwnra\s*(?:ontslag|procedure)/i, /\bnormalisering\s*(?:en\s*)?ontslag/i],
    terms: ['Wnra', 'CAO Rijk', 'CAO Gemeenten', 'normalisering rechtspositie ambtenaren', 'integriteit overheid', 'bovenwettelijke uitkering', 'van-werk-naar-werktraject', 'ambtelijke status'],
  },

  // ===== FINANCIEEL / SCHULDEN =====

  // 185. Loonbeslag details / beslagvrije voet
  {
    patterns: [/\bloonbeslag\s*(?:hoeveel|wat|berekening|bedrag)/i, /\bbeslagvrije\s*voet\s*(?:berekening|hoeveel|hoogte|aanpassing)/i, /\bdeurwaarder\s*(?:op\s*)?(?:mijn\s*)?loon/i, /\bhoeveel\s*(?:mogen|kunnen)\s*(?:ze\s*)?(?:inhouden|beslag)/i, /\bloonbeslag\s*(?:meerdere|twee|drie)\s*(?:schuldeisers|deurwaarders)/i, /\bvereenvoudiging\s*beslagvrije\s*voet/i],
    terms: ['loonbeslag', 'beslagvrije voet', 'Wet vereenvoudiging beslagvrije voet', 'art. 475c Rv', 'art. 475d Rv', 'verplichtingen werkgever loonbeslag', 'derdenverklaring', 'preferente vorderingen'],
  },
  // 186. Schuldsanering en werk / WSNP
  {
    patterns: [/\bschuldsanering\s*(?:en\s*)?werk/i, /\bwsnp\b/i, /\bwettelijke?\s*schuldsanering/i, /\bschuldhulp(?:verlening)?\s*(?:en\s*)?werk/i, /\bschulden\s*(?:en\s*)?werk(?:gever)?/i, /\bsollicitatieplicht\s*(?:wsnp|schuldsanering)/i, /\bschone?\s*lei/i],
    terms: ['WSNP', 'Wet schuldsanering natuurlijke personen', 'schuldsanering', 'schone lei', 'sollicitatieplicht WSNP', 'bewindvoerder', 'schuldhulpverlening', 'loonbeslag'],
  },
  // 187. Faillissement werkgever / loongarantie detail
  {
    patterns: [/\bloongarantie(?:regeling)?/i, /\bfaillissement\s*(?:werkgever\s*)?(?:loon|uitkering|recht)/i, /\buwv\s*(?:overneemt|overname|betaalt)\s*(?:loon|salaris)/i, /\buitkering\s*(?:wegens|na|bij)\s*faillissement/i, /\bcurator\s*(?:en\s*)?(?:loon|salaris|opzegging)/i, /\bdoorstart\s*(?:en\s*)?(?:loon|personeel|contract)/i],
    terms: ['loongarantieregeling UWV', 'art. 61-68 WW', 'faillissement werkgever', 'overneming betalingsverplichtingen', 'curator opzegging', 'opzegtermijn faillissement', 'doorstart', 'pre-pack'],
  },
  // 188. Bijzonder beslag / beslag op specifieke looncomponenten
  {
    patterns: [/\bbijzonder\s*beslag/i, /\bbeslag\s*(?:op\s*)?(?:vakantiegeld|bonus|13e?\s*maand|dertiende|overwerk)/i, /\bvakantiegeld\s*(?:en\s*)?beslag/i, /\bbeslag\s*(?:op\s*)?(?:eindejaars|uitkering|ontslagvergoeding|transitie)/i, /\bontslagvergoeding\s*(?:en\s*)?beslag/i, /\btransitievergoeding\s*(?:en\s*)?beslag/i],
    terms: ['bijzonder beslag', 'beslag vakantiegeld', 'beslag ontslagvergoeding', 'beslagvrije voet', 'art. 475c Rv', 'beslagobject', 'beslag transitievergoeding', 'executoriaal beslag'],
  },
  // 189. Verrekening schulden met eindafrekening
  {
    patterns: [/\bverrekenin?g\s*(?:met\s*)?(?:eind)?afrekening/i, /\bwerkgever\s*(?:houdt\s*)?(?:in|verrekent)\s*(?:bij\s*)?(?:einde|eindafrekening)/i, /\bschade\s*(?:verrekenen|inhouden)\s*(?:bij\s*)?einde/i, /\bstudiekosten\s*(?:verrekenen|inhouden|terugbetalen)\s*(?:bij\s*)?einde/i, /\bteveel\s*(?:genoten|opgenomen)\s*(?:vakantie)?dagen\s*(?:verrekenen|terugbetalen)/i],
    terms: ['verrekening eindafrekening', 'art. 7:632', 'studiekostenbeding', 'schadevergoeding', 'teveel genoten vakantiedagen', 'onverschuldigde betaling', 'verrekeningsverklaring'],
  },

  // ===== INTERNATIONAAL UITGEBREID =====

  // 190. Detachering EU / specifiek Posted Workers
  {
    patterns: [/\bdetachering\s*(?:naar|in|vanuit)\s*(?:eu|europa|duitsland|belgie|frankrijk)/i, /\bgedetacheerd\s*(?:naar|in)\s*(?:het\s*)?buitenland/i, /\bposted\s*worker\s*(?:recht|richtlijn|nederland)/i, /\bwagweu\b/i, /\bkernarbeidsvoorwaarden\s*(?:detachering|buitenland)/i, /\bmelding(?:splicht)?\s*detachering/i],
    terms: ['detachering EU', 'Detacheringsrichtlijn', 'WagwEU', 'kernarbeidsvoorwaarden', 'meldingsplicht detachering', 'A1-verklaring', 'Posted Workers Directive', 'harde kern arbeidsvoorwaarden'],
  },
  // 191. Sociale zekerheid coordinatie EU
  {
    patterns: [/\bsociale?\s*zekerheid\s*(?:eu|europa|coordinatie|buitenland)/i, /\ba1-?verklaring/i, /\bverordening\s*(?:883|987)/i, /\bverzekerings(?:plicht|positie)\s*(?:buitenland|eu)/i, /\bwelk\s*land\s*(?:sociale?\s*)?(?:zekerheid|verzekerd)/i, /\bpremie(?:plicht|heffing)\s*(?:buitenland|eu)/i],
    terms: ['sociale zekerheidscoordinatie', 'Verordening 883/2004', 'Verordening 987/2009', 'A1-verklaring', 'toepasselijke wetgeving', 'SVB', 'detachering sociale zekerheid', 'multi-state workers'],
  },
  // 192. Rijnvarenden
  {
    patterns: [/\brijnvar(?:end|enden|aar)/i, /\bbinnenvaart\s*(?:arbeidsrecht|sociale?\s*zekerheid|recht)/i, /\brijnvaart(?:akte|verdrag)/i, /\bscheepvaart\s*(?:arbeidsrecht|sociale?\s*zekerheid)/i, /\bbemanning(?:slid)?\s*(?:binnenvaart|schip)/i],
    terms: ['Rijnvarenden', 'Rijnvarendenovereenkomst', 'Verordening 883/2004', 'sociale zekerheid binnenvaart', 'A1-verklaring Rijnvarenden', 'SVB', 'exploitantenland'],
  },
  // 193. Grensarbeiders / frontaliers
  {
    patterns: [/\bgrensarbeider/i, /\bfrontalier/i, /\bwerken\s*(?:in\s*)?(?:belgie|duitsland|buitenland)\s*(?:wonen\s*)?(?:in\s*)?nederland/i, /\bwonen\s*(?:in\s*)?(?:belgie|duitsland|buitenland)\s*(?:werken\s*)?(?:in\s*)?nederland/i, /\bbelasting(?:verdrag)?\s*(?:grens|belgie|duitsland)/i, /\bthuiswerkdag(?:en)?\s*(?:grens|belgie|duitsland)/i],
    terms: ['grensarbeiders', 'belastingverdrag', 'sociale zekerheidscoordinatie', 'Verordening 883/2004', 'woonland-werklandbeginsel', 'compensatieregeling grensarbeiders', 'thuiswerkdagen grensarbeiders'],
  },
  // 194. 30%-regeling / expat faciliteit
  {
    patterns: [/\b30\s*(?:procent|%)\s*(?:regeling|ruling)/i, /\bexpat\s*(?:regeling|faciliteit|belasting)/i, /\b30-?(?:procent)?regeling\s*(?:voorwaarden|duur|afbouw|einde)/i, /\binkomende?\s*werknemer\s*(?:belasting|faciliteit)/i, /\bextraterritoriale?\s*kosten/i, /\bschaars(?:e)?\s*(?:specifieke?)?\s*deskundig/i],
    terms: ['30%-regeling', 'extraterritoriale kosten', 'inkomende werknemer', 'schaarse specifieke deskundigheid', '150-kilometergrens', 'belastingvoordeel expat', 'looptijd 30%-regeling'],
  },

  // ===== AANVULLENDE MODERNE THEMAS =====

  // 195. Werkvergunning / verblijfsvergunning en werk
  {
    patterns: [/\bwerkvergunning/i, /\btewerkstellingsvergunning\s*(?:aanvraag|nodig|vereist)/i, /\btwv\b/i, /\bgecombineerde?\s*vergunning/i, /\bverblijfsvergunning\s*(?:en\s*)?werk/i, /\bkennismigrant/i, /\bvergunning\s*(?:voor\s*)?(?:werk|arbeid)\s*(?:buitenland|vreemdeling)/i, /\bonderdaan\s*(?:derde\s*)?land/i],
    terms: ['tewerkstellingsvergunning', 'TWV', 'gecombineerde vergunning GVVA', 'Wet arbeid vreemdelingen', 'kennismigrant', 'werkvergunning', 'verblijfsvergunning arbeid', 'illegale tewerkstelling'],
  },
  // 196. Gendergelijkheid / loonkloof
  {
    patterns: [/\bloonkloof/i, /\bgender\s*(?:pay\s*)?gap/i, /\bgelijk\s*loon\s*(?:man|vrouw|geslacht)/i, /\bloonverschil\s*(?:man|vrouw|gender|geslacht)/i, /\bgendergelijkheid\s*(?:op\s*)?werk/i, /\bman\s*(?:en\s*)?vrouw\s*(?:gelijk|verschil|loon)/i, /\bglazen\s*plafond/i, /\bloon(?:transparantie|rapportage)/i],
    terms: ['gelijke beloning', 'art. 7:646', 'loonkloof', 'gendergelijkheid', 'EU-richtlijn loontransparantie', 'verboden onderscheid geslacht', 'College voor de Rechten van de Mens'],
  },
  // 197. Zelfstandigenaftrek / wet DBA / handhaving
  {
    patterns: [/\bwet\s*dba\b/i, /\bhandhaving\s*(?:schijn)?zelfstandig/i, /\bbelastingdienst\s*(?:zzp|zelfstandig|schijnzelfstandig)/i, /\bmodelovereenkomst\s*(?:dba|belastingdienst)/i, /\bvrijwaring(?:sbrief)?\s*dba/i, /\bwet\s*(?:verduidelijking\s*)?beoordeling\s*(?:arbeids)?relatie/i, /\bvban\b/i],
    terms: ['Wet DBA', 'schijnzelfstandigheid', 'handhaving Belastingdienst', 'modelovereenkomst', 'gezagsverhouding', 'kwalificatie arbeidsrelatie', 'boete schijnzelfstandigheid', 'VBAR'],
  },
  // 198. Bedrijfsarts geschil / klachtprocedure bedrijfsarts
  {
    patterns: [/\bklacht\s*(?:over|tegen|bij)\s*(?:de\s*)?bedrijfsarts/i, /\bbedrijfsarts\s*(?:klacht|tucht|fout|onterecht)/i, /\btuchtrecht\s*(?:bedrijfs)?arts/i, /\bonterecht\s*(?:arbeids)?geschikt\s*(?:verklaard|gemeld)/i, /\bbedrijfsarts\s*(?:luistert|doet)\s*niet/i, /\bbedrijfsarts\s*(?:is\s*)?(?:partijdig|bevooroordeeld)/i],
    terms: ['klacht bedrijfsarts', 'tuchtrecht', 'deskundigenoordeel UWV', 'second opinion', 'art. 7:629a', 'NVAB-richtlijn', 'klachtenprocedure arbodienst', 'medisch tuchtcollege'],
  },
  // 199. Arbeidsmarktdiscriminatie / sollicitatiediscriminatie
  {
    patterns: [/\bsollicitatie(?:discriminatie|afwijzing)\b/i, /\bafgewezen\s*(?:op\s*)?(?:basis\s*(?:van\s*)?)?(?:leeftijd|afkomst|geslacht|handicap|naam|uiterlijk)/i, /\bdiscriminatie\s*(?:bij|tijdens)\s*(?:sollicitatie|werving|selectie)/i, /\barbeidsmarktdiscriminatie/i, /\bselect(?:ie|eren)\s*(?:op\s*)?(?:leeftijd|afkomst|geslacht)/i, /\bnaam\s*(?:en\s*)?kans(?:en)?/i],
    terms: ['arbeidsmarktdiscriminatie', 'sollicitatiediscriminatie', 'AWGB', 'WGBL', 'verboden onderscheid', 'College voor de Rechten van de Mens', 'bewijslast', 'anoniem solliciteren'],
  },
  // 200. Werkgever weigert re-integratie / re-integratiegeschil
  {
    patterns: [/\bwerkgever\s*(?:weigert|werkt\s*(?:niet\s*)?mee)\s*(?:aan\s*)?re-?integratie/i, /\bre-?integratie\s*(?:geschil|conflict|probleem|stagneert)/i, /\bgeen\s*(?:passend\s*)?werk\s*(?:aangeboden|beschikbaar)/i, /\bwerkgever\s*(?:doet|biedt)\s*(?:niets|niks)\s*(?:aan\s*)?re-?integratie/i, /\bstagner(?:end|ende)\s*re-?integratie/i],
    terms: ['re-integratiegeschil', 'deskundigenoordeel UWV', 'art. 7:658a', 'passende arbeid', 'loonsanctie werkgever', 'spoor 2', 'Wet verbetering poortwachter', 'plan van aanpak'],
  },
  // 201. Werknemer en privacy (personeelsdossier / dataportabiliteit)
  {
    patterns: [/\bpersoneelsdossier\s*(?:inzage|recht|opvragen|verwijderen)/i, /\binzage(?:recht|verzoek)\s*(?:personeels)?dossier/i, /\bdataportabiliteit\s*(?:werknemer|personeel)/i, /\bverwijdering\s*(?:personeels)?gegevens/i, /\brecht\s*(?:op\s*)?(?:inzage|vergetelheid|rectificatie)\s*(?:personeels)?dossier/i, /\bpersoneelsgegevens\s*(?:bewaren|vernietigen|overdragen)/i],
    terms: ['inzagerecht personeelsdossier', 'AVG', 'art. 15 AVG', 'recht op inzage', 'recht op vergetelheid', 'dataportabiliteit', 'bewaartermijn personeelsdossier', 'Autoriteit Persoonsgegevens'],
  },
  // 202. Payrolling en uitzendconstructie misbruik
  {
    patterns: [/\bpayroll\s*(?:constructie|misbruik|rechten|gelijk)/i, /\bpayroll(?:werknemer|kracht|overeenkomst)/i, /\bgelijke?\s*(?:behandeling|rechten)\s*payroll/i, /\buitzend(?:constructie|misbruik)\b/i, /\bdraaideur(?:constructie)?\b/i, /\bverschil\s*(?:uitzend|payroll)\s*(?:en\s*)?(?:vast|direct)/i],
    terms: ['payrolling', 'WAB payroll', 'gelijke behandeling payroll', 'allocatiefunctie', 'adequate pensioenregeling', 'inlenersbeloning', 'draaideurconstructie', 'misbruik uitzendconstructie'],
  },
  // 203. Vakantie weigeren / vakantieaanvraag weigering
  {
    patterns: [/\bvakantie\s*(?:geweigerd|afgewezen|niet\s*goedgekeurd)/i, /\bwerkgever\s*(?:weigert|keurt\s*(?:niet\s*)?goed)\s*(?:mijn\s*)?vakantie/i, /\bmag\s*(?:werkgever\s*)?vakantie\s*(?:weigeren|afwijzen)/i, /\bvakantie(?:aanvraag)?\s*(?:weiger|afwijs)/i, /\bverplicht\s*vakantie\s*(?:opnemen|op)/i, /\bcollectieve?\s*(?:vakantie|sluiting|bedrijfssluiting)/i],
    terms: ['vakantieaanvraag', 'art. 7:638', 'gewichtige redenen', 'vaststelling vakantie', 'collectieve vakantie', 'verplichte vrije dagen', 'art. 7:636', 'opnemen vakantiedagen'],
  },
  // 204. Detentie en ontslag / strafrechtelijk en werk
  {
    patterns: [/\bgevangenschap\s*(?:en\s*)?werk/i, /\bhechtenis\s*(?:en\s*)?(?:ontslag|werk|loon)/i, /\bstrafrechtelijke?\s*(?:vervolging|veroordeling)\s*(?:en\s*)?(?:ontslag|werk)/i, /\bverdacht\s*(?:en\s*)?(?:ontslag|werk|schorsing)/i, /\bstrafzaak\s*(?:en\s*)?(?:werk|ontslag)/i, /\bgedetineerd\s*(?:en\s*)?(?:werk|loon|ontslag)/i],
    terms: ['detentie ontslag', 'art. 7:669 lid 3 sub h', 'dringende reden', 'onschuldpresumptie', 'schorsing bij verdenking', 'loondoorbetaling detentie', 'goed werknemerschap'],
  },
  // 205. Arbeidsongeschiktheidsverzekering / WIA-hiaat
  {
    patterns: [/\barbeidsongeschiktheidsverzekering/i, /\baov\b/i, /\bwia-?(?:hiaat|excedent|aanvulling|gat)/i, /\bwga-?(?:hiaat|verzekering|eigen\s*risico)/i, /\beigen\s*risico(?:drager)?\s*(?:wga|ziektewet)/i, /\bverzekering\s*(?:bij\s*)?arbeidsongeschiktheid/i, /\binkomens(?:verzekering|bescherming)/i],
    terms: ['arbeidsongeschiktheidsverzekering', 'WIA-hiaatverzekering', 'WGA-excedent', 'eigenrisicodrager WGA', 'eigenrisicodrager Ziektewet', 'AOV', 'inkomensbescherming', 'premieplicht'],
  },

  // ===== ONTSLAG-VARIANTEN EN -PROCEDURES (uitgebreid) =====

  // 206. Herplaatsingsverplichting detail
  {
    patterns: [/\bherplaatsing(?:sverplichting|sinspanning|smogelijkhe)/i, /\bherplaatsen\s*(?:werknemer|functie)/i, /\bpassende?\s*(?:functie|werk)\s*(?:aanbieden|beschikbaar)/i, /\bredelijke?\s*termijn\s*herplaatsing/i, /\bgeen\s*herplaatsing\s*(?:mogelijk|beschikbaar)/i],
    terms: ['herplaatsingsverplichting', 'art. 7:669 lid 1', 'passende functie', 'redelijke termijn', 'herplaatsingsonderzoek', 'scholing', 'art. 9 Ontslagregeling'],
  },
  // 207. Afspiegelingsbeginsel detail
  {
    patterns: [/\bafspiegeling(?:sbeginsel|smethode|sregel)/i, /\bleeftijds(?:groep|categorie|cohort)\s*(?:afspiegeling|ontslag)/i, /\bontslagvolgorde\s*(?:bepalen|berekenen)/i, /\bpeildatum\s*afspiegeling/i, /\bcategorie\s*(?:uitwisselbare?\s*)?functies/i, /\buitwisselbare?\s*functies/i],
    terms: ['afspiegelingsbeginsel', 'art. 11 Ontslagregeling', 'leeftijdscohorten', 'uitwisselbare functies', 'peildatum', 'ontslagvolgorde', 'anciënniteit', 'lifo'],
  },
  // 208. Sociaal plan onderhandeling
  {
    patterns: [/\bsociaal\s*plan\s*(?:onderhandel|opstel|afsluit|inhoud)/i, /\bsociaal\s*plan\s*(?:cao|or|vakbond)/i, /\bbinding\s*sociaal\s*plan/i, /\bhardheidsclausule\s*sociaal\s*plan/i, /\bsociaal\s*plan\s*(?:verplicht|nodig|wanneer)/i],
    terms: ['sociaal plan', 'vakbond onderhandeling', 'OR-adviesrecht', 'art. 25 WOR', 'hardheidsclausule', 'binding sociaal plan', 'collectief ontslag', 'WMCO'],
  },
  // 209. NOW-regeling en ontslag
  {
    patterns: [/\bnow\s*(?:regeling|subsidie|steun)/i, /\bnow\s*(?:en\s*)?ontslag/i, /\bnow\s*(?:terugbetal|boete|korting)/i, /\bloonsubsidie\s*(?:corona|covid|now)/i, /\bontslagboete\s*now/i],
    terms: ['NOW-regeling', 'loonsubsidie', 'ontslagboete NOW', 'terugbetaling NOW', 'bedrijfseconomisch ontslag NOW', 'UWV NOW', 'omzetverlies'],
  },
  // 210. Ontslag statutair bestuurder detail
  {
    patterns: [/\bstatutar\s*(?:bestuurder|directeur)/i, /\bontslag\s*(?:statutair\s*)?bestuurder/i, /\b15-?april\s*arrest/i, /\bvennootschapsrechtelijk\s*(?:ontslag|besluit)/i, /\bava\s*(?:besluit|ontslag|vergadering)\s*(?:bestuurder|directeur)/i, /\bbestuurder\s*(?:ontslag|opzegging|verwijder)/i],
    terms: ['statutair bestuurder ontslag', '15 april-arresten', 'vennootschapsrechtelijk ontslag', 'arbeidsrechtelijk ontslag', 'art. 2:134', 'art. 2:244', 'AVA-besluit', 'raad van commissarissen'],
  },
  // 211. Opzegging door werknemer
  {
    patterns: [/\bwerknemer\s*(?:zegt\s*op|neemt\s*ontslag|wil\s*(?:weg|vertrekken|opzeggen))/i, /\bopzegging\s*(?:door|van(?:uit)?)\s*(?:de\s*)?werknemer/i, /\bzelf\s*(?:ontslag\s*nemen|opzeggen|vertrekken)/i, /\beigen\s*ontslag/i, /\bvrijwillig\s*(?:ontslag|vertrek)/i],
    terms: ['opzegging werknemer', 'opzegtermijn werknemer', 'art. 7:672', 'duidelijke en ondubbelzinnige verklaring', 'bedenktijd', 'schadeplichtig', 'gefixeerde schadevergoeding'],
  },
  // 212. Bedenktijd vaststellingsovereenkomst
  {
    patterns: [/\bbedenktijd\s*(?:vso|vaststellingsovereenkomst|beëindigingsovereenkomst)/i, /\bveertien\s*dagen\s*(?:bedenk|herroep)/i, /\b14\s*dagen\s*(?:bedenk|herroep|terug)/i, /\bherroeping(?:srecht|stermijn)?\s*(?:vso|vaststellingsovereenkomst)/i, /\bterugkomen\s*(?:op\s*)?(?:vso|vaststellingsovereenkomst|beëindiging)/i],
    terms: ['bedenktijd', 'art. 7:670b lid 2', '14 dagen herroeping', 'vaststellingsovereenkomst', 'informatieplicht werkgever', 'schriftelijkheidsvereiste'],
  },
  // 213. Pro-forma ontbindingsprocedure
  {
    patterns: [/\bpro\s*forma\s*(?:procedure|ontbinding|verzoek)/i, /\bpro-?forma\b/i, /\bschijn(?:procedure|verweer)/i, /\bgeen\s*verweer\s*(?:voeren|ontbinding)/i, /\bregelen\s*(?:via\s*)?(?:kantonrechter|rechter)/i],
    terms: ['pro-forma ontbinding', 'kantonrechter', 'geen verweer', 'WW-veilige constructie', 'art. 7:671b', 'ontvankelijkheid', 'procesafspraken'],
  },
  // 214. UWV-procedure stap voor stap
  {
    patterns: [/\buwv\s*(?:procedure|aanvraag|formulier|ontslagaanvraag)/i, /\bontslagaanvraag\s*uwv/i, /\buwv\s*(?:werkbedrijf|toestemming)\s*(?:ontslag|opzeg)/i, /\bverweer(?:schrift|termijn)?\s*uwv/i, /\buwv\s*(?:beslis|doorlooptijd|termijn)/i],
    terms: ['UWV ontslagaanvraag', 'ontslagvergunning', 'formulier A', 'formulier B', 'formulier C', 'verweerperiode', 'beslistermijn UWV', 'art. 7:671a'],
  },
  // 215. Kantonrechtersformule / oud ontslagrecht
  {
    patterns: [/\bkantonrechtersformule/i, /\boud(?:e)?\s*(?:ontslag)?recht/i, /\bformule\s*(?:voor|oud|kantonrechter)/i, /\ba\s*[x×*]\s*b\s*[x×*]\s*c\b/i, /\bcorrectiefactor/i, /\bvóór\s*(?:1\s*)?juli\s*2015/i],
    terms: ['kantonrechtersformule', 'ABC-formule', 'correctiefactor', 'oud ontslagrecht', 'Wet werk en zekerheid', 'transitievergoeding', 'overgangsrecht'],
  },
  // 216. Ontslagvergoeding berekenen
  {
    patterns: [/\bontslagvergoeding\s*(?:bereken|hoogte|hoeveel)/i, /\bhoeveel\s*(?:vergoeding|krijg\s*ik|geld)\s*(?:bij|na|ontslag)/i, /\btransitievergoeding\s*(?:bereken|hoogte|hoeveel|uitrekenen)/i, /\bvergoeding\s*(?:bereken|uitrekenen|schatten)\s*(?:bij\s*)?ontslag/i],
    terms: ['transitievergoeding berekenen', 'art. 7:673', 'bruto maandsalaris', 'dienstjaren', 'billijke vergoeding', 'ontslagvergoeding', 'New Hairstyle-formule'],
  },
  // 217. Wederzijds goedvinden / VSO nuances
  {
    patterns: [/\bwederzijds\s*goedvinden/i, /\bvso\s*(?:nuance|voorwaarde|inhoud|onderhandel|check)/i, /\bvaststellingsovereenkomst\s*(?:voorwaarde|check|beoorde|risico|inhoud)/i, /\bbeëindigingsovereenkomst\s*(?:voorwaarde|check|beoorde)/i, /\bonderhandel(?:en|ing)\s*(?:over\s*)?(?:vso|vaststellingsovereenkomst|vertrekregeling)/i],
    terms: ['vaststellingsovereenkomst', 'wederzijds goedvinden', 'art. 7:670b', 'WW-rechten', 'finale kwijting', 'transitievergoeding VSO', 'neutrale referentie', 'vrijstelling werk'],
  },
  // 218. Deeltijdontslag
  {
    patterns: [/\bdeeltijd\s*ontslag/i, /\bgedeeltelijk\s*(?:ontslag|ontslagen|beëindig)/i, /\buren\s*(?:verminderen|inkrimpen)\s*(?:gedwongen|eenzijdig)/i, /\bhalve?\s*ontslag/i, /\bgedeeltelijke?\s*(?:opzegging|beëindiging)/i],
    terms: ['deeltijdontslag', 'gedeeltelijke transitievergoeding', 'Kolom-arrest', 'urenverlies', 'art. 7:669', 'gedeeltelijke beëindiging', 'deeltijd-WW'],
  },
  // 219. Collectief ontslag / WMCO
  {
    patterns: [/\bcollectief\s*ontslag/i, /\bwmco\b/i, /\bwet\s*melding\s*collectief\s*ontslag/i, /\b(?:20|twintig)\s*(?:of\s*meer\s*)?(?:werk)?nemers\s*(?:ontsl|ontbidn)/i, /\bmelding(?:splicht)?\s*(?:collectief\s*)?ontslag/i, /\braadpleging\s*vakbond/i],
    terms: ['WMCO', 'collectief ontslag', 'meldingsplicht UWV', 'raadpleging vakbonden', 'wachttijd 1 maand', '20 werknemers', 'werkgebied', 'Europese richtlijn collectief ontslag'],
  },
  // 220. Opzegverbod tijdens ziekte detail
  {
    patterns: [/\bopzegverbod\s*(?:tijdens|bij|ziekte)/i, /\bziek\s*(?:en\s*)?(?:ontslag|opzeg|ontslagen)/i, /\bmag\s*(?:werkgever\s*)?ontslaan\s*(?:bij|tijdens)\s*(?:ziekte|ziek)/i, /\bontslag\s*(?:tijdens|bij)\s*(?:ziekte|ziek\s*zijn)/i, /\btw(?:ee|ee)\s*jaar\s*(?:ziek|ziekte)\s*(?:en\s*)?ontslag/i],
    terms: ['opzegverbod tijdens ziekte', 'art. 7:670 lid 1', 'twee jaar wachttijd', 'reflexwerking opzegverbod', 'ontbinding tijdens ziekte', 'art. 7:670a', 'uitzondering opzegverbod'],
  },
  // 221. Ontslag wegens frequent ziekteverzuim
  {
    patterns: [/\bfrequent\s*(?:ziekte)?verzuim/i, /\bveelvuldig\s*(?:ziek|absent|afwezig)/i, /\bregelmatig\s*(?:ziek|absent)/i, /\bontslag\s*(?:wegens|vanwege)\s*(?:frequent|veelvuldig)\s*(?:ziek|verzuim)/i, /\bc-grond\b/i, /\bziekteverzuim\s*(?:te\s*)?(?:hoog|veel)/i],
    terms: ['frequent ziekteverzuim', 'art. 7:669 lid 3 sub c', 'regelmatig ziekteverzuim', 'onaanvaardbare gevolgen bedrijfsvoering', 'deskundigenoordeel', 'herstel binnen 26 weken', 'aangepast werk'],
  },

  // ===== ZIEKTE & RE-INTEGRATIE (uitgebreid) =====

  // 222. Wet verbetering poortwachter stappen
  {
    patterns: [/\bpoortwachter\s*(?:stappen|schema|tijdlijn|verloop|verplichting)/i, /\bwet\s*verbetering\s*poortwachter/i, /\bwvp\b/i, /\bpoortwachter(?:toets|kader|stappenplan)/i, /\bverzuimprotocol\s*(?:stappen|verloop)/i],
    terms: ['Wet verbetering poortwachter', 'probleemanalyse', 'plan van aanpak', 'eerstejaars evaluatie', 'WIA-aanvraag', 'RIV-toets', 'loonsanctie', 'week 6', 'week 42', 'week 91'],
  },
  // 223. 104 weken ziekte / einde wachttijd
  {
    patterns: [/\b104\s*weken\s*(?:ziek|ziekte|wachttijd)/i, /\btw(?:ee|ee)\s*jaar\s*(?:ziek|ziekte|wachttijd)/i, /\beinde\s*wachttijd/i, /\bna\s*(?:104\s*weken|twee\s*jaar\s*ziekte)/i, /\bwachttijd\s*(?:wia|verstreken|voorbij)/i],
    terms: ['104 weken ziekte', 'einde wachttijd', 'WIA-aanvraag', 'slapend dienstverband', 'opzegverbod verlopen', 'art. 7:670 lid 11', 'transitievergoeding na 2 jaar ziekte'],
  },
  // 224. Eerstejaars evaluatie / eerstejaarsbeoordeling
  {
    patterns: [/\beerstejaars\s*(?:evaluatie|beoordeling)/i, /\beerstejaarsevaluatie/i, /\bjaar\s*(?:evaluatie|beoordeling)\s*(?:ziekte|verzuim|poortwachter)/i, /\bopschudmoment/i, /\bevaluatie\s*(?:na\s*)?(?:52\s*weken|één\s*jaar|1\s*jaar)/i],
    terms: ['eerstejaars evaluatie', 'opschudmoment', 'bijstelling plan van aanpak', 'spoor 2', 'spoor 1', 'Wet verbetering poortwachter', 're-integratiedoel bijstellen'],
  },
  // 225. Plan van aanpak detail
  {
    patterns: [/\bplan\s*van\s*aanpak\s*(?:opstel|inhoud|aanpass|wijzig|verplicht)/i, /\bpva\s*(?:ziekte|verzuim|re-?integratie)/i, /\bplan\s*van\s*aanpak\s*(?:niet|geen|ontbreekt|te\s*laat)/i, /\bre-?integratieplan\s*(?:opstel|inhoud)/i],
    terms: ['plan van aanpak', 'art. 7:658a', 'Wet verbetering poortwachter', 'probleemanalyse', 'bijstelling', 're-integratiedoel', 'werkhervatting', 'zes weken termijn'],
  },
  // 226. Arbeidsdeskundig onderzoek
  {
    patterns: [/\barbeidsdeskundig\s*(?:onderzoek|rapport|beoordeling)/i, /\barbeidsdeskundige\s*(?:inschakelen|rapport|advies)/i, /\bbelastbaarheid(?:sprofiel|sonderzoek)?\b/i, /\bfunctionele?\s*(?:mogelijkheden|beperking)(?:enlijst)?\b/i, /\bfml\b/i],
    terms: ['arbeidsdeskundig onderzoek', 'belastbaarheidsprofiel', 'functionele mogelijkhedenlijst', 'FML', 'passende arbeid', 'arbeidsvermogen', 'UWV arbeidsdeskundige'],
  },
  // 227. UWV deskundigenoordeel aanvragen
  {
    patterns: [/\bdeskundigenoordeel\s*(?:aanvrag|uwv|kosten|termijn|procedure)/i, /\buwv\s*deskundigenoordeel/i, /\bsecond\s*opinion\s*(?:uwv|ziekte|arbeid)/i, /\bdeskundigenoordeel\s*(?:re-?integratie|ziekte|passend\s*werk)/i],
    terms: ['deskundigenoordeel UWV', 'art. 7:629a', 'second opinion', 'kosten deskundigenoordeel', 'arbeidsgeschiktheid', 'passende arbeid', 're-integratie-inspanningen'],
  },
  // 228. Loonsanctie detail
  {
    patterns: [/\bloonsanctie\s*(?:uwv|detail|verlenging|vermijden|opgelegd|duur)/i, /\bverlenging\s*loondoorbetaling/i, /\bderde\s*ziektejaar/i, /\b(?:52|104)\s*weken\s*(?:loondoorbetaling|verlenging|loonsanctie)/i, /\buwv\s*(?:legt|oplegt|opgelegd)\s*loonsanctie/i],
    terms: ['loonsanctie UWV', 'verlenging loondoorbetaling', 'derde ziektejaar', 'art. 25 WIA', 'RIV-toets', 'reparatie loonsanctie', 'bezwaar loonsanctie', 'onvoldoende re-integratie-inspanningen'],
  },
  // 229. Vervroegde IVA-aanvraag
  {
    patterns: [/\bvervroegde?\s*iva/i, /\biva\s*(?:aanvraag|aanvragen|uitkering|vervroegd)/i, /\bduurzaam\s*(?:en\s*)?volledig\s*arbeidsongeschikt/i, /\b80\s*(?:tot\s*)?100\s*(?:procent|%)\s*arbeidsongeschikt/i, /\biva\b(?!.*(?:inburger|cursus))/i],
    terms: ['vervroegde IVA-aanvraag', 'IVA-uitkering', 'duurzaam arbeidsongeschikt', 'volledig arbeidsongeschikt', '80-100%', 'art. 47 WIA', 'geen herstelkans'],
  },
  // 230. No-risk polis
  {
    patterns: [/\bno\s*risk\s*polis/i, /\bno-?risk(?:polis)?\b/i, /\bziektewet\s*vangnet\s*(?:werknemer|arbeidsgehandicapt)/i, /\bcompensatie\s*(?:werkgever\s*)?(?:ziekte|arbeidsongeschikt)\s*(?:werknemer\s*)?(?:verleden|voorgeschiedenis)/i],
    terms: ['no-risk polis', 'art. 29b Ziektewet', 'Wet banenafspraak', 'arbeidsgehandicapt', 'compensatie werkgever', 'Ziektewet', 'WIA-verleden', 'loonkostensubsidie'],
  },
  // 231. Ziektewet vangnet
  {
    patterns: [/\bziektewet\s*(?:vangnet|uitkering)/i, /\bvangnet(?:ter|uitkering)?\s*ziektewet/i, /\bziektewet\s*(?:zwanger|orgaandon|no-?risk)/i, /\bziek\s*(?:na\s*)?(?:einde\s*)?(?:tijdelijk\s*)?contract/i, /\bvangnetter/i],
    terms: ['Ziektewet vangnet', 'vangnetter', 'art. 29 Ziektewet', 'ziek einde contract', 'ziek uit dienst', 'flexwerker ziekte', 'UWV Ziektewet'],
  },
  // 232. Ziek uit dienst
  {
    patterns: [/\bziek\s*uit\s*dienst/i, /\bziek\s*(?:bij|na|op)\s*(?:einde\s*)?(?:dienst|contract|arbeidsovereenkomst)/i, /\buitdiensttreding\s*(?:tijdens|bij)\s*ziekte/i, /\bziektewet\s*(?:na\s*)?(?:einde\s*)?dienstverband/i],
    terms: ['ziek uit dienst', 'Ziektewet aanvraag', 'UWV', 'ziek einde contract', 'art. 29 Ziektewet', 're-integratieverplichtingen UWV', 'uitkering Ziektewet'],
  },
  // 233. Bezwaar UWV-beslissing
  {
    patterns: [/\bbezwaar\s*(?:uwv|wia|wga|iva|ziektewet)/i, /\buwv\s*(?:beslissing|beschikking|afwijzing)\s*(?:bezwaar|beroep)/i, /\bbezwaar(?:schrift|procedure|termijn)?\s*(?:uwv|wia)/i, /\bafwijzing\s*(?:wia|wga|iva)\s*(?:bezwaar|beroep)/i],
    terms: ['bezwaar UWV', 'bezwaarprocedure', 'zes weken termijn', 'beroep rechtbank', 'hoger beroep CRvB', 'WIA-beslissing', 'herkeuring', 'art. 7:1 Awb'],
  },
  // 234. Mediation bij arbeidsconflict en ziekte
  {
    patterns: [/\bmediation\s*(?:bij|tijdens|arbeids|ziekte|conflict|werk)/i, /\bmediator\s*(?:inschakelen|nodig|verplicht|werk)/i, /\barbeidsmediation/i, /\bconflict(?:bemiddeling)?\s*(?:werk|arbeid|ziekte)/i, /\bbemiddeling\s*(?:arbeids)?conflict/i],
    terms: ['arbeidsmediation', 'mediator', 'deskundigenoordeel mediation', 'conflictbemiddeling', 'verstoorde arbeidsverhouding', 'ziekte door conflict', 'STECR werkwijzer'],
  },
  // 235. Situatieve arbeidsongeschiktheid detail
  {
    patterns: [/\bsituatie?ve?\s*arbeidsongeschikt/i, /\bniet\s*ziek\s*(?:maar|wel)\s*(?:niet\s*)?(?:in\s*staat|werken)/i, /\barbeids(?:on)?geschikt\s*(?:door|vanwege)\s*(?:conflict|situatie|werkplek)/i, /\bziek\s*(?:door|vanwege|van)\s*(?:het\s*)?(?:werk|conflict|situatie|stress|baas|leidinggevende)/i],
    terms: ['situatieve arbeidsongeschiktheid', 'Mak/SGBO-arrest', 'werkgerelateerde klachten', 'deugdelijke grond niet-werken', 'loonvordering', 'art. 7:628', 'conflictverzuim', 'STECR werkwijzer'],
  },
  // 236. Werkhervatting na kanker / ernstige ziekte
  {
    patterns: [/\bkanker\s*(?:en\s*)?(?:werk|terug|hervatten|re-?integrat)/i, /\bwerkhervatting\s*(?:na|bij)\s*(?:kanker|chemo|bestraling|ernstige?\s*ziekte)/i, /\bterug\s*(?:naar|op)\s*(?:het\s*)?werk\s*(?:na|bij)\s*(?:kanker|ernstige?\s*ziekte)/i, /\bcancer\s*(?:and\s*)?(?:work|return)/i],
    terms: ['werkhervatting na kanker', 're-integratie ernstige ziekte', 'aangepast werk', 'opbouw werkuren', 'bedrijfsarts advies', 'belastbaarheid', 'no-risk polis', 'Wet verbetering poortwachter'],
  },
  // 237. PTSD / beroepsziekten
  {
    patterns: [/\bptss?\b/i, /\bpost\s*traumatisch/i, /\bberoepsziekte/i, /\bwerkgerelateerde?\s*(?:aandoening|ziekte|klacht)/i, /\btrauma\s*(?:door|op|vanwege)\s*(?:het\s*)?werk/i, /\boverspanning\s*(?:door|vanwege)\s*werk/i],
    terms: ['beroepsziekte', 'PTSD', 'werkgeversaansprakelijkheid', 'art. 7:658', 'causaal verband', 'Nederlands Centrum voor Beroepsziekten', 'schadevergoeding', 'bewijslast'],
  },
  // 238. Burnout en werk
  {
    patterns: [/\bburnout\b/i, /\bburn\s*out/i, /\bburn-?out/i, /\bopgebrand/i, /\boverspanning/i, /\boverspannen/i, /\buitgeput\s*(?:door|van|op)\s*(?:het\s*)?werk/i, /\bstress\s*(?:door|vanwege|van)\s*(?:het\s*)?werk/i, /\bwerkdruk\s*(?:te\s*hoog|onhoudbaar|ziek)/i],
    terms: ['burnout', 'overspanning', 'werkgerelateerde klachten', 'bedrijfsarts', 'NVAB-richtlijn', 'art. 7:658', 'psychosociale arbeidsbelasting', 'Arbowet art. 3', 'werkdruk', 'stressklachten'],
  },

  // ===== CAO EN ARBEIDSVOORWAARDEN (uitgebreid) =====

  // 239. CAO-bepalingen afdwingen
  {
    patterns: [/\bcao\s*(?:bepaling|recht|afdwing|nakoming|schending|overtreding)/i, /\bafdwing(?:en|ing)\s*(?:van\s*)?cao/i, /\bnakom(?:en|ing)\s*(?:van\s*)?cao/i, /\bcao\s*(?:niet\s*)?(?:nageleefd|nagekomen)/i, /\bschending\s*cao/i],
    terms: ['nakoming CAO', 'afdwinging CAO-bepalingen', 'art. 9 Wet CAO', 'vakbond vordering', 'nalevingsactie', 'schadevergoeding', 'boetebeding CAO'],
  },
  // 240. Incorporatiebeding
  {
    patterns: [/\bincorporatie(?:beding|clausule|bepaling)/i, /\bcao\s*(?:van\s*toepassing\s*verklaard|verwijs|verwezen|incorpor)/i, /\bdynamisch\s*(?:verwijs|incorporatie)/i, /\bstatisch\s*(?:verwijs|incorporatie)/i],
    terms: ['incorporatiebeding', 'dynamische verwijzing', 'statische verwijzing', 'CAO van toepassing verklaard', 'arbeidsovereenkomst', 'wijziging CAO', 'gebondenheid'],
  },
  // 241. Nawerking CAO
  {
    patterns: [/\bnawerking\s*(?:van\s*)?(?:de\s*)?cao/i, /\bcao\s*(?:verlopen|afgelopen|geëindigd|beëindigd)\s*(?:en\s*)?(?:nawerk|recht)/i, /\bcao\s*(?:is\s*)?(?:verlopen|afgelopen)\s*(?:wat\s*)?nu/i, /\bgeen\s*(?:nieuwe?\s*)?cao\s*(?:meer|afgesloten)/i],
    terms: ['nawerking CAO', 'verlopen CAO', 'incorporatie', 'doorwerking', 'individuele arbeidsovereenkomst', 'vakbond onderhandeling', 'arbeidsvoorwaarden behoud'],
  },
  // 242. Minimum-CAO vs standaard-CAO
  {
    patterns: [/\bminimum\s*cao/i, /\bstandaard\s*cao/i, /\bminimum\s*(?:vs|versus|of)\s*standaard\s*cao/i, /\bcao\s*(?:afwijken|afwijking|gunstiger)/i, /\bdriekwart\s*(?:dwingend|cao)/i],
    terms: ['minimum-CAO', 'standaard-CAO', 'afwijking ten gunste', 'driekwart dwingend recht', 'art. 12 Wet CAO', 'art. 13 Wet CAO', 'gunstigere arbeidsvoorwaarden'],
  },
  // 243. AVV (algemeen verbindend verklaring)
  {
    patterns: [/\bavv\b/i, /\balgemeen\s*verbindend\s*(?:verklaring|verklaard)/i, /\bverbindend\s*verklaring\s*cao/i, /\bdispensatie\s*(?:avv|cao)/i, /\bgebonden\s*(?:aan\s*)?cao\s*(?:zonder|niet\s*lid)/i],
    terms: ['algemeen verbindend verklaring', 'AVV', 'Wet AVV', 'dispensatie', 'gebondenheid niet-leden', 'werkingssfeer CAO', 'bedrijfstak-CAO'],
  },
  // 244. Pensioenregeling wijzigen
  {
    patterns: [/\bpensioen(?:regeling)?\s*(?:wijzig|aanpass|verslechter|versobber)/i, /\bwijziging\s*(?:pensioen|pensioenregeling)/i, /\bversobering\s*pensioen/i, /\bpensioen(?:premie|bijdrage)\s*(?:verhoging|wijziging)/i, /\bpensioen\s*(?:achteruitgang|minder|lager)/i],
    terms: ['wijziging pensioenregeling', 'eenzijdig wijzigingsbeding', 'art. 19 Pensioenwet', 'instemmingsrecht OR', 'pensioenversobering', 'zwaarwichtig belang', 'Stoof/Mammoet'],
  },
  // 245. Eenzijdig wijzigingsbeding detail
  {
    patterns: [/\beenzijdig\s*wijziging(?:sbeding)?/i, /\bwijzigingsbeding\s*(?:arbeids)?(?:overeenkomst|voorwaarden)/i, /\bart\.?\s*7:613/i, /\bzwaarwichtig\s*belang/i, /\bwerkgever\s*(?:eenzijdig\s*)?wijzig/i, /\barbeidsvoorwaarden\s*eenzijdig\s*(?:wijzig|aanpass)/i],
    terms: ['eenzijdig wijzigingsbeding', 'art. 7:613', 'zwaarwichtig belang', 'Stoof/Mammoet', 'belangenafweging', 'schriftelijk beding', 'redelijkheid en billijkheid'],
  },
  // 246. Functiewaardering
  {
    patterns: [/\bfunctiewaardering/i, /\bfunctiebeschrijving\s*(?:wijzig|aanpass|verschil)/i, /\bfunctie-?(?:indeling|niveau|schaal)\s*(?:wijzig|geschil|bezwaar)/i, /\binschaling\s*(?:geschil|bezwaar|onjuist|te\s*laag)/i, /\bhay\s*(?:methode|functie|score)/i, /\bfuwasys\b/i],
    terms: ['functiewaardering', 'functiebeschrijving', 'functie-indeling', 'salarisschaal', 'bezwaar inschaling', 'hay-methode', 'fuwasys', 'CAO-schaal'],
  },
  // 247. Salarisschalen en periodieken
  {
    patterns: [/\bsalarisschaal\s*(?:indel|wijzig|bezwaar|verschil)/i, /\bperiodiek\s*(?:toekenning|weiger|overslaan|niet)/i, /\bloonschaal/i, /\bsalarisstap/i, /\bschaal(?:indeling|verhoging|aanpassing)/i, /\bniet\s*(?:periodiek|salarisstap|schaalverhoging)/i],
    terms: ['salarisschaal', 'periodiek', 'salarisstap', 'schaalindeling', 'functiewaardering', 'CAO-loonschaal', 'weigeringsgrond periodiek'],
  },
  // 248. Toeslagen en emolumenten
  {
    patterns: [/\btoeslag(?:en)?\s*(?:recht|aanspraak|cao|onregelmatig|ploegen|shift)/i, /\bemolument(?:en)?\b/i, /\bonregelmatigheidstoeslag/i, /\bploegentoeslag/i, /\bshifttoeslag/i, /\btoeslagen\s*(?:afschaffen|wijzigen|stoppen)/i],
    terms: ['toeslagen', 'onregelmatigheidstoeslag', 'ploegentoeslag', 'emolumenten', 'verworven recht', 'CAO-toeslag', 'arbeidsvoorwaarden'],
  },

  // ===== WERKGEVERSAANSPRAKELIJKHEID (uitgebreid) =====

  // 249. RSI / KANS / muisarm
  {
    patterns: [/\brsi\b/i, /\bkans\b(?=.*(?:werk|arm|pols|klacht|letsel))/i, /\bmuisarm/i, /\brepetitive\s*strain/i, /\btendinitis\s*(?:door|werk)/i, /\bcarpaal\s*tunnel/i, /\bbeeldscherm(?:werk)?\s*(?:klacht|letsel)/i],
    terms: ['RSI', 'KANS', 'muisarm', 'beroepsziekte', 'art. 7:658', 'werkgeversaansprakelijkheid', 'arbeidsomstandigheden', 'arbobeleid', 'beeldschermwerk'],
  },
  // 250. Bedrijfsongeval procedure
  {
    patterns: [/\bbedrijfsongeval\s*(?:procedure|meld|aansprakelijk|schadevergoeding|letsel)/i, /\barbeidsongeval/i, /\bongeval\s*(?:op|tijdens|bij)\s*(?:het\s*)?(?:werk|arbeid)/i, /\bletsel\s*(?:op|tijdens|bij)\s*(?:het\s*)?werk/i, /\bvallen\s*(?:op|tijdens)\s*(?:het\s*)?werk/i],
    terms: ['bedrijfsongeval', 'arbeidsongeval', 'art. 7:658', 'werkgeversaansprakelijkheid', 'Arbeidsinspectie melding', 'schadevergoeding letsel', 'zorgplicht werkgever', 'bewijslast'],
  },
  // 251. Asbestblootstelling
  {
    patterns: [/\basbest(?:blootstelling|schade|ziekte|slachtoffer|claim)/i, /\bmesothelioom/i, /\basbestose/i, /\basbest\s*(?:op|bij|tijdens)\s*(?:het\s*)?werk/i, /\binstituut\s*asbestslachtoffers/i],
    terms: ['asbestblootstelling', 'mesothelioom', 'asbestose', 'Instituut Asbestslachtoffers', 'werkgeversaansprakelijkheid', 'art. 7:658', 'verjaring', 'proportionele aansprakelijkheid'],
  },
  // 252. Beroepsziekten melden
  {
    patterns: [/\bberoepsziekte\s*(?:meld|registr|aangifte|rapport)/i, /\bmeld(?:en|ing)\s*beroepsziekte/i, /\bncvb\b/i, /\bnederlands\s*centrum\s*(?:voor\s*)?beroepsziekten/i, /\bsignaleringsrapport\s*beroepsziekten/i],
    terms: ['beroepsziekte melden', 'Nederlands Centrum voor Beroepsziekten', 'NCVB', 'meldingsplicht bedrijfsarts', 'registratie beroepsziekten', 'Arbowet', 'preventie'],
  },
  // 253. Werkgeversaansprakelijkheid verkeer
  {
    patterns: [/\bverkeersongeval\s*(?:werk|dienst|zakel)/i, /\baansprakelijkheid\s*(?:verkeers|auto|weg)\s*(?:werk|dienst)/i, /\bongeval\s*(?:woon-?werk|onderweg|dienst|zakel)/i, /\bart\.?\s*7:611\b/i, /\bwerkgever\s*(?:aansprakelijk\s*)?verkeersongeval/i],
    terms: ['werkgeversaansprakelijkheid verkeer', 'art. 7:611', 'art. 7:658', 'woon-werkverkeer', 'goed werkgeverschap', 'adequate verzekering', 'Kooiker/Taxicentrale-arrest'],
  },
  // 254. Aansprakelijkheid uitzendkracht / inlener
  {
    patterns: [/\baansprakelijkheid\s*(?:uitzend|inlen|uitlen)/i, /\buitzendkracht\s*(?:letsel|ongeval|schade|aansprakelijk)/i, /\binlener(?:saansprakelijkheid)?\b/i, /\bketenaansprakelijkheid\s*(?:letsel|arbeid)/i, /\bart\.?\s*7:658\s*lid\s*4/i],
    terms: ['aansprakelijkheid inlener', 'art. 7:658 lid 4', 'uitzendkracht letsel', 'zorgplicht inlener', 'werkgeversaansprakelijkheid', 'ketenaansprakelijkheid', 'Davelaar/Allspan'],
  },
  // 255. RI&E verplichtingen
  {
    patterns: [/\bri&?e\b/i, /\brisico-?inventarisatie\s*(?:en\s*)?(?:-?evaluatie)?/i, /\bplan\s*van\s*aanpak\s*(?:arbo|ri&?e|veiligheid)/i, /\bri&?e\s*(?:verplicht|toets|actualis|opstel|ontbreekt)/i, /\barbocatalogus/i],
    terms: ['RI&E', 'risico-inventarisatie en -evaluatie', 'plan van aanpak arbo', 'Arbowet art. 5', 'arbocatalogus', 'toetsing RI&E', 'Arbeidsinspectie', 'boete ontbreken RI&E'],
  },
  // 256. Arbobeleid en preventiemedewerker
  {
    patterns: [/\barbobeleid\s*(?:verplicht|opzetten|inhoud)/i, /\bpreventiemedewerker\s*(?:taak|verplicht|aanstell|benoem)/i, /\barbodienst\s*(?:contract|verplicht|kiezen|maatwerkregeling)/i, /\bverzuimbeleid\s*(?:opzetten|invoer|verplicht)/i, /\bmaatwerkregeling\s*arbo/i],
    terms: ['arbobeleid', 'preventiemedewerker', 'Arbowet art. 13', 'arbodienstverlening', 'maatwerkregeling', 'vangnetregeling', 'basiscontract arbodienst', 'Arbeidsinspectie'],
  },
  // 257. Psychosociale arbeidsbelasting (PSA)
  {
    patterns: [/\bpsychosociale?\s*arbeidsbelasting/i, /\bpsa\b(?=.*(?:werk|beleid|arbo))/i, /\bwerkdruk\s*(?:beleid|aanpak|verplicht)/i, /\bagressie\s*(?:op\s*)?(?:het\s*)?(?:werk|werkvloer)/i, /\bpesten\s*(?:op\s*)?(?:het\s*)?(?:werk|werkvloer)/i, /\bseksuele?\s*intimidatie\s*(?:op\s*)?(?:het\s*)?werk/i],
    terms: ['psychosociale arbeidsbelasting', 'PSA', 'Arbowet art. 3', 'werkdrukbeleid', 'ongewenst gedrag', 'pesten op werk', 'seksuele intimidatie', 'agressie', 'discriminatie op werk'],
  },
  // 258. Veiligheidsvoorschriften niet naleven
  {
    patterns: [/\bveiligheidsvoorschriften?\s*(?:niet\s*)?(?:nalev|overtre|schend)/i, /\bpbm\s*(?:niet|weiger)/i, /\bpersoonlijke?\s*beschermingsmiddel/i, /\bwerknemer\s*(?:weigert|draagt\s*niet)\s*(?:helm|veiligheid|pbm)/i, /\bonveilig\s*(?:werken|werk|situatie)/i],
    terms: ['veiligheidsvoorschriften', 'persoonlijke beschermingsmiddelen', 'art. 7:658', 'art. 11 Arbowet', 'eigen schuld werknemer', 'opzet of bewuste roekeloosheid', 'Arbeidsinspectie'],
  },

  // ===== PRAKTISCHE HR-SITUATIES (uitgebreid) =====

  // 259. Functioneringsgesprek juridisch
  {
    patterns: [/\bfunctioneringsgesprek\s*(?:juridisch|dossier|verslaglegging|weiger|verplicht)/i, /\bbeoordelingsgesprek\s*(?:juridisch|dossier|verslaglegging|weiger|verplicht)/i, /\bjaarlijks\s*(?:gesprek|beoordeling|functionering)/i, /\bverslaglegging\s*(?:functionering|beoordeling)/i],
    terms: ['functioneringsgesprek', 'beoordelingsgesprek', 'dossieropbouw', 'verslaglegging', 'hoor en wederhoor', 'verbetertraject', 'disfunctioneren'],
  },
  // 260. Verbeterplan / PIP juridisch
  {
    patterns: [/\bverbeterplan\s*(?:juridisch|opstel|eisen|duur|inhoud|afgewe)/i, /\bpip\s*(?:juridisch|opstel|eisen|weiger|afgewezen)/i, /\bperformance\s*improvement\s*plan/i, /\bverbetertraject\s*(?:opstel|eisen|duur|inhoud|misluk)/i, /\bverbeterkans/i],
    terms: ['verbeterplan', 'PIP', 'performance improvement plan', 'art. 7:669 lid 3 sub d', 'disfunctioneren', 'redelijke termijn', 'SMART-doelen', 'coaching', 'begeleiding'],
  },
  // 261. Demotie
  {
    patterns: [/\bdemotie\b/i, /\bterugzetting\s*(?:in\s*)?(?:functie|rang|schaal)/i, /\bfunctie\s*(?:verlaging|degradatie|terugzetting)/i, /\blagere?\s*(?:functie|rang|schaal)\s*(?:aangeboden|opgelegd)/i, /\bdegradatie\b/i],
    terms: ['demotie', 'eenzijdige functiewijziging', 'art. 7:611', 'art. 7:613', 'redelijkheid en billijkheid', 'goed werkgeverschap', 'Stoof/Mammoet', 'salarisverlaging'],
  },
  // 262. Schorsing vs op non-actiefstelling
  {
    patterns: [/\bschorsing\s*(?:werknemer|vs|versus|verschil)/i, /\bnon-?actief(?:stelling)?\b/i, /\bop\s*non-?actief/i, /\bvrijstelling\s*van\s*(?:werk|werkzaamheden)/i, /\bgeschorst\b/i, /\bhuis\s*(?:gestuurd|blijven)\s*(?:door\s*)?werkgever/i],
    terms: ['schorsing', 'op non-actiefstelling', 'vrijstelling van werkzaamheden', 'loondoorbetaling', 'art. 7:628', 'goed werkgeverschap', 'kort geding wedertewerkstelling'],
  },
  // 263. Geheimhoudingsbeding detail
  {
    patterns: [/\bgeheimhouding(?:sbeding|sclausule|splicht|sverplichting)/i, /\bgeheimhouding\s*(?:overtre|schend|boete)/i, /\bvertrouwelijke?\s*informatie\s*(?:werk|delen|lekken)/i, /\bnda\b(?=.*(?:werk|arbeid|overtre))/i, /\bbedrijfsgeheim(?:en)?\s*(?:bescherm|schend|lekken)/i],
    terms: ['geheimhoudingsbeding', 'bedrijfsgeheimen', 'Wet bescherming bedrijfsgeheimen', 'boetebeding', 'schadevergoeding', 'art. 7:611', 'NDA'],
  },
  // 264. Relatiebeding vs concurrentiebeding
  {
    patterns: [/\brelatiebeding\s*(?:vs|versus|verschil|en|of)\s*(?:concurrentie)/i, /\brelatiebeding\s*(?:geldig|rechtsgeldig|schriftelijk|overtr)/i, /\brelatiebeding\b/i, /\bklanten\s*(?:meenemen|benaderen|binden)\s*(?:na|bij)\s*(?:vertrek|ontslag|einde)/i],
    terms: ['relatiebeding', 'concurrentiebeding', 'art. 7:653', 'schriftelijkheidsvereiste', 'belangenafweging', 'matiging', 'boete overtreding', 'verschil relatie- concurrentiebeding'],
  },
  // 265. Intellectual property werknemer / uitvinding
  {
    patterns: [/\bintellectueel\s*eigendom\s*(?:werk|arbeid)/i, /\buitvinding\s*(?:werknemer|werkgever|arbeid)/i, /\boctrooirecht\s*werknemer/i, /\bauteursrecht\s*(?:werk|arbeid|maker)/i, /\bip\s*(?:recht|beding)\s*(?:werk|arbeid)/i, /\bwie\s*(?:is\s*)?eigenaar\s*(?:van\s*)?(?:uitvinding|software|ontwerp|werk)/i],
    terms: ['intellectueel eigendom', 'uitvinding werknemer', 'art. 7:610 BW', 'auteursrecht werkgever', 'art. 7 Auteurswet', 'octrooi werknemer', 'billijke vergoeding uitvinding', 'Rijksoctrooiwet'],
  },
  // 266. Social media beleid werkgever
  {
    patterns: [/\bsocial\s*media\s*(?:beleid|ontslag|bericht|post|uitlating)/i, /\buitlating\s*(?:op\s*)?(?:social\s*media|twitter|linkedin|facebook|instagram)/i, /\bontslag\s*(?:door|wegens|vanwege)\s*(?:social\s*media|bericht|post|tweet)/i, /\bvrijheid\s*(?:van\s*)?(?:menings)?uiting\s*(?:werk|arbeid)/i],
    terms: ['social media beleid', 'vrijheid van meningsuiting', 'art. 10 EVRM', 'goed werknemerschap', 'art. 7:611', 'schade reputatie werkgever', 'dringende reden', 'instructierecht'],
  },
  // 267. Cameratoezicht op de werkplek
  {
    patterns: [/\bcamera(?:toezicht|bewaking)?\s*(?:op\s*)?(?:de\s*)?(?:werk|kantoor|bedrijf)/i, /\bcamera\s*(?:werk|kantoor|bedrijf|werkvloer)/i, /\bheimelijk\s*(?:camera|filmen|opnemen)/i, /\bverborgen\s*camera\s*(?:werk|kantoor)/i, /\btoezicht\s*(?:camera|beeldmateriaal)\s*(?:werk|arbeid)/i],
    terms: ['cameratoezicht werkplek', 'AVG', 'art. 27 lid 1 sub l WOR', 'instemmingsrecht OR', 'heimelijk cameratoezicht', 'gerechtvaardigd belang', 'proportionaliteit', 'Autoriteit Persoonsgegevens'],
  },
  // 268. E-mail monitoring werknemer
  {
    patterns: [/\bemail\s*(?:monitor|controle|meelezen|inzien)/i, /\be-?mail\s*(?:monitor|controle|meelezen|inzien)\s*(?:werk|arbeid)/i, /\bwerkgever\s*(?:leest|controleert|monitort)\s*(?:e-?mail|berichten)/i, /\bprivacy\s*(?:e-?mail|berichten|communicatie)\s*(?:werk|arbeid)/i, /\bbarbulescu\b/i],
    terms: ['e-mail monitoring', 'AVG', 'art. 8 EVRM', 'privacy werknemer', 'Barbulescu-arrest', 'proportionaliteit', 'gerechtvaardigd belang', 'bedrijfsmiddelen'],
  },
  // 269. Alcohol- en drugstest op het werk
  {
    patterns: [/\balcohol\s*(?:test|controle|beleid|op\s*(?:het\s*)?werk)/i, /\bdrugs?\s*(?:test|controle|beleid|op\s*(?:het\s*)?werk)/i, /\balcohol-?\s*(?:en\s*)?drugs?\s*(?:test|beleid|controle)/i, /\bonder\s*invloed\s*(?:op\s*)?(?:het\s*)?werk/i, /\bdronken\s*(?:op\s*)?(?:het\s*)?werk/i],
    terms: ['alcohol- en drugstest', 'AVG', 'bijzondere persoonsgegevens', 'Arbowet', 'veiligheid', 'privacy', 'ontslag wegens alcohol', 'verslaving', 'ziekte of gedrag'],
  },
  // 270. Medische keuring bij sollicitatie
  {
    patterns: [/\bmedische?\s*keuring\s*(?:sollicitatie|aanstelling|voor|bij)/i, /\baanstellingskeuring/i, /\bwet\s*(?:op\s*de\s*)?medische?\s*keuring/i, /\bwmk\b/i, /\bgezondheidsverklaring\s*(?:werk|sollicitatie)/i, /\bkeuring\s*(?:voor|bij)\s*(?:werk|functie)/i],
    terms: ['aanstellingskeuring', 'Wet op de medische keuringen', 'WMK', 'gezondheidseis', 'bijzondere functie-eisen', 'Commissie Klachtenbehandeling', 'privacy medische gegevens'],
  },
  // 271. Assessment en selectie
  {
    patterns: [/\bassessment\s*(?:centrum|center|werk|sollicitatie|verplicht|weiger)/i, /\bpsychologisch\s*(?:test|onderzoek|assessment)\s*(?:werk|sollicit)/i, /\bcapaciteiten(?:test|onderzoek)\s*(?:werk|sollicit)/i, /\bpersoonlijkheidstest\s*(?:werk|sollicit)/i],
    terms: ['assessment', 'psychologisch onderzoek', 'NIP-richtlijnen', 'privacy', 'AVG', 'selectieprocedure', 'gelijke behandeling', 'discriminatieverbod'],
  },
  // 272. Outplacement
  {
    patterns: [/\boutplacement\s*(?:regeling|kosten|recht|verplicht|aanbod)/i, /\boutplacement\b/i, /\bre-?integratie\s*(?:tweede\s*spoor|2e\s*spoor|extern)/i, /\bbegeleid(?:ing)?\s*(?:naar\s*)?(?:ander\s*)?werk/i, /\bloopbaanbegeleiding\s*(?:bij\s*)?ontslag/i],
    terms: ['outplacement', 'loopbaanbegeleiding', 'spoor 2', 'scholing', 'transitievergoeding', 'vaststellingsovereenkomst', 're-integratie extern'],
  },
  // 273. Waarschuwing / officiële waarschuwingsbrief
  {
    patterns: [/\bwaarschuwing(?:sbrief)?\s*(?:officieel|officiële|formeel|formele|geven|ontvangen|werk)/i, /\bofficiële?\s*waarschuwing\s*(?:werk|arbeid)/i, /\bschriftelijke?\s*waarschuwing\s*(?:werk|arbeid)/i, /\bberisping\b/i, /\bdossier(?:opbouw)?\s*(?:waarschuwing|brief)/i],
    terms: ['officiële waarschuwing', 'schriftelijke waarschuwing', 'berisping', 'dossieropbouw', 'hoor en wederhoor', 'personeelsdossier', 'disfunctioneren', 'verwijtbaar handelen'],
  },

  // ===== BIJZONDERE ARBEIDSRELATIES (uitgebreid) =====

  // 274. Oproepcontract nuances
  {
    patterns: [/\boproep(?:contract|overeenkomst)\s*(?:nuance|recht|uren|weiger|opkom)/i, /\bnul\s*uren\s*(?:contract|recht|opzeg|weiger)/i, /\boproepkracht\s*(?:recht|weiger|uren|vast\s*aanbod)/i, /\bvast\s*uren\s*aanbod\s*(?:oproep|wab)/i, /\b12\s*maanden\s*(?:oproep|aanbod|vast)/i],
    terms: ['oproepcontract', 'nul-urencontract', 'WAB', 'vast urenaanbod 12 maanden', 'art. 7:628a', 'oproeptermijn 4 dagen', 'opzegtermijn oproepkracht', 'rechtsvermoeden arbeidsomvang'],
  },
  // 275. Min-max contract
  {
    patterns: [/\bmin-?max\s*(?:contract|overeenkomst|uren)/i, /\bminimum\s*(?:en\s*)?maximum\s*uren\s*(?:contract|overeenkomst)/i, /\bbandbreedtecontract/i, /\bmin-?max\b/i],
    terms: ['min-max contract', 'art. 7:628a', 'oproepovereenkomst', 'rechtsvermoeden arbeidsomvang', 'WAB', 'vast urenaanbod', 'bandbreedte uren'],
  },
  // 276. Jaarurennorm
  {
    patterns: [/\bjaaruren(?:norm|systeem|model)/i, /\bjaar\s*uren\s*(?:norm|systeem|model)/i, /\bannualisering\s*(?:arbeidstijd|uren)/i, /\bjaarlijkse?\s*uren(?:norm|budget|saldo)/i],
    terms: ['jaarurennorm', 'annualisering arbeidstijd', 'Arbeidstijdenwet', 'flexibele werktijden', 'urensaldo', 'min-max uren', 'compensatie-uren'],
  },
  // 277. Uitzendkracht fase ABC
  {
    patterns: [/\buitzend\s*(?:fase|fases)\s*(?:a|b|c)/i, /\bfase\s*(?:a|b|c)\s*(?:uitzend|uitzendbeding)/i, /\buitzendbeding/i, /\buitzend-?cao\s*(?:fase|recht)/i, /\b(?:ABU|NBBU)\s*(?:cao|fase|regeling)/i],
    terms: ['uitzend fase A', 'uitzend fase B', 'uitzend fase C', 'uitzendbeding', 'ABU CAO', 'NBBU CAO', 'ketenregeling uitzend', 'inlenersbeloning'],
  },
  // 278. Detachering vs uitzending
  {
    patterns: [/\bdetachering\s*(?:vs|versus|verschil|of)\s*(?:uitzend)/i, /\bdetachering\s*(?:recht|juridisch|constructie|overeenkomst)/i, /\bverschil\s*(?:detachering|uitzend|uitlen)/i, /\bdetacheringsovereenkomst/i],
    terms: ['detachering', 'uitzending', 'verschil detachering uitzending', 'inlener', 'uitlener', 'gezagsverhouding', 'WAADI', 'allocatiefunctie'],
  },
  // 279. Collegiale uitleen
  {
    patterns: [/\bcollegiale?\s*(?:uit|in)leen/i, /\buitleen\s*(?:werknemer|personeel|collega)/i, /\bwerknemer\s*uitlenen/i, /\bwaadi\b/i, /\buitlening\s*(?:personeel|werknemer)/i],
    terms: ['collegiale uitleen', 'WAADI', 'uitlening zonder winstoogmerk', 'inlenersaansprakelijkheid', 'toestemming werknemer', 'art. 7:690'],
  },
  // 280. Freelance vs arbeidsovereenkomst (Deliveroo)
  {
    patterns: [/\bfreelance\s*(?:vs|versus|of)\s*(?:arbeids|dienst|loondienst)/i, /\bdeliveroo\s*(?:arrest|uitspraak|criterium)/i, /\bplatform(?:werk|arbeid|economie)\s*(?:arbeids|recht)/i, /\bzzp\s*(?:vs|versus|of)\s*(?:arbeids|werknemer|loondienst)/i, /\bschijn\s*(?:zzp|zelfstandig|constructie)/i],
    terms: ['Deliveroo-arrest', 'kwalificatie arbeidsovereenkomst', 'platformarbeid', 'gezagsverhouding', 'inbedding', 'art. 7:610', 'schijnzelfstandigheid', 'holistische toets'],
  },
  // 281. Thuiswerken / Wet flexibel werken
  {
    patterns: [/\bthuiswerk(?:en|er|plek)\s*(?:recht|verplicht|weiger|wet|verzoek)/i, /\bwet\s*flexibel\s*werken/i, /\bwfw\b/i, /\bhybride?\s*werk(?:en)?\s*(?:recht|beleid|verplicht)/i, /\bverzoek\s*(?:thuis|hybride|flexibel)\s*werk/i, /\bwerkgever\s*(?:weigert|mag\s*weigeren)\s*thuiswerk/i],
    terms: ['thuiswerken', 'Wet flexibel werken', 'WFW', 'verzoek aanpassing arbeidsplaats', 'hybride werken', 'arbo thuiswerkplek', 'thuiswerkvergoeding', 'instructierecht'],
  },
  // 282. Stagiair rechten
  {
    patterns: [/\bstage\s*(?:overeenkomst|contract|recht|vergoeding|verplicht)/i, /\bstagiai?r\s*(?:recht|vergoeding|ontslag|bescherm)/i, /\bstage(?:vergoeding|loon|overeenkomst)/i, /\bstagiair\b/i, /\bwerknemerschap\s*stagiair/i],
    terms: ['stageovereenkomst', 'stagiair rechten', 'stagevergoeding', 'leerovereenkomst', 'arbeidsovereenkomst of stage', 'art. 7:610', 'BBL', 'BOL'],
  },
  // 283. Vrijwilligerswerk vs arbeidsrelatie
  {
    patterns: [/\bvrijwillig(?:er|ers)?(?:werk|overeenkomst)?\s*(?:vs|versus|of|arbeids)/i, /\bvrijwilliger\s*(?:recht|vergoeding|arbeidsovereenkomst|verzeker)/i, /\bis\s*(?:een\s*)?vrijwilliger\s*(?:een\s*)?werknemer/i, /\bvrijwilligersvergoeding\s*(?:grens|max|belasting)/i],
    terms: ['vrijwilligerswerk', 'arbeidsovereenkomst', 'art. 7:610', 'vergoeding vrijwilliger', 'maximumbedrag vrijwilligersvergoeding', 'loon of vergoeding', 'afhankelijkheid'],
  },

  // ===== LOON EN VERGOEDINGEN (uitgebreid) =====

  // 284. Wachtdagcompensatie
  {
    patterns: [/\bwachtdag(?:en)?\s*(?:compensatie|vergoeding|ziekte|loon)/i, /\beerste?\s*(?:twee\s*)?(?:ziekte)?dag(?:en)?\s*(?:geen\s*)?loon/i, /\bwachtdag(?:en)?\b/i, /\bgeen\s*loon\s*(?:eerste|wacht)\s*dag/i],
    terms: ['wachtdagen', 'wachtdagcompensatie', 'art. 7:629 lid 9', 'CAO-bepaling', 'loondoorbetaling ziekte', 'eerste ziektedag', 'twee wachtdagen'],
  },
  // 285. Reiskostenvergoeding
  {
    patterns: [/\breiskosten(?:vergoeding)?\s*(?:recht|verplicht|belasting|hoogte|wijzig|stop)/i, /\bwoon-?werkverkeer\s*(?:vergoeding|kosten)/i, /\bkilometervergoeding\s*(?:werk|woon)/i, /\bns-?(?:business)?card\s*(?:werk|verplicht)/i, /\breiskosten\s*(?:stoppen|verlagen|wijzigen)/i],
    terms: ['reiskostenvergoeding', 'woon-werkverkeer', 'kilometervergoeding', 'gerichte vrijstelling', 'werkkostenregeling', 'WKR', 'verworven recht'],
  },
  // 286. Thuiswerkvergoeding
  {
    patterns: [/\bthuiswerk(?:vergoeding|kosten)\b/i, /\bvergoeding\s*(?:voor\s*)?thuiswerk/i, /\bthuiswerk\s*(?:kosten|faciliteit|budget)/i, /\barbo\s*(?:thuiswerk|thuis)/i, /\binrichting\s*(?:thuiswerk|werkplek\s*thuis)/i],
    terms: ['thuiswerkvergoeding', 'gerichte vrijstelling', 'werkkostenregeling', 'WKR', 'arbo thuiswerkplek', 'Arbowet', 'thuiswerkbeleid'],
  },
  // 287. Overwerkvergoeding
  {
    patterns: [/\boverwerk(?:vergoeding|toeslag|uren|betaling)?\b/i, /\boveruren\s*(?:betalen|vergoeding|uitbetal|compensat)/i, /\bmeer(?:uren|werk)\s*(?:vergoeding|betaling|compensat)/i, /\boverwerk\s*(?:weiger|verplicht|mag)/i],
    terms: ['overwerkvergoeding', 'overwerktoeslag', 'Arbeidstijdenwet', 'CAO-overwerk', 'time for time', 'compensatie-uren', 'art. 7:610'],
  },
  // 288. Ploegentoeslag / onregelmatigheidstoeslag
  {
    patterns: [/\bploegentoeslag\s*(?:recht|berekenen|hoogte|CAO)/i, /\bonregelmatigheid(?:stoeslag|svergoeding)/i, /\bshifttoeslag/i, /\bnachtdienst\s*(?:toeslag|vergoeding)/i, /\bweekend\s*(?:toeslag|vergoeding|werk)/i, /\bavond(?:dienst|toeslag|vergoeding)/i],
    terms: ['ploegentoeslag', 'onregelmatigheidstoeslag', 'ORT', 'nachtdiensttoeslag', 'weekendtoeslag', 'CAO-toeslag', 'Arbeidstijdenwet'],
  },
  // 289. Dertiende maand / eindejaarsuitkering
  {
    patterns: [/\bdertiende?\s*maand/i, /\b13e?\s*maand/i, /\beindejaars(?:uitkering|bonus|gratificatie)/i, /\bkerstgratificatie/i, /\bdertiende?\s*maand\s*(?:recht|verplicht|pro\s*rata|weiger)/i],
    terms: ['dertiende maand', 'eindejaarsuitkering', 'CAO-bepaling', 'verworven recht', 'pro rata', 'voorwaardelijke toekenning', 'gratificatie'],
  },
  // 290. Winstdeling / bonus
  {
    patterns: [/\bwinstdeling\s*(?:recht|regeling|aanspraak|stoppen|wijzig)/i, /\bbonus(?:regeling)?\s*(?:recht|discretionair|voorwaardelijk|weiger|niet\s*uitbetaald)/i, /\btarget(?:bonus)?\s*(?:niet|weiger|recht)/i, /\bvariabel\s*(?:loon|beloning|inkomen)\s*(?:recht|weiger)/i],
    terms: ['winstdeling', 'bonusregeling', 'discretionaire bonus', 'variabele beloning', 'targetbonus', 'goed werkgeverschap', 'art. 7:611', 'verworven recht'],
  },
  // 291. Aandelenopties / RSU / werknemersparticipatie
  {
    patterns: [/\baandelenoptie\s*(?:werknemer|regeling|vest|verval)/i, /\brsu\b/i, /\brestricted\s*stock/i, /\bwerknemer(?:s)?participatie/i, /\bstock\s*option\s*(?:plan|regeling|werknemer)/i, /\bvesting\s*(?:bij\s*)?(?:ontslag|vertrek|einde)/i],
    terms: ['aandelenopties', 'RSU', 'werknemersparticipatie', 'vesting', 'loon in natura', 'belasting aandelenopties', 'good leaver', 'bad leaver', 'clawback'],
  },
  // 292. Auto van de zaak
  {
    patterns: [/\bauto\s*(?:van\s*)?(?:de\s*)?zaak\s*(?:intrekken|innemen|recht|teruggeven|privé|bijtelling)/i, /\bleaseauto\s*(?:intrekken|innemen|recht|teruggeven|wijzig)/i, /\bbijtelling\s*(?:auto|lease)/i, /\bauto\s*(?:bij\s*)?(?:ontslag|ziekte|einde\s*dienstverband)/i],
    terms: ['auto van de zaak', 'leaseauto', 'bijtelling', 'arbeidsvoorwaarde', 'innemen auto', 'eenzijdige wijziging', 'loon in natura', 'verworven recht'],
  },
  // 293. Loonvordering / werkgever betaalt niet
  {
    patterns: [/\bloonvordering/i, /\bloon\s*niet\s*(?:betaald|uitbetaald|ontvangen|gekregen)/i, /\bwerkgever\s*(?:betaalt|betaald)\s*(?:niet|geen\s*loon|laat)/i, /\bachterstallig\s*loon/i, /\bloon\s*(?:te\s*laat|achterstallig|vorderen)/i, /\bwettelijke?\s*verhoging\s*(?:loon|art)/i],
    terms: ['loonvordering', 'achterstallig loon', 'art. 7:625', 'wettelijke verhoging', 'wettelijke rente', 'kort geding loon', 'beslag loon', 'incasso loon'],
  },

  // ===== INFORMELE VARIANTEN EN EMOTIONELE TAAL =====

  // 294. "ik word gepest door mijn leidinggevende"
  {
    patterns: [/\bgepest\s*(?:door|op)\s*(?:mijn\s*)?(?:werk|baas|leidinggevende|manager|collega)/i, /\bpesten\s*(?:door|op)\s*(?:het\s*)?werk/i, /\bmobbing/i, /\btreiteren\s*(?:op\s*)?(?:het\s*)?werk/i, /\bintimid(?:atie|eren)\s*(?:door\s*)?(?:mijn\s*)?(?:baas|leidinggevende|collega)/i],
    terms: ['pesten op het werk', 'psychosociale arbeidsbelasting', 'Arbowet art. 3', 'ongewenst gedrag', 'klachtenprocedure', 'vertrouwenspersoon', 'werkgeversaansprakelijkheid', 'art. 7:658'],
  },
  // 295. "mijn werkgever betaalt niet uit"
  {
    patterns: [/\bwerkgever\s*(?:betaalt|betaald)\s*(?:mij\s*)?niet\s*(?:uit|meer)/i, /\bkrijg\s*(?:mijn\s*)?(?:loon|salaris|geld)\s*niet/i, /\bgeen\s*(?:loon|salaris)\s*(?:ontvangen|gekregen|gestort)/i, /\b(?:loon|salaris)\s*(?:niet\s*)?(?:gestort|overgemaakt|ontvangen)/i, /\bwanneer\s*(?:krijg\s*ik|komt)\s*(?:mijn\s*)?(?:loon|salaris)/i],
    terms: ['loonvordering', 'achterstallig loon', 'art. 7:625', 'wettelijke verhoging', 'kort geding', 'incasso', 'beslag', 'faillissement werkgever'],
  },
  // 296. "mag mijn baas mij dwingen"
  {
    patterns: [/\bmag\s*(?:mijn\s*)?(?:baas|werkgever|manager|leidinggevende)\s*(?:mij\s*)?(?:dwingen|verplichten|eisen|opdragen)/i, /\bben\s*ik\s*verplicht\s*(?:om\s*)?(?:te\s*)?/i, /\bmoet\s*ik\s*(?:van\s*)?(?:mijn\s*)?(?:baas|werkgever)/i, /\bkan\s*(?:mijn\s*)?(?:baas|werkgever)\s*(?:mij\s*)?(?:dwingen|verplichten)/i],
    terms: ['instructierecht werkgever', 'art. 7:660', 'redelijke instructie', 'goed werknemerschap', 'art. 7:611', 'weigering redelijke opdracht', 'gezagsverhouding'],
  },
  // 297. "ik voel me onveilig op het werk"
  {
    patterns: [/\b(?:ik\s*)?(?:voel|ben)\s*(?:me\s*)?(?:niet\s*)?(?:on)?veilig\s*(?:op\s*)?(?:het\s*)?werk/i, /\bonveilige?\s*(?:werk)?(?:situatie|sfeer|omgeving|plek)/i, /\bbedreig(?:d|ing)\s*(?:op\s*)?(?:het\s*)?werk/i, /\bagressie\s*(?:op\s*)?(?:het\s*)?(?:werk|werkvloer)/i, /\bbang\s*(?:op|voor)\s*(?:het\s*)?werk/i],
    terms: ['onveilige werksituatie', 'zorgplicht werkgever', 'art. 7:658', 'Arbowet', 'psychosociale arbeidsbelasting', 'RI&E', 'klachtenprocedure', 'Arbeidsinspectie melding'],
  },
  // 298. "mijn contract wordt niet verlengd"
  {
    patterns: [/\bcontract\s*(?:wordt|is)\s*niet\s*(?:verlengd|hernieuwd|gecontinueerd)/i, /\bgeen\s*verlenging\s*(?:van\s*)?(?:mijn\s*)?contract/i, /\bcontract\s*(?:loopt\s*)?af\s*(?:en\s*)?(?:geen|niet)/i, /\baanzegging\s*(?:niet\s*)?(?:verlengen|beëindigen|einde)/i, /\beinde\s*(?:tijdelijk\s*)?contract\s*(?:en\s*)?nu/i],
    terms: ['einde tijdelijk contract', 'aanzegverplichting', 'art. 7:668', 'aanzegvergoeding', 'ketenregeling', 'WW-recht', 'transitievergoeding bij niet-verlenging'],
  },
  // 299. "ik word anders behandeld" / ongelijke behandeling
  {
    patterns: [/\banders?\s*behandeld/i, /\bongelijk\s*(?:behandeld|behandeling)/i, /\bgediscrimineerd\s*(?:op\s*)?(?:het\s*)?werk/i, /\bvoorgetrokken/i, /\bachtergesteld/i, /\bik\s*word\s*(?:niet\s*)?(?:gelijk|eerlijk)\s*behandeld/i],
    terms: ['gelijke behandeling', 'discriminatie', 'AWGB', 'art. 7:646', 'College voor de Rechten van de Mens', 'verboden onderscheid', 'bewijslast', 'gelijk loon voor gelijk werk'],
  },
  // 300. "mijn werkgever liegt" / onbetrouwbare werkgever
  {
    patterns: [/\bwerkgever\s*(?:liegt|liegen|liegt\s*tegen|oneerlijk|onbetrouwbaar)/i, /\bgelogen\s*(?:door\s*)?(?:mijn\s*)?werkgever/i, /\bvalse?\s*(?:reden|voorstelling|informatie)\s*(?:werkgever|ontslag)/i, /\bbedrog\s*(?:door\s*)?(?:mijn\s*)?werkgever/i, /\bwerkgever\s*houdt\s*(?:zich\s*)?niet\s*(?:aan\s*)?(?:afspraken|beloften)/i],
    terms: ['goed werkgeverschap', 'art. 7:611', 'dwaling', 'bedrog', 'nakoming', 'schadevergoeding', 'vertrouwensbeginsel', 'redelijkheid en billijkheid'],
  },
  // 301. "ik durf niet naar het werk" / angst voor werk
  {
    patterns: [/\bdurf\s*(?:niet\s*)?(?:naar\s*)?(?:het\s*)?werk/i, /\bbang\s*(?:om\s*)?(?:naar\s*)?(?:het\s*)?werk\s*(?:te\s*)?gaan/i, /\bangst\s*(?:voor|om)\s*(?:naar\s*)?(?:het\s*)?werk/i, /\bkan\s*(?:niet\s*meer\s*)?(?:naar\s*)?(?:het\s*)?werk\s*(?:door|vanwege)\s*(?:angst|stress|conflict)/i],
    terms: ['situatieve arbeidsongeschiktheid', 'bedrijfsarts', 'werkgerelateerde klachten', 'psychosociale arbeidsbelasting', 'mediation', 'zorgplicht werkgever', 'verzuim door conflict'],
  },
  // 302. "ze willen me weg hebben" / wegpestgedrag
  {
    patterns: [/\bze\s*willen\s*(?:me|mij)\s*(?:weg|eruit|kwijt)/i, /\bwegpest(?:en|gedrag)?\b/i, /\buitgerookt/i, /\bwerkgever\s*(?:wil|probeert)\s*(?:me|mij)\s*(?:weg|eruit|kwijt)/i, /\bopzettelijk\s*(?:moeilijk|onmogelijk)\s*(?:gemaakt|maken)/i, /\bconstructief\s*ontslag/i],
    terms: ['wegpesten', 'slecht werkgeverschap', 'art. 7:611', 'ernstig verwijtbaar werkgever', 'billijke vergoeding', 'ontbinding op verzoek werknemer', 'art. 7:671c', 'schadevergoeding'],
  },
  // 303. "ik krijg geen eerlijke kans" / verbetertraject oneerlijk
  {
    patterns: [/\bgeen\s*eerlijke?\s*kans/i, /\bverbetertraject\s*(?:oneerlijk|niet\s*eerlijk|schijn|nep)/i, /\bvalstrik/i, /\bset\s*up\s*(?:to\s*)?fail/i, /\bonhaalbare?\s*(?:doelen|targets|eisen)/i, /\bschijnverbetertraject/i],
    terms: ['verbetertraject', 'disfunctioneren', 'art. 7:669 lid 3 sub d', 'redelijke verbeterkans', 'SMART-doelen', 'hoor en wederhoor', 'zorgvuldigheid', 'objectieve criteria'],
  },
  // 304. Instructierecht werkgever / eenzijdige wijziging werktijden
  {
    patterns: [/\binstructierecht\s*(?:werkgever|grenzen|overtre)/i, /\bwijziging\s*(?:werk)?tijden\s*(?:eenzijdig|verplicht|zonder\s*overleg)/i, /\brooster(?:wijziging)?\s*(?:eenzijdig|verplicht|weiger)/i, /\bwerkgever\s*(?:wijzigt|verandert)\s*(?:mijn\s*)?(?:rooster|werktijden|taken)/i],
    terms: ['instructierecht', 'art. 7:660', 'eenzijdige roosterwijziging', 'redelijke instructie', 'Arbeidstijdenwet', 'art. 7:611', 'goed werkgeverschap', 'instemming werknemer'],
  },
  // 305. Loonbeslag / beslaglegging op loon
  {
    patterns: [/\bloonbeslag/i, /\bbeslag\s*(?:op\s*)?(?:mijn\s*)?loon/i, /\bderdenbeslag\s*(?:loon|salaris|werkgever)/i, /\bbeslagvrije?\s*voet/i, /\bdeurwaarder\s*(?:loon|werkgever|beslag)/i],
    terms: ['loonbeslag', 'derdenbeslag', 'beslagvrije voet', 'art. 475c Rv', 'verplichtingen werkgever', 'vtlb', 'deurwaarder', 'Wet vereenvoudiging beslagvrije voet'],
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
