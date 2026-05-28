'use client'

interface Pillar {
  letter: string
  emoji: string
  title: string
  detail: string
}

const PILLARS: Pillar[] = [
  {
    letter: 'a',
    emoji: '📂',
    title: 'Administratie',
    detail:
      'De administratie van een zaak bevat alle relevante informatie en is snel terug te vinden. Alle gegevens worden overzichtelijk en op een afsluitbare plaats bewaard en gearchiveerd.',
  },
  {
    letter: 'b',
    emoji: '📞',
    title: 'Bereikbaarheid',
    detail:
      'De advocaat is goed bereikbaar voor de cliënt, behandelt zaken tijdig en overschrijdt geen termijnen. Bij afwezigheid zorgt de advocaat voor goede vervanging.',
  },
  {
    letter: 'c',
    emoji: '🤝',
    title: 'Eerste contact',
    detail:
      'Bij het eerste contact maakt de advocaat een inschatting van de haalbaarheid van de zaak. Hij bespreekt direct de financiële consequenties en houdt de cliënt gevraagd én ongevraagd op de hoogte.',
  },
  {
    letter: 'd',
    emoji: '🔒',
    title: 'Vertrouwelijkheid',
    detail: 'De vertrouwelijkheid van alle gegevens is goed gewaarborgd — fysiek én digitaal.',
  },
  {
    letter: 'e',
    emoji: '📮',
    title: 'Klachtenregeling',
    detail:
      'De advocaat draagt zorg voor een klachtenregeling en betrekt het oordeel van de cliënt bij verbetering van de dienstverlening.',
  },
]

export default function KantoororganisatieGuide() {
  return (
    <section className="relative overflow-hidden rounded-3xl border" style={{
      borderColor: 'rgba(180, 185, 50, 0.35)',
      background: 'linear-gradient(135deg, rgba(249, 255, 133, 0.18), var(--color-bg-secondary) 70%)',
    }}>
      <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full blur-3xl pointer-events-none" style={{ background: 'rgba(249, 255, 133, 0.18)' }} />

      <div className="relative p-6 sm:p-10">
        {/* Header */}
        <div className="flex items-start gap-4 flex-wrap mb-2">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0" style={{
            background: 'rgba(249, 255, 133, 0.35)',
            border: '1px solid rgba(180, 185, 50, 0.4)',
          }}>
            🏛️
          </div>
          <div className="flex-1 min-w-[260px]">
            <p className="text-[11px] uppercase tracking-widest font-bold mb-1" style={{ color: 'rgb(140, 150, 30)' }}>
              Kantoororganisatie
            </p>
            <h2 className="text-3xl font-bold leading-tight" style={{ color: 'var(--color-text-primary)' }}>
              Vijf pijlers voor goede dienstverlening
            </h2>
            <p className="text-sm mt-2 max-w-2xl italic" style={{ color: 'var(--color-text-secondary)' }}>
              "De advocaat neemt alleen zaken aan die hij gezien zijn kantoororganisatie adequaat kan behandelen."
            </p>
          </div>
        </div>

        {/* 5 pillars grid */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {PILLARS.map((p) => (
            <div key={p.letter} className="rounded-2xl border p-5 flex flex-col" style={{
              background: 'var(--color-bg-card)',
              borderColor: 'var(--color-border-subtle)',
            }}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-base font-black shrink-0" style={{
                  background: 'rgba(249, 255, 133, 0.30)',
                  color: 'rgb(140, 150, 30)',
                  border: '1px solid rgba(180, 185, 50, 0.4)',
                }}>
                  {p.letter}
                </div>
                <span className="text-2xl">{p.emoji}</span>
              </div>
              <h3 className="text-base font-bold mb-2" style={{ color: 'var(--color-text-primary)' }}>
                {p.title}
              </h3>
              <p className="text-xs leading-relaxed flex-1" style={{ color: 'var(--color-text-secondary)' }}>
                {p.detail}
              </p>
            </div>
          ))}
        </div>

        {/* Persoonlijk contact card */}
        <div className="mt-8 rounded-2xl border-2 p-5" style={{
          background: 'rgba(249, 255, 133, 0.12)',
          borderColor: 'rgba(180, 185, 50, 0.5)',
        }}>
          <div className="flex items-start gap-3">
            <span className="text-2xl shrink-0">📱</span>
            <div className="flex-1">
              <p className="text-[11px] uppercase tracking-widest font-bold mb-1" style={{ color: 'rgb(140, 150, 30)' }}>
                Workx-stijl
              </p>
              <p className="text-sm font-bold mb-2" style={{ color: 'var(--color-text-primary)' }}>
                Persoonlijk contact — geen telefoniste, geen secretaresses
              </p>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                Voor Workx is goede bereikbaarheid van cliënten essentieel. Iedere klant ontvangt naast een vast telefoonnummer ook het mobiele telefoonnummer van de advocaat, voor optimale bereikbaarheid.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
