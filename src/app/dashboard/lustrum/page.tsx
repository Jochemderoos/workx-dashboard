'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { Icons } from '@/components/ui/Icons'
import {
  LUSTRUM_CONFIG,
  CAN_FRESSA_PHOTOS,
  MALLORCA_FACTS,
  HOTSPOTS,
  PACKLIST,
  MAP_MARKERS,
  getDailyFact,
  getCountdown,
  getHotspotsByCategory,
  CATEGORY_LABELS,
  type HotspotCategory,
  type PacklistItem,
} from '@/lib/lustrum-data'

// Weather code mapping
const getWeatherInfo = (code: number) => {
  if (code === 0) return { icon: '☀️', desc: 'Helder' }
  if (code <= 3) return { icon: '⛅', desc: 'Deels bewolkt' }
  if (code <= 49) return { icon: '🌫️', desc: 'Mistig' }
  if (code <= 59) return { icon: '🌧️', desc: 'Motregen' }
  if (code <= 69) return { icon: '🌧️', desc: 'Regen' }
  if (code <= 79) return { icon: '🌨️', desc: 'Sneeuw' }
  if (code <= 84) return { icon: '🌧️', desc: 'Buien' }
  if (code <= 94) return { icon: '🌨️', desc: 'Sneeuwbuien' }
  if (code <= 99) return { icon: '⛈️', desc: 'Onweer' }
  return { icon: '🌤️', desc: 'Onbekend' }
}

interface WeatherForecast {
  date: string
  tempMax: number
  tempMin: number
  weatherCode: number
}

export default function LustrumPage() {
  const [countdown, setCountdown] = useState(getCountdown())
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0)
  const [weather, setWeather] = useState<WeatherForecast[]>([])
  const [isWeatherLoading, setIsWeatherLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState<HotspotCategory | 'all'>('all')
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set())
  const [showMap, setShowMap] = useState(false)

  // Daily fact based on day of year
  const dailyFact = useMemo(() => getDailyFact(), [])

  // Update countdown every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(getCountdown())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Auto-rotate photos
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentPhotoIndex((prev) => (prev + 1) % CAN_FRESSA_PHOTOS.length)
    }, 5000)
    return () => clearInterval(timer)
  }, [])

  // Fetch weather for Mallorca
  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const { lat, lng } = LUSTRUM_CONFIG.coordinates
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=Europe%2FMadrid&forecast_days=7`
        )
        if (res.ok) {
          const data = await res.json()
          const forecasts: WeatherForecast[] = data.daily.time.map((date: string, i: number) => ({
            date,
            tempMax: Math.round(data.daily.temperature_2m_max[i]),
            tempMin: Math.round(data.daily.temperature_2m_min[i]),
            weatherCode: data.daily.weather_code[i],
          }))
          setWeather(forecasts)
        }
      } catch (e) {
        console.error('Weather fetch error:', e)
      } finally {
        setIsWeatherLoading(false)
      }
    }
    fetchWeather()
  }, [])

  // Load checked items from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('lustrum-packlist')
    if (saved) {
      setCheckedItems(new Set(JSON.parse(saved)))
    }
  }, [])

  // Save checked items to localStorage
  const togglePacklistItem = (id: string) => {
    setCheckedItems((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      localStorage.setItem('lustrum-packlist', JSON.stringify(Array.from(next)))
      return next
    })
  }

  // Filter hotspots
  const filteredHotspots = activeCategory === 'all'
    ? HOTSPOTS
    : getHotspotsByCategory(activeCategory)

  // Group packlist by category
  const packlistByCategory = useMemo(() => {
    const groups: Record<string, PacklistItem[]> = {
      kleding: [],
      toiletspullen: [],
      documenten: [],
      tech: [],
      overig: [],
    }
    PACKLIST.forEach((item) => {
      groups[item.category].push(item)
    })
    return groups
  }, [])

  const categoryLabels: Record<string, string> = {
    kleding: 'Kleding',
    toiletspullen: 'Toiletspullen',
    documenten: 'Documenten',
    tech: 'Tech',
    overig: 'Overig',
  }

  return (
    <div className="space-y-8 fade-in">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-500/20 via-amber-500/10 to-yellow-500/20 border border-orange-500/20 p-8">
        <div className="absolute top-0 right-0 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-yellow-500/10 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />

        {/* Confetti decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(20)].map((_, i) => (
            <span
              key={i}
              className="absolute text-2xl animate-pulse"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`,
                opacity: 0.3,
              }}
            >
              {['🎉', '✨', '🌴', '☀️', '🎊', '🏝️'][Math.floor(Math.random() * 6)]}
            </span>
          ))}
        </div>

        <div className="relative">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-5xl">🎉</span>
                <div>
                  <p className="text-orange-400 text-sm font-medium">30 september - 4 oktober 2025</p>
                  <h1 className="text-4xl font-bold text-white">Workx Lustrum - 15 Jaar!</h1>
                </div>
              </div>
              <p className="text-white/60 max-w-lg mb-4">
                We vieren ons 15-jarig jubileum met een onvergetelijke trip naar Mallorca!
                Samen genieten van zon, zee, lekker eten en natuurlijk elkaar.
              </p>
              <a
                href={LUSTRUM_CONFIG.website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500/20 border border-orange-500/30 text-orange-400 hover:bg-orange-500/30 transition-colors"
              >
                <Icons.externalLink size={16} />
                Bekijk Can Fressa
              </a>
            </div>

            {/* Countdown */}
            <div className="flex-shrink-0">
              <p className="text-center text-white/40 text-sm mb-3">Nog te gaan</p>
              <div className="flex gap-3">
                {[
                  { value: countdown.days, label: 'dagen' },
                  { value: countdown.hours, label: 'uur' },
                  { value: countdown.minutes, label: 'min' },
                  { value: countdown.seconds, label: 'sec' },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="w-20 h-24 rounded-xl bg-white/5 border border-white/10 flex flex-col items-center justify-center"
                  >
                    <span className="text-3xl font-bold text-orange-400 tabular-nums">
                      {String(item.value).padStart(2, '0')}
                    </span>
                    <span className="text-[10px] text-white/40 uppercase tracking-wider">
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Photo Carousel */}
        <div className="lg:col-span-2 card p-0 overflow-hidden relative group">
          <div className="absolute top-4 left-4 z-10 bg-black/50 backdrop-blur-sm rounded-lg px-3 py-1.5">
            <p className="text-white text-sm font-medium">📸 Hier gaan we naartoe</p>
          </div>

          {/* Navigation arrows */}
          <button
            onClick={() => setCurrentPhotoIndex((prev) => (prev - 1 + CAN_FRESSA_PHOTOS.length) % CAN_FRESSA_PHOTOS.length)}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
          >
            <Icons.chevronLeft size={20} />
          </button>
          <button
            onClick={() => setCurrentPhotoIndex((prev) => (prev + 1) % CAN_FRESSA_PHOTOS.length)}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
          >
            <Icons.chevronRight size={20} />
          </button>

          {/* Photo display */}
          <div className="aspect-[16/9] relative overflow-hidden">
            <img
              src={CAN_FRESSA_PHOTOS[currentPhotoIndex].url}
              alt={CAN_FRESSA_PHOTOS[currentPhotoIndex].alt}
              className="w-full h-full object-cover transition-opacity duration-500"
            />
            {/* Caption overlay */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-6">
              <p className="text-white text-sm font-medium">
                {CAN_FRESSA_PHOTOS[currentPhotoIndex].caption}
              </p>
              <p className="text-white/50 text-xs mt-1">
                Foto {currentPhotoIndex + 1} van {CAN_FRESSA_PHOTOS.length}
              </p>
            </div>
          </div>

          {/* Dots indicator */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
            {CAN_FRESSA_PHOTOS.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentPhotoIndex(i)}
                className={`w-2 h-2 rounded-full transition-all ${
                  i === currentPhotoIndex
                    ? 'bg-orange-400 w-6'
                    : 'bg-white/30 hover:bg-white/50'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Weather Widget */}
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <span className="text-xl">🌡️</span>
            </div>
            <div>
              <h3 className="text-white font-medium">Weer in Mallorca</h3>
              <p className="text-xs text-white/40">Artà, komende week</p>
            </div>
          </div>

          {isWeatherLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-12 bg-white/5 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : weather.length > 0 ? (
            <div className="space-y-2">
              {weather.slice(0, 5).map((day) => {
                const info = getWeatherInfo(day.weatherCode)
                const date = new Date(day.date)
                return (
                  <div
                    key={day.date}
                    className="flex items-center justify-between p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{info.icon}</span>
                      <div>
                        <p className="text-sm text-white">
                          {date.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' })}
                        </p>
                        <p className="text-xs text-white/40">{info.desc}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold text-orange-400">{day.tempMax}°</p>
                      <p className="text-xs text-white/40">{day.tempMin}°</p>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-white/40 text-sm text-center py-4">
              Weerdata niet beschikbaar
            </p>
          )}
        </div>
      </div>

      {/* Daily Fact */}
      <div className="card p-5 bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-amber-500/10 border-amber-500/20">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0">
            <span className="text-2xl">💡</span>
          </div>
          <div>
            <p className="text-amber-400 text-sm font-medium mb-1">Weetje van de dag</p>
            <p className="text-white">{dailyFact}</p>
          </div>
        </div>
      </div>

      {/* Hotspots Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
              <Icons.mapPin className="text-orange-400" size={16} />
            </div>
            <h2 className="text-lg font-medium text-white">Te doen in de buurt</h2>
          </div>
        </div>

        {/* Category filters */}
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => setActiveCategory('all')}
            className={`px-4 py-2 rounded-lg text-sm transition-colors ${
              activeCategory === 'all'
                ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10'
            }`}
          >
            Alles ({HOTSPOTS.length})
          </button>
          {(Object.keys(CATEGORY_LABELS) as HotspotCategory[]).map((cat) => {
            const count = getHotspotsByCategory(cat).length
            const icons: Record<HotspotCategory, string> = {
              restaurant: '🍽️',
              strand: '🏖️',
              bezienswaardigheid: '🏛️',
              activiteit: '🚴',
            }
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${
                  activeCategory === cat
                    ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                    : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10'
                }`}
              >
                <span>{icons[cat]}</span>
                {CATEGORY_LABELS[cat]} ({count})
              </button>
            )
          })}
        </div>

        {/* Hotspots grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredHotspots.map((hotspot) => {
            const icons: Record<HotspotCategory, string> = {
              restaurant: '🍽️',
              strand: '🏖️',
              bezienswaardigheid: '🏛️',
              activiteit: '🚴',
            }
            return (
              <div
                key={hotspot.id}
                className="card p-4 hover:border-orange-500/30 transition-colors group"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center flex-shrink-0 text-xl group-hover:scale-110 transition-transform">
                    {icons[hotspot.category]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white font-medium truncate">{hotspot.name}</h3>
                    <p className="text-xs text-orange-400 mb-2">{hotspot.location}</p>
                    <p className="text-sm text-white/60 line-clamp-2">{hotspot.description}</p>
                    {hotspot.tip && (
                      <p className="text-xs text-amber-400 mt-2 flex items-center gap-1">
                        <span>💡</span> {hotspot.tip}
                      </p>
                    )}
                    {hotspot.priceRange && (
                      <span className="inline-block mt-2 px-2 py-0.5 rounded-full bg-white/5 text-xs text-white/40">
                        {hotspot.priceRange}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Map Section */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
              <Icons.mapPin className="text-green-400" size={16} />
            </div>
            <div>
              <h2 className="text-lg font-medium text-white">Locatie</h2>
              <p className="text-xs text-white/40">Can Fressa en omgeving</p>
            </div>
          </div>
          <button
            onClick={() => setShowMap(!showMap)}
            className="px-4 py-2 rounded-lg bg-green-500/10 text-green-400 text-sm hover:bg-green-500/20 transition-colors"
          >
            {showMap ? 'Verberg kaart' : 'Toon kaart'}
          </button>
        </div>

        {/* Design map placeholder */}
        <div className="relative aspect-[16/7] bg-gradient-to-br from-blue-900/30 to-cyan-900/20 rounded-xl overflow-hidden border border-white/5">
          {/* Sea */}
          <div className="absolute inset-0 bg-gradient-to-br from-blue-800/20 to-cyan-700/10" />

          {/* Land */}
          <div className="absolute bottom-0 left-0 right-0 h-2/3 bg-gradient-to-t from-amber-900/30 to-amber-800/10 rounded-t-[100px]" />

          {/* Map markers */}
          {MAP_MARKERS.map((marker, i) => {
            const colors = {
              home: 'bg-orange-500 ring-orange-500/30',
              town: 'bg-white/60 ring-white/20',
              beach: 'bg-cyan-400 ring-cyan-400/30',
            }
            const icons = {
              home: '🏠',
              town: '🏘️',
              beach: '🏖️',
            }
            // Rough positioning based on coordinates
            const left = 20 + (i * 12)
            const top = 30 + (i % 3) * 15
            return (
              <div
                key={marker.id}
                className="absolute transform -translate-x-1/2 -translate-y-1/2 group cursor-pointer"
                style={{ left: `${left}%`, top: `${top}%` }}
              >
                <div className={`w-8 h-8 rounded-full ${colors[marker.type]} ring-4 flex items-center justify-center shadow-lg group-hover:scale-125 transition-transform`}>
                  <span className="text-sm">{icons[marker.type]}</span>
                </div>
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 px-2 py-1 bg-black/80 rounded text-xs text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                  {marker.name}
                </div>
              </div>
            )
          })}

          {/* Legend */}
          <div className="absolute bottom-4 right-4 bg-black/50 backdrop-blur-sm rounded-lg p-3 text-xs space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-orange-500" />
              <span className="text-white/60">Can Fressa</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-white/60" />
              <span className="text-white/60">Dorp</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-cyan-400" />
              <span className="text-white/60">Strand</span>
            </div>
          </div>
        </div>

        {showMap && (
          <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <p className="text-sm text-white/60">
              📍 <strong className="text-white">Can Fressa</strong> ligt in het noordoosten van Mallorca,
              nabij het authentieke dorp Artà. Op korte afstand vind je prachtige stranden zoals Cala Mesquida
              en Cala Agulla, en het kasteel van Capdepera.
            </p>
            <a
              href={`https://www.google.com/maps?q=${LUSTRUM_CONFIG.coordinates.lat},${LUSTRUM_CONFIG.coordinates.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 mt-3 px-4 py-2 rounded-lg bg-blue-500/20 text-blue-400 text-sm hover:bg-blue-500/30 transition-colors"
            >
              <Icons.externalLink size={14} />
              Open in Google Maps
            </a>
          </div>
        )}
      </div>

      {/* Packlist Section */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <Icons.check className="text-purple-400" size={16} />
            </div>
            <div>
              <h2 className="text-lg font-medium text-white">Inpaklijst</h2>
              <p className="text-xs text-white/40">
                {checkedItems.size} van {PACKLIST.length} ingepakt
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setCheckedItems(new Set())
              localStorage.removeItem('lustrum-packlist')
            }}
            className="text-xs text-white/40 hover:text-white/60 transition-colors"
          >
            Reset
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-2 bg-white/5 rounded-full overflow-hidden mb-6">
          <div
            className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-500"
            style={{ width: `${(checkedItems.size / PACKLIST.length) * 100}%` }}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Object.entries(packlistByCategory).map(([category, items]) => {
            const icons: Record<string, string> = {
              kleding: '👕',
              toiletspullen: '🧴',
              documenten: '📄',
              tech: '📱',
              overig: '🎒',
            }
            const checkedInCategory = items.filter((i) => checkedItems.has(i.id)).length
            return (
              <div key={category}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">{icons[category]}</span>
                  <h3 className="text-sm font-medium text-white">{categoryLabels[category]}</h3>
                  <span className="text-xs text-white/30">
                    {checkedInCategory}/{items.length}
                  </span>
                </div>
                <div className="space-y-1">
                  {items.map((item) => (
                    <label
                      key={item.id}
                      className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                        checkedItems.has(item.id)
                          ? 'bg-purple-500/10 line-through text-white/40'
                          : 'bg-white/5 hover:bg-white/10 text-white/80'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checkedItems.has(item.id)}
                        onChange={() => togglePacklistItem(item.id)}
                        className="sr-only"
                      />
                      <div
                        className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                          checkedItems.has(item.id)
                            ? 'bg-purple-500 border-purple-500'
                            : 'border-white/20 hover:border-purple-400'
                        }`}
                      >
                        {checkedItems.has(item.id) && (
                          <Icons.check size={12} className="text-white" />
                        )}
                      </div>
                      <span className="text-sm flex-1">{item.item}</span>
                      {item.essential && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400">
                          !
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="text-center py-8">
        <p className="text-white/30 text-sm">
          🌴 Tot op Mallorca! 🎉
        </p>
      </div>
    </div>
  )
}
