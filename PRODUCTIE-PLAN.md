# Workx Dashboard - Productie Plan

## Huidige Status

### Wat werkt (Demo Mode)
- **Dashboard** - Overzicht met quick links, verjaardagen, wie is er weg
- **Agenda** - Kalender met events en verjaardagen team
- **Vakanties** - Overzicht wie er weg is, vakantiesaldo beheer (Hanna + Partners)
- **Bonus** - Bonusberekening met factuur/bonus betaald tracking, PDF export
- **Transitievergoeding** - Calculator
- **Afspiegeling** - Ontslagsimulatie tool
- **Werk** - Taken beheer met werkdruk tracking
- **Team** - Overzicht teamleden

### Premium Features
- Silicon Valley-niveau design
- Geanimeerde icon hover effecten
- Feestelijke verjaardagsconfetti
- Premium dropdowns (geen standaard selects)
- Grachtenpand silhouette + vliegende duiven

---

## Wat nog moet voor Productie

### 1. Database Setup (Vercel/Supabase)
```
Kosten: GRATIS (Supabase free tier)

Stappen:
1. Maak Supabase account aan op supabase.com
2. Maak nieuwe project "workx-dashboard"
3. Kopieer DATABASE_URL naar Vercel environment variables
4. Pas prisma/schema.prisma aan: provider = "postgresql"
5. Run: npx prisma migrate deploy
6. Run: npx prisma db seed
```

### 2. Alle Teamleden met Login
Seed script is klaar met alle accounts:

**Partners (kunnen vakantiesaldo beheren):**
- marnix@workxadvocaten.nl
- jochem@workxadvocaten.nl
- maaike@workxadvocaten.nl
- juliette@workxadvocaten.nl
- bas@workxadvocaten.nl

**Admin (kan alles beheren):**
- hanna@workxadvocaten.nl

**Medewerkers:**
- marlieke@workxadvocaten.nl
- kay@workxadvocaten.nl
- justine@workxadvocaten.nl
- julia@workxadvocaten.nl
- erika@workxadvocaten.nl
- emma@workxadvocaten.nl
- barbara@workxadvocaten.nl
- lotte@workxadvocaten.nl

**Standaard wachtwoord:** Workx2024!
(Moet bij eerste login gewijzigd worden)

### 3. Environment Variables op Vercel

In Vercel Dashboard > Project > Settings > Environment Variables:

```
DATABASE_URL=postgresql://...  (van Supabase)
NEXTAUTH_SECRET=<genereer met: openssl rand -base64 32>
NEXTAUTH_URL=https://workx-dashboard.vercel.app
```

### 4. Demo Mode uitzetten

Huidige pages gebruiken lokale state met demo data. Deze moeten gekoppeld worden aan echte API:

- [ ] `/dashboard/bonus/page.tsx` - Koppel aan /api/bonus
- [ ] `/dashboard/vakanties/page.tsx` - Koppel aan /api/vacation
- [ ] `/dashboard/werk/page.tsx` - Deels al gekoppeld

### 5. Layout updaten voor echte sessie

In `src/app/dashboard/layout.tsx`:
- Vervang `fakeUser` met `getServerSession()`
- Redirect naar /login als niet ingelogd

---

## Geschatte Kosten (maandelijks)

| Service | Kosten |
|---------|--------|
| Vercel (hosting) | Gratis |
| Supabase (database) | Gratis |
| Domain (optioneel) | ~€1/maand |
| **Totaal** | **€0-1/maand** |

---

## Actie Stappenplan

1. **Vandaag** - Maak Supabase account en database
2. **Vandaag** - Update environment variables op Vercel
3. **Vandaag** - Run database migratie en seed
4. **Morgen** - Test alle logins
5. **Morgen** - Demo mode uitzetten per pagina
6. **Week 1** - User acceptatie test met team

---

## Technische Details

**Stack:**
- Next.js 14.1.0 (App Router)
- Prisma ORM
- NextAuth.js (credentials provider)
- PostgreSQL (productie) / SQLite (development)
- Tailwind CSS
- Vercel (hosting)

**Rollen:**
- `PARTNER` - Directie, kan vakantiesaldo beheren
- `ADMIN` - Hanna (kantoormanager), kan alles beheren
- `EMPLOYEE` - Medewerkers, kan eigen data zien

**Schema updates:**
- VacationDays -> VacationBalance (overgedragen, opbouw, opgenomen)
- BonusCalculation.isPaid -> invoicePaid + bonusPaid
- User.role: EMPLOYEE | PARTNER | ADMIN
