'use client'

import { useState, useEffect } from 'react'
import {
  GrowthCard,
  HorizontalBarChart,
  RankingBarChart,
  StackedBarChart,
  ProgressGaugeList,
  QuarterlyTrendChart,
  ForecastAreaChart,
  DonutChart,
} from './charts'

interface AnalyticsData {
  bezettingsgraad: {
    perEmployee: { name: string; billableHours: number; workedHours: number; percentage: number }[]
    kantoorGemiddelde: number
  }
  omzetPerMedewerker: { name: string; estimated: number; billableHours: number; hourlyRate: number }[]
  realisatiegraad: {
    kantoorGemiddeld: number
    perEmployee: { name: string; hourlyRate: number; effectiveRate: number }[]
  }
  kostprijs: { name: string; kostprijsPerUur: number; margePerUur: number; hourlyRate: number; annualSalary: number; totalBillable: number }[]
  breakeven: { name: string; targetHours: number; annualTargetHours: number; actualHoursYTD: number; surplusHours: number; percentage: number }[]
  verzuim: {
    kantoorGemiddelde: number
    benchmark: number
    perQuarter: number[]
    perEmployee: { userId: string; name: string; totalDays: number; perQuarter: number[] }[]
  }
  vakantieRisico: { name: string; opgenomen: number; resterend: number; totaal: number }[]
  forecast: {
    actualMonths: { month: number; omzet: number }[]
    forecastedTotal: number
    projectedRemaining: { month: number; omzet: number }[]
    previousYearTotal: number
  }
  yoy: {
    omzet: { current: number; previous: number; growth: number }
    werkgeverslasten: { current: number; previous: number; growth: number }
    uren: { current: number; previous: number; growth: number }
    saldo: { current: number; previous: number; growth: number }
  }
  bonusROI: {
    totalInvoiceAmount: number
    totalBonusPaid: number
    totalBonusPending: number
    totalUnpaidInvoices: number
  }
  kpis: {
    omzetPerFTE: number
    avgMargePerUur: number
    verzuimPercentage: number
  }
  currentYear: number
  monthsElapsed: number
}

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v)

export default function InzichtenTab() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/financien/analytics')
        if (!res.ok) throw new Error('Kon analytics niet laden')
        const json = await res.json()
        setData(json)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Onbekende fout')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-workx-lime" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="bg-workx-dark/40 rounded-2xl p-12 border border-white/5 text-center">
        <p className="text-white/60">{error || 'Geen data beschikbaar'}</p>
      </div>
    )
  }

  const { omzetPerMedewerker, realisatiegraad, kostprijs, breakeven, verzuim, vakantieRisico, forecast, yoy, bonusROI, kpis } = data

  return (
    <div className="space-y-6">
      {/* Rij 1: Overview KPI-kaarten */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-workx-dark/40 rounded-2xl p-3 sm:p-6 border border-white/5">
          <p className="text-gray-400 text-xs sm:text-sm">Omzet per FTE (geschat)</p>
          <p className="text-lg sm:text-2xl font-semibold text-white mt-1 truncate">{fmtCurrency(kpis.omzetPerFTE)}</p>
          <p className="text-xs text-white/30 mt-1">Geschatte omzet per fulltime medewerker dit jaar (billable uren x uurtarief).</p>
        </div>
        <div className="bg-workx-dark/40 rounded-2xl p-3 sm:p-6 border border-white/5">
          <p className="text-gray-400 text-xs sm:text-sm">Gem. Marge per uur</p>
          <p className="text-lg sm:text-2xl font-semibold text-white mt-1">{fmtCurrency(kpis.avgMargePerUur)}</p>
          <p className="text-xs text-white/30 mt-1">Verschil tussen uurtarief en loonkosten per declarabel uur. Hoe hoger, hoe winstgevender.</p>
        </div>
        <div className="bg-workx-dark/40 rounded-2xl p-3 sm:p-6 border border-white/5">
          <p className="text-gray-400 text-xs sm:text-sm">Verzuimpercentage</p>
          <p className={`text-lg sm:text-2xl font-semibold mt-1 ${kpis.verzuimPercentage <= 3 ? 'text-green-400' : kpis.verzuimPercentage <= 5 ? 'text-orange-400' : 'text-red-400'}`}>
            {kpis.verzuimPercentage.toFixed(1)}%
          </p>
          <p className="text-xs text-white/30 mt-1">Percentage werkdagen dat medewerkers ziek zijn. Benchmark: onder 3%.</p>
        </div>
      </div>

      {/* Rij 2: Year-over-Year groeikaarten (#9) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <GrowthCard label="Omzet" current={yoy.omzet.current} previous={yoy.omzet.previous} growth={yoy.omzet.growth} />
        <GrowthCard label="Werkgeverslasten" current={yoy.werkgeverslasten.current} previous={yoy.werkgeverslasten.previous} growth={yoy.werkgeverslasten.growth} />
        <GrowthCard label="Uren" current={yoy.uren.current} previous={yoy.uren.previous} growth={yoy.uren.growth} isCurrency={false} />
        <GrowthCard label="Saldo" current={yoy.saldo.current} previous={yoy.saldo.previous} growth={yoy.saldo.growth} />
      </div>

      {/* Rij 3: Omzet per medewerker + Uurtarief per medewerker */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        {/* #2 Omzet per medewerker */}
        {omzetPerMedewerker.length > 0 ? (
          <RankingBarChart
            data={omzetPerMedewerker.map(e => ({ name: e.name, value: e.estimated }))}
            title="Geschatte omzet per medewerker"
            description="Berekend als: declarabele uren x uurtarief. Dit geeft een indicatie van de omzetbijdrage per medewerker. Medewerkers met veel declarabele uren en/of een hoog tarief staan bovenaan."
          />
        ) : (
          <EmptyState title="Omzet per medewerker" />
        )}

        {/* #3 Uurtarief */}
        {realisatiegraad.perEmployee.length > 0 ? (
          <RankingBarChart
            data={realisatiegraad.perEmployee.map(e => ({
              name: e.name,
              value: e.hourlyRate,
              label: `€${e.hourlyRate}`
            }))}
            title="Uurtarief per medewerker"
            description="Het afgesproken uurtarief per medewerker. De gele lijn toont het kantoorgemiddelde. Medewerkers boven het gemiddelde genereren relatief meer omzet per uur."
            comparisonLine={realisatiegraad.kantoorGemiddeld}
            comparisonLabel={`Kantoorgemiddelde: €${realisatiegraad.kantoorGemiddeld.toFixed(0)}/u`}
            formatValue={v => `€${v.toFixed(0)}`}
          />
        ) : (
          <EmptyState title="Realisatiegraad" />
        )}
      </div>

      {/* Rij 4: Kostprijs & marge per uur */}
      {kostprijs.length > 0 ? (
        <StackedBarChart
          data={kostprijs.map(e => ({
            name: e.name,
            cost: e.kostprijsPerUur,
            margin: e.margePerUur,
            total: e.hourlyRate,
          }))}
          title="Kostprijs & marge per uur"
          description="Elke balk toont hoeveel een declarabel uur kost (rood = loonkosten) en hoeveel marge overblijft (groen = uurtarief minus loonkosten). Berekend over de YTD-periode. Als er geen groene balk zichtbaar is, zijn de loonkosten per declarabel uur hoger dan het uurtarief."
        />
      ) : (
        <EmptyState title="Kostprijs per medewerker" />
      )}

      {/* Rij 5: Break-even analyse (#5) */}
      {breakeven.length > 0 ? (
        <ProgressGaugeList
          data={breakeven.map(e => ({
            name: e.name,
            actual: e.actualHoursYTD,
            target: e.targetHours,
            percentage: e.percentage,
            surplusHours: e.surplusHours,
          }))}
          title="Break-even analyse (factureerbare uren vs. salariskosten)"
          description="Toont hoeveel procent van het break-even target al behaald is dit jaar. Het target is het aantal declarabele uren dat nodig is om de jaarlijkse salariskosten te dekken, gecorrigeerd naar de verstreken maanden. De witte lijn markeert het break-even punt. Groen = op schema, oranje = aandachtspunt, rood = achter op schema."
        />
      ) : (
        <EmptyState title="Break-even analyse" />
      )}

      {/* Rij 6: Verzuim + Vakantie */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        {/* #6 Verzuimpercentage */}
        <div className="space-y-4">
          <QuarterlyTrendChart
            data={verzuim.perQuarter}
            title="Verzuimpercentage per kwartaal"
            description="Toont het verzuimpercentage per kwartaal als lijndiagram. De rode stippellijn is de benchmark van 3%. Een stijgende trend vraagt om aandacht voor werkdruk en welzijn."
            benchmark={verzuim.benchmark}
            benchmarkLabel={`Benchmark ${verzuim.benchmark}%`}
          />
          {verzuim.perEmployee.length > 0 && (
            <div className="bg-workx-dark/40 rounded-2xl p-4 sm:p-6 border border-white/5">
              <h4 className="text-white/60 text-xs sm:text-sm mb-3">Verzuimdagen per medewerker</h4>
              <div className="space-y-2">
                {verzuim.perEmployee.sort((a, b) => b.totalDays - a.totalDays).map((emp, i) => (
                  <div key={i} className="flex justify-between text-xs sm:text-sm">
                    <span className="text-white/80">{emp.name}</span>
                    <span className="text-white/60 font-mono">{emp.totalDays.toFixed(1)} dagen</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* #7 Vakantiedagen-risico */}
        {vakantieRisico.length > 0 ? (
          <HorizontalBarChart
            data={vakantieRisico.map(e => ({
              name: e.name,
              value: e.totaal,
              secondary: e.totaal - e.resterend,
            }))}
            title="Vakantiedagen overzicht"
            description="Toont het totaal aantal vakantiedagen per medewerker. De lichtgroene balk is opgenomen, de grijze balk is het resterend tegoed. Medewerkers met veel resterende dagen aan het eind van het jaar vormen een financieel risico."
            valueLabel=" dg"
            formatValue={v => v.toFixed(1)}
          />
        ) : (
          <EmptyState title="Vakantiedagen-risico" />
        )}
      </div>

      {/* Rij 7: Forecast (#8) */}
      <ForecastAreaChart
        actualMonths={forecast.actualMonths}
        projectedMonths={forecast.projectedRemaining}
        forecastedTotal={forecast.forecastedTotal}
        previousYearTotal={forecast.previousYearTotal}
        title={`Omzet Forecast ${data.currentYear}`}
        description="Projecteert de jaaromzet op basis van het gemiddelde van de maanden met data. De doorgetrokken lijn is werkelijk, de stippellijn is geprojecteerd. Vergelijk met het 2025-totaal voor groei-inzicht."
      />

      {/* Rij 8: Bonus ROI (#10) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <div className="bg-workx-dark/40 rounded-2xl p-3 sm:p-6 border border-white/5">
            <p className="text-gray-400 text-xs sm:text-sm">Factuurbedrag</p>
            <p className="text-lg sm:text-2xl font-semibold text-white mt-1 truncate">{fmtCurrency(bonusROI.totalInvoiceAmount)}</p>
          </div>
          <div className="bg-workx-dark/40 rounded-2xl p-3 sm:p-6 border border-white/5">
            <p className="text-gray-400 text-xs sm:text-sm">Bonus Uitbetaald</p>
            <p className="text-lg sm:text-2xl font-semibold text-green-400 mt-1 truncate">{fmtCurrency(bonusROI.totalBonusPaid)}</p>
          </div>
          <div className="bg-workx-dark/40 rounded-2xl p-3 sm:p-6 border border-white/5">
            <p className="text-gray-400 text-xs sm:text-sm">Bonus Openstaand</p>
            <p className="text-lg sm:text-2xl font-semibold text-orange-400 mt-1 truncate">{fmtCurrency(bonusROI.totalBonusPending)}</p>
          </div>
          <div className="bg-workx-dark/40 rounded-2xl p-3 sm:p-6 border border-white/5">
            <p className="text-gray-400 text-xs sm:text-sm">Onbetaalde Facturen</p>
            <p className="text-lg sm:text-2xl font-semibold text-red-400 mt-1 truncate">{fmtCurrency(bonusROI.totalUnpaidInvoices)}</p>
          </div>
        </div>

        {/* Donut chart */}
        <DonutChart
          segments={[
            { label: 'Bonus betaald', value: bonusROI.totalBonusPaid, color: '#22c55e' },
            { label: 'Bonus openstaand', value: bonusROI.totalBonusPending, color: '#f97316' },
            { label: 'Onbetaalde facturen', value: bonusROI.totalUnpaidInvoices, color: '#ef4444' },
          ]}
          title="Bonus Verdeling"
          centerLabel="totaal"
          centerValue={fmtCurrency(bonusROI.totalBonusPaid + bonusROI.totalBonusPending)}
        />
      </div>
    </div>
  )
}

function EmptyState({ title }: { title: string }) {
  return (
    <div className="bg-workx-dark/40 rounded-2xl p-8 border border-white/5 text-center">
      <p className="text-white/40 text-sm">{title}</p>
      <p className="text-white/20 text-xs mt-1">Onvoldoende data beschikbaar</p>
    </div>
  )
}
