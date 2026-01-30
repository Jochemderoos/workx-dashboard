# Workx Dashboard

Een intern dashboard voor Workx Advocaten met Slack-achtige chat, bonus calculator, transitievergoeding calculator, vakantie management en werk overzicht.

## Features

- **Gedeelde Agenda**: Team kalender met events, vergaderingen, deadlines en sociale momenten - direct zichtbaar op het dashboard
- **Slack-achtige Chat**: Kanalen, direct messages, real-time updates
- **Bonus Calculator**: Bereken bonussen op basis van facturen, download als PDF
- **Transitievergoeding Calculator**: Wettelijke berekening met PDF export
- **Vakantie Overzicht**: Persoonlijke dagen en gedeelde teamkalender
- **Werk Overzicht**: Zaken beheren, werkdruk visualisatie
- **Team Overzicht**: Bekijk alle teamleden

## Tech Stack

- **Frontend**: Next.js 14, React, Tailwind CSS, Framer Motion
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL met Prisma ORM
- **Authenticatie**: NextAuth.js
- **PDF Generatie**: jsPDF

## Installatie

### 1. Clone en installeer dependencies

```bash
cd workx-dashboard
npm install
```

### 2. Database setup

Je hebt een PostgreSQL database nodig. Je kunt:

**Optie A: Lokaal met Docker**
```bash
docker run --name workx-db -e POSTGRES_PASSWORD=password -e POSTGRES_DB=workx_dashboard -p 5432:5432 -d postgres
```

**Optie B: Railway (cloud)**
1. Ga naar [railway.app](https://railway.app)
2. Maak een nieuw project
3. Voeg PostgreSQL toe
4. Kopieer de connection string

### 3. Environment variables

Kopieer `.env.example` naar `.env`:

```bash
cp .env.example .env
```

Pas de volgende variabelen aan:

```env
# Database URL (van Railway of lokaal)
DATABASE_URL="postgresql://username:password@localhost:5432/workx_dashboard"

# NextAuth secret (genereer met: openssl rand -base64 32)
NEXTAUTH_SECRET="jouw-super-geheime-sleutel"
NEXTAUTH_URL="http://localhost:3000"
```

### 4. Database migratie en seeding

```bash
# Genereer Prisma client
npm run db:generate

# Push schema naar database
npm run db:push

# Seed de database met standaard data
npm run db:seed
```

### 5. Start de development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Demo Login

Na seeding kun je inloggen met:
- **Email**: admin@workxadvocaten.nl
- **Wachtwoord**: workx2024

## Deployment

### Vercel (Frontend)

1. Push je code naar GitHub
2. Ga naar [vercel.com](https://vercel.com)
3. Importeer je repository
4. Voeg environment variables toe
5. Deploy!

### Railway (Database)

1. Maak een PostgreSQL database aan op Railway
2. Kopieer de connection string naar je Vercel environment variables
3. Run migraties via de Vercel CLI of een deployment hook

## Projectstructuur

```
workx-dashboard/
├── prisma/
│   ├── schema.prisma    # Database schema
│   └── seed.ts          # Seed data
├── src/
│   ├── app/
│   │   ├── api/         # API routes
│   │   ├── dashboard/   # Dashboard pages
│   │   └── login/       # Login page
│   ├── components/      # React components
│   ├── lib/            # Utilities (prisma, auth)
│   └── types/          # TypeScript types
├── .env.example        # Environment template
└── package.json
```

## Huisstijl

Kleuren gebaseerd op workxadvocaten.nl:
- **Primair (lime)**: #f9ff85
- **Donker**: #1e1e1e
- **Grijs**: #3c3c3b

## Toekomstige Features

- [ ] BaseNet API integratie (afhankelijk van API beschikbaarheid)
- [ ] Afspiegelingstool
- [ ] Real-time notifications
- [ ] Mobile app

## Support

Voor vragen of problemen, neem contact op met het development team.

---

Gebouwd met ❤️ voor Workx Advocaten
