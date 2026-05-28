'use client'

import { Icons } from '@/components/ui/Icons'

interface Step {
  num: number
  title: string
  detail?: string
}

interface Phase {
  num: number
  title: string
  emoji: string
  accent: string // tailwind text color (light + dark)
  bg: string // bg gradient
  ring: string // border
  steps: Step[]
}

const PHASES: Phase[] = [
  {
    num: 1,
    title: 'Setup in Doxflow',
    emoji: '🗂️',
    accent: 'text-cyan-700 dark:text-cyan-300',
    bg: 'from-cyan-500/15 to-cyan-500/[0.02]',
    ring: 'border-cyan-500/40',
    steps: [
      { num: 1, title: 'Nieuwe zaak aanmaken', detail: 'Dossiernaam · Procesadvocaat = jij · Groep = Arbeidsrecht · Opslaan' },
      { num: 2, title: 'Bestanden toevoegen', detail: 'Vanuit BaseNet of je computer. Sleep om volgorde te wijzigen. Rechtermuisknop voor verwijderen/omdraaien.' },
      { num: 3, title: 'Tabbladen toevoegen', detail: 'Bovenin "Tabbladen" → alle in één keer. Producties-titel aanpassen in balk boven elke productie.' },
      { num: 4, title: 'Processtuk benoemen', detail: 'Drie puntjes bij verzoek-/verweerschrift → "Benoem als processtuk" → krijgt letter P bovenaan.' },
    ],
  },
  {
    num: 2,
    title: 'Afdrukken',
    emoji: '🖨️',
    accent: 'text-amber-700 dark:text-amber-300',
    bg: 'from-amber-400/15 to-amber-400/[0.02]',
    ring: 'border-amber-400/50',
    steps: [
      { num: 5, title: 'Opslaan als PDF (optioneel)', detail: 'Opslaan → Als PDF — het hele stuk in één keer.' },
      { num: 6, title: 'Afdrukken naar Canon iR-ADV C477', detail: 'Klik "Afdrukken" → check printer → afdrukken. De printer weet zelf welke lades.' },
    ],
  },
  {
    num: 3,
    title: 'Inbinden',
    emoji: '📎',
    accent: 'text-yellow-700 dark:text-workx-lime',
    bg: 'from-workx-lime/25 to-workx-lime/[0.04]',
    ring: 'border-workx-lime/50',
    steps: [
      { num: 7, title: 'Plastic bladen toevoegen', detail: 'Voor- en achterkant.' },
      { num: 8, title: 'Gaatjes maken', detail: 'Grote perforator, in kleine delen.' },
      { num: 9, title: 'Inbinden met Jalema clip' },
      { num: 10, title: 'Gele tabjes toevoegen', detail: 'Plastic index-tabjes aan productiebladen, beschrijven met zwarte sharpie.' },
      { num: 11, title: 'Procesinleiding laten ondertekenen', detail: 'Door de advocaat.' },
      { num: 12, title: 'In bruine enveloppe', detail: 'Mét begeleidende brief.' },
    ],
  },
  {
    num: 4,
    title: 'Versturen',
    emoji: '🚲',
    accent: 'text-orange-700 dark:text-orange-300',
    bg: 'from-orange-400/15 to-orange-400/[0.02]',
    ring: 'border-orange-400/50',
    steps: [
      { num: 13, title: 'Fietskoerier inschakelen', detail: 'Mail naar spoed@fietskoerier.nl met datum, aantal stukken, ophaal- en afleveradres + ontvangstbevestiging.' },
    ],
  },
]

export default function DoxflowGuide() {
  return (
    <section className="relative overflow-hidden rounded-3xl border" style={{
      borderColor: 'rgba(180, 185, 50, 0.35)',
      background: 'linear-gradient(135deg, rgba(249, 255, 133, 0.18), var(--color-bg-secondary) 70%)',
    }}>
      {/* Decoratieve glows */}
      <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full blur-3xl pointer-events-none" style={{ background: 'rgba(249, 255, 133, 0.20)' }} />
      <div className="absolute -bottom-20 -left-20 w-64 h-64 rounded-full blur-3xl pointer-events-none" style={{ background: 'rgba(249, 255, 133, 0.10)' }} />

      <div className="relative p-6 sm:p-10">
        {/* Header */}
        <div className="flex items-start gap-4 flex-wrap mb-2">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0" style={{
            background: 'rgba(249, 255, 133, 0.35)',
            border: '1px solid rgba(180, 185, 50, 0.4)',
          }}>
            📁
          </div>
          <div className="flex-1 min-w-[260px]">
            <p className="text-[11px] uppercase tracking-widest font-bold mb-1" style={{ color: 'rgb(140, 150, 30)' }}>
              Doxflow
            </p>
            <h2 className="text-3xl font-bold leading-tight" style={{ color: 'var(--color-text-primary)' }}>
              Processtuk voorbereiden en indienen
            </h2>
            <p className="text-sm mt-2 max-w-2xl" style={{ color: 'var(--color-text-secondary)' }}>
              Vier stappen van eerste klik tot pakket bij de rechtbank. Inloggen via{' '}
              <a href="http://10.4.42.80/login" target="_blank" rel="noopener noreferrer" className="font-mono font-semibold hover:underline" style={{ color: 'rgb(140, 150, 30)' }}>
                10.4.42.80/login
              </a>
            </p>
          </div>
        </div>

        {/* Phase summary — quick visual */}
        <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {PHASES.map((phase) => (
            <div key={phase.num} className={`rounded-2xl border ${phase.ring} bg-gradient-to-br ${phase.bg} p-4`}>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xl shrink-0" style={{ background: 'var(--color-bg-secondary)' }}>
                  {phase.emoji}
                </div>
                <span className={`text-[10px] uppercase tracking-widest font-bold ${phase.accent}`}>
                  Fase {phase.num}
                </span>
              </div>
              <p className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>
                {phase.title}
              </p>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
                {phase.steps.length} {phase.steps.length === 1 ? 'stap' : 'stappen'}
              </p>
            </div>
          ))}
        </div>

        {/* Full per-phase detail */}
        <div className="mt-8 space-y-5">
          {PHASES.map((phase) => (
            <div
              key={phase.num}
              className={`relative rounded-2xl border ${phase.ring} bg-gradient-to-br ${phase.bg} p-5 sm:p-6`}
            >
              {/* Phase header */}
              <div className="flex items-center gap-3 mb-5">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0" style={{
                  background: 'var(--color-bg-secondary)',
                  border: `1px solid var(--color-border)`,
                }}>
                  {phase.emoji}
                </div>
                <div>
                  <p className={`text-[10px] uppercase tracking-widest font-bold ${phase.accent} mb-0.5`}>
                    Fase {phase.num}
                  </p>
                  <h3 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
                    {phase.title}
                  </h3>
                </div>
              </div>

              {/* Steps */}
              <ol className="space-y-3">
                {phase.steps.map((step) => (
                  <li key={step.num} className="flex gap-3">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 ${phase.accent}`} style={{
                      background: 'var(--color-bg-secondary)',
                      border: `1px solid var(--color-border)`,
                    }}>
                      {step.num}
                    </div>
                    <div className="flex-1 pt-0.5">
                      <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                        {step.title}
                      </p>
                      {step.detail && (
                        <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                          {step.detail}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>

        {/* Brief-regels — geel highlight */}
        <div className="mt-6 rounded-2xl p-5 border-2" style={{
          background: 'rgba(249, 255, 133, 0.12)',
          borderColor: 'rgba(180, 185, 50, 0.5)',
        }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xl">⚠️</span>
            <h3 className="text-sm font-bold uppercase tracking-widest" style={{ color: 'rgb(140, 150, 30)' }}>
              Let op bij brieven
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl p-3 border" style={{ background: 'var(--color-bg-secondary)', borderColor: 'var(--color-border-subtle)' }}>
              <p className="text-xs font-bold mb-1" style={{ color: 'var(--color-text-primary)' }}>
                📨 Naar wederpartij
              </p>
              <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                Brief wederpartij <strong>+</strong> brief rechtbank bijvoegen
              </p>
            </div>
            <div className="rounded-xl p-3 border" style={{ background: 'var(--color-bg-secondary)', borderColor: 'var(--color-border-subtle)' }}>
              <p className="text-xs font-bold mb-1" style={{ color: 'var(--color-text-primary)' }}>
                🏛️ Naar rechtbank
              </p>
              <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                Alleen brief rechtbank
              </p>
            </div>
          </div>
        </div>

        {/* Koerier-template */}
        <div className="mt-5 rounded-2xl p-5 border" style={{
          background: 'var(--color-bg-card)',
          borderColor: 'var(--color-border-subtle)',
        }}>
          <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xl">📧</span>
              <h3 className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>
                Koerier-template
              </h3>
            </div>
            <a
              href="mailto:spoed@fietskoerier.nl"
              className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors"
              style={{ background: 'rgba(249, 255, 133, 0.25)', color: 'rgb(140, 150, 30)' }}
            >
              <Icons.mail size={11} className="inline mr-1" />
              spoed@fietskoerier.nl
            </a>
          </div>
          <p className="text-xs italic leading-relaxed rounded-xl p-3 border" style={{
            background: 'var(--color-bg-glass)',
            borderColor: 'var(--color-border-subtle)',
            color: 'var(--color-text-primary)',
          }}>
            "Hi, Is het mogelijk om [datum] [x aantal] stukken bij ons op te halen op Herengracht 448, 1017 CA Amsterdam en deze voor [aflevertijd] af te leveren bij [adres] inclusief ontvangstbevestiging?"
          </p>
        </div>

        {/* Print-tip */}
        <p className="text-[11px] mt-6 italic flex items-start gap-2" style={{ color: 'var(--color-text-tertiary)' }}>
          <span>💡</span>
          <span>Vergeet niet eerst met de advocaat te overleggen hoeveel exemplaren je print, en voor wie de stukken bestemd zijn.</span>
        </p>
      </div>
    </section>
  )
}
