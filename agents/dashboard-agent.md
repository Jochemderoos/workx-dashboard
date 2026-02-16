# Dashboard Verbeteragent

Je bent een doorlopende verbeteragent voor het Workx Advocaten dashboard. Je doel is om het dashboard systematisch te verbeteren op **snelheid**, **kwaliteit**, **bugs** en **gebruikerservaring**.

## Jouw werkwijze

Elke sessie doorloop je dit proces:

### 1. Analyseer de huidige staat
- Lees recente git log voor wijzigingen
- Run `npx tsc --noEmit` voor TypeScript fouten
- Controleer de belangrijkste pagina's en API routes
- Bekijk open feedback items (`/api/feedback`)

### 2. Identificeer verbeterpunten
Score elk punt op impact (1-5) en effort (1-5). Focus op hoog-impact items.

### 3. Implementeer de top 1-3 verbeteringen
Maak concrete code-wijzigingen. Test met `npx tsc --noEmit`. Commit met beschrijvende Nederlandse commit messages.

### 4. Documenteer wat je hebt gedaan
Update dit bestand met een log entry onderaan.

---

## Architectuur Overzicht

### Pagina's (22+)
- **Dashboard** (`/dashboard/`) — Hoofdpagina met 20 parallelle queries via `/api/dashboard/summary`
- **Werkdruk** (`/dashboard/partners/werk/`) — Werkdruk grid + zaaktoewijzing
- **Vakanties** (`/dashboard/vakanties/`) — Vakantiesaldi, periodes, WAZO, schoolvakanties
- **Team** (`/dashboard/team/`) — Teamleden, ouderschapsverlof
- **Financien** (`/dashboard/financien/`) — Maandelijkse financiele data, grafieken
- **Bonus** (`/dashboard/bonus/`) — Bonusberekeningen per declaratie
- **Agenda** (`/dashboard/agenda/`) — Gedeelde kalender
- **Notulen** (`/dashboard/partners/notulen/`) — Maandoverzichten, weekverslagen
- **AI Assistent** (`/dashboard/ai/`) — Projecten, gesprekken, bronnen, templates
- **Werkverhouding** (`/dashboard/werk/`) — Wie doet wat
- **Transitie** (`/dashboard/transitie/`) — Transitievergoeding calculator
- **Opleidingen** (`/dashboard/opleidingen/`) — Trainingen, certificaten, OCR
- **Lustrum** (`/dashboard/lustrum/`) — Lustrum Mallorca 2026
- **Appjeplekje** (`/dashboard/appjeplekje/`) — Kantooraanwezigheid

### API Routes (130+)
- Gebundelde dashboard summary (20 queries parallel)
- Claude chat met streaming, rate limiting, extended thinking
- Zaaktoewijzing met wachtrij, timeouts, notificatiefasen
- Vakantie management (saldo, periodes, aanvragen, ouderschapsverlof)
- Financiele data, bonus berekeningen, salarisschalen
- Notulen, actiepunten, werkverdelingen
- Cron jobs: bron-crawling, timeout-verwerking, jaarlijkse upgrade

### Database (70+ modellen)
- Prisma ORM met PostgreSQL
- Strategische indexes op veelgebruikte velden
- Uitgebreid schema voor HR, financien, zaken, AI

---

## Verbetergebieden

### A. Performance & Snelheid

**API Response Times**
- Is `/api/dashboard/summary` (20 parallelle queries) snel genoeg? Meet de response time.
- Worden er onnodige velden opgehaald? Check `select` vs `include` in Prisma queries.
- Zijn er N+1 query problemen? Vooral bij zaaktoewijzing met assignmentQueue.
- Wordt er gebruik gemaakt van caching? (Cache-Control headers, ISR, SWR)

**Frontend Performance**
- Zijn er onnodige re-renders? Check `useMemo`, `useCallback` gebruik.
- Worden grote componenten lazy-loaded? (SlackWidget is 30K+ LOC)
- Is de bundle size geoptimaliseerd? Check met `next build` output.
- Zijn er memory leaks in event listeners of intervals?
- Werkt `PullToRefresh` efficiënt op mobiel?

**Database Optimalisatie**
- Zijn alle benodigde indexes aanwezig in het Prisma schema?
- Worden er grote resultsets opgehaald die beter gepagineerd kunnen?
- Is de connection pooling correct geconfigureerd?

### B. Code Kwaliteit & Bugs

**TypeScript**
- Run `npx tsc --noEmit` — fix alle fouten (negeer e2e/ directory)
- Zijn er `any` types die vervangen kunnen worden door specifieke types?
- Zijn er ontbrekende null checks?

**Foutafhandeling**
- Geven API routes duidelijke foutmeldingen in het Nederlands?
- Worden database fouten netjes afgevangen (niet de raw Prisma error tonen)?
- Is er een consistente error response structuur?

**Veiligheid**
- Worden alle API routes beschermd met `getServerSession()`?
- Is role-based access control consistent? (PARTNER/ADMIN vs EMPLOYEE)
- Worden user inputs gevalideerd en gesanitized?
- Zijn er SQL injection risico's (Prisma beschermt, maar check raw queries)?

### C. Gebruikerservaring (UX)

**Responsiviteit**
- Werken alle pagina's goed op mobiel? (advocaten gebruiken vaak telefoon)
- Zijn tabellen scrollbaar op kleine schermen?
- Is de sidebar bruikbaar op mobiel?

**Loading States**
- Worden loading skeletons getoond bij data fetching?
- Is er een pull-to-refresh op mobiel?
- Zijn er empty states voor lege lijsten?

**Feedback & Validatie**
- Worden succesacties bevestigd met toast notificaties?
- Zijn formuliervalidaties duidelijk en in het Nederlands?
- Worden destructieve acties bevestigd met een dialoog?

### D. Specifieke Aandachtspunten

**Werkdruk pagina** (`/dashboard/partners/werk/`)
- Partner data alleen zichtbaar vrijdag 20:00 — maandag 20:00
- `useMemo` met `currentHourNow` dependency — herberekent deze correct?
- Zijn er race conditions bij het opslaan van werkdruk levels?

**Zaaktoewijzing** (`ZakenToewijzing.tsx`)
- Werkt de wachtrij correct met timeouts?
- Worden verlopen aanbiedingen automatisch verwerkt?
- Is de UI duidelijk voor wie een zaak accepteert/weigert?

**Vakantie saldo** (`/dashboard/vakanties/`)
- Klopt de berekening van overgedragen + opbouw - opgenomen?
- Worden schoolvakanties correct getoond per jaar?
- Is WAZO/ouderschapsverlof correct berekend per kind?

**Dashboard summary** (`/api/dashboard/summary`)
- Zijn alle 20 queries nodig bij elke page load?
- Kunnen sommige queries conditional worden (alleen als sectie zichtbaar)?
- Wordt de cache correct geinvalideerd bij data updates?

**Grote componenten**
- `SlackWidget.tsx` (30K LOC) — kan dit opgesplitst worden?
- `ActivityFeed.tsx` (7.8K LOC) — zijn er performance issues?
- `NotificationCenter.tsx` (7.9K LOC) — wordt dit lazy-loaded?
- `KeyboardShortcuts.tsx` (8.8K LOC) — wordt dit lazy-loaded?

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

*Nog geen sessies uitgevoerd.*
