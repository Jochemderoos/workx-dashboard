'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'
import { Icons } from '@/components/ui/Icons'

interface Cost {
  id: string
  year: number
  month: number
  amount: number
  description: string
  sortOrder: number
  createdAt: string
}

const MONTHS = [
  '', 'Januari', 'Februari', 'Maart', 'April', 'Mei',
  'Juni', 'Juli', 'Augustus', 'September', 'Oktober', 'November', 'December'
]

function formatEUR(n: number) {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(n)
}

// Heuristic: groepeer kosten op een leesbare key (vendor / categorie),
// gebaseerd op de eerste woorden van de description.
function groupKey(desc: string): string {
  const cleaned = desc.toLowerCase()
    .replace(/\(.*?\)/g, '')      // haal alles tussen () weg
    .replace(/[.,]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  // Specifieke aliases voor herkenbare vendors
  const aliases: [RegExp, string][] = [
    [/^vlaams broodhuys/, 'Vlaams Broodhuys'],
    [/^albert heijn/, 'Albert Heijn'],
    [/^bol\.?com/, 'Bol.com'],
    [/^viking/, 'Viking kantoorspullen'],
    [/^google ireland/, 'Google Ireland'],
    [/^spotify/, 'Spotify'],
    [/^iside/, 'Iside'],
    [/^kpn/, 'KPN'],
    [/^constant it/, 'Constant IT'],
    [/^basenet/, 'Basenet'],
    [/^herengracht investments/, 'Herengracht Investments (huur)'],
    [/^norm finance/, 'Norm Finance'],
    [/^international card services/, 'International Card Services'],
    [/^digihero/, 'Digihero'],
    [/^financ.+dagblad/, 'Financieele Dagblad'],
    [/^kamer van koophandel/, 'Kamer van Koophandel'],
    [/^abn amro/, 'ABN AMRO'],
    [/^stadhouders/, 'Stadhouders Advocaten'],
    [/^kwps/, 'KWPS (doorbelast)'],
    [/^chambers/, 'Chambers'],
    [/^bright pensioen/, 'Bright Pensioen'],
    [/^delfts? congress/, 'Delfts Congress Support'],
    [/^delft congress/, 'Delfts Congress Support'],
    [/^vereniging arbeidsrecht/, 'Vereniging Arbeidsrecht'],
    [/^vereniging voor arbeidsrecht/, 'Vereniging Arbeidsrecht'],
    [/^nederlandse orde/, 'Nederlandse Orde van Advocaten' ],
    [/^contributie nederlandse orde/, 'Nederlandse Orde van Advocaten' ],
    [/^amsterdamse orde/, 'Amsterdamse Orde van Advocaten'],
    [/^international card/, 'International Card Services'],
    [/^spontaanja/, 'Spontaanja schoonmaker'],
    [/^spontaan ja/, 'Spontaanja schoonmaker'],
    [/^smartcoffee/, 'Smartcoffee (Boonchance)' ],
    [/^bocca coffee/, 'Bocca Coffee'],
    [/^bocca koffie/, 'Bocca Coffee'],
    [/^dba .*bary/, 'DBA / Bary (koffie)'],
    [/^de bary/, 'DBA / Bary (koffie)'],
    [/^gamma business/, 'Gamma Business'],
    [/^froot/, 'Froot' ],
    [/^tentoo/, 'Tentoo'],
    [/^fleurop/, 'Fleurop bloemen'],
    [/^postnl/, 'PostNL'],
    [/^post nl/, 'PostNL'],
    [/^marie-?stella/, 'Marie-Stella-Maris'],
    [/^marie stella/, 'Marie-Stella-Maris'],
    [/^hema/, 'HEMA'],
    [/^rituals/, 'Rituals'],
    [/^topgeschenken/, 'Topgeschenken'],
    [/^brownie box/, 'Brownie box (relatiegeschenken)' ],
    [/^cadeau brownie box/, 'Brownie box (relatiegeschenken)'],
    [/^asr verzuim/, 'ASR Verzuimverzekering'],
    [/^declaratieformulier|^declaratie/, 'Declaratieformulieren medewerkers'],
    [/^fietskoerier/, 'Fietskoerier'],
    [/^zerozero|^zero zero/, 'Zerozero broodjes'],
    [/^broodjes zero/, 'Zerozero broodjes'],
    [/^krua thai/, 'Krua Thai (partnerdiner)'],
    [/^stichting opleiding/, 'Stichting Opleiding Advocaten'],
    [/^stichting idfa/, 'Stichting IDFA'],
    [/^proceskosten/, 'Proceskosten'],
    [/^mooi boules/, 'Mooi Boules (borrel)'],
    [/^hotel arena/, 'Hotel Arena (borrel)'],
    [/^merch/, 'Merchandise (lustrum)'],
    [/^legal mike|^legalmike/, 'Legal Mike'],
    [/^doxflow/, 'Doxflow'],
    [/^vurich/, 'Vurich gerechtsdeurwaarder'],
    [/^ttwwoo/, 'TTWWOO'],
    [/^milieuservice/, 'Milieuservice'],
    [/^jonge balie/, 'Jonge Balie Amsterdam'],
    [/^ndsm/, 'NDSM Apotheek'],
    [/^bram willems/, 'Bram Willems Photography'],
    [/^van loman/, 'Van Loman (doorbelast)'],
    [/^van benthem/, 'Van Benthem & Keulen'],
    [/^hj advocaten/, 'HJ Advocaten & Mediators'],
    [/^stichting spuistraat/, 'Stichting Spuistraat 10'],
    [/^coolblue/, 'Coolblue'],
    [/^adobe/, 'Adobe'],
    [/^athenaeum/, 'Athenaeum'],
    [/^pci/, 'PCI (printer)'],
    [/^de lage landen/, 'De Lage Landen Vendorlease'],
    [/^marleenkookt/, 'Marleenkookt'],
    [/^nectaro/, 'Nectaro (Lodewijk)'],
    [/^buffet van odette/, 'Buffet van Odette'],
    [/^ns reizigers|^ns /, 'NS'],
    [/^mediationgenootschap/, 'Mediationgenootschap'],
    [/^alo .*mediation|^partners in mediation/, 'ALO (Partners in Mediation)'],
    [/^citius/, 'Citius Advocaten'],
    [/^avocare/, 'Avocare'],
    [/^pallas/, 'Pallas Advocaten'],
    [/^youman fisher/, 'Youman Fisher'],
    [/^academie voor de rechtspraak/, 'Academie voor de Rechtspraak'],
    [/^amstelveld/, 'Amstelveld (borrel)'],
    [/^merchado/, 'Merchado (lustrum)'],
    [/^merchlab/, 'Merchlab (lustrum)'],
    [/^dutch arbitration/, 'Dutch Arbitration Association'],
    [/^ministerie van justitie/, 'Ministerie van Justitie (doorbelast)'],
    [/^kosten buitenlandse/, 'Buitenlandse overboeking-kosten'],
    [/^abonnement|^abo /, 'Diverse abonnementen'],
    [/^fiets workx/, 'Fiets Workx (medewerker)'],
    [/^cadeau|^boekenbon|^nijntje/, 'Cadeaus medewerkers/relaties'],
  ]
  for (const [re, label] of aliases) {
    if (re.test(cleaned)) return label
  }
  return cleaned
    .split(' ')
    .slice(0, 2)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export default function KostenPage() {
  const { data: session } = useSession()
  const role = (session?.user as { role?: string })?.role
  const hasAccess = role === 'PARTNER' || role === 'ADMIN'

  const [costs, setCosts] = useState<Cost[]>([])
  const [loading, setLoading] = useState(true)
  const [activeMonth, setActiveMonth] = useState<number>(new Date().getMonth() + 1)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editAmount, setEditAmount] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [newAmount, setNewAmount] = useState('')
  const [newDesc, setNewDesc] = useState('')
  // MT940 import state
  const [showImport, setShowImport] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importItems, setImportItems] = useState<Array<{
    date: string; year: number; month: number; amount: number;
    description: string; externalRef: string; isDuplicate: boolean; selected: boolean
  }>>([])
  const [importError, setImportError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/monthly-costs?year=2026')
      if (res.ok) setCosts(await res.json())
    } catch {
      toast.error('Kon kosten niet laden')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (hasAccess) fetchData()
    else setLoading(false)
  }, [hasAccess, fetchData])

  const addCost = async () => {
    const amount = parseFloat(newAmount.replace(',', '.'))
    if (!amount || !newDesc.trim()) {
      toast.error('Bedrag en omschrijving zijn verplicht')
      return
    }
    try {
      const res = await fetch('/api/monthly-costs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year: 2026, month: activeMonth, amount, description: newDesc.trim() }),
      })
      if (!res.ok) throw new Error()
      setNewAmount('')
      setNewDesc('')
      await fetchData()
    } catch {
      toast.error('Kon niet toevoegen')
    }
  }

  const saveEdit = async (id: string) => {
    const amount = parseFloat(editAmount.replace(',', '.'))
    if (!amount || !editDesc.trim()) {
      setEditingId(null)
      return
    }
    try {
      await fetch(`/api/monthly-costs/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, description: editDesc.trim() }),
      })
      setEditingId(null)
      await fetchData()
    } catch {
      toast.error('Kon niet opslaan')
    }
  }

  const deleteCost = async (id: string) => {
    if (!confirm('Verwijder deze kostenpost?')) return
    try {
      await fetch(`/api/monthly-costs/${id}`, { method: 'DELETE' })
      await fetchData()
    } catch {
      toast.error('Kon niet verwijderen')
    }
  }

  const handleMT940File = async (file: File) => {
    setImporting(true)
    setImportError(null)
    setImportItems([])
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/monthly-costs/parse-mt940', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) {
        setImportError(data.error || 'Kon bestand niet verwerken')
        return
      }
      if (data.transactions.length === 0) {
        setImportError('Geen kosten-transacties gevonden in dit bestand (alleen inkomsten?).')
        return
      }
      setImportItems(data.transactions.map((t: { date: string; year: number; month: number; amount: number; description: string; externalRef: string; isDuplicate: boolean }) => ({
        ...t,
        selected: !t.isDuplicate,
      })))
    } catch {
      setImportError('Kon bestand niet verwerken')
    } finally {
      setImporting(false)
    }
  }

  const confirmImport = async () => {
    const selected = importItems.filter(i => i.selected && !i.isDuplicate)
    if (selected.length === 0) {
      toast.error('Geen regels geselecteerd')
      return
    }
    setImporting(true)
    try {
      const res = await fetch('/api/monthly-costs/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: selected.map(s => ({
            year: s.year,
            month: s.month,
            amount: s.amount,
            description: s.description,
            externalRef: s.externalRef,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error()
      toast.success(`${data.added} toegevoegd${data.skipped > 0 ? `, ${data.skipped} overgeslagen` : ''}`)
      setShowImport(false)
      setImportItems([])
      if (fileInputRef.current) fileInputRef.current.value = ''
      await fetchData()
    } catch {
      toast.error('Importeren mislukt')
    } finally {
      setImporting(false)
    }
  }

  const byMonth = useMemo(() => {
    const map: Record<number, Cost[]> = {}
    for (let m = 1; m <= 12; m++) map[m] = []
    for (const c of costs) map[c.month].push(c)
    return map
  }, [costs])

  const monthTotal = (m: number) => byMonth[m].reduce((s, c) => s + c.amount, 0)

  // Top vendors voor grafiek (op basis van groupKey)
  const vendorStats = useMemo(() => {
    const stats: Record<string, { total: number; count: number }> = {}
    for (const c of costs) {
      const key = groupKey(c.description)
      if (!stats[key]) stats[key] = { total: 0, count: 0 }
      stats[key].total += c.amount
      stats[key].count++
    }
    return Object.entries(stats)
      .map(([key, v]) => ({ key, ...v }))
      .sort((a, b) => b.total - a.total)
  }, [costs])

  const recurringVendors = useMemo(
    () => vendorStats.filter(v => v.count >= 2).slice(0, 15),
    [vendorStats]
  )

  const totalYear = costs.reduce((s, c) => s + c.amount, 0)
  const maxMonthTotal = Math.max(...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(monthTotal), 1)
  const maxVendor = recurringVendors[0]?.total || 1

  if (!session) return null
  if (!hasAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Icons.lock size={32} className="mx-auto text-gray-500 mb-3" />
          <p className="text-gray-400">Alleen toegankelijk voor partners, Hanna en Lotte</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen relative">
      {/* Ambient glows */}
      <div className="absolute top-0 right-[10%] w-64 h-64 bg-workx-lime/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-40 left-[5%] w-48 h-48 bg-green-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="mb-8 relative flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-workx-lime/10 flex items-center justify-center">
            <Icons.euro size={20} className="text-workx-lime" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Kosten 2026</h1>
            <p className="text-sm text-white/40">Per maand bijhouden, onderaan inzicht in terugkerende kosten</p>
          </div>
        </div>
        <button
          onClick={() => setShowImport(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-workx-lime/10 text-workx-lime text-sm font-medium border border-workx-lime/30 hover:bg-workx-lime/20 transition-colors"
          title="Bankafschrift in MT940-formaat uploaden (ABN AMRO → Mutaties → Downloaden)"
        >
          <Icons.upload size={14} />
          Importeer MT940
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-workx-lime/30 border-t-workx-lime rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Year-stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <p className="text-xs text-white/40 mb-1">Totaal jaar</p>
              <p className="text-2xl font-bold text-workx-lime">{formatEUR(totalYear)}</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <p className="text-xs text-white/40 mb-1">Aantal posten</p>
              <p className="text-2xl font-bold text-white">{costs.length}</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <p className="text-xs text-white/40 mb-1">Maandgemiddelde (jan–apr)</p>
              <p className="text-2xl font-bold text-white">
                {formatEUR((monthTotal(1) + monthTotal(2) + monthTotal(3) + monthTotal(4)) / 4)}
              </p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <p className="text-xs text-white/40 mb-1">Unieke vendors</p>
              <p className="text-2xl font-bold text-white">{vendorStats.length}</p>
            </div>
          </div>

          {/* Month tabs */}
          <div className="flex gap-1 overflow-x-auto pb-2 mb-4">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
              <button
                key={m}
                onClick={() => setActiveMonth(m)}
                className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                  activeMonth === m
                    ? 'bg-workx-lime text-workx-dark'
                    : byMonth[m].length > 0
                      ? 'bg-white/5 text-white hover:bg-white/10'
                      : 'bg-white/[0.02] text-gray-600 hover:bg-white/5'
                }`}
              >
                {MONTHS[m]}
                {byMonth[m].length > 0 && (
                  <span className="ml-2 text-xs opacity-70">{byMonth[m].length}</span>
                )}
              </button>
            ))}
          </div>

          {/* Active month panel */}
          <div className="bg-white/[0.03] border border-white/10 rounded-2xl mb-8">
            <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between rounded-t-2xl bg-white/[0.02]">
              <div>
                <h2 className="text-lg font-semibold text-white">{MONTHS[activeMonth]} 2026</h2>
                <p className="text-xs text-gray-500">{byMonth[activeMonth].length} posten</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Subtotaal</p>
                <p className="text-xl font-bold text-workx-lime">{formatEUR(monthTotal(activeMonth))}</p>
              </div>
            </div>

            {/* Add row */}
            <div className="px-5 py-3 border-b border-white/5 flex flex-col sm:flex-row gap-2 bg-white/[0.01]">
              <input
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addCost() }}
                placeholder="Omschrijving"
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-workx-lime/50"
              />
              <input
                value={newAmount}
                onChange={e => setNewAmount(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addCost() }}
                placeholder="Bedrag €"
                inputMode="decimal"
                className="sm:w-40 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-workx-lime/50"
              />
              <button
                onClick={addCost}
                disabled={!newAmount || !newDesc.trim()}
                className="px-4 py-2 rounded-xl bg-workx-lime text-workx-dark text-sm font-medium hover:bg-workx-lime/90 disabled:opacity-40 transition-colors"
              >
                <Icons.plus size={14} className="inline mr-1" /> Toevoegen
              </button>
            </div>

            {/* Rows */}
            {byMonth[activeMonth].length === 0 ? (
              <div className="px-5 py-12 text-center text-gray-500 text-sm">
                Nog geen kosten voor {MONTHS[activeMonth]}. Voeg de eerste post hierboven toe.
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {byMonth[activeMonth].map(c => {
                  const startEdit = () => { setEditingId(c.id); setEditAmount(String(c.amount)); setEditDesc(c.description) }
                  return (
                    <div key={c.id} className="group px-5 py-2.5 flex items-center gap-3 hover:bg-white/[0.02]">
                      {editingId === c.id ? (
                        <>
                          <input
                            value={editDesc}
                            onChange={e => setEditDesc(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') saveEdit(c.id); if (e.key === 'Escape') setEditingId(null) }}
                            autoFocus
                            className="flex-1 bg-white/5 border border-workx-lime/50 rounded-lg px-2 py-1 text-sm text-white focus:outline-none"
                          />
                          <input
                            value={editAmount}
                            onChange={e => setEditAmount(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') saveEdit(c.id); if (e.key === 'Escape') setEditingId(null) }}
                            inputMode="decimal"
                            className="w-28 bg-white/5 border border-workx-lime/50 rounded-lg px-2 py-1 text-sm text-white text-right focus:outline-none"
                          />
                          <button onClick={() => saveEdit(c.id)} className="p-1.5 rounded-lg text-workx-lime hover:bg-workx-lime/10" title="Opslaan (Enter)">
                            <Icons.check size={14} />
                          </button>
                          <button onClick={() => setEditingId(null)} className="p-1.5 rounded-lg text-gray-500 hover:bg-white/5" title="Annuleer (Esc)">
                            <Icons.x size={14} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={startEdit}
                            className="flex-1 text-left text-sm text-white hover:text-workx-lime transition-colors min-w-0 truncate"
                            title="Klik om te bewerken"
                          >
                            {c.description}
                          </button>
                          <span className="text-sm font-medium text-workx-lime/90 tabular-nums">{formatEUR(c.amount)}</span>
                          <button
                            onClick={startEdit}
                            className="p-1.5 rounded-lg text-gray-500 hover:text-workx-lime hover:bg-workx-lime/10 transition-colors opacity-0 group-hover:opacity-100"
                            title="Bewerken"
                          >
                            <Icons.edit size={14} />
                          </button>
                          <button
                            onClick={() => deleteCost(c.id)}
                            className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
                            title="Verwijderen"
                          >
                            <Icons.trash size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Charts section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Maand-bar */}
            <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
              <h3 className="text-white font-semibold mb-1">Totaal per maand</h3>
              <p className="text-xs text-gray-500 mb-4">Hoogte is relatief t.o.v. de duurste maand</p>
              <div className="space-y-2">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => {
                  const total = monthTotal(m)
                  const pct = (total / maxMonthTotal) * 100
                  return (
                    <div key={m} className="flex items-center gap-3">
                      <span className="text-xs text-gray-400 w-20 shrink-0">{MONTHS[m]}</span>
                      <div className="flex-1 h-6 bg-white/5 rounded-lg overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-workx-lime/60 to-workx-lime rounded-lg transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-white tabular-nums w-24 text-right">
                        {total > 0 ? formatEUR(total) : '—'}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Top vendors */}
            <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
              <h3 className="text-white font-semibold mb-1">Top terugkerende kosten</h3>
              <p className="text-xs text-gray-500 mb-4">Vendors die in meerdere maanden voorkomen, op totaalbedrag</p>
              {recurringVendors.length === 0 ? (
                <p className="text-sm text-gray-500 italic">Nog geen terugkerend patroon — meer maanden invullen.</p>
              ) : (
                <div className="space-y-2">
                  {recurringVendors.map(v => {
                    const pct = (v.total / maxVendor) * 100
                    return (
                      <div key={v.key} className="flex items-center gap-3">
                        <span className="text-xs text-white w-40 shrink-0 truncate" title={v.key}>{v.key}</span>
                        <div className="flex-1 h-5 bg-white/5 rounded-md overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-cyan-500/40 to-cyan-400/80 rounded-md"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-gray-500 w-8 text-right">×{v.count}</span>
                        <span className="text-xs font-medium text-white tabular-nums w-24 text-right">{formatEUR(v.total)}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Full vendor table */}
          <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 mb-8">
            <h3 className="text-white font-semibold mb-1">Alle kosten samengevat</h3>
            <p className="text-xs text-gray-500 mb-4">Gegroepeerd op vendor, gesorteerd op totaalbedrag</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b border-white/10">
                    <th className="py-2 px-2 font-medium">Vendor / categorie</th>
                    <th className="py-2 px-2 font-medium text-right">Aantal</th>
                    <th className="py-2 px-2 font-medium text-right">Totaal</th>
                    <th className="py-2 px-2 font-medium text-right">Gemiddeld</th>
                  </tr>
                </thead>
                <tbody>
                  {vendorStats.map(v => (
                    <tr key={v.key} className="border-b border-white/5 hover:bg-white/[0.02]">
                      <td className="py-2 px-2 text-white">{v.key}</td>
                      <td className="py-2 px-2 text-right text-gray-400 tabular-nums">{v.count}</td>
                      <td className="py-2 px-2 text-right text-workx-lime tabular-nums font-medium">{formatEUR(v.total)}</td>
                      <td className="py-2 px-2 text-right text-gray-400 tabular-nums">{formatEUR(v.total / v.count)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* MT940 Import Modal */}
      {showImport && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => { if (!importing) { setShowImport(false); setImportItems([]); setImportError(null) } }}>
          <div className="bg-workx-dark border border-white/10 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            {/* Modal header — vast */}
            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-lg font-semibold text-white">MT940 importeren</h2>
                <p className="text-xs text-gray-400 mt-0.5">ABN AMRO → Mutaties → Downloaden in MT940-formaat</p>
              </div>
              <button
                onClick={() => { if (!importing) { setShowImport(false); setImportItems([]); setImportError(null) } }}
                className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-colors"
              >
                <Icons.x size={16} />
              </button>
            </div>

            {/* Scrollable content */}
            <div className="overflow-y-auto p-6 flex-1">
              {importItems.length === 0 ? (
                <div className="space-y-4">
                  {importError && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-300">
                      {importError}
                    </div>
                  )}
                  <div className="bg-white/[0.02] border border-dashed border-white/15 rounded-2xl p-10 text-center">
                    <Icons.upload size={32} className="mx-auto text-gray-500 mb-3" />
                    <p className="text-sm text-white mb-1">Kies een MT940-bestand (.940 of .txt)</p>
                    <p className="text-xs text-gray-500 mb-4">Alleen kosten (debet) worden geïmporteerd. Inkomsten worden overgeslagen.</p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".940,.txt,.sta"
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (f) handleMT940File(f)
                      }}
                      disabled={importing}
                      className="block mx-auto text-xs text-gray-400 file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-workx-lime file:text-workx-dark file:text-xs file:font-medium hover:file:bg-workx-lime/90 file:cursor-pointer"
                    />
                    {importing && (
                      <div className="mt-3 flex items-center justify-center gap-2 text-xs text-gray-400">
                        <div className="w-3 h-3 border-2 border-workx-lime/30 border-t-workx-lime rounded-full animate-spin" />
                        Bezig met inlezen…
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <p className="text-sm text-white">
                      {importItems.length} transacties gevonden
                      {importItems.filter(i => i.isDuplicate).length > 0 && (
                        <span className="text-orange-400 ml-2">
                          ({importItems.filter(i => i.isDuplicate).length} al bekend)
                        </span>
                      )}
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setImportItems(items => items.map(i => ({ ...i, selected: !i.isDuplicate })))}
                        className="text-xs text-gray-400 hover:text-workx-lime transition-colors"
                      >
                        Alleen nieuwe
                      </button>
                      <span className="text-xs text-gray-700">·</span>
                      <button
                        onClick={() => setImportItems(items => items.map(i => ({ ...i, selected: true })))}
                        className="text-xs text-gray-400 hover:text-workx-lime transition-colors"
                      >
                        Alles aan
                      </button>
                      <span className="text-xs text-gray-700">·</span>
                      <button
                        onClick={() => setImportItems(items => items.map(i => ({ ...i, selected: false })))}
                        className="text-xs text-gray-400 hover:text-red-400 transition-colors"
                      >
                        Alles uit
                      </button>
                    </div>
                  </div>

                  <div className="border border-white/10 rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-white/[0.03]">
                        <tr className="text-left text-xs text-gray-400">
                          <th className="px-2 py-2 w-8"></th>
                          <th className="px-2 py-2 font-medium w-24">Datum</th>
                          <th className="px-2 py-2 font-medium">Omschrijving</th>
                          <th className="px-2 py-2 font-medium text-right w-28">Bedrag</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importItems.map((it, idx) => (
                          <tr key={idx} className={`border-t border-white/5 ${it.isDuplicate ? 'opacity-40' : ''}`}>
                            <td className="px-2 py-1.5">
                              <input
                                type="checkbox"
                                checked={it.selected}
                                disabled={it.isDuplicate}
                                onChange={(e) => {
                                  const checked = e.target.checked
                                  setImportItems(items => items.map((i, j) => j === idx ? { ...i, selected: checked } : i))
                                }}
                                className="accent-workx-lime"
                              />
                            </td>
                            <td className="px-2 py-1.5 text-gray-400 tabular-nums whitespace-nowrap">
                              {new Date(it.date).toLocaleDateString('nl-NL', { day: '2-digit', month: 'short' })}
                              {it.isDuplicate && (
                                <span className="ml-1 text-[9px] text-orange-400">DUP</span>
                              )}
                            </td>
                            <td className="px-2 py-1.5">
                              <input
                                value={it.description}
                                onChange={(e) => {
                                  const v = e.target.value
                                  setImportItems(items => items.map((i, j) => j === idx ? { ...i, description: v } : i))
                                }}
                                disabled={it.isDuplicate}
                                className="w-full bg-transparent text-xs text-white focus:outline-none focus:bg-white/5 rounded px-1"
                              />
                            </td>
                            <td className="px-2 py-1.5 text-right text-workx-lime/90 tabular-nums">{formatEUR(it.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Modal footer — vast */}
            <div className="px-6 py-4 border-t border-white/10 flex items-center justify-between gap-3 shrink-0">
              <div className="text-xs text-gray-500">
                {importItems.length > 0 && (
                  <>
                    <span className="text-workx-lime font-medium">{importItems.filter(i => i.selected && !i.isDuplicate).length}</span> regels worden geïmporteerd
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { if (!importing) { setShowImport(false); setImportItems([]); setImportError(null) } }}
                  disabled={importing}
                  className="px-4 py-2 rounded-xl bg-white/5 text-gray-300 text-sm hover:bg-white/10 transition-colors disabled:opacity-40"
                >
                  Annuleren
                </button>
                {importItems.length > 0 && (
                  <button
                    onClick={confirmImport}
                    disabled={importing || importItems.filter(i => i.selected && !i.isDuplicate).length === 0}
                    className="px-4 py-2 rounded-xl bg-workx-lime text-workx-dark text-sm font-medium hover:bg-workx-lime/90 transition-colors disabled:opacity-40"
                  >
                    {importing ? 'Importeren…' : 'Importeren'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
