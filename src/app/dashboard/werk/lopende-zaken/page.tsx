'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Icons } from '@/components/ui/Icons'
import { useLopendeZaken } from '@/lib/hooks/useData'
import { getPhotoUrl } from '@/lib/team-photos'

interface CaseMember {
  personName: string
  workedHours: number
}

interface CaseItem {
  projectName: string
  totalWorkedHours: number
  totalBillableHours: number
  members: CaseMember[]
}

interface LopendeZakenData {
  cases: CaseItem[]
  period: { startDate: string; endDate: string }
}

const MEMBER_COLORS = [
  'from-blue-500 to-blue-400',
  'from-purple-500 to-purple-400',
  'from-orange-500 to-orange-400',
  'from-emerald-500 to-emerald-400',
  'from-pink-500 to-pink-400',
  'from-cyan-500 to-cyan-400',
  'from-amber-500 to-amber-400',
  'from-indigo-500 to-indigo-400',
]

function formatDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('nl-NL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export default function LopendeZakenPage() {
  const { data, error, isLoading } = useLopendeZaken() as {
    data: LopendeZakenData | undefined
    error: Error | undefined
    isLoading: boolean
  }
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)

  const cases = data?.cases || []
  const maxHours = cases[0]?.totalWorkedHours || 1

  // Stats
  const totalHours = cases.reduce((sum, c) => sum + c.totalWorkedHours, 0)
  const uniqueMembers = new Set(cases.flatMap(c => c.members.map(m => m.personName)))

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-workx-lime/30 border-t-workx-lime rounded-full animate-spin" />
          <p className="text-white/40 text-sm">Lopende zaken laden...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center mx-auto">
            <Icons.x size={24} className="text-red-400" />
          </div>
          <p className="text-white/60">Kon lopende zaken niet laden</p>
          <p className="text-white/30 text-sm">Probeer het later opnieuw</p>
        </div>
      </div>
    )
  }

  // Empty state
  if (cases.length === 0) {
    return (
      <div className="p-6 md:p-10 max-w-6xl mx-auto">
        <Header period={data?.period} />
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="text-center space-y-3">
            <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mx-auto">
              <Icons.briefcase size={24} className="text-white/30" />
            </div>
            <p className="text-white/60">Geen zaken gevonden</p>
            <p className="text-white/30 text-sm">Er zijn geen uren geregistreerd in de afgelopen 30 dagen</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-8">
      {/* Decorative glow */}
      <div className="fixed top-0 right-0 w-96 h-96 bg-workx-lime/5 rounded-full blur-3xl pointer-events-none" />

      <Header period={data?.period} />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          icon={<Icons.clock size={18} className="text-workx-lime" />}
          label="Totaal uren"
          value={`${Math.round(totalHours).toLocaleString('nl-NL')}`}
        />
        <StatCard
          icon={<Icons.briefcase size={18} className="text-blue-400" />}
          label="Actieve zaken"
          value={`${cases.length}`}
        />
        <StatCard
          icon={<Icons.users size={18} className="text-purple-400" />}
          label="Teamleden"
          value={`${uniqueMembers.size}`}
        />
      </div>

      {/* Cases list */}
      <div className="space-y-2">
        {cases.map((c, i) => {
          const isExpanded = expandedIndex === i
          const barWidth = (c.totalWorkedHours / maxHours) * 100

          return (
            <div key={c.projectName} className="rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden transition-colors hover:border-white/10">
              {/* Case row */}
              <button
                onClick={() => setExpandedIndex(isExpanded ? null : i)}
                className="w-full flex items-center gap-4 px-4 py-3 text-left group"
              >
                {/* Rank */}
                <span className="w-7 text-center text-sm font-mono text-white/30 flex-shrink-0">
                  {i + 1}
                </span>

                {/* Name + bar */}
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-white truncate">{c.projectName}</span>
                    <span className="text-sm font-mono text-workx-lime flex-shrink-0">
                      {c.totalWorkedHours}u
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-workx-lime to-workx-lime/70 transition-all duration-500"
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>

                {/* Members count + chevron */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs text-white/30">{c.members.length}</span>
                  <div className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                    <Icons.chevronDown size={16} className="text-white/30 group-hover:text-white/60 transition-colors" />
                  </div>
                </div>
              </button>

              {/* Expanded members */}
              {isExpanded && (
                <div className="px-4 pb-4 pt-1 border-t border-white/5">
                  <div className="ml-11 space-y-2">
                    {c.members.map((m, mi) => {
                      const memberBarWidth = (m.workedHours / c.totalWorkedHours) * 100
                      const color = MEMBER_COLORS[mi % MEMBER_COLORS.length]
                      const photo = getPhotoUrl(m.personName)

                      return (
                        <div key={m.personName} className="flex items-center gap-3">
                          {/* Avatar */}
                          {photo ? (
                            <Image
                              src={photo}
                              alt={m.personName}
                              width={28}
                              height={28}
                              className="w-7 h-7 rounded-lg object-cover flex-shrink-0"
                            />
                          ) : (
                            <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${color} flex items-center justify-center flex-shrink-0`}>
                              <span className="text-[11px] font-medium text-white">
                                {m.personName.charAt(0)}
                              </span>
                            </div>
                          )}

                          {/* Name */}
                          <span className="text-sm text-white/70 w-36 truncate flex-shrink-0">
                            {m.personName}
                          </span>

                          {/* Bar */}
                          <div className="flex-1 h-1 rounded-full bg-white/5 overflow-hidden">
                            <div
                              className={`h-full rounded-full bg-gradient-to-r ${color} transition-all duration-500`}
                              style={{ width: `${memberBarWidth}%` }}
                            />
                          </div>

                          {/* Hours */}
                          <span className="text-xs font-mono text-white/40 w-10 text-right flex-shrink-0">
                            {m.workedHours}u
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Header({ period }: { period?: { startDate: string; endDate: string } }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-workx-lime/10 flex items-center justify-center">
          <Icons.briefcase size={20} className="text-workx-lime" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-white">Lopende zaken</h1>
          {period && (
            <p className="text-sm text-white/40">
              {formatDate(period.startDate)} — {formatDate(period.endDate)}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 hover:bg-white/[0.04] transition-colors">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs text-white/40">{label}</span>
      </div>
      <p className="text-2xl font-semibold text-white">{value}</p>
    </div>
  )
}
