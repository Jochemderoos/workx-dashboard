'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { Icons } from '@/components/ui/Icons'

interface InvoiceLite {
  id: string
  invoiceNumber: string
  bookYear: number
  bookPeriod: number
  projectName: string | null
  clientName: string | null
  totalIncl: number
  primaryUserId: string | null
  reminderSentAt: string | null
}

const MONTHS = ['', 'jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']
const REMINDER_WINDOW_DAYS = 14

function formatEUR(n: number) {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(n)
}

function isReminderDue(reminderSentAt: string | null): boolean {
  if (!reminderSentAt) return true
  const sent = new Date(reminderSentAt)
  return (Date.now() - sent.getTime()) / 86400000 >= REMINDER_WINDOW_DAYS
}

export default function OpenInvoicesWidget() {
  const [invoices, setInvoices] = useState<InvoiceLite[]>([])
  const [loaded, setLoaded] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/open-invoices?mine=1')
      if (res.ok) setInvoices(await res.json())
    } catch { /* silent */ }
    finally { setLoaded(true) }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const dueInvoices = useMemo(
    () => invoices.filter(i => isReminderDue(i.reminderSentAt)).sort((a, b) => {
      // Oudste eerst
      if (a.bookYear !== b.bookYear) return a.bookYear - b.bookYear
      return a.bookPeriod - b.bookPeriod
    }),
    [invoices]
  )

  const markReminded = async (id: string) => {
    setInvoices(prev => prev.map(i => i.id === id ? { ...i, reminderSentAt: new Date().toISOString() } : i))
    try {
      await fetch(`/api/open-invoices/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark-reminded' }),
      })
    } catch { fetchData() }
  }

  if (!loaded || invoices.length === 0) return null

  const totalDue = dueInvoices.reduce((s, i) => s + i.totalIncl, 0)

  const alarmMode = dueInvoices.length > 0

  return (
    <div className={`rounded-2xl border p-5 ${
      alarmMode
        ? 'border-orange-500/40 bg-gradient-to-br from-orange-500/15 via-orange-500/8 to-transparent shadow-lg shadow-orange-500/10'
        : 'border-green-500/20 bg-gradient-to-br from-green-500/10 via-green-500/5 to-transparent'
    }`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
            alarmMode ? 'bg-orange-500/25 animate-pulse' : 'bg-green-500/20'
          }`}>
            <Icons.alertTriangle size={14} className={alarmMode ? 'text-orange-400' : 'text-green-400'} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">
              {alarmMode ? '🔔 Aan te schrijven debiteuren' : 'Debiteuren bijgewerkt'}
            </h3>
            <p className="text-[10px] text-gray-500">
              {alarmMode
                ? `${dueInvoices.length} factu(u)r(en), totaal ${formatEUR(totalDue)} — 14+ dagen niets gedaan`
                : 'Alles recent aangeschreven — geen actie nodig'}
            </p>
          </div>
        </div>
        <Link
          href="/dashboard/debiteuren"
          className="text-[11px] text-workx-lime hover:underline flex items-center gap-1"
        >
          Alles
        </Link>
      </div>

      {dueInvoices.length === 0 ? (
        <div className="text-center py-3 text-xs text-gray-500">
          {invoices.length} factu(u)r(en) recent aangeschreven · volgende reminder over max {REMINDER_WINDOW_DAYS} dagen
        </div>
      ) : (
        <div className="space-y-1.5">
          {dueInvoices.slice(0, 4).map(inv => (
            <div key={inv.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.06]">
              <span className="text-[10px] text-gray-500 tabular-nums w-12 shrink-0">{MONTHS[inv.bookPeriod]} {String(inv.bookYear).slice(2)}</span>
              <span className="text-xs text-white flex-1 truncate" title={inv.projectName || inv.clientName || inv.invoiceNumber}>
                {inv.projectName || inv.clientName || `#${inv.invoiceNumber}`}
              </span>
              <span className="text-xs text-workx-lime tabular-nums shrink-0">{formatEUR(inv.totalIncl)}</span>
              <button
                onClick={() => markReminded(inv.id)}
                className="text-[10px] px-2 py-0.5 rounded bg-orange-500/15 text-orange-300 hover:bg-orange-500/25 shrink-0"
                title="Markeer als aangeschreven"
              >
                ✓
              </button>
            </div>
          ))}
          {dueInvoices.length > 4 && (
            <Link
              href="/dashboard/debiteuren"
              className="block text-[10px] text-gray-500 hover:text-workx-lime text-center pt-1"
            >
              + {dueInvoices.length - 4} meer →
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
