'use client'

// ======= Growth Card (#9 YoY) =======
export function GrowthCard({ label, current, previous, growth, isCurrency = true }: {
  label: string
  current: number
  previous: number
  growth: number
  isCurrency?: boolean
}) {
  const isPositive = growth >= 0
  const fmt = (v: number) => isCurrency
    ? new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v)
    : new Intl.NumberFormat('nl-NL', { maximumFractionDigits: 0 }).format(v)

  return (
    <div className="bg-workx-dark/40 rounded-2xl p-4 border border-white/5">
      <p className="text-gray-400 text-xs mb-1">{label}</p>
      <p className="text-white text-lg font-semibold truncate">{fmt(current)}</p>
      <div className="flex items-center gap-1.5 mt-1">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={isPositive ? '#22c55e' : '#ef4444'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {isPositive
            ? <path d="M7 17l5-5 5 5M7 7h10" />
            : <path d="M7 7l5 5 5-5M7 17h10" />
          }
        </svg>
        <span className={`text-sm font-medium ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
          {isPositive ? '+' : ''}{growth.toFixed(1)}%
        </span>
        <span className="text-white/30 text-xs">vs vorig jaar</span>
      </div>
      <p className="text-white/30 text-xs mt-1">2025: {fmt(previous)}</p>
    </div>
  )
}

// ======= Horizontal Bar Chart (#1 Bezettingsgraad, #7 Vakantie) =======
export function HorizontalBarChart({ data, title, description, valueLabel, barColor = '#f9ff85', benchmarkLine, benchmarkLabel, maxOverride, formatValue }: {
  data: { name: string; value: number; secondary?: number }[]
  title: string
  description?: string
  valueLabel?: string
  barColor?: string
  benchmarkLine?: number
  benchmarkLabel?: string
  maxOverride?: number
  formatValue?: (v: number) => string
}) {
  const maxValue = maxOverride || Math.max(...data.map(d => d.value + (d.secondary || 0)), 1)
  const fmt = formatValue || ((v: number) => v.toFixed(1))

  return (
    <div className="bg-workx-dark/40 rounded-2xl p-4 sm:p-6 border border-white/5">
      <h3 className="text-white font-medium mb-1 text-sm sm:text-base">{title}</h3>
      {description && <p className="text-white/40 text-xs mt-1 mb-3">{description}</p>}
      {!description && <div className="mb-3" />}
      <div className="space-y-3">
        {data.map((item, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-24 sm:w-32 text-white/80 text-xs sm:text-sm truncate" title={item.name}>{item.name}</div>
            <div className="flex-1 relative h-6 bg-white/5 rounded-full overflow-hidden">
              {item.secondary !== undefined ? (
                <>
                  <div
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{ width: `${(item.value / maxValue) * 100}%`, backgroundColor: '#6b7280' }}
                  />
                  <div
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{ width: `${(item.secondary / maxValue) * 100}%`, backgroundColor: '#bef264' }}
                  />
                </>
              ) : (
                <div
                  className="absolute inset-y-0 left-0 rounded-full transition-all"
                  style={{ width: `${Math.min((item.value / maxValue) * 100, 100)}%`, backgroundColor: barColor }}
                />
              )}
              {benchmarkLine !== undefined && (
                <div
                  className="absolute inset-y-0 w-0.5"
                  style={{ left: `${(benchmarkLine / maxValue) * 100}%`, backgroundColor: 'rgba(255,255,255,0.5)' }}
                />
              )}
            </div>
            <div className="w-14 text-right text-white/60 text-xs sm:text-sm font-mono">{fmt(item.value)}{valueLabel}</div>
          </div>
        ))}
      </div>
      {benchmarkLine !== undefined && benchmarkLabel && (
        <div className="flex items-center gap-2 mt-3 text-xs text-white/40">
          <div className="w-4 h-0.5 bg-white/50" />
          <span>{benchmarkLabel}</span>
        </div>
      )}
    </div>
  )
}

// ======= Ranking Bar Chart (#2 Omzet, #3 Realisatiegraad) =======
export function RankingBarChart({ data, title, description, comparisonLine, comparisonLabel, formatValue }: {
  data: { name: string; value: number; label?: string }[]
  title: string
  description?: string
  comparisonLine?: number
  comparisonLabel?: string
  formatValue?: (v: number) => string
}) {
  const maxValue = Math.max(...data.map(d => d.value), comparisonLine || 0, 1)
  const fmt = formatValue || ((v: number) =>
    new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v)
  )

  return (
    <div className="bg-workx-dark/40 rounded-2xl p-4 sm:p-6 border border-white/5">
      <h3 className="text-white font-medium mb-1 text-sm sm:text-base">{title}</h3>
      {description && <p className="text-white/40 text-xs mt-1 mb-3">{description}</p>}
      {!description && <div className="mb-3" />}
      <div className="space-y-3">
        {data.map((item, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-24 sm:w-32 text-white/80 text-xs sm:text-sm truncate" title={item.name}>{item.name}</div>
            <div className="flex-1 relative h-6 bg-white/5 rounded-full overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 rounded-full transition-all"
                style={{
                  width: `${(item.value / maxValue) * 100}%`,
                  backgroundColor: '#06b6d4'
                }}
              />
              {comparisonLine !== undefined && (
                <div
                  className="absolute inset-y-0 w-0.5"
                  style={{ left: `${(comparisonLine / maxValue) * 100}%`, backgroundColor: '#f9ff85' }}
                />
              )}
            </div>
            <div className="w-20 text-right text-white/60 text-xs font-mono">{item.label || fmt(item.value)}</div>
          </div>
        ))}
      </div>
      {comparisonLine !== undefined && comparisonLabel && (
        <div className="flex items-center gap-2 mt-3 text-xs text-white/40">
          <div className="w-4 h-0.5 bg-workx-lime" />
          <span>{comparisonLabel}</span>
        </div>
      )}
    </div>
  )
}

// ======= Stacked Bar Chart (#4 Kostprijs) =======
export function StackedBarChart({ data, title, description }: {
  data: { name: string; cost: number; margin: number; total: number }[]
  title: string
  description?: string
}) {
  const maxValue = Math.max(...data.map(d => d.total), 1)
  const fmtCurrency = (v: number) =>
    new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v)

  return (
    <div className="bg-workx-dark/40 rounded-2xl p-4 sm:p-6 border border-white/5">
      <h3 className="text-white font-medium mb-1 text-sm sm:text-base">{title}</h3>
      {description && <p className="text-white/40 text-xs mt-1 mb-3">{description}</p>}
      {!description && <div className="mb-3" />}
      <div className="space-y-3">
        {data.map((item, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-24 sm:w-32 text-white/80 text-xs sm:text-sm truncate" title={item.name}>{item.name}</div>
            <div className="flex-1 relative h-6 bg-white/5 rounded-full overflow-hidden flex">
              <div
                className="h-full"
                style={{ width: `${(item.cost / maxValue) * 100}%`, backgroundColor: '#ef4444' }}
              />
              <div
                className="h-full"
                style={{ width: `${(Math.max(item.margin, 0) / maxValue) * 100}%`, backgroundColor: '#22c55e' }}
              />
            </div>
            <div className="w-20 text-right text-white/60 text-xs font-mono">{fmtCurrency(item.total)}/u</div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-4 mt-3 text-xs text-white/40">
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-red-500" /><span>Kostprijs</span></div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-green-500" /><span>Marge</span></div>
      </div>
    </div>
  )
}

// ======= Progress Gauge List (#5 Break-even) =======
export function ProgressGaugeList({ data, title, description }: {
  data: { name: string; actual: number; target: number; percentage: number; surplusHours?: number }[]
  title: string
  description?: string
}) {
  const getColor = (pct: number) => {
    if (pct >= 100) return '#22c55e'
    if (pct >= 80) return '#f97316'
    return '#ef4444'
  }

  // Dynamic scale: use max percentage in data so bars aren't all identical
  const maxPct = Math.max(...data.map(d => d.percentage), 100)
  const scale = maxPct * 1.1 // 10% breathing room
  // Position of the 100% break-even line relative to scale
  const breakEvenPos = (100 / scale) * 100

  return (
    <div className="bg-workx-dark/40 rounded-2xl p-4 sm:p-6 border border-white/5">
      <h3 className="text-white font-medium mb-1 text-sm sm:text-base">{title}</h3>
      {description && <p className="text-white/40 text-xs mt-1 mb-3">{description}</p>}
      {!description && <div className="mb-3" />}
      <div className="space-y-4">
        {data.map((item, i) => {
          const surplus = item.surplusHours ?? (item.actual - item.target)
          return (
            <div key={i}>
              <div className="flex justify-between text-xs sm:text-sm mb-1">
                <span className="text-white/80">{item.name}</span>
                <span className="text-white/60">
                  {item.actual.toFixed(0)} / {item.target.toFixed(0)} uur
                  <span className="ml-1 font-medium" style={{ color: getColor(item.percentage) }}>
                    ({surplus >= 0 ? '+' : ''}{surplus.toFixed(0)}u)
                  </span>
                  <span className="ml-1.5 font-medium" style={{ color: getColor(item.percentage) }}>
                    {item.percentage.toFixed(0)}%
                  </span>
                </span>
              </div>
              <div className="relative h-3 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min((item.percentage / scale) * 100, 100)}%`,
                    backgroundColor: getColor(item.percentage),
                  }}
                />
                {/* 100% break-even reference line */}
                <div
                  className="absolute inset-y-0 w-0.5"
                  style={{ left: `${breakEvenPos}%`, backgroundColor: 'rgba(255,255,255,0.4)' }}
                />
              </div>
            </div>
          )
        })}
      </div>
      <div className="flex items-center gap-4 mt-4 text-xs text-white/40">
        <div className="flex items-center gap-1.5"><div className="w-4 h-0.5 bg-white/40" /><span>Break-even (100%)</span></div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-green-500" /><span>&ge;100%</span></div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-orange-500" /><span>80-100%</span></div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-red-500" /><span>&lt;80%</span></div>
      </div>
    </div>
  )
}

// ======= Quarterly Trend Chart (#6 Verzuim) =======
export function QuarterlyTrendChart({ data, title, description, benchmark, benchmarkLabel }: {
  data: number[]
  title: string
  description?: string
  benchmark?: number
  benchmarkLabel?: string
}) {
  const maxValue = Math.max(...data, benchmark || 0, 1) * 1.2
  const labels = ['Q1', 'Q2', 'Q3', 'Q4']
  const height = 160
  const padding = 20
  const chartWidth = 100
  const chartHeight = height - padding * 2

  const getX = (i: number) => padding + (i / 3) * (chartWidth - padding * 2)
  const getY = (v: number) => padding + chartHeight - (v / maxValue) * chartHeight

  const points = data.map((v, i) => `${getX(i)},${getY(v)}`).join(' ')

  return (
    <div className="bg-workx-dark/40 rounded-2xl p-4 sm:p-6 border border-white/5">
      <h3 className="text-white font-medium mb-1 text-sm sm:text-base">{title}</h3>
      {description && <p className="text-white/40 text-xs mt-1 mb-3">{description}</p>}
      {!description && <div className="mb-3" />}
      <div style={{ height }}>
        <svg width="100%" height="100%" viewBox={`0 0 ${chartWidth} ${height}`} preserveAspectRatio="xMidYMid meet">
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map(pct => (
            <line key={pct}
              x1={padding} y1={padding + chartHeight * (1 - pct)}
              x2={chartWidth - padding} y2={padding + chartHeight * (1 - pct)}
              stroke="rgba(255,255,255,0.07)" strokeWidth="0.3"
            />
          ))}
          {/* Benchmark line */}
          {benchmark !== undefined && (
            <line
              x1={padding} y1={getY(benchmark)}
              x2={chartWidth - padding} y2={getY(benchmark)}
              stroke="#ef4444" strokeWidth="0.5" strokeDasharray="2,2"
            />
          )}
          {/* Area fill */}
          <polygon
            points={`${getX(0)},${getY(0)} ${points} ${getX(data.length - 1)},${getY(0)}`}
            fill="url(#trendGradient)" opacity="0.3"
          />
          {/* Line */}
          <polyline points={points} fill="none" stroke="#06b6d4" strokeWidth="1.5" strokeLinecap="round" />
          {/* Points */}
          {data.map((v, i) => (
            <circle key={i} cx={getX(i)} cy={getY(v)} r="2.5" fill="#06b6d4" />
          ))}
          {/* Labels */}
          {labels.map((l, i) => (
            <text key={i} x={getX(i)} y={height - 2} textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="5">{l}</text>
          ))}
          {/* Value labels */}
          {data.map((v, i) => (
            <text key={`v${i}`} x={getX(i)} y={getY(v) - 5} textAnchor="middle" fill="rgba(255,255,255,0.7)" fontSize="4">{v.toFixed(1)}%</text>
          ))}
          <defs>
            <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
      </div>
      {benchmark !== undefined && benchmarkLabel && (
        <div className="flex items-center gap-2 mt-2 text-xs text-white/40">
          <div className="w-4 h-0.5 bg-red-500 border-dashed" />
          <span>{benchmarkLabel}</span>
        </div>
      )}
    </div>
  )
}

// ======= Forecast Area Chart (#8) =======
export function ForecastAreaChart({ actualMonths, projectedMonths, forecastedTotal, previousYearTotal, title, description }: {
  actualMonths: { month: number; omzet: number }[]
  projectedMonths: { month: number; omzet: number }[]
  forecastedTotal: number
  previousYearTotal: number
  title: string
  description?: string
}) {
  const allValues = [...actualMonths.map(m => m.omzet), ...projectedMonths.map(m => m.omzet)]
  const maxValue = Math.max(...allValues, 1) * 1.15
  const height = 180
  const padding = 15
  const chartWidth = 100
  const chartHeight = height - padding * 2

  const getX = (month: number) => padding + ((month - 1) / 11) * (chartWidth - padding * 2)
  const getY = (v: number) => padding + chartHeight - (v / maxValue) * chartHeight

  const fmtCurrency = (v: number) =>
    new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v)

  const actualPoints = actualMonths.map(m => `${getX(m.month)},${getY(m.omzet)}`).join(' ')
  const lastActual = actualMonths[actualMonths.length - 1]
  const projectedAllPoints = lastActual
    ? [`${getX(lastActual.month)},${getY(lastActual.omzet)}`, ...projectedMonths.map(m => `${getX(m.month)},${getY(m.omzet)}`)].join(' ')
    : ''

  return (
    <div className="bg-workx-dark/40 rounded-2xl p-4 sm:p-6 border border-white/5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-1 gap-2">
        <h3 className="text-white font-medium text-sm sm:text-base">{title}</h3>
        <div className="flex gap-4 text-xs">
          <div><span className="text-white/40">Forecast:</span> <span className="text-workx-lime font-medium">{fmtCurrency(forecastedTotal)}</span></div>
          <div><span className="text-white/40">2025:</span> <span className="text-white/60">{fmtCurrency(previousYearTotal)}</span></div>
        </div>
      </div>
      {description && <p className="text-white/40 text-xs mt-1 mb-3">{description}</p>}
      {!description && <div className="mb-3" />}
      <div style={{ height }}>
        <svg width="100%" height="100%" viewBox={`0 0 ${chartWidth} ${height}`} preserveAspectRatio="xMidYMid meet">
          {/* Grid */}
          {[0, 0.25, 0.5, 0.75, 1].map(pct => (
            <line key={pct}
              x1={padding} y1={padding + chartHeight * (1 - pct)}
              x2={chartWidth - padding} y2={padding + chartHeight * (1 - pct)}
              stroke="rgba(255,255,255,0.07)" strokeWidth="0.3"
            />
          ))}
          {/* Actual area */}
          {actualMonths.length > 1 && (
            <polygon
              points={`${getX(actualMonths[0].month)},${getY(0)} ${actualPoints} ${getX(actualMonths[actualMonths.length - 1].month)},${getY(0)}`}
              fill="url(#actualGradient)" opacity="0.5"
            />
          )}
          {/* Actual line */}
          {actualMonths.length > 1 && (
            <polyline points={actualPoints} fill="none" stroke="#f9ff85" strokeWidth="1.5" strokeLinecap="round" />
          )}
          {/* Projected area */}
          {projectedAllPoints && projectedMonths.length > 0 && (
            <>
              <polygon
                points={`${lastActual ? `${getX(lastActual.month)},${getY(0)}` : ''} ${projectedAllPoints} ${getX(projectedMonths[projectedMonths.length - 1].month)},${getY(0)}`}
                fill="url(#projectedGradient)" opacity="0.2"
              />
              <polyline points={projectedAllPoints} fill="none" stroke="#f9ff85" strokeWidth="1" strokeDasharray="2,2" strokeLinecap="round" />
            </>
          )}
          {/* Points */}
          {actualMonths.map(m => (
            <circle key={m.month} cx={getX(m.month)} cy={getY(m.omzet)} r="2" fill="#f9ff85" />
          ))}
          {/* Month labels */}
          {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
            <text key={m} x={getX(m)} y={height - 2} textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="4">
              {['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'][m - 1]}
            </text>
          ))}
          <defs>
            <linearGradient id="actualGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f9ff85" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#f9ff85" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="projectedGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f9ff85" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#f9ff85" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
      </div>
      <div className="flex items-center gap-4 mt-2 text-xs text-white/40">
        <div className="flex items-center gap-1.5"><div className="w-4 h-0.5 bg-workx-lime" /><span>Werkelijk</span></div>
        <div className="flex items-center gap-1.5"><div className="w-4 h-0.5 bg-workx-lime/50 border-dashed" /><span>Geprojecteerd</span></div>
      </div>
    </div>
  )
}

// ======= Donut Chart (#10 Bonus ROI) =======
export function DonutChart({ segments, title, description, centerLabel, centerValue, size = 160 }: {
  segments: { label: string; value: number; color: string }[]
  title: string
  description?: string
  centerLabel: string
  centerValue: string
  size?: number
}) {
  const total = segments.reduce((s, seg) => s + seg.value, 0)
  if (total === 0) {
    return (
      <div className="bg-workx-dark/40 rounded-2xl p-4 sm:p-6 border border-white/5">
        <h3 className="text-white font-medium mb-4 text-sm sm:text-base">{title}</h3>
        <p className="text-white/40 text-sm text-center py-8">Geen bonusdata beschikbaar</p>
      </div>
    )
  }

  const radius = 40
  const strokeWidth = 10
  const circumference = 2 * Math.PI * radius
  let currentOffset = 0

  return (
    <div className="bg-workx-dark/40 rounded-2xl p-4 sm:p-6 border border-white/5">
      <h3 className="text-white font-medium mb-1 text-sm sm:text-base">{title}</h3>
      {description && <p className="text-white/40 text-xs mt-1 mb-3">{description}</p>}
      {!description && <div className="mb-3" />}
      <div className="flex flex-col sm:flex-row items-center gap-6">
        <div className="relative" style={{ width: size, height: size }}>
          <svg width={size} height={size} viewBox="0 0 100 100">
            <circle cx="50" cy="50" r={radius} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={strokeWidth} />
            {segments.map((seg, i) => {
              const segLength = (seg.value / total) * circumference
              const offset = currentOffset
              currentOffset += segLength
              return (
                <circle
                  key={i}
                  cx="50" cy="50" r={radius}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${segLength} ${circumference - segLength}`}
                  strokeDashoffset={-offset}
                  transform="rotate(-90 50 50)"
                  strokeLinecap="round"
                />
              )
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-white text-lg font-semibold">{centerValue}</span>
            <span className="text-white/40 text-xs">{centerLabel}</span>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          {segments.map((seg, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: seg.color }} />
              <span className="text-white/60 text-xs sm:text-sm">{seg.label}</span>
              <span className="text-white/40 text-xs ml-auto font-mono">
                {new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(seg.value)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
