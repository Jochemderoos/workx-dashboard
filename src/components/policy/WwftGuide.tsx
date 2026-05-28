'use client'

import { Icons } from '@/components/ui/Icons'

interface Activity {
  emoji: string
  title: string
  detail?: string
}

// Workx-werkzaamheden — vallen ONDER de uitzondering van art. 1 lid 2 Wwft
const WORKX_ACTIVITIES: Activity[] = [
  {
    emoji: '⚖️',
    title: 'Bepalen van de rechtspositie',
    detail: 'Adviseren over rechten en plichten van cliënt onder het arbeidsrecht.',
  },
  {
    emoji: '🛡️',
    title: 'Vertegenwoordiging in rechte',
    detail: 'Procederen voor cliënt bij de rechtbank, het hof of de Hoge Raad.',
  },
  {
    emoji: '💬',
    title: 'Advies voor, tijdens en na rechtsgeding',
    detail: 'Strategisch en juridisch advies rondom een lopende of toekomstige procedure.',
  },
  {
    emoji: '🎯',
    title: 'Instellen of vermijden van rechtsgeding',
    detail: 'Advies of een procedure wel of niet gestart moet worden.',
  },
]

// Voorbeelden waar Wwft WÉL zou gelden (niet-Workx-activiteiten)
const WWFT_ACTIVITIES: Activity[] = [
  {
    emoji: '🏠',
    title: 'Onroerend goed-transacties',
    detail: 'Begeleiden van koop/verkoop van onroerend goed.',
  },
  {
    emoji: '🏢',
    title: 'Vennootschappen en trusts',
    detail: 'Oprichten of beheren van vennootschappen, trusts, fondsen.',
  },
  {
    emoji: '💸',
    title: 'Financieel beheer',
    detail: 'Beheer of administratie van gelden voor cliënt buiten een procedure.',
  },
  {
    emoji: '📈',
    title: 'Effectentransacties',
    detail: 'Aandelen- en effectenhandel buiten een procedure-advies.',
  },
]

export default function WwftGuide() {
  return (
    <section className="relative overflow-hidden rounded-3xl border" style={{
      borderColor: 'rgba(180, 185, 50, 0.35)',
      background: 'linear-gradient(135deg, rgba(249, 255, 133, 0.18), var(--color-bg-secondary) 70%)',
    }}>
      {/* Decoratieve gele glows */}
      <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full blur-3xl pointer-events-none" style={{ background: 'rgba(249, 255, 133, 0.20)' }} />
      <div className="absolute -bottom-20 -left-20 w-64 h-64 rounded-full blur-3xl pointer-events-none" style={{ background: 'rgba(249, 255, 133, 0.10)' }} />

      <div className="relative p-6 sm:p-10">
        {/* Header met grote vinkstatus */}
        <div className="flex items-start gap-4 flex-wrap mb-2">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0" style={{
            background: 'rgba(249, 255, 133, 0.35)',
            border: '1px solid rgba(180, 185, 50, 0.4)',
          }}>
            ⚖️
          </div>
          <div className="flex-1 min-w-[260px]">
            <p className="text-[11px] uppercase tracking-widest font-bold mb-1" style={{ color: 'rgb(140, 150, 30)' }}>
              Wwft
            </p>
            <h2 className="text-3xl font-bold leading-tight" style={{ color: 'var(--color-text-primary)' }}>
              Wet ter voorkoming van witwassen en financieren van terrorisme
            </h2>
            <p className="text-sm mt-2 max-w-2xl" style={{ color: 'var(--color-text-secondary)' }}>
              De Wwft regelt cliëntenonderzoek en meldingsplicht voor "poortwachters" — banken, notarissen, accountants en bepaalde advocaten.
            </p>
          </div>
        </div>

        {/* Status-card: NIET van toepassing */}
        <div className="mt-8 rounded-2xl border-2 p-6 sm:p-7 flex items-center gap-5 flex-wrap" style={{
          background: 'linear-gradient(135deg, rgba(249, 255, 133, 0.20), rgba(34, 197, 94, 0.08))',
          borderColor: 'rgba(180, 185, 50, 0.6)',
        }}>
          <div className="w-20 h-20 rounded-full flex items-center justify-center text-4xl shrink-0" style={{
            background: 'rgba(34, 197, 94, 0.20)',
            border: '2px solid rgba(34, 197, 94, 0.5)',
          }}>
            ✅
          </div>
          <div className="flex-1 min-w-[260px]">
            <p className="text-[11px] uppercase tracking-widest font-bold mb-1" style={{ color: 'rgb(22, 163, 74)' }}>
              Status voor Workx
            </p>
            <h3 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
              Wwft is <span style={{ color: 'rgb(22, 163, 74)' }}>niet van toepassing</span> op Workx
            </h3>
            <p className="text-sm mt-2" style={{ color: 'var(--color-text-secondary)' }}>
              Workx-advocaten verrichten uitsluitend juridisch advies en procesvoering — werkzaamheden die onder de wettelijke uitzondering vallen van <strong>art. 1, lid 2 Wwft</strong>.
            </p>
          </div>
        </div>

        {/* Wat doen we wel? */}
        <div className="mt-8">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-base">🟢</span>
            <h3 className="text-sm font-bold uppercase tracking-widest" style={{ color: 'rgb(22, 163, 74)' }}>
              Wat we wél doen (uitgezonderd van Wwft)
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {WORKX_ACTIVITIES.map((a, i) => (
              <div key={i} className="rounded-2xl border p-4 flex gap-3" style={{
                background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.10), var(--color-bg-glass))',
                borderColor: 'rgba(34, 197, 94, 0.30)',
              }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0" style={{
                  background: 'rgba(34, 197, 94, 0.15)',
                }}>
                  {a.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold mb-0.5" style={{ color: 'var(--color-text-primary)' }}>
                    {a.title}
                  </p>
                  {a.detail && (
                    <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                      {a.detail}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Wanneer geldt Wwft wel — illustratief, doen we NIET */}
        <div className="mt-8">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-base">🟠</span>
            <h3 className="text-sm font-bold uppercase tracking-widest" style={{ color: 'rgb(217, 119, 6)' }}>
              Wanneer zou Wwft wél gelden? (niet voor Workx)
            </h3>
          </div>
          <p className="text-xs mb-3" style={{ color: 'var(--color-text-tertiary)' }}>
            Deze activiteiten doen wij niet, maar ze illustreren wanneer een advocatenkantoor wél onder Wwft valt:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {WWFT_ACTIVITIES.map((a, i) => (
              <div key={i} className="rounded-2xl border p-4 flex gap-3" style={{
                background: 'var(--color-bg-card)',
                borderColor: 'var(--color-border-subtle)',
                opacity: 0.85,
              }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0" style={{
                  background: 'rgba(217, 119, 6, 0.12)',
                }}>
                  {a.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold mb-0.5" style={{ color: 'var(--color-text-primary)' }}>
                    {a.title}
                  </p>
                  {a.detail && (
                    <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                      {a.detail}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Wetsartikel in geel uitgelichte box */}
        <div className="mt-8 rounded-2xl border-2 p-5" style={{
          background: 'rgba(249, 255, 133, 0.12)',
          borderColor: 'rgba(180, 185, 50, 0.5)',
        }}>
          <div className="flex items-start gap-3">
            <span className="text-2xl shrink-0">📜</span>
            <div className="flex-1">
              <p className="text-[11px] uppercase tracking-widest font-bold mb-1" style={{ color: 'rgb(140, 150, 30)' }}>
                Wettelijke uitzondering
              </p>
              <p className="text-sm font-bold mb-2" style={{ color: 'var(--color-text-primary)' }}>
                Artikel 1, lid 2 Wwft
              </p>
              <p className="text-xs leading-relaxed italic" style={{ color: 'var(--color-text-secondary)' }}>
                "Deze wet is niet van toepassing op werkzaamheden voor cliënten betreffende de bepaling van diens rechtspositie, diens vertegenwoordiging en verdediging in rechte, het geven van advies voor, tijdens en na een rechtsgeding of het geven van advies over het instellen of vermijden van een rechtsgeding."
              </p>
            </div>
          </div>
        </div>

        {/* Twijfel? */}
        <div className="mt-6 rounded-2xl p-5 border flex items-start gap-3" style={{
          background: 'var(--color-bg-card)',
          borderColor: 'var(--color-border-subtle)',
        }}>
          <span className="text-2xl shrink-0">💭</span>
          <div className="flex-1">
            <p className="text-sm font-bold mb-1" style={{ color: 'var(--color-text-primary)' }}>
              Twijfel of een opdracht onder Wwft valt?
            </p>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
              Stem direct af met een partner. Als de opdracht buiten de uitzondering valt (bijv. zelf onroerend goed leveren), is Wwft alsnog van toepassing. Bij twijfel: niet aannemen totdat helder is.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
