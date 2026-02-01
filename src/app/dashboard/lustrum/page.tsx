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
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-500/20 via-amber-500/10 to-yellow-500/20 border border-orange-500/20 p-8 group/hero">
        <div className="absolute top-0 right-0 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-yellow-500/10 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />

        {/* Confetti decoration - only visible on hover */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-0 group-hover/hero:opacity-100 transition-opacity duration-500">
          {[...Array(20)].map((_, i) => (
            <span
              key={i}
              className="absolute text-2xl animate-bounce"
              style={{
                left: `${5 + (i * 4.5)}%`,
                top: `${10 + (i % 5) * 18}%`,
                animationDelay: `${(i % 5) * 0.15}s`,
                animationDuration: `${0.8 + (i % 3) * 0.3}s`,
              }}
            >
              {['🎉', '✨', '🌴', '☀️', '🎊', '🏝️'][i % 6]}
            </span>
          ))}
        </div>

        <div className="relative">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-5xl">🎉</span>
                <div>
                  <p className="text-orange-400 text-sm font-medium">30 september - 4 oktober 2026</p>
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
              <p className="text-xs text-white/40">Alaró, komende week</p>
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
        </div>

        {/* Beautiful static Mallorca map */}
        <div className="relative aspect-[16/9] rounded-xl overflow-hidden border border-white/10">
          <svg viewBox="0 0 800 450" className="w-full h-full" style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #0c4a6e 50%, #164e63 100%)' }}>
            {/* Sea pattern */}
            <defs>
              <linearGradient id="seaGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#1e40af" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#0891b2" stopOpacity="0.2" />
              </linearGradient>
              <linearGradient id="landGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#d97706" stopOpacity="0.4" />
                <stop offset="50%" stopColor="#b45309" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#92400e" stopOpacity="0.25" />
              </linearGradient>
              <linearGradient id="mountainGradient" x1="0%" y1="100%" x2="0%" y2="0%">
                <stop offset="0%" stopColor="#78350f" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#451a03" stopOpacity="0.6" />
              </linearGradient>
              <filter id="glow">
                <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>

            {/* Sea */}
            <rect width="800" height="450" fill="url(#seaGradient)" />

            {/* Mallorca island shape - simplified but recognizable */}
            <path
              d="M 150 280
                 Q 120 250 130 200
                 Q 140 150 200 120
                 Q 280 80 380 90
                 Q 480 70 550 100
                 Q 620 130 680 180
                 Q 720 220 700 280
                 Q 680 340 620 370
                 Q 540 400 440 390
                 Q 340 400 260 380
                 Q 180 360 150 320
                 Q 130 300 150 280 Z"
              fill="url(#landGradient)"
              stroke="rgba(251, 191, 36, 0.3)"
              strokeWidth="2"
            />

            {/* Serra de Tramuntana mountains - northwest */}
            <path
              d="M 150 280
                 Q 140 240 160 200
                 Q 180 160 220 140
                 Q 280 110 340 100
                 Q 360 120 340 150
                 Q 300 180 260 200
                 Q 200 240 180 280
                 Q 160 300 150 280 Z"
              fill="url(#mountainGradient)"
              opacity="0.8"
            />

            {/* Mountain peaks indication */}
            <text x="220" y="175" fill="rgba(255,255,255,0.3)" fontSize="10" fontStyle="italic">Serra de Tramuntana</text>

            {/* Location: Palma - Southwest */}
            <g className="cursor-pointer hover:scale-110 transition-transform" style={{ transformOrigin: '220px 340px' }}>
              <circle cx="220" cy="340" r="8" fill="rgba(255,255,255,0.8)" />
              <circle cx="220" cy="340" r="12" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" />
              <text x="220" y="365" textAnchor="middle" fill="white" fontSize="13" fontWeight="500">Palma</text>
              <text x="220" y="378" textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="9">Hoofdstad</text>
            </g>

            {/* Location: Valldemossa */}
            <g className="cursor-pointer hover:scale-110 transition-transform" style={{ transformOrigin: '250px 195px' }}>
              <circle cx="250" cy="195" r="6" fill="rgba(255,255,255,0.7)" />
              <text x="250" y="183" textAnchor="middle" fill="white" fontSize="11">Valldemossa</text>
            </g>

            {/* Location: Deià */}
            <g className="cursor-pointer hover:scale-110 transition-transform" style={{ transformOrigin: '290px 155px' }}>
              <circle cx="290" cy="155" r="5" fill="rgba(255,255,255,0.7)" />
              <text x="290" y="143" textAnchor="middle" fill="white" fontSize="11">Deià</text>
            </g>

            {/* Location: Sóller */}
            <g className="cursor-pointer hover:scale-110 transition-transform" style={{ transformOrigin: '320px 175px' }}>
              <circle cx="320" cy="175" r="6" fill="rgba(255,255,255,0.7)" />
              <text x="320" y="163" textAnchor="middle" fill="white" fontSize="11">Sóller</text>
            </g>

            {/* Location: Inca */}
            <g className="cursor-pointer hover:scale-110 transition-transform" style={{ transformOrigin: '400px 220px' }}>
              <circle cx="400" cy="220" r="5" fill="rgba(255,255,255,0.6)" />
              <text x="400" y="208" textAnchor="middle" fill="rgba(255,255,255,0.8)" fontSize="10">Inca</text>
            </g>

            {/* Location: ALARÓ / CAN FRESSA - The star! */}
            <g className="cursor-pointer" filter="url(#glow)">
              {/* Pulsing ring */}
              <circle cx="350" cy="235" r="20" fill="none" stroke="rgba(249, 115, 22, 0.4)" strokeWidth="2">
                <animate attributeName="r" values="20;28;20" dur="2s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.6;0.2;0.6" dur="2s" repeatCount="indefinite" />
              </circle>
              {/* Main marker */}
              <circle cx="350" cy="235" r="12" fill="#f97316" stroke="white" strokeWidth="3" />
              <text x="350" y="239" textAnchor="middle" fill="white" fontSize="10">🏠</text>
              {/* Label */}
              <rect x="295" y="250" width="110" height="32" rx="6" fill="rgba(249, 115, 22, 0.9)" />
              <text x="350" y="266" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold">Can Fressa</text>
              <text x="350" y="278" textAnchor="middle" fill="rgba(255,255,255,0.8)" fontSize="9">Alaró</text>
            </g>

            {/* Location: Alcúdia - North */}
            <g className="cursor-pointer hover:scale-110 transition-transform" style={{ transformOrigin: '500px 120px' }}>
              <circle cx="500" cy="120" r="5" fill="rgba(34, 211, 238, 0.8)" />
              <text x="500" y="108" textAnchor="middle" fill="rgba(34, 211, 238, 1)" fontSize="10">Alcúdia</text>
            </g>

            {/* Location: Pollença */}
            <g className="cursor-pointer hover:scale-110 transition-transform" style={{ transformOrigin: '440px 110px' }}>
              <circle cx="440" cy="110" r="5" fill="rgba(255,255,255,0.6)" />
              <text x="440" y="98" textAnchor="middle" fill="rgba(255,255,255,0.8)" fontSize="10">Pollença</text>
            </g>

            {/* Location: Manacor - East */}
            <g className="cursor-pointer hover:scale-110 transition-transform" style={{ transformOrigin: '560px 280px' }}>
              <circle cx="560" cy="280" r="5" fill="rgba(255,255,255,0.6)" />
              <text x="560" y="268" textAnchor="middle" fill="rgba(255,255,255,0.8)" fontSize="10">Manacor</text>
            </g>

            {/* Beach indicators */}
            <text x="580" y="150" fill="rgba(34, 211, 238, 0.6)" fontSize="9">🏖️ stranden</text>
            <text x="650" cy="320" fill="rgba(34, 211, 238, 0.6)" fontSize="9">🏖️</text>

            {/* Compass */}
            <g transform="translate(720, 60)">
              <circle cx="0" cy="0" r="25" fill="rgba(0,0,0,0.3)" stroke="rgba(255,255,255,0.2)" />
              <text x="0" y="-8" textAnchor="middle" fill="white" fontSize="14" fontWeight="bold">N</text>
              <path d="M 0 -18 L 4 -5 L 0 -10 L -4 -5 Z" fill="white" />
              <text x="0" y="18" textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="8">Z</text>
            </g>

            {/* Distance indicator from Can Fressa */}
            <g transform="translate(60, 400)">
              <rect x="0" y="0" width="180" height="40" rx="8" fill="rgba(0,0,0,0.4)" />
              <text x="15" y="18" fill="rgba(255,255,255,0.6)" fontSize="10">Vanaf Can Fressa:</text>
              <text x="15" y="32" fill="white" fontSize="10">Palma 25 min • Sóller 20 min</text>
            </g>
          </svg>

          {/* Legend overlay */}
          <div className="absolute bottom-4 right-4 bg-black/60 backdrop-blur-sm rounded-lg p-3 text-xs space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-orange-500 ring-2 ring-white/50" />
              <span className="text-white">Can Fressa (ons huis!)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-white/70" />
              <span className="text-white/70">Stadjes</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-cyan-400" />
              <span className="text-white/70">Strand</span>
            </div>
          </div>
        </div>

        {/* Info section below map */}
        <div className="mt-4 p-4 bg-orange-500/10 border border-orange-500/20 rounded-lg">
          <p className="text-sm text-white/70">
            📍 <strong className="text-white">Can Fressa</strong> ligt in het dorpje Alaró, centraal op Mallorca
            aan de voet van de Serra de Tramuntana. Perfect gelegen om het hele eiland te ontdekken!
            Palma is 25 minuten rijden, het pittoreske Sóller 20 minuten.
          </p>
          <a
            href={`https://www.google.com/maps?q=${LUSTRUM_CONFIG.coordinates.lat},${LUSTRUM_CONFIG.coordinates.lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 mt-3 px-4 py-2 rounded-lg bg-orange-500/20 text-orange-400 text-sm hover:bg-orange-500/30 transition-colors"
          >
            <Icons.externalLink size={14} />
            Open in Google Maps
          </a>
        </div>
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
