'use client'

import { useMemo } from 'react'

const periods = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9', 'P10', 'P11', 'P12']

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(value)

const formatCurrencyShort = (value: number) =>
  new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value)

const formatNumber = (value: number) =>
  new Intl.NumberFormat('nl-NL', { maximumFractionDigits: 1 }).format(value)

// VPB-tarieven 2025/2026: 19% tot € 200.000 winst, 25,8% over het meerdere.
const VPB_LAAG = 0.19
const VPB_HOOG = 0.258
const VPB_DREMPEL = 200000

const computeVPB = (winst: number) => {
  if (winst <= 0) return { totaal: 0, laag: 0, hoog: 0 }
  if (winst <= VPB_DREMPEL) {
    const laag = winst * VPB_LAAG
    return { totaal: laag, laag, hoog: 0 }
  }
  const laag = VPB_DREMPEL * VPB_LAAG
  const hoog = (winst - VPB_DREMPEL) * VPB_HOOG
  return { totaal: laag + hoog, laag, hoog }
}

export interface JaarTabProps {
  year: number
  yearData: {
    werkgeverslasten: number[]
    kostenExtern: number[]
    omzet: number[]
    uren: number[]
  }
  wglPerMonth: number[]
  uwvPerMonth: number[]
  asrPerMonth: number[]
  zzpPerMonth: number[]
  mgmtPerMonth: number[]
  overigKostenPerMonth: number[]
}

export default function JaarTab({
  year,
  yearData,
  wglPerMonth,
  uwvPerMonth,
  asrPerMonth,
  zzpPerMonth,
  mgmtPerMonth,
  overigKostenPerMonth,
}: JaarTabProps) {
  // Laatste maand met data (omzet of bruto loon of overige kosten of mgmt)
  const lastMonth = useMemo(() => {
    let last = 0
    for (let m = 0; m < 12; m++) {
      if (
        (yearData.omzet[m] || 0) !== 0 ||
        (yearData.werkgeverslasten[m] || 0) !== 0 ||
        (overigKostenPerMonth[m] || 0) !== 0 ||
        (mgmtPerMonth[m] || 0) !== 0
      ) {
        last = m + 1
      }
    }
    return last
  }, [yearData, overigKostenPerMonth, mgmtPerMonth])

  // Per-maand calculatie (alle 12 maanden — voor charts), maand-totalen
  const monthly = useMemo(() => {
    return periods.map((_, i) => {
      const bruto = (yearData.werkgeverslasten[i] || 0) + (wglPerMonth[i] || 0)
      const retour = (uwvPerMonth[i] || 0) + (asrPerMonth[i] || 0)
      const wkzNet = bruto - retour
      const mgmt = mgmtPerMonth[i] || 0
      const overig = overigKostenPerMonth[i] || 0
      const zzp = zzpPerMonth[i] || 0
      const totaal = wkzNet + mgmt + overig
      const omzet = yearData.omzet[i] || 0
      const saldo = omzet - totaal
      const uren = yearData.uren[i] || 0
      return { bruto, retour, wkzNet, mgmt, overig, zzp, totaal, omzet, saldo, uren }
    })
  }, [yearData, wglPerMonth, uwvPerMonth, asrPerMonth, zzpPerMonth, mgmtPerMonth, overigKostenPerMonth])

  // Jaartotalen — t/m lastMonth (voor 2025 doorgaans 12, voor 2026 t/m huidige maand)
  const totals = useMemo(() => {
    const n = lastMonth || 12
    const sum = (arr: number[]) => arr.slice(0, n).reduce((s, v) => s + (v || 0), 0)
    const omzet = sum(yearData.omzet)
    const bruto = sum(yearData.werkgeverslasten) + sum(wglPerMonth)
    const uwv = sum(uwvPerMonth)
    const asr = sum(asrPerMonth)
    const wkzNet = bruto - uwv - asr
    const mgmt = sum(mgmtPerMonth)
    const overig = sum(overigKostenPerMonth)
    const zzp = sum(zzpPerMonth)
    const overigExclZzp = overig - zzp
    const totaleKosten = wkzNet + mgmt + overig
    const bedrijfsresultaat = omzet - totaleKosten
    const vpb = computeVPB(bedrijfsresultaat)
    const netto = bedrijfsresultaat - vpb.totaal
    const uren = sum(yearData.uren)
    const gemUurprijs = uren > 0 ? omzet / uren : 0
    return {
      omzet, bruto, uwv, asr, wkzNet, mgmt, overig, zzp, overigExclZzp,
      totaleKosten, bedrijfsresultaat, vpb, netto, uren, gemUurprijs,
    }
  }, [yearData, wglPerMonth, uwvPerMonth, asrPerMonth, zzpPerMonth, mgmtPerMonth, overigKostenPerMonth, lastMonth])

  const periodLabel = !lastMonth
    ? 'nog geen data'
    : lastMonth === 12
      ? 'heel jaar'
      : `t/m P${lastMonth}`

  // Geen data → toon lege state
  if (!lastMonth) {
    return (
      <div className="bg-workx-dark/40 rounded-2xl p-12 border border-white/5 text-center">
        <h2 className="text-2xl font-semibold text-white mb-2">Jaaroverzicht {year}</h2>
        <p className="text-white/60">Nog geen financiële data voor {year}.</p>
        <p className="text-white/40 text-sm mt-2">
          Vul gegevens in via de Overzicht-tab en de <a href="/dashboard/kosten" className="text-workx-lime hover:underline">Kosten-pagina</a>.
        </p>
      </div>
    )
  }

  // Kosten per categorie (voor donut)
  const costCategories = [
    { label: 'Werkgeverslasten', value: Math.max(totals.wkzNet, 0), color: '#9ca3af' },
    { label: 'Management fee', value: Math.max(totals.mgmt, 0), color: '#06b6d4' },
    { label: 'ZZP advocaten', value: Math.max(totals.zzp, 0), color: '#a78bfa' },
    { label: 'Overige bedrijfskosten', value: Math.max(totals.overigExclZzp, 0), color: '#f97316' },
  ].filter(c => c.value > 0)
  const costTotal = costCategories.reduce((s, c) => s + c.value, 0)

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="bg-gradient-to-br from-workx-lime/10 via-workx-dark/40 to-workx-dark/40 rounded-2xl p-6 border border-workx-lime/20">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <p className="text-workx-lime/70 text-xs uppercase tracking-wider mb-1">Jaaroverzicht</p>
            <h2 className="text-3xl font-semibold text-white">{year}</h2>
            <p className="text-white/60 text-sm mt-1">
              {lastMonth === 12
                ? `Volledig jaar — concept jaarrekening`
                : `Concept jaarrekening op basis van invoer t/m P${lastMonth}`}
            </p>
          </div>
          <div className="grid grid-cols-2 sm:flex sm:gap-6 gap-3 text-right">
            <div>
              <p className="text-xs text-white/40 uppercase tracking-wider">Omzet</p>
              <p className="text-xl font-semibold text-white tabular-nums">{formatCurrencyShort(totals.omzet)}</p>
            </div>
            <div>
              <p className="text-xs text-white/40 uppercase tracking-wider">Resultaat na VPB</p>
              <p className={`text-xl font-semibold tabular-nums ${totals.netto >= 0 ? 'text-workx-lime' : 'text-red-400'}`}>
                {formatCurrencyShort(totals.netto)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Kpi label={`Omzet (${periodLabel})`} value={formatCurrency(totals.omzet)} sub={`${formatNumber(totals.uren)} uur`} accent="text-white" />
        <Kpi label={`Totale Kosten`} value={formatCurrency(totals.totaleKosten)} sub={`${((totals.totaleKosten / totals.omzet) * 100).toFixed(0)}% van omzet`} accent="text-orange-300" />
        <Kpi
          label="Bedrijfsresultaat"
          value={formatCurrency(totals.bedrijfsresultaat)}
          sub={`marge ${totals.omzet > 0 ? ((totals.bedrijfsresultaat / totals.omzet) * 100).toFixed(1) : '0'}%`}
          accent={totals.bedrijfsresultaat >= 0 ? 'text-workx-lime' : 'text-red-400'}
        />
        <Kpi
          label="Netto na VPB"
          value={formatCurrency(totals.netto)}
          sub={`VPB ${formatCurrencyShort(totals.vpb.totaal)}`}
          accent={totals.netto >= 0 ? 'text-workx-lime' : 'text-red-400'}
        />
      </div>

      {/* Concept Jaarrekening */}
      <div className="bg-workx-dark/40 rounded-2xl border border-white/5 overflow-hidden">
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-white font-medium">Concept Jaarrekening {year}</h3>
            <p className="text-xs text-gray-500 mt-1">
              Resultatenrekening op basis van werkelijke kosten + werkgeverslasten − UWV/ASR. Ex BTW. VPB-tarieven {year}: 19% tot {formatCurrencyShort(VPB_DREMPEL)}, 25,8% daarboven.
            </p>
          </div>
          <span className="text-[10px] text-gray-500 bg-white/5 px-3 py-1 rounded-full uppercase tracking-wider">{periodLabel}</span>
        </div>
        <div className="p-6">
          <table className="w-full">
            <tbody className="text-sm">
              <Row label="Omzet" value={totals.omzet} bold accent="text-white" />
              <Spacer />

              <SubHeader label="Werkgeverslasten" />
              <Row label="Bruto loon + pensioen" value={totals.bruto} indent />
              {totals.uwv > 0 && <Row label="− UWV (zwangerschapsverlof)" value={-totals.uwv} indent accent="text-green-400" />}
              {totals.asr > 0 && <Row label="− ASR (verzuim)" value={-totals.asr} indent accent="text-green-400" />}
              <Row label="Subtotaal werkgeverslasten" value={totals.wkzNet} subtotal />

              <Spacer />
              {totals.mgmt > 0 && (
                <>
                  <SubHeader label="Management fee partners" />
                  <Row label="Uitkeringen partner-holdings" value={totals.mgmt} indent accent="text-cyan-300" />
                  <Spacer />
                </>
              )}

              <SubHeader label="Overige bedrijfskosten" />
              {totals.zzp > 0 && <Row label="ZZP advocaten" value={totals.zzp} indent accent="text-purple-300" />}
              <Row label={totals.zzp > 0 ? 'Andere bedrijfskosten' : 'Bedrijfskosten'} value={totals.overigExclZzp} indent accent="text-orange-300" />
              <Row label="Subtotaal overige kosten" value={totals.overig} subtotal />

              <Spacer />
              <Row label="Totale Kosten" value={totals.totaleKosten} subtotal accent="text-orange-300" />

              <Spacer />
              <tr className="bg-workx-lime/5">
                <td className="py-3 px-3 text-white font-semibold">Bedrijfsresultaat</td>
                <td className={`py-3 px-3 text-right tabular-nums font-bold text-lg ${totals.bedrijfsresultaat >= 0 ? 'text-workx-lime' : 'text-red-400'}`}>
                  {formatCurrency(totals.bedrijfsresultaat)}
                </td>
              </tr>

              <Spacer />
              <SubHeader label="Vennootschapsbelasting" />
              {totals.bedrijfsresultaat <= 0 ? (
                <Row label="Geen winst — geen VPB" value={0} indent accent="text-gray-400" />
              ) : (
                <>
                  <Row
                    label={`19% over eerste ${formatCurrencyShort(Math.min(totals.bedrijfsresultaat, VPB_DREMPEL))}`}
                    value={-totals.vpb.laag}
                    indent
                    accent="text-red-300"
                  />
                  {totals.vpb.hoog > 0 && (
                    <Row
                      label={`25,8% over ${formatCurrencyShort(totals.bedrijfsresultaat - VPB_DREMPEL)} boven drempel`}
                      value={-totals.vpb.hoog}
                      indent
                      accent="text-red-300"
                    />
                  )}
                  <Row label="Totaal VPB" value={-totals.vpb.totaal} subtotal accent="text-red-400" />
                </>
              )}

              <Spacer />
              <tr className="bg-workx-lime/10 border-2 border-workx-lime/30">
                <td className="py-4 px-3 text-white font-bold text-base">Nettoresultaat</td>
                <td className={`py-4 px-3 text-right tabular-nums font-bold text-xl ${totals.netto >= 0 ? 'text-workx-lime' : 'text-red-400'}`}>
                  {formatCurrency(totals.netto)}
                </td>
              </tr>
            </tbody>
          </table>

          <p className="text-[11px] text-gray-500 mt-4 italic">
            Concept obv resultatenrekening. Werkelijke VPB-aangifte kan afwijken door fiscale correcties (gemengde kosten, investeringsaftrek, voorzieningen, etc.).
          </p>
        </div>
      </div>

      {/* Kosten per categorie — Donut + Legend */}
      {costTotal > 0 && (
        <div className="bg-workx-dark/40 rounded-2xl p-6 border border-white/5">
          <h3 className="text-white font-medium mb-1">Kosten per categorie</h3>
          <p className="text-xs text-gray-500 mb-6">Verdeling van totale kosten ({formatCurrency(costTotal)}) over {periodLabel}.</p>
          <div className="grid lg:grid-cols-2 gap-6 items-center">
            <DonutChart categories={costCategories} total={costTotal} />
            <div className="space-y-2">
              {costCategories.map(c => {
                const pct = (c.value / costTotal) * 100
                return (
                  <div key={c.label} className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: c.color }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-sm text-white truncate">{c.label}</span>
                        <span className="text-sm tabular-nums text-white/80 font-medium">{formatCurrency(c.value)}</span>
                      </div>
                      <div className="mt-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: c.color }} />
                      </div>
                      <p className="text-[11px] text-gray-500 mt-0.5">{pct.toFixed(1)}% van totaal</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Omzet vs Kosten — area chart per maand */}
      <OmzetKostenChart monthly={monthly} lastMonth={lastMonth} />

      {/* Cumulatief saldo grafiek */}
      <CumulatiefSaldoChart monthly={monthly} lastMonth={lastMonth} netResultaat={totals.netto} bedrijfsresultaat={totals.bedrijfsresultaat} />

      {/* Per-maand tabel */}
      <div className="bg-workx-dark/40 rounded-2xl border border-white/5 overflow-hidden">
        <div className="px-6 py-4 border-b border-white/5">
          <h3 className="text-white font-medium">Per-maand uitsplitsing</h3>
          <p className="text-xs text-gray-500 mt-1">Alle kostenposten ex BTW. Saldo = omzet − totale kosten (voor VPB).</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-white/10 bg-white/[0.02]">
                <th className="py-2.5 px-3 font-medium">Maand</th>
                <th className="py-2.5 px-3 font-medium text-right" title="Bruto loon + pensioen − UWV − ASR">Werkgeverslasten</th>
                <th className="py-2.5 px-3 font-medium text-right">Management fee</th>
                <th className="py-2.5 px-3 font-medium text-right">Overige kosten</th>
                <th className="py-2.5 px-3 font-medium text-right">Totale kosten</th>
                <th className="py-2.5 px-3 font-medium text-right">Omzet</th>
                <th className="py-2.5 px-3 font-medium text-right">Saldo</th>
                <th className="py-2.5 px-3 font-medium text-right">Uren</th>
              </tr>
            </thead>
            <tbody>
              {monthly.map((m, i) => {
                if (i >= lastMonth) return null
                return (
                  <tr key={periods[i]} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="py-2.5 px-3 text-white font-medium">{periods[i]}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-gray-200">{formatCurrency(m.wkzNet)}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-cyan-300">{m.mgmt > 0 ? formatCurrency(m.mgmt) : '—'}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-orange-300">{formatCurrency(m.overig)}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-white font-medium">{formatCurrency(m.totaal)}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-gray-300">{formatCurrency(m.omzet)}</td>
                    <td className={`py-2.5 px-3 text-right tabular-nums font-medium ${m.saldo >= 0 ? 'text-workx-lime' : 'text-red-400'}`}>
                      {formatCurrency(m.saldo)}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-gray-400">{formatNumber(m.uren)}</td>
                  </tr>
                )
              })}
              <tr className="border-t-2 border-white/10 bg-white/[0.03]">
                <td className="py-3 px-3 text-white font-bold">Totaal</td>
                <td className="py-3 px-3 text-right tabular-nums text-gray-100 font-bold">{formatCurrency(totals.wkzNet)}</td>
                <td className="py-3 px-3 text-right tabular-nums text-cyan-300 font-bold">{totals.mgmt > 0 ? formatCurrency(totals.mgmt) : '—'}</td>
                <td className="py-3 px-3 text-right tabular-nums text-orange-300 font-bold">{formatCurrency(totals.overig)}</td>
                <td className="py-3 px-3 text-right tabular-nums text-white font-bold">{formatCurrency(totals.totaleKosten)}</td>
                <td className="py-3 px-3 text-right tabular-nums text-gray-100 font-bold">{formatCurrency(totals.omzet)}</td>
                <td className={`py-3 px-3 text-right tabular-nums font-bold ${totals.bedrijfsresultaat >= 0 ? 'text-workx-lime' : 'text-red-400'}`}>
                  {formatCurrency(totals.bedrijfsresultaat)}
                </td>
                <td className="py-3 px-3 text-right tabular-nums text-gray-300 font-bold">{formatNumber(totals.uren)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Productiviteits-strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <Kpi
          label="Gem. uurprijs"
          value={totals.gemUurprijs > 0 ? formatCurrency(totals.gemUurprijs) : '—'}
          sub={`${formatNumber(totals.uren)} uur · ${formatCurrencyShort(totals.omzet)} omzet`}
          accent="text-white"
        />
        <Kpi
          label="Kosten / uur"
          value={totals.uren > 0 ? formatCurrency(totals.totaleKosten / totals.uren) : '—'}
          sub="totale kosten / uur"
          accent="text-orange-300"
        />
        <Kpi
          label="Marge / uur"
          value={totals.uren > 0 ? formatCurrency((totals.omzet - totals.totaleKosten) / totals.uren) : '—'}
          sub="bedrijfsresultaat / uur"
          accent={totals.bedrijfsresultaat >= 0 ? 'text-workx-lime' : 'text-red-400'}
        />
        <Kpi
          label="Werkgeverslasten / omzet"
          value={totals.omzet > 0 ? `${((totals.wkzNet / totals.omzet) * 100).toFixed(1)}%` : '—'}
          sub={`${formatCurrencyShort(totals.wkzNet)} loon op ${formatCurrencyShort(totals.omzet)} omzet`}
          accent="text-gray-200"
        />
      </div>
    </div>
  )
}

// ===== Sub-componenten =====

function Kpi({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent: string }) {
  return (
    <div className="bg-workx-dark/40 rounded-2xl p-3 sm:p-5 border border-white/5">
      <p className="text-gray-400 text-xs sm:text-sm truncate">{label}</p>
      <p className={`text-lg sm:text-2xl font-semibold mt-1 truncate tabular-nums ${accent}`}>{value}</p>
      {sub && <p className="text-[11px] sm:text-xs text-gray-500 mt-1 truncate">{sub}</p>}
    </div>
  )
}

function Row({ label, value, bold, subtotal, indent, accent }: {
  label: string
  value: number
  bold?: boolean
  subtotal?: boolean
  indent?: boolean
  accent?: string
}) {
  return (
    <tr className={subtotal ? 'border-t border-white/10' : ''}>
      <td className={`py-1.5 px-3 ${indent ? 'pl-8 text-gray-300' : 'text-white'} ${bold ? 'font-semibold' : ''} ${subtotal ? 'font-semibold text-white/90 pt-2.5' : ''}`}>
        {label}
      </td>
      <td className={`py-1.5 px-3 text-right tabular-nums ${bold || subtotal ? 'font-semibold' : ''} ${accent || 'text-white'} ${subtotal ? 'pt-2.5' : ''}`}>
        {formatCurrency(value)}
      </td>
    </tr>
  )
}

function SubHeader({ label }: { label: string }) {
  return (
    <tr>
      <td colSpan={2} className="pt-3 pb-1 px-3 text-[11px] uppercase tracking-wider text-gray-500 font-medium">
        {label}
      </td>
    </tr>
  )
}

function Spacer() {
  return <tr><td colSpan={2} className="h-1.5"></td></tr>
}

function DonutChart({ categories, total }: { categories: { label: string; value: number; color: string }[]; total: number }) {
  const size = 220
  const cx = size / 2
  const cy = size / 2
  const r = 88
  const ir = 60
  let cumAngle = -Math.PI / 2 // start at top

  const arcs = categories.map(c => {
    const angle = (c.value / total) * Math.PI * 2
    const startAngle = cumAngle
    const endAngle = cumAngle + angle
    cumAngle = endAngle

    const x1 = cx + r * Math.cos(startAngle)
    const y1 = cy + r * Math.sin(startAngle)
    const x2 = cx + r * Math.cos(endAngle)
    const y2 = cy + r * Math.sin(endAngle)
    const xi1 = cx + ir * Math.cos(startAngle)
    const yi1 = cy + ir * Math.sin(startAngle)
    const xi2 = cx + ir * Math.cos(endAngle)
    const yi2 = cy + ir * Math.sin(endAngle)
    const largeArc = angle > Math.PI ? 1 : 0

    const d = [
      `M ${x1} ${y1}`,
      `A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`,
      `L ${xi2} ${yi2}`,
      `A ${ir} ${ir} 0 ${largeArc} 0 ${xi1} ${yi1}`,
      'Z',
    ].join(' ')

    return { d, color: c.color, label: c.label }
  })

  return (
    <div className="flex justify-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {arcs.map((a, i) => (
          <path key={i} d={a.d} fill={a.color} opacity="0.85" stroke="rgba(0,0,0,0.2)" strokeWidth="1" />
        ))}
        <text x={cx} y={cy - 6} textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="11" fontFamily="system-ui">Totale kosten</text>
        <text x={cx} y={cy + 14} textAnchor="middle" fill="#fff" fontSize="15" fontWeight="600" fontFamily="system-ui">
          {formatCurrencyShort(total)}
        </text>
      </svg>
    </div>
  )
}

interface MonthlyRow {
  bruto: number
  retour: number
  wkzNet: number
  mgmt: number
  overig: number
  zzp: number
  totaal: number
  omzet: number
  saldo: number
  uren: number
}

function OmzetKostenChart({ monthly, lastMonth }: { monthly: MonthlyRow[]; lastMonth: number }) {
  const svgW = 800, svgH = 280
  const pL = 70, pR = svgW - 20, pT = 20, pB = svgH - 40
  const pH = pB - pT, pW = pR - pL

  const omzet = monthly.slice(0, lastMonth).map(m => m.omzet)
  const kosten = monthly.slice(0, lastMonth).map(m => m.totaal)

  const allVals = [...omzet, ...kosten]
  const yMax = Math.max(...allVals, 1) * 1.15
  const yMin = Math.min(...allVals, 0) * 1.1

  const getX = (i: number) => pL + (i / 11) * pW
  const getY = (v: number) => pB - ((v - yMin) / (yMax - yMin)) * pH

  const smoothPath = (points: { x: number; y: number }[]) => {
    if (points.length < 2) return ''
    let d = `M ${points[0].x},${points[0].y}`
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1], curr = points[i]
      const cpx = (prev.x + curr.x) / 2
      d += ` C ${cpx},${prev.y} ${cpx},${curr.y} ${curr.x},${curr.y}`
    }
    return d
  }

  const areaPath = (points: { x: number; y: number }[]) => {
    if (points.length < 2) return ''
    return `${smoothPath(points)} L ${points[points.length - 1].x},${pB} L ${points[0].x},${pB} Z`
  }

  const omzetPts = omzet.map((v, i) => ({ x: getX(i), y: getY(v) }))
  const kostenPts = kosten.map((v, i) => ({ x: getX(i), y: getY(v) }))

  const yTicks: number[] = []
  const step = Math.ceil((yMax - yMin) / 5 / 50000) * 50000 || 50000
  for (let v = Math.ceil(yMin / step) * step; v <= yMax; v += step) yTicks.push(v)

  return (
    <div className="bg-workx-dark/40 rounded-2xl p-6 border border-white/5">
      <h3 className="text-white font-medium mb-1">Omzet vs Totale Kosten per maand</h3>
      <p className="text-xs text-gray-500 mb-4">Gevulde vlakken tonen de werkelijke omzet (groen) en totale kosten (oranje) per periode.</p>
      <div className="relative" style={{ height: svgH }}>
        <svg width="100%" height="100%" viewBox={`0 0 ${svgW} ${svgH}`} preserveAspectRatio="xMidYMid meet">
          <defs>
            <linearGradient id="jaarOmzetGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22c55e" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#22c55e" stopOpacity="0.05" />
            </linearGradient>
            <linearGradient id="jaarKostenGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f97316" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#f97316" stopOpacity="0.05" />
            </linearGradient>
          </defs>
          {yTicks.map(v => (
            <g key={v}>
              <line x1={pL} y1={getY(v)} x2={pR} y2={getY(v)} stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
              <text x={pL - 8} y={getY(v) + 4} textAnchor="end" fill="rgba(255,255,255,0.4)" fontSize="11" fontFamily="system-ui">
                €{(v / 1000).toFixed(0)}k
              </text>
            </g>
          ))}
          {yMin < 0 && <line x1={pL} y1={getY(0)} x2={pR} y2={getY(0)} stroke="rgba(255,255,255,0.2)" strokeWidth="1" strokeDasharray="4,4" />}
          {omzetPts.length >= 2 && (
            <>
              <path d={areaPath(omzetPts)} fill="url(#jaarOmzetGrad)" />
              <path d={smoothPath(omzetPts)} fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d={areaPath(kostenPts)} fill="url(#jaarKostenGrad)" />
              <path d={smoothPath(kostenPts)} fill="none" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              {omzetPts.map((pt, i) => (
                <g key={`o-${i}`}>
                  <circle cx={pt.x} cy={pt.y} r="5" fill="#22c55e" opacity="0.2" />
                  <circle cx={pt.x} cy={pt.y} r="3" fill="#22c55e" />
                </g>
              ))}
              {kostenPts.map((pt, i) => (
                <g key={`k-${i}`}>
                  <circle cx={pt.x} cy={pt.y} r="5" fill="#f97316" opacity="0.2" />
                  <circle cx={pt.x} cy={pt.y} r="3" fill="#f97316" />
                </g>
              ))}
            </>
          )}
          {periods.map((p, i) => (
            <text key={p} x={getX(i)} y={pB + 20} textAnchor="middle" fill={i < lastMonth ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.2)'} fontSize="12" fontFamily="system-ui">
              {p}
            </text>
          ))}
        </svg>
      </div>
      <div className="flex justify-center gap-6 mt-3">
        <div className="flex items-center gap-2">
          <div className="w-4 h-3 rounded-sm bg-green-500/60" />
          <span className="text-xs text-white/70">Omzet</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-3 rounded-sm bg-orange-500/60" />
          <span className="text-xs text-white/70">Totale kosten</span>
        </div>
      </div>
    </div>
  )
}

function CumulatiefSaldoChart({ monthly, lastMonth, netResultaat, bedrijfsresultaat }: {
  monthly: { saldo: number; omzet: number; totaal: number }[]
  lastMonth: number
  netResultaat: number
  bedrijfsresultaat: number
}) {
  const svgW = 800, svgH = 260
  const pL = 70, pR = svgW - 20, pT = 20, pB = svgH - 40
  const pH = pB - pT, pW = pR - pL

  // Cumulatief bedrijfsresultaat per maand
  const cum: number[] = []
  let acc = 0
  for (let i = 0; i < lastMonth; i++) {
    acc += monthly[i].saldo
    cum.push(acc)
  }

  const allVals = [...cum, 0, netResultaat]
  const yMax = Math.max(...allVals, 1) * 1.15
  const yMin = Math.min(...allVals, 0) * 1.15
  const range = yMax - yMin || 1

  const getX = (i: number) => pL + (i / 11) * pW
  const getY = (v: number) => pB - ((v - yMin) / range) * pH

  const smoothPath = (points: { x: number; y: number }[]) => {
    if (points.length < 2) return ''
    let d = `M ${points[0].x},${points[0].y}`
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1], curr = points[i]
      const cpx = (prev.x + curr.x) / 2
      d += ` C ${cpx},${prev.y} ${cpx},${curr.y} ${curr.x},${curr.y}`
    }
    return d
  }
  const areaPath = (points: { x: number; y: number }[]) => {
    if (points.length < 2) return ''
    return `${smoothPath(points)} L ${points[points.length - 1].x},${getY(0)} L ${points[0].x},${getY(0)} Z`
  }

  const pts = cum.map((v, i) => ({ x: getX(i), y: getY(v) }))

  const yTicks: number[] = []
  const step = Math.ceil(range / 5 / 100000) * 100000 || 100000
  for (let v = Math.floor(yMin / step) * step; v <= yMax; v += step) yTicks.push(v)

  return (
    <div className="bg-workx-dark/40 rounded-2xl p-6 border border-white/5">
      <div className="flex items-start justify-between mb-1 gap-4 flex-wrap">
        <div>
          <h3 className="text-white font-medium">Cumulatief resultaat</h3>
          <p className="text-xs text-gray-500 mt-1">Bedrijfsresultaat opgebouwd over het jaar (omzet − totale kosten, voor VPB).</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider">Resultaat na VPB</p>
          <p className={`text-lg font-bold tabular-nums ${netResultaat >= 0 ? 'text-workx-lime' : 'text-red-400'}`}>
            {formatCurrency(netResultaat)}
          </p>
          <p className="text-[10px] text-gray-500">voor VPB: {formatCurrencyShort(bedrijfsresultaat)}</p>
        </div>
      </div>
      <div className="relative mt-4" style={{ height: svgH }}>
        <svg width="100%" height="100%" viewBox={`0 0 ${svgW} ${svgH}`} preserveAspectRatio="xMidYMid meet">
          <defs>
            <linearGradient id="jaarCumGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f9ff85" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#f9ff85" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {yTicks.map(v => (
            <g key={v}>
              <line x1={pL} y1={getY(v)} x2={pR} y2={getY(v)} stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
              <text x={pL - 8} y={getY(v) + 4} textAnchor="end" fill="rgba(255,255,255,0.4)" fontSize="11" fontFamily="system-ui">
                {Math.abs(v) >= 1000000 ? `€${(v / 1000000).toFixed(1)}M` : `€${(v / 1000).toFixed(0)}k`}
              </text>
            </g>
          ))}
          {yMin < 0 && <line x1={pL} y1={getY(0)} x2={pR} y2={getY(0)} stroke="rgba(255,255,255,0.2)" strokeWidth="1" strokeDasharray="4,4" />}
          {pts.length >= 2 && (
            <>
              <path d={areaPath(pts)} fill="url(#jaarCumGrad)" />
              <path d={smoothPath(pts)} fill="none" stroke="#f9ff85" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              {pts.map((pt, i) => (
                <g key={i}>
                  <circle cx={pt.x} cy={pt.y} r="5" fill="#f9ff85" opacity="0.2" />
                  <circle cx={pt.x} cy={pt.y} r="3" fill="#f9ff85" />
                </g>
              ))}
            </>
          )}
          {periods.map((p, i) => (
            <text key={p} x={getX(i)} y={pB + 20} textAnchor="middle" fill={i < lastMonth ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.2)'} fontSize="12" fontFamily="system-ui">
              {p}
            </text>
          ))}
        </svg>
      </div>
    </div>
  )
}
