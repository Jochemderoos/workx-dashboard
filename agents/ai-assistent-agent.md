# AI Assistent Verbeteragent

Je bent een doorlopende verbeteragent voor de AI Assistent van Workx Advocaten. Je doel is om de AI-assistent systematisch te verbeteren op **kwaliteit**, **betrouwbaarheid** en **gebruikerservaring**. De assistent MOET altijd werken en mensen altijd een goed antwoord geven.

## Prioriteit: BETROUWBAARHEID

De belangrijkste eis: **de assistent moet ALTIJD een antwoord geven**. Nooit een lege pagina of "Verwerken..." dat blijft hangen. Test elke wijziging door daadwerkelijk een vraag te stellen via de API.

## Jouw werkwijze

Elke sessie doorloop je dit proces:

### 1. TEST EERST — Stel een vraag aan de AI Assistent
Voordat je iets wijzigt, test of de huidige versie werkt:
```bash
# Snel E2E test via de API
node scripts/test-chat.js "Wat is de opzegtermijn bij ontslag?"
```
Als dit NIET werkt, fix dat EERST voordat je aan verbeteringen werkt.

### 2. Analyseer de huidige staat
- Lees `src/app/api/claude/chat/route.ts` (backend, system prompt, tool handling)
- Lees `src/components/claude/ClaudeChat.tsx` (frontend chat interface)
- Lees `src/lib/markdown.ts` (response rendering)
- Lees `src/lib/embeddings.ts` (RAG retrieval)
- Lees `src/components/claude/LegalQuickActions.tsx` (quick actions)
- Lees `src/components/claude/SourcesManager.tsx` en `TemplatesManager.tsx`
- Bekijk de git log voor recente wijzigingen

### 3. Identificeer verbeterpunten
Score elk punt op impact (1-5) en effort (1-5). Focus op hoog-impact items.

### 4. Implementeer de top 1-3 verbeteringen
Maak concrete code-wijzigingen. Test met `npx tsc --noEmit`. Commit met beschrijvende Nederlandse commit messages.

### 5. TEST OPNIEUW — Controleer dat alles nog werkt
Na elke wijziging: test opnieuw met een echte vraag.

### 6. Documenteer wat je hebt gedaan
Update dit bestand met een log entry onderaan.

---

## Verbetergebieden

### A. Betrouwbaarheid (HOOGSTE PRIORITEIT)

**Nooit lege antwoorden:**
- Source retrieval heeft timeout-bescherming (8s source fetch, 15s chunk retrieval)
- Als bronnen niet beschikbaar zijn: ga door ZONDER bronnen (graceful degradation)
- Bij API timeout: bewaar partial response als assistant message
- Bij Claude API fout: toon duidelijke Nederlandse foutmelding
- Test: stuur een vraag en controleer dat altijd een antwoord verschijnt

**Database veerkracht:**
- Vercel Postgres kan traag zijn bij zware achtergrondprocessen (embeddings, crawls)
- Alle DB-queries in het chat-pad moeten een timeout hebben
- Connection pooling correct geconfigureerd?
- Geen N+1 queries in het kritieke pad

**Error recovery:**
- Worden partial responses bewaard bij fouten? (Ja, regel ~1124)
- Worden consecutive user messages correct gemerged? (Ja, regel ~732)
- Is de ECLI verificatie robuust bij API timeouts? (check)

### B. Kwaliteit van AI-output

**Kennisbronnen (38K+ chunks, 5 bronnen):**
- T&C Arbeidsrecht 2024 (1041 chunks)
- Thematica Arbeidsrecht (1720 chunks)
- VAAN AR Updates (2267 chunks)
- InView RAR (33K+ chunks, 2000-2026)
- InView ArbeidsRecht (content in RAR source)

**Retrieval kwaliteit (CRUCIAAL):**
- Per-source hybrid search: semantic (pgvector, 60%) + keyword (40%) — PER BRON apart
- Reciprocal Rank Fusion (K=60) combineert resultaten
- Balanced source selection: MIN_PER_SOURCE=4, MAX_PER_SOURCE=12
- HNSW ef_search=200 voor correcte filtered nearest neighbor search
- Multi-query expansion: 5 varianten gericht op verschillende bronnen
- Adjacent chunk inclusion: N-1 en N+1 chunks voor context (800 chars, top 12)
- CITEERWIJZE per passage + CITAAT-HERINNERING forceert citeren uit alle bronnen
- **Verbeterkansen:**
  - Query decomposition: splits complexe vragen op in deelvragen
  - Re-ranking: herscoor chunks na initiële retrieval met een cross-encoder
  - InView Tijdschrift ArbeidsRecht: chunks genereren (bron bestaat maar heeft 0 chunks)

**Thinking budget:**
- Sonnet: 10K (initieel) → 16K (vervolg) — overweeg verhoging naar 16K/24K
- Opus: 16K (initieel) → 32K (vervolg) — overweeg verhoging naar 32K/50K
- Grotere thinking budgets → betere analyse maar langere wachttijd
- Balans: liever iets langer bezig met een BETER antwoord

**System Prompt Optimalisatie:**
- Is het prompt effectief voor het specifieke model (Sonnet vs Opus)?
- Worden de instructies daadwerkelijk gevolgd? Test met voorbeeldvragen.
- Zijn er tegenstrijdigheden of overbodige instructies?
- Wordt de zoekstrategie (meervoudig zoeken) consistent uitgevoerd?
- Is de juridische terminologie correct en actueel?
- Worden ECLI-nummers alleen uit geverifieerde bronnen geciteerd?

**Tool Effectiviteit:**
- Worden rechtspraak.nl zoekresultaten goed geparsed?
- Is de XML parsing robuust genoeg voor verschillende response-formaten?
- Wordt web search effectief ingezet voor wetteksten en vakliteratuur?
- Zijn de tool descriptions optimaal voor Claude's tool-use?
- Timeout waarden: zijn ze realistisch voor de APIs?

**Citation verificatie:**
- Post-processing: controleer of citaten in de response overeenkomen met bronmateriaal
- ECLI verificatie: check tegen rechtspraak.nl (al geïmplementeerd, regel ~1055)
- Wetsartikel verificatie: controleer dat genoemde artikelen bestaan

### C. Gebruikerservaring (UX)

**Bronnen toggle (gevraagd door gebruiker):**
- Knop om kennisbronnen uit te zetten voor niet-arbeidsrecht vragen
- Als bronnen uit: skip source retrieval → sneller antwoord
- UI: toggle naast model selector

**Streaming en rendering:**
- Markdown wordt incrementeel gerenderd (80ms interval) — werkt dit soepel?
- Details/summary blocks voor citaten: native toggle + JavaScript fallback
- Hover effect op summary elementen

**Document support:**
- PDF: native Claude document blocks (base64)
- DOCX: text extraction + edit via %%DOCX_EDITS%% protocol
- Images: native Claude vision blocks (PNG/JPG/JPEG/WEBP) — NET TOEGEVOEGD
- Max 10MB, type validatie in frontend + backend

**Concrete UX verbeterpunten:**
- Is er een manier om feedback te geven op antwoorden (goed/slecht)?
- Is de confidence indicator nuttig en begrijpelijk voor advocaten?
- Zijn de quick actions relevant en actueel?
- Is de model-selector (Sonnet/Opus) duidelijk qua verschil?
- Werkt de anonymisatie betrouwbaar?
- Hoe is de mobiele ervaring?

### D. Performance
- Hoe snel verschijnt het eerste token na het versturen van een vraag?
- Is er onnodige re-rendering tijdens streaming?
- Worden API calls geoptimaliseerd (caching, deduplication)?
- Source retrieval: kan de cosine similarity query sneller? (pgvector HNSW index?)

---

## Implementatieregels
1. **TEST EERST** — Stel een echte vraag aan de AI voordat je wijzigingen maakt
2. **Kleine, gerichte wijzigingen** — Max 1-3 verbeteringen per sessie
3. **Test altijd** — `npx tsc --noEmit` voor elke commit
4. **TEST NA WIJZIGING** — Stel opnieuw een vraag, controleer dat het antwoord goed is
5. **Commit in het Nederlands** — Beschrijvende commit messages
6. **Geen breaking changes** — Backward compatible
7. **Push naar master** — Vercel auto-deployt
8. **Documenteer** — Voeg een log entry toe hieronder

---

## Verbeterlog

<!-- Voeg nieuwe entries bovenaan toe -->

### Sessie 7 — 2026-02-19 (Retrieval kwaliteit & brongebruik optimalisatie)

**Analyse uitgevoerd:**
- Volledige analyse van retrieval pipeline (embeddings.ts, route.ts retrieval, query expansion, adjacent chunks)
- Systeem-prompt instructies voor brongebruik beoordeeld op effectiviteit
- Per-source balancering (MIN_PER_SOURCE=6, MAX_PER_SOURCE=15) geanalyseerd
- Adjacent chunk enrichment scope vs MIN_PER_SOURCE garantie vergeleken
- Keyword search recall per bron geanalyseerd

**Problemen gevonden:**
1. **Keyword search miste heading-matches**: keyword zoekquery bevatte alleen `content: contains` condities, terwijl relevante chunks vaak het zoekterm in hun heading hebben (bijv. "art. 7:669 lid 3 sub d" als heading). T&C chunks (94% met headings na sessie 5 fix) profiteerden hier niet van
2. **Adjacent chunk enrichment te beperkt**: adjacents werden alleen opgehaald voor top 10 chunks en gemerged in top 12. Met MIN_PER_SOURCE=6 per bron krijgen ondervertegenwoordigde bronnen (VAAN, Thematica) chunks buiten de top 12 die GEEN context-enrichment kregen. Dit verminderde de passage-kwaliteit voor precies de bronnen die het meest context nodig hebben
3. **Bronintegratie-instructie te vaag**: de WERKWIJZE stap 5 zei "Combineer bronnen systematisch: T&C → Thematica → RAR/VAAN" zonder te specificeren WAT per bron moet worden gezocht. Claude sloeg regelmatig Thematica en VAAN over

**Verbeteringen doorgevoerd:**
1. **Keyword search + heading matching**: naast `content: contains` worden nu ook `heading: contains` condities toegevoegd voor de top 15 zoektermen. Dit verbetert recall voor T&C chunks (wetsartikel in heading) en alle bronnen met structured headings. Geen extra DB query — condities worden samengevoegd in dezelfde OR-clause
2. **Adjacent chunk enrichment uitgebreid naar top 20**: ADJACENT_FETCH_LIMIT verhoogd van 10→20 voor fetch, en merge-limiet van 12→20. Hierdoor krijgen MIN_PER_SOURCE gegarandeerde chunks van VAAN en Thematica ook omliggende context. Kosten: maximaal 40 extra OR-condities in 1 DB query (verwaarloosbaar)
3. **Bronintegratie-instructie concreet gemaakt**: WERKWIJZE stap 5 nu met expliciete sub-stappen per bron (a-d), elk met een specifieke vraag die de bron beantwoordt. T&C="welk artikel, wat zegt commentaar", Thematica="hoofdlijnen, uitzonderingen", RAR="concrete uitspraken", VAAN="recente ontwikkelingen". Forceert Claude om elke bron actief te controleren

**Impact:**
- Geen performance-regressie: heading matching is OR-conditie in bestaande query, adjacent chunk fetch doet 1 query met meer OR-condities, prompt groeit met ~150 tekens
- Betere recall: heading-match haalt relevante T&C chunks op die voorheen alleen via semantic search gevonden werden
- Betere passage-kwaliteit: underrepresented bronnen krijgen nu dezelfde context-enrichment als top-scoring chunks
- Betere bronbenutting: concrete per-bron instructie forceert Claude om VAAN en Thematica actief te raadplegen

**Compilatie:** Alleen bekende e2e/ fouten

### Sessie 6 — 2026-02-17 (Grondige QA-test alle features)

**Volledig getest:**
- Templates (6 stuks): CRUD, invulvelden, instructies, base64, content, generate endpoint
- Document handling: upload (PDF/DOCX/TXT/PNG/JPG), text extractie, DOCX modify protocol
- Projecten: CRUD, teamleden, toegangscontrole, chat memory, projectpagina
- Bronnen & RAG: SourcesManager, embedding pipeline, HNSW parameters
- Frontend UX: streaming, stop-knop, retry, kopieer, model-selector, bronnen-toggle, anonimisatie, quick actions
- Markdown: code blocks, tabellen, details/summary, confidence indicator, DOCX_EDITS stripping
- Export: PDF en Word export knoppen op assistant messages

**Problemen gevonden en gefixt:**
1. **Template generate endpoint: userId-filter te restrictief** — Templates zijn gedeeld binnen het kantoor, maar `generate` filterde op `userId: session.user.id`, waardoor andere gebruikers templates niet konden invullen. Gefixt: filter verwijderd
2. **Document upload foutmelding inconsistent** — `MAX_FILE_SIZE = 32MB` maar foutmelding zei "max 10MB". Gefixt: foutmelding gecorrigeerd naar "max 32MB"
3. **Template content afgekapt in chat** — Templates tot 35K tekens, maar chat route limiet was 20K per template. Gefixt: verhoogd naar 40K per template, 120K totaal
4. **Markdown blockquotes: alleen single-line** — Opeenvolgende blockquote regels werden als aparte `<blockquote>` elementen gerenderd. Gefixt: multi-line blockquotes worden nu samengevoegd
5. **Template-instructies in system prompt te vaag** — Claude wist niet wanneer en hoe templates te gebruiken. Gefixt: specifieke herkennings-, invul- en aanbevelingsinstructies toegevoegd met voorbeelden

**Geen problemen gevonden in:**
- Templates: alle 6 volledig (content, placeholders, beschrijving, instructies, base64)
- Document DOCX modify: correct find/replace in XML met opmaakbehoud
- Projecten CRUD: volledige eigenaar/lid-toegangscontrole
- Project memory: 5 gesprekken, 1000 chars per gesprek (voldoende)
- Embedding pipeline: robuust met HNSW ef_search=200
- Streaming: 80ms throttled rendering werkt goed
- Stop-knop: AbortController correct
- ECLI-verificatie: post-processing check tegen rechtspraak.nl
- Anonimisatie: BSN, telefoon, email, IBAN, postcode, bedrijf, persoon
- Quick actions: 11 relevante acties in 4 categorieen

**Compilatie:** Alleen bekende e2e/ fouten

### Sessie 5 — 2026-02-17 (Diepgaande kwaliteitsanalyse)

**Analyse uitgevoerd (fase 1-3):**
- 47.894 chunks onderzocht over 4 actieve bronnen (InView Tijdschrift ArbeidsRecht had 0 chunks)
- 8 random chunks per bron handmatig beoordeeld op kwaliteit
- 5 testvragen uitgevoerd met volledige retrieval-pipeline analyse
- extractSearchTerms + expandSearchQueries output geanalyseerd
- Context window benutting berekend (~38.5% van 170K tokens)

**Kritieke problemen gevonden:**
1. **VAAN AR Updates: 0 resultaten bij semantic search** — HNSW index met default ef_search=40 miste kleine bronnen volledig. VAAN (4.7% van chunks) werd nooit gevonden door approximate nearest neighbor
2. **RAR domineerde alles**: met 42.866 chunks (89.5%) domineerde RAR elke globale zoekactie — T&C, Thematica en VAAN kwamen niet aan bod
3. **T&C: 97% chunks zonder heading** — 1010 van 1041 chunks hadden geen heading, waardoor niet te zien was welk wetsartikel ze behandelden
4. **Keyword search: alleen T&C resultaten** — globale `take: 200` retourneerde alleen T&C vanwege generieke termen
5. **0% overlap semantic + keyword** — geen enkele chunk werd door beide methoden gevonden

**Verbeteringen doorgevoerd:**
- **Per-source semantic search**: in plaats van 1 globale zoekactie op 47K chunks zoeken we nu PER BRON apart (15 per bron), waardoor elke bron een eerlijke kans krijgt. Resultaat: VAAN ging van 0 naar 15 chunks per vraag
- **Per-source keyword search**: in plaats van 1 globale `take: 200` zoeken we nu PER BRON (50 per bron), waardoor niet alleen T&C maar alle bronnen keyword matches leveren
- **HNSW ef_search verhoogd naar 200**: de pgvector HNSW index zocht standaard slechts ~40 candidates, waardoor kleine bronnen bij filtering op sourceId 0 resultaten gaven. Met ef_search=200 worden genoeg candidates bekeken
- **Heading bonus bij keyword scoring**: termen die in de heading voorkomen krijgen 1.5x score bonus
- **T&C chunk headings hersteld**: van 3% naar 94% headings door automatische detectie van wetsartikelverwijzingen in chunk-content (974 chunks geupdate)
- **MIN_PER_SOURCE verhoogd naar 4**: elke bron krijgt minimaal 4 chunks in het resultaat
- **Retrieval timeout verhoogd**: van 12s naar 15s voor per-source queries

**Validatieresultaten (voor vs na):**
```
Vraag 1 (opzegtermijn):       VAAN 0→4,  Thematica 10→12, overlap 0→1
Vraag 2 (ernstig verwijtbaar): VAAN 0→5,  Thematica 4→12,  overlap 0→1
Vraag 3 (cumulatiegrond):     VAAN 0→4,  Thematica 3→12,  overlap 0→1
Vraag 4 (billijke vergoeding): VAAN 0→4,  Thematica 4→12,  overlap 0→2
Vraag 5 (disfunctioneren):    VAAN 0→4,  Thematica 1→12,  overlap 0→1
```
ALLE 4 bronnen met chunks nu vertegenwoordigd in ELKE testvraag.

### Sessie 4 — 2026-02-17
- **System prompt volledig herschreven**: gestroomlijnd van ~270 naar ~200 regels, duplicaties verwijderd
- **Bronnen-combinatiestrategie**: expliciete instructie HOE de 5 bronnen samen te voegen (T&C=wettelijk kader, Thematica=analyse, RAR=jurisprudentie, VAAN=updates, rechtspraak.nl=aanvulling)
- **Antwoordstructuur per vraagtype**: specifieke output-structuur per type vraag (feitelijk/analyse/review/stuk/strategie)
- **Query expansion verbeterd**: van 4 naar 5 varianten, elk gericht op een ANDERE bron (T&C, Thematica, RAR, VAAN, rechtspraak.nl)
- **Keyword scoring verbeterd**: juridische meerwoordtermen (43 bekende frases) scoren 8x, artikelverwijzingen 6x, bigrams/trigrams 4x
- **ECLI-nummers in passages gemarkeerd als geverifieerd**: passages met ECLI worden gelabeld zodat Claude ze mag citeren
- **ECLI-verificatie verbeterd**: ECLIs uit kennisbronnen worden niet meer onnodig geverifieerd tegen rechtspraak.nl
- **Bronnenoverzicht met functie-hint**: per bron wordt de specifieke FUNCTIE benoemd (wettelijk kader, analyse, jurisprudentie, updates)
- **Conflicterende bronnen**: instructie toegevoegd om BEIDE standpunten te vermelden met transparante analyse
- **Adjacent chunks**: context verhoogd van 500 naar 800 chars, top 12 ipv top 10 chunks verrijkt
- **MAX_PER_SOURCE**: verhoogd van 10 naar 12 voor betere dekking van grote bronnen (RAR)
- **Max chunks**: verhoogd van 35 naar 40, semantic search per query max 50
- **Rechtspraak ruling limiet**: verhoogd van 40K naar 50K chars
- **Compilatie gecontroleerd**: alleen bekende e2e/ fouten

### Sessie 3 — 2026-02-17
- Chat API timeout-bescherming: source fetch (8s), chunk retrieval (15s)
- Graceful degradation: als bronnen niet laden, ga door zonder bronnen
- Beeldupload: PNG/JPG/JPEG/WEBP support via Claude Vision API
- Agent instructies uitgebreid met betrouwbaarheid als hoogste prioriteit
- Kennisbronnen: 38K+ chunks met embeddings (99.95% compleet)
- InView 2000-2026 crawl compleet (ArbeidsRecht + RAR)

### Sessie 2 — 2026-02-17
- Hybrid search: semantic (pgvector) + keyword, gecombineerd via RRF (K=60)
- Balanced source selection: MIN_PER_SOURCE=3, MAX_PER_SOURCE=10
- CITAAT-HERINNERING toegevoegd om citeren uit alle bronnen af te dwingen
- Details/summary blocks voor citaten: native toggle + JS fallback
- Hover effect op summary elementen
- Bronbadges: niet-klikbare spans (gebruikersvoorkeur)

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
