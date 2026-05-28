'use client'

import { Icons } from '@/components/ui/Icons'

interface Contact {
  emoji: string
  role: string
  name: string
  detail?: string
  email?: string
  phone?: string
}

const INTERNE_CONTACTEN: Contact[] = [
  { emoji: '🛟', role: 'Preventiemedewerker', name: 'Hanna', detail: 'Officemanager — contact externe diensten (ArboDuo), arbeidsomstandighedenbeleid, RI&E, BHV-coördinatie.' },
  { emoji: '🤝', role: 'Vertrouwenspersoon (intern)', name: 'Marlieke', detail: 'Voor alles wat je vertrouwelijk wilt bespreken.' },
]

const EXTERNE_CONTACTEN: Contact[] = [
  { emoji: '🔒', role: 'Vertrouwenspersoon (extern)', name: 'Marcel Boshuizen', email: 'mboshuizen@uwvertrouwenspersoon.nl', phone: '085 065 92 70' },
  { emoji: '🔒', role: 'Vertrouwenspersoon (extern)', name: 'Sjakkelien Marlet', email: 'smarlet@uwvertrouwenspersoon.nl', phone: '085 065 92 70' },
]

const BHV: Contact[] = [
  { emoji: '🚨', role: 'BHV', name: 'Marnix', detail: 'BHV-certificaat behaald.' },
  { emoji: '🚨', role: 'BHV', name: 'Justine', detail: 'BHV-certificaat behaald.' },
  { emoji: '🚨', role: 'BHV', name: 'Hanna', detail: 'BHV-certificaat behaald.' },
]

const VERZUIM_CHECKLIST = [
  'Dat je wegens ziekte niet in staat bent om te werken',
  'Wat de verwachte duur van het verzuim zal zijn',
  'Wat Workx kan doen om te helpen',
  'Op welk adres en telefoonnummer je te bereiken bent',
  'Welke werkzaamheden nog wel uitgevoerd kunnen worden',
]

export default function VeiligWerkenGuide() {
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
            🛡️
          </div>
          <div className="flex-1 min-w-[260px]">
            <p className="text-[11px] uppercase tracking-widest font-bold mb-1" style={{ color: 'rgb(140, 150, 30)' }}>
              Veilig werken
            </p>
            <h2 className="text-3xl font-bold leading-tight" style={{ color: 'var(--color-text-primary)' }}>
              Wie te bereiken & wat te doen
            </h2>
            <p className="text-sm mt-2 max-w-2xl italic" style={{ color: 'var(--color-text-secondary)' }}>
              "We zijn er voor elkaar, door dik en dun." Werkdruk, verzuim, BHV, vertrouwenspersoon — alles op één plek.
            </p>
          </div>
        </div>

        {/* Verzuim-protocol — featured */}
        <div className="mt-8 rounded-2xl border-2 p-5 sm:p-6" style={{
          background: 'rgba(249, 255, 133, 0.10)',
          borderColor: 'rgba(180, 185, 50, 0.5)',
        }}>
          <div className="flex items-start gap-3 mb-4">
            <span className="text-3xl shrink-0">🤧</span>
            <div>
              <p className="text-[11px] uppercase tracking-widest font-bold mb-0.5" style={{ color: 'rgb(140, 150, 30)' }}>
                Verzuimprotocol
              </p>
              <h3 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
                Bij ziekte: bel een partner, app of Slack-bericht
              </h3>
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                Geef bij de ziekmelding deze 5 dingen door:
              </p>
            </div>
          </div>
          <ol className="space-y-2">
            {VERZUIM_CHECKLIST.map((item, i) => (
              <li key={i} className="flex gap-3 items-start">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0" style={{
                  background: 'rgba(249, 255, 133, 0.35)',
                  color: 'rgb(110, 120, 20)',
                  border: '1px solid rgba(180, 185, 50, 0.4)',
                }}>
                  {i + 1}
                </div>
                <p className="text-sm leading-relaxed mt-0.5" style={{ color: 'var(--color-text-primary)' }}>{item}</p>
              </li>
            ))}
          </ol>
          <p className="text-xs italic mt-4" style={{ color: 'var(--color-text-secondary)' }}>
            Blijf bereikbaar voor contact met Workx en de arbodienst. We zijn er voor elkaar en houden graag contact.
          </p>
        </div>

        {/* Interne contacten */}
        <div className="mt-8">
          <h3 className="text-sm font-bold uppercase tracking-widest mb-3" style={{ color: 'rgb(140, 150, 30)' }}>
            Intern aanspreekpunt
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {INTERNE_CONTACTEN.map((c, i) => (
              <ContactCard key={i} c={c} accent="rgba(249, 255, 133, 0.20)" />
            ))}
          </div>
        </div>

        {/* Externe vertrouwenspersonen */}
        <div className="mt-6">
          <h3 className="text-sm font-bold uppercase tracking-widest mb-3" style={{ color: 'rgb(140, 150, 30)' }}>
            Externe vertrouwenspersoon
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {EXTERNE_CONTACTEN.map((c, i) => (
              <ContactCard key={i} c={c} accent="rgba(168, 185, 0, 0.15)" />
            ))}
          </div>
        </div>

        {/* BHV'ers */}
        <div className="mt-6">
          <h3 className="text-sm font-bold uppercase tracking-widest mb-3" style={{ color: 'rgb(220, 38, 38)' }}>
            🚨 BHV'ers — bij brand, ongeval, evacuatie
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {BHV.map((c, i) => (
              <div key={i} className="rounded-2xl border p-4 flex items-center gap-3" style={{
                background: 'rgba(239, 68, 68, 0.05)',
                borderColor: 'rgba(239, 68, 68, 0.30)',
              }}>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0" style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.30)',
                }}>
                  {c.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-bold" style={{ color: 'var(--color-text-primary)' }}>{c.name}</p>
                  <p className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>BHV-gecertificeerd</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Werkdruk + Grensoverschrijdend + Fit Workx */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-2xl p-4 border" style={{ background: 'var(--color-bg-card)', borderColor: 'var(--color-border-subtle)' }}>
            <div className="text-2xl mb-2">⚖️</div>
            <p className="text-sm font-bold mb-1" style={{ color: 'var(--color-text-primary)' }}>Arbeidsbelasting</p>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
              Voel je druk? Bespreek het tijdig met een partner, preventiemedewerker of vertrouwenspersoon. Het is geen teken van zwakte.
            </p>
          </div>
          <div className="rounded-2xl p-4 border" style={{ background: 'var(--color-bg-card)', borderColor: 'var(--color-border-subtle)' }}>
            <div className="text-2xl mb-2">🚫</div>
            <p className="text-sm font-bold mb-1" style={{ color: 'var(--color-text-primary)' }}>Eén voor allen, allen voor één</p>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
              Pesten, ongewenst gedrag en agressie is op geen enkele manier toegestaan. Meld dit altijd direct.
            </p>
          </div>
          <div className="rounded-2xl p-4 border" style={{ background: 'var(--color-bg-card)', borderColor: 'var(--color-border-subtle)' }}>
            <div className="text-2xl mb-2">🚶</div>
            <p className="text-sm font-bold mb-1" style={{ color: 'var(--color-text-primary)' }}>Fit Workx</p>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
              Twee tot drie keer per week een uur bewegen is optimaal. De Workx wandelingen na de lunch zijn hier perfect voor.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

function ContactCard({ c, accent }: { c: Contact; accent: string }) {
  return (
    <div className="rounded-2xl p-4 border flex items-start gap-3" style={{
      background: 'var(--color-bg-card)',
      borderColor: 'var(--color-border-subtle)',
    }}>
      <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0" style={{
        background: accent,
        border: '1px solid rgba(180, 185, 50, 0.30)',
      }}>
        {c.emoji}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-wider font-bold mb-0.5" style={{ color: 'rgb(140, 150, 30)' }}>
          {c.role}
        </p>
        <p className="text-base font-bold" style={{ color: 'var(--color-text-primary)' }}>
          {c.name}
        </p>
        {c.detail && (
          <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
            {c.detail}
          </p>
        )}
        {(c.email || c.phone) && (
          <div className="mt-2 flex flex-col gap-1">
            {c.email && (
              <a href={`mailto:${c.email}`} className="flex items-center gap-1.5 text-xs hover:underline" style={{ color: 'rgb(140, 150, 30)' }}>
                <Icons.mail size={11} />
                <span className="truncate">{c.email}</span>
              </a>
            )}
            {c.phone && (
              <a href={`tel:${c.phone.replace(/\s+/g, '')}`} className="flex items-center gap-1.5 text-xs tabular-nums" style={{ color: 'var(--color-text-secondary)' }}>
                <Icons.phone size={11} />
                <span>{c.phone}</span>
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
