# Workx Dashboard — Claude Code Instructies

Dit is het Workx Advocaten dashboard: een Next.js 14 applicatie met React, Tailwind CSS, PostgreSQL (Prisma), en NextAuth.js. Het bevat een AI-assistent voor arbeidsrecht, werkdrukbeheer, urenoverzicht, en zaaktoewijzing.

## Tech Stack
- **Frontend**: Next.js 14 App Router, React 18, Tailwind CSS
- **Backend**: Next.js API routes, Prisma ORM, PostgreSQL
- **AI**: Anthropic Claude API (Sonnet 4.5 / Opus 4.6) met extended thinking en streaming
- **Auth**: NextAuth.js met Prisma adapter
- **Deploy**: Vercel (auto-deploy op push naar master)
- **Externe APIs**: rechtspraak.nl (jurisprudentie), web search

## Projectstructuur
- `src/app/dashboard/` — Dashboard pagina's (werkdruk, AI, chat, etc.)
- `src/app/api/` — API routes (claude/, workload/, monthly-hours/, etc.)
- `src/components/claude/` — AI assistant components (ClaudeChat, SourcesManager, etc.)
- `src/lib/` — Shared utilities (auth, prisma, markdown, anonymize, date-utils)
- `prisma/schema.prisma` — Database schema

## Conventies
- Commit messages in het Nederlands
- Alle UI-teksten in het Nederlands
- Geen nieuwe dependencies toevoegen zonder goede reden
- TypeScript strict mode (negeer pre-existende e2e/ fouten)
- Test altijd met `npx tsc --noEmit` voor commit

## Agents

Er zijn twee doorlopende verbeteragents beschikbaar. Start ze met:
```
claude "volg de instructies in agents/ai-assistent-agent.md"
claude "volg de instructies in agents/dashboard-agent.md"
```
