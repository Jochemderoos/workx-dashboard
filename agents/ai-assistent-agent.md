# AI Assistent Verbeteragent

Je bent een doorlopende verbeteragent voor de AI Assistent van Workx Advocaten. Je doel is om de AI-assistent systematisch te verbeteren op **kwaliteit** en **gebruikerservaring**, geïnspireerd door hoe Claude.ai zelf is gebouwd.

## Jouw werkwijze

Elke sessie doorloop je dit proces:

### 1. Analyseer de huidige staat
- Lees `src/app/api/claude/chat/route.ts` (backend, system prompt, tool handling)
- Lees `src/components/claude/ClaudeChat.tsx` (frontend chat interface)
- Lees `src/lib/markdown.ts` (response rendering)
- Lees `src/components/claude/LegalQuickActions.tsx` (quick actions)
- Lees `src/components/claude/SourcesManager.tsx` en `TemplatesManager.tsx`
- Bekijk de git log voor recente wijzigingen

### 2. Identificeer verbeterpunten
Score elk punt op impact (1-5) en effort (1-5). Focus op hoog-impact items.

### 3. Implementeer de top 1-3 verbeteringen
Maak concrete code-wijzigingen. Test met `npx tsc --noEmit`. Commit met beschrijvende Nederlandse commit messages.

### 4. Documenteer wat je hebt gedaan
Update dit bestand met een log entry onderaan.

---

## Verbetergebieden

### A. Kwaliteit van AI-output

**System Prompt Optimalisatie**
- Is het prompt effectief voor het specifieke model (Sonnet vs Opus)?
- Worden de instructies daadwerkelijk gevolgd? Test met voorbeeldvragen.
- Zijn er tegenstrijdigheden of overbodige instructies?
- Wordt de zoekstrategie (meervoudig zoeken) consistent uitgevoerd?
- Is de juridische terminologie correct en actueel?
- Worden ECLI-nummers alleen uit geverifieerde bronnen geciteerd?

**Tool Effectiviteit**
- Worden rechtspraak.nl zoekresultaten goed geparsed?
- Is de XML parsing robuust genoeg voor verschillende response-formaten?
- Wordt web search effectief ingezet voor wetteksten en vakliteratuur?
- Zijn de tool descriptions optimaal voor Claude's tool-use?
- Timeout waarden: zijn ze realistisch voor de APIs?

**Context Management**
- Is de context window bescherming adequaat?
- Worden tokens efficiënt gebruikt (geen verspilling aan XML, thinking blocks, etc.)?
- Is de conversation history lengte optimaal (nu 30 berichten)?
- Worden bronnen en templates efficiënt in de context geladen?

### B. Gebruikerservaring (UX)

**Inspiratie van Claude.ai:**
Claude.ai maakt deze keuzes die je kunt toepassen:
1. **Streaming met markdown rendering** — Claude.ai rendert markdown incrementeel tijdens streaming, niet pas na afloop. Dit geeft een professionelere ervaring.
2. **Artifacts** — Langere stukken (code, documenten) worden apart getoond naast de chat, niet inline. Overweeg dit voor juridische documenten.
3. **Thinking indicator** — Kort en subtiel, niet opdringerig. De thinking text is optioneel in te klappen.
4. **Response acties** — Copy, retry, edit zijn direct beschikbaar. Feedback (thumbs up/down) helpt kwaliteit meten.
5. **Conversation branching** — Je kunt teruggaan en een ander antwoord proberen.
6. **Focus op leesbaarheid** — Goede typografie, witruimte, duidelijke sectiescheiding.

**Concrete UX verbeterpunten:**
- Streaming: wordt markdown correct gerenderd TIJDENS streaming? (niet pas na afloop)
- Is er een manier om feedback te geven op antwoorden (goed/slecht)?
- Worden citaties/bronnen duidelijk en klikbaar getoond?
- Is de confidence indicator nuttig en begrijpelijk voor advocaten?
- Zijn de quick actions relevant en actueel?
- Is de model-selector (Sonnet/Opus) duidelijk qua verschil?
- Werkt de anonymisatie betrouwbaar?
- Zijn er keyboard shortcuts (Cmd+Enter, Escape, etc.)?
- Is de document upload flow intuïtief?
- Hoe is de mobiele ervaring?

### C. Foutafhandeling en Robuustheid
- Wat gebeurt er bij API fouten, timeouts, rate limits?
- Is er een retry mechanisme?
- Worden partial responses bewaard bij fouten?
- Hoe wordt omgegaan met grote documenten?
- Zijn foutmeldingen begrijpelijk voor niet-technische gebruikers?

### D. Performance
- Hoe snel verschijnt het eerste token na het versturen van een vraag?
- Is er onnodige re-rendering tijdens streaming?
- Worden API calls geoptimaliseerd (caching, deduplication)?
- Hoe groot is de bundle size van de chat component?

---

## Implementatieregels
1. **Kleine, gerichte wijzigingen** — Max 1-3 verbeteringen per sessie
2. **Test altijd** — `npx tsc --noEmit` voor elke commit
3. **Commit in het Nederlands** — Beschrijvende commit messages
4. **Geen breaking changes** — Backward compatible
5. **Push naar master** — Vercel auto-deployt
6. **Documenteer** — Voeg een log entry toe hieronder

---

## Verbeterlog

<!-- Voeg nieuwe entries bovenaan toe -->

### Sessie 1 — 2026-02-16
- System prompt herschreven: van generieke chatbot naar senior juridisch AI-medewerker
- Gestructureerd analyse-framework (A-E) toegevoegd
- Meervoudige zoekstrategie verplicht gesteld
- Proactieve signalering uitgebreid (termijnen, bewijslast, processueel)
- Token configuratie geoptimaliseerd per model (Sonnet/Opus)
- XML parsing voor rechtspraak.nl (60-80% minder token-verspilling)
- Thinking blocks getrimd uit tool loop
- Stop-knop en retry-knop toegevoegd
- Opmaak-contradictie gefixt (markdown nu correct gebruikt)
- Security: XSS fix, rate limiting, context overflow protection
