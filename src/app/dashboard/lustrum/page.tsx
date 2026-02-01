'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
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
  getDailySpanish,
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

// Flight info interface
interface FlightInfo {
  outbound: {
    date: string
    departureTime: string
    arrivalTime: string
    flightNumber: string
    departureAirport: string
    arrivalAirport: string
  }
  return: {
    date: string
    departureTime: string
    arrivalTime: string
    flightNumber: string
    departureAirport: string
    arrivalAirport: string
  }
}

// Program item interface
interface ProgramItem {
  id: string
  date: string
  time: string
  title: string
  description: string
  responsible: string[]
}

// Team member type
interface TeamMember {
  id: string
  name: string
  role: string
}

// Distances from Can Fressa (Alaró) in minutes by car
const DISTANCES_FROM_CAN_FRESSA: Record<string, { minutes: number; km: number }> = {
  'palma': { minutes: 25, km: 28 },
  'soller': { minutes: 20, km: 18 },
  'valldemossa': { minutes: 25, km: 22 },
  'deia': { minutes: 30, km: 25 },
  'inca': { minutes: 10, km: 8 },
  'alcudia': { minutes: 35, km: 38 },
  'pollenca': { minutes: 35, km: 35 },
  'manacor': { minutes: 40, km: 45 },
  'santanyi': { minutes: 55, km: 58 },
  'portocolom': { minutes: 50, km: 52 },
}

export default function LustrumPage() {
  const [countdown, setCountdown] = useState(getCountdown())
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0)
  const [weather, setWeather] = useState<WeatherForecast[]>([])
  const [isWeatherLoading, setIsWeatherLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState<HotspotCategory | 'all'>('all')
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set())
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null)

  // Flight info state
  const [flightInfo, setFlightInfo] = useState<FlightInfo | null>(null)
  const [showFlightModal, setShowFlightModal] = useState(false)
  const [flightForm, setFlightForm] = useState<FlightInfo>({
    outbound: { date: '2026-09-30', departureTime: '', arrivalTime: '', flightNumber: '', departureAirport: 'AMS', arrivalAirport: 'PMI' },
    return: { date: '2026-10-04', departureTime: '', arrivalTime: '', flightNumber: '', departureAirport: 'PMI', arrivalAirport: 'AMS' }
  })
  const [isSavingFlight, setIsSavingFlight] = useState(false)

  // Program state
  const [programItems, setProgramItems] = useState<ProgramItem[]>([])
  const [showProgramModal, setShowProgramModal] = useState(false)
  const [programForm, setProgramForm] = useState<Omit<ProgramItem, 'id'>>({
    date: '2026-09-30', time: '', title: '', description: '', responsible: []
  })
  const [isSavingProgram, setIsSavingProgram] = useState(false)
  const [isLoadingData, setIsLoadingData] = useState(true)
  const [userCanEdit, setUserCanEdit] = useState(false)
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [isSavingPacklist, setIsSavingPacklist] = useState(false)

  // Music state
  const [isMusicPlaying, setIsMusicPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Initialize audio on mount
  useEffect(() => {
    // Chill Ibiza/Spanish vibe music - royalty free lofi spanish guitar
    audioRef.current = new Audio('https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112191.mp3')
    audioRef.current.loop = true
    audioRef.current.volume = 0.4

    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [])

  // Toggle music
  const toggleMusic = () => {
    if (!audioRef.current) return

    if (isMusicPlaying) {
      audioRef.current.pause()
    } else {
      audioRef.current.play().catch(console.error)
    }
    setIsMusicPlaying(!isMusicPlaying)
  }

  // Daily fact based on day of year
  const dailyFact = useMemo(() => getDailyFact(), [])

  // Daily Spanish lesson
  const dailySpanish = useMemo(() => getDailySpanish(), [])

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

  // Load checked items from API
  useEffect(() => {
    const fetchPacklist = async () => {
      try {
        const res = await fetch('/api/lustrum/packlist')
        if (res.ok) {
          const data = await res.json()
          setCheckedItems(new Set(data.checkedItems || []))
        }
      } catch (error) {
        console.error('Error loading packlist:', error)
      }
    }
    fetchPacklist()
  }, [])

  // Load team members from API
  useEffect(() => {
    const fetchTeamMembers = async () => {
      try {
        const res = await fetch('/api/team')
        if (res.ok) {
          const data = await res.json()
          // Filter alleen actieve medewerkers en sorteer: Partners eerst, dan Admin, dan medewerkers
          const sortedMembers = data
            .filter((m: TeamMember) => m.name)
            .sort((a: TeamMember, b: TeamMember) => {
              const roleOrder: Record<string, number> = { PARTNER: 0, ADMIN: 1, EMPLOYEE: 2 }
              const orderA = roleOrder[a.role] ?? 3
              const orderB = roleOrder[b.role] ?? 3
              if (orderA !== orderB) return orderA - orderB
              return a.name.localeCompare(b.name)
            })
          setTeamMembers(sortedMembers)
        }
      } catch (error) {
        console.error('Error loading team members:', error)
      }
    }
    fetchTeamMembers()
  }, [])

  // Load flight info and program from API
  useEffect(() => {
    const fetchLustrumData = async () => {
      try {
        const res = await fetch('/api/lustrum')
        if (res.ok) {
          const data = await res.json()
          if (data.flight) {
            setFlightInfo(data.flight)
            setFlightForm(data.flight)
          }
          if (data.program) {
            setProgramItems(data.program)
          }
        }
      } catch (error) {
        console.error('Error loading lustrum data:', error)
      } finally {
        setIsLoadingData(false)
      }
    }
    fetchLustrumData()
  }, [])

  // Check if user can edit (PARTNER or ADMIN)
  useEffect(() => {
    const checkUserRole = async () => {
      try {
        const res = await fetch('/api/user/profile')
        if (res.ok) {
          const data = await res.json()
          setUserCanEdit(data.role === 'PARTNER' || data.role === 'ADMIN')
        }
      } catch (error) {
        console.error('Error checking user role:', error)
      }
    }
    checkUserRole()
  }, [])

  // Save flight info via API
  const saveFlightInfo = async () => {
    setIsSavingFlight(true)
    try {
      const res = await fetch('/api/lustrum/flight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(flightForm),
      })
      if (res.ok) {
        const data = await res.json()
        setFlightInfo(data)
        setShowFlightModal(false)
      } else {
        const error = await res.json()
        alert(error.error || 'Fout bij opslaan')
      }
    } catch (error) {
      console.error('Error saving flight info:', error)
      alert('Fout bij opslaan')
    } finally {
      setIsSavingFlight(false)
    }
  }

  // Save program item via API
  const saveProgramItem = async () => {
    setIsSavingProgram(true)
    try {
      const res = await fetch('/api/lustrum/program', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(programForm),
      })
      if (res.ok) {
        const newItem = await res.json()
        const updated = [...programItems, newItem].sort((a, b) => {
          const dateCompare = a.date.localeCompare(b.date)
          if (dateCompare !== 0) return dateCompare
          return (a.time || '').localeCompare(b.time || '')
        })
        setProgramItems(updated)
        setProgramForm({ date: '2026-09-30', time: '', title: '', description: '', responsible: [] })
        setShowProgramModal(false)
      } else {
        const error = await res.json()
        alert(error.error || 'Fout bij opslaan')
      }
    } catch (error) {
      console.error('Error saving program item:', error)
      alert('Fout bij opslaan')
    } finally {
      setIsSavingProgram(false)
    }
  }

  // Delete program item via API
  const deleteProgramItem = async (id: string) => {
    try {
      const res = await fetch(`/api/lustrum/program/${id}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        setProgramItems(programItems.filter(item => item.id !== id))
      } else {
        const error = await res.json()
        alert(error.error || 'Fout bij verwijderen')
      }
    } catch (error) {
      console.error('Error deleting program item:', error)
      alert('Fout bij verwijderen')
    }
  }

  // Toggle responsible person
  const toggleResponsible = (name: string) => {
    setProgramForm(prev => ({
      ...prev,
      responsible: prev.responsible.includes(name)
        ? prev.responsible.filter(n => n !== name)
        : [...prev.responsible, name]
    }))
  }

  // Save checked items to API
  const togglePacklistItem = async (id: string) => {
    const next = new Set(checkedItems)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    setCheckedItems(next)

    // Save to API (debounced, fire and forget)
    try {
      await fetch('/api/lustrum/packlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkedItems: Array.from(next) }),
      })
    } catch (error) {
      console.error('Error saving packlist:', error)
    }
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
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-500/20 via-amber-500/10 to-yellow-500/20 border border-orange-500/20 p-4 sm:p-8 group/hero">
        <div className="absolute top-0 right-0 w-48 sm:w-96 h-48 sm:h-96 bg-orange-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-32 sm:w-64 h-32 sm:h-64 bg-yellow-500/10 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />

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
              <div className="flex items-center gap-2 sm:gap-3 mb-3">
                <span className="text-3xl sm:text-5xl hover:scale-125 hover:rotate-12 transition-transform cursor-default">🎉</span>
                <div>
                  <p className="text-orange-400 text-xs sm:text-sm font-medium">30 september - 4 oktober 2026</p>
                  <h1 className="text-2xl sm:text-4xl font-bold text-white">Workx Lustrum - 15 Jaar!</h1>
                </div>
              </div>
              <p className="text-white/60 max-w-lg mb-4">
                We vieren ons 15-jarig jubileum met een onvergetelijke trip naar Mallorca!
                Samen genieten van zon, zee, lekker eten en natuurlijk elkaar.
              </p>
              <div className="flex items-center gap-3 flex-wrap">
                <a
                  href={LUSTRUM_CONFIG.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500/20 border border-orange-500/30 text-orange-400 hover:bg-orange-500/30 transition-colors group/link"
                >
                  <Icons.externalLink size={16} className="group-hover/link:rotate-12 transition-transform" />
                  Bekijk Can Fressa
                </a>
                <button
                  onClick={toggleMusic}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${
                    isMusicPlaying
                      ? 'bg-pink-500/30 border-pink-500/50 text-pink-300'
                      : 'bg-pink-500/20 border-pink-500/30 text-pink-400 hover:bg-pink-500/30'
                  }`}
                >
                  <span className={`text-lg ${isMusicPlaying ? 'animate-pulse' : ''}`}>
                    {isMusicPlaying ? '🎵' : '🎶'}
                  </span>
                  {isMusicPlaying ? 'Muziek uit' : 'Mallorca vibes'}
                </button>
              </div>
            </div>

            {/* Countdown */}
            <div className="flex-shrink-0">
              <p className="text-center text-white/40 text-sm mb-3">Nog te gaan</p>
              <div className="flex gap-1.5 sm:gap-3">
                {[
                  { value: countdown.days, label: 'dagen' },
                  { value: countdown.hours, label: 'uur' },
                  { value: countdown.minutes, label: 'min' },
                  { value: countdown.seconds, label: 'sec' },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="w-14 h-16 sm:w-20 sm:h-24 rounded-lg sm:rounded-xl bg-white/5 border border-white/10 flex flex-col items-center justify-center hover:scale-105 hover:bg-white/10 hover:border-orange-500/30 transition-all duration-300 cursor-default"
                  >
                    <span className="text-xl sm:text-3xl font-bold text-orange-400 tabular-nums">
                      {String(item.value).padStart(2, '0')}
                    </span>
                    <span className="text-[8px] sm:text-[10px] text-white/40 uppercase tracking-wider">
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
          <div className="absolute top-2 left-2 sm:top-4 sm:left-4 z-10 bg-black/50 backdrop-blur-sm rounded-md sm:rounded-lg px-2 py-1 sm:px-3 sm:py-1.5">
            <p className="text-white text-xs sm:text-sm font-medium">📸 Hier gaan we naartoe</p>
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

          {/* Dots indicator - hidden on mobile */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 hidden sm:flex gap-2">
            {CAN_FRESSA_PHOTOS.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentPhotoIndex(i)}
                className={`h-2 rounded-full transition-all ${
                  i === currentPhotoIndex
                    ? 'bg-orange-400 w-6'
                    : 'bg-white/30 hover:bg-white/50 w-2'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Weather Widget */}
        <div className="card p-5 group/weather">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center group-hover/weather:scale-110 group-hover/weather:bg-blue-500/20 transition-all duration-300">
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
                      <span className="text-2xl hover:scale-125 transition-transform cursor-default">{info.icon}</span>
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

      {/* Daily Fact + Spanish Lesson Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Fact */}
        <div className="card p-5 bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-amber-500/10 border-amber-500/20 group">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0 group-hover:scale-110 group-hover:bg-amber-500/30 transition-all duration-300">
              <span className="text-2xl group-hover:animate-bounce">💡</span>
            </div>
            <div>
              <p className="text-amber-400 text-sm font-medium mb-1">Weetje van de dag</p>
              <p className="text-white">{dailyFact}</p>
            </div>
          </div>
        </div>

        {/* Spanish Lesson */}
        <div className="card p-5 bg-gradient-to-r from-red-500/10 via-yellow-500/5 to-red-500/10 border-red-500/20 group">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center flex-shrink-0 group-hover:scale-110 group-hover:bg-red-500/30 transition-all duration-300">
              <span className="text-2xl group-hover:animate-pulse">🇪🇸</span>
            </div>
            <div className="flex-1">
              <p className="text-red-400 text-sm font-medium mb-2">¿Hablas español?</p>
              <div className="space-y-2">
                <div>
                  <span className="text-white font-semibold">{dailySpanish.word}</span>
                  <span className="text-white/50 mx-2">—</span>
                  <span className="text-white/70">{dailySpanish.wordTranslation}</span>
                  {dailySpanish.pronunciation && (
                    <span className="text-white/40 text-xs ml-2">({dailySpanish.pronunciation})</span>
                  )}
                </div>
                <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                  <p className="text-yellow-400 italic">"{dailySpanish.phrase}"</p>
                  <p className="text-white/60 text-sm mt-1">{dailySpanish.phraseTranslation}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Map Section */}
      <div className="card p-5 group/map">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center group-hover/map:scale-110 group-hover/map:bg-green-500/20 transition-all duration-300">
              <Icons.mapPin className="text-green-400 group-hover/map:animate-bounce" size={16} />
            </div>
            <div>
              <h2 className="text-lg font-medium text-white">Locatie</h2>
              <p className="text-xs text-white/40">Klik op een plaats om de afstand te zien</p>
            </div>
          </div>
        </div>

        {/* Realistic Mallorca map */}
        <div className="relative aspect-[16/10] rounded-xl overflow-hidden border border-white/10">
          <svg viewBox="0 0 800 500" className="w-full h-full" style={{ background: 'linear-gradient(180deg, #0c4a6e 0%, #164e63 50%, #155e75 100%)' }}>
            <defs>
              <linearGradient id="seaGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.15" />
                <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.1" />
              </linearGradient>
              <linearGradient id="landGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.5" />
                <stop offset="50%" stopColor="#d97706" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#b45309" stopOpacity="0.35" />
              </linearGradient>
              <linearGradient id="mountainGradient" x1="0%" y1="100%" x2="0%" y2="0%">
                <stop offset="0%" stopColor="#92400e" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#78350f" stopOpacity="0.5" />
              </linearGradient>
              <filter id="glow">
                <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
              <filter id="softGlow">
                <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>

            {/* Sea background */}
            <rect width="800" height="500" fill="url(#seaGradient)" />

            {/* Wave pattern */}
            {[0, 1, 2].map((i) => (
              <path
                key={i}
                d={`M 0 ${400 + i * 25} Q 200 ${390 + i * 25} 400 ${400 + i * 25} T 800 ${400 + i * 25}`}
                fill="none"
                stroke="rgba(34, 211, 238, 0.1)"
                strokeWidth="1"
              />
            ))}

            {/* MALLORCA - Realistic island shape */}
            <path
              d="M 95 290
                 C 85 260 90 230 105 200
                 C 115 175 135 155 160 140
                 C 185 125 215 115 245 105
                 L 260 100 L 280 95
                 C 320 88 360 85 400 85
                 C 440 83 470 80 500 82
                 L 530 85
                 C 545 87 560 92 575 100
                 L 590 108
                 C 620 125 645 145 665 170
                 L 678 188
                 C 690 210 698 235 700 260
                 L 702 280 L 700 300
                 C 695 330 680 355 660 375
                 L 640 393
                 C 610 415 575 428 540 435
                 L 510 440 L 480 443
                 C 440 445 400 445 360 442
                 L 320 438 L 285 432
                 C 250 425 220 415 195 400
                 L 170 382
                 C 145 362 125 338 115 312
                 L 105 290
                 C 98 275 95 290 95 290 Z"
              fill="url(#landGradient)"
              stroke="rgba(251, 191, 36, 0.4)"
              strokeWidth="2"
            />

            {/* Cap de Formentor peninsula - Northeast tip */}
            <path
              d="M 575 100
                 C 595 90 620 85 645 90
                 C 665 95 680 105 688 118
                 C 695 130 690 145 678 155
                 C 665 165 645 168 625 165
                 C 608 162 595 155 590 145
                 L 575 100 Z"
              fill="url(#landGradient)"
              stroke="rgba(251, 191, 36, 0.3)"
              strokeWidth="1"
            />

            {/* Serra de Tramuntana mountains - Northwest coast */}
            <path
              d="M 95 290
                 C 90 260 100 230 115 200
                 C 130 170 155 145 185 125
                 C 215 108 250 100 285 95
                 C 310 92 335 90 355 92
                 L 340 120
                 C 310 130 280 145 255 165
                 C 225 190 200 220 180 255
                 C 165 280 155 300 150 315
                 C 135 310 115 300 100 290
                 L 95 290 Z"
              fill="url(#mountainGradient)"
              opacity="0.9"
            />

            {/* Mountain label */}
            <text x="180" y="180" fill="rgba(255,255,255,0.25)" fontSize="9" fontStyle="italic" transform="rotate(-35, 180, 180)">Serra de Tramuntana</text>

            {/* Bays: Pollença and Alcúdia */}
            <ellipse cx="485" cy="95" rx="35" ry="12" fill="rgba(6, 182, 212, 0.2)" />
            <ellipse cx="560" cy="105" rx="25" ry="10" fill="rgba(6, 182, 212, 0.2)" />

            {/* Bay: Palma */}
            <ellipse cx="220" cy="400" rx="55" ry="20" fill="rgba(6, 182, 212, 0.2)" />

            {/* === CLICKABLE LOCATIONS === */}

            {/* Palma - Capital, Southwest */}
            <g
              className="cursor-pointer transition-all duration-200 hover:scale-110"
              style={{ transformOrigin: '200px 370px' }}
              onClick={() => setSelectedLocation(selectedLocation === 'palma' ? null : 'palma')}
            >
              <circle cx="200" cy="370" r={selectedLocation === 'palma' ? 12 : 9} fill="white" stroke={selectedLocation === 'palma' ? '#f97316' : 'rgba(255,255,255,0.5)'} strokeWidth={selectedLocation === 'palma' ? 3 : 2} />
              <text x="200" y="395" textAnchor="middle" fill="white" fontSize="14" fontWeight="600">Palma</text>
              <text x="200" y="408" textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="9">Hoofdstad</text>
            </g>

            {/* Valldemossa */}
            <g
              className="cursor-pointer transition-all duration-200 hover:scale-110"
              style={{ transformOrigin: '185px 255px' }}
              onClick={() => setSelectedLocation(selectedLocation === 'valldemossa' ? null : 'valldemossa')}
            >
              <circle cx="185" cy="255" r={selectedLocation === 'valldemossa' ? 8 : 6} fill="white" opacity={selectedLocation === 'valldemossa' ? 1 : 0.85} stroke={selectedLocation === 'valldemossa' ? '#f97316' : 'transparent'} strokeWidth="2" />
              <text x="160" y="245" textAnchor="middle" fill="white" fontSize="10">Valldemossa</text>
            </g>

            {/* Deià */}
            <g
              className="cursor-pointer transition-all duration-200 hover:scale-110"
              style={{ transformOrigin: '215px 210px' }}
              onClick={() => setSelectedLocation(selectedLocation === 'deia' ? null : 'deia')}
            >
              <circle cx="215" cy="210" r={selectedLocation === 'deia' ? 7 : 5} fill="white" opacity={selectedLocation === 'deia' ? 1 : 0.85} stroke={selectedLocation === 'deia' ? '#f97316' : 'transparent'} strokeWidth="2" />
              <text x="215" y="198" textAnchor="middle" fill="white" fontSize="10">Deià</text>
            </g>

            {/* Sóller */}
            <g
              className="cursor-pointer transition-all duration-200 hover:scale-110"
              style={{ transformOrigin: '265px 195px' }}
              onClick={() => setSelectedLocation(selectedLocation === 'soller' ? null : 'soller')}
            >
              <circle cx="265" cy="195" r={selectedLocation === 'soller' ? 8 : 6} fill="white" opacity={selectedLocation === 'soller' ? 1 : 0.85} stroke={selectedLocation === 'soller' ? '#f97316' : 'transparent'} strokeWidth="2" />
              <text x="265" y="183" textAnchor="middle" fill="white" fontSize="11">Sóller</text>
            </g>

            {/* Pollença */}
            <g
              className="cursor-pointer transition-all duration-200 hover:scale-110"
              style={{ transformOrigin: '455px 125px' }}
              onClick={() => setSelectedLocation(selectedLocation === 'pollenca' ? null : 'pollenca')}
            >
              <circle cx="455" cy="125" r={selectedLocation === 'pollenca' ? 7 : 5} fill="white" opacity={selectedLocation === 'pollenca' ? 1 : 0.8} stroke={selectedLocation === 'pollenca' ? '#f97316' : 'transparent'} strokeWidth="2" />
              <text x="455" y="113" textAnchor="middle" fill="white" fontSize="10">Pollença</text>
            </g>

            {/* Alcúdia */}
            <g
              className="cursor-pointer transition-all duration-200 hover:scale-110"
              style={{ transformOrigin: '520px 130px' }}
              onClick={() => setSelectedLocation(selectedLocation === 'alcudia' ? null : 'alcudia')}
            >
              <circle cx="520" cy="130" r={selectedLocation === 'alcudia' ? 7 : 5} fill="#22d3ee" opacity={selectedLocation === 'alcudia' ? 1 : 0.9} stroke={selectedLocation === 'alcudia' ? '#f97316' : 'rgba(255,255,255,0.5)'} strokeWidth="2" />
              <text x="520" y="118" textAnchor="middle" fill="#22d3ee" fontSize="10">Alcúdia</text>
            </g>

            {/* Inca */}
            <g
              className="cursor-pointer transition-all duration-200 hover:scale-110"
              style={{ transformOrigin: '420px 235px' }}
              onClick={() => setSelectedLocation(selectedLocation === 'inca' ? null : 'inca')}
            >
              <circle cx="420" cy="235" r={selectedLocation === 'inca' ? 7 : 5} fill="white" opacity={selectedLocation === 'inca' ? 1 : 0.7} stroke={selectedLocation === 'inca' ? '#f97316' : 'transparent'} strokeWidth="2" />
              <text x="420" y="223" textAnchor="middle" fill="rgba(255,255,255,0.8)" fontSize="10">Inca</text>
            </g>

            {/* Manacor */}
            <g
              className="cursor-pointer transition-all duration-200 hover:scale-110"
              style={{ transformOrigin: '545px 305px' }}
              onClick={() => setSelectedLocation(selectedLocation === 'manacor' ? null : 'manacor')}
            >
              <circle cx="545" cy="305" r={selectedLocation === 'manacor' ? 7 : 5} fill="white" opacity={selectedLocation === 'manacor' ? 1 : 0.7} stroke={selectedLocation === 'manacor' ? '#f97316' : 'transparent'} strokeWidth="2" />
              <text x="545" y="293" textAnchor="middle" fill="rgba(255,255,255,0.8)" fontSize="10">Manacor</text>
            </g>

            {/* Santanyí */}
            <g
              className="cursor-pointer transition-all duration-200 hover:scale-110"
              style={{ transformOrigin: '520px 400px' }}
              onClick={() => setSelectedLocation(selectedLocation === 'santanyi' ? null : 'santanyi')}
            >
              <circle cx="520" cy="400" r={selectedLocation === 'santanyi' ? 7 : 5} fill="#22d3ee" opacity={selectedLocation === 'santanyi' ? 1 : 0.8} stroke={selectedLocation === 'santanyi' ? '#f97316' : 'transparent'} strokeWidth="2" />
              <text x="520" y="418" textAnchor="middle" fill="rgba(34, 211, 238, 0.9)" fontSize="10">Santanyí</text>
            </g>

            {/* Porto Colom */}
            <g
              className="cursor-pointer transition-all duration-200 hover:scale-110"
              style={{ transformOrigin: '620px 355px' }}
              onClick={() => setSelectedLocation(selectedLocation === 'portocolom' ? null : 'portocolom')}
            >
              <circle cx="620" cy="355" r={selectedLocation === 'portocolom' ? 6 : 4} fill="#22d3ee" opacity={selectedLocation === 'portocolom' ? 1 : 0.7} stroke={selectedLocation === 'portocolom' ? '#f97316' : 'transparent'} strokeWidth="2" />
              <text x="655" y="360" textAnchor="middle" fill="rgba(34, 211, 238, 0.8)" fontSize="9">Porto Colom</text>
            </g>

            {/* === CAN FRESSA - ALARÓ - Our home! === */}
            <g filter="url(#glow)">
              {/* Connection line to selected location */}
              {selectedLocation && DISTANCES_FROM_CAN_FRESSA[selectedLocation] && (
                <line
                  x1="340"
                  y1="270"
                  x2={
                    selectedLocation === 'palma' ? 200 :
                    selectedLocation === 'soller' ? 265 :
                    selectedLocation === 'valldemossa' ? 185 :
                    selectedLocation === 'deia' ? 215 :
                    selectedLocation === 'inca' ? 420 :
                    selectedLocation === 'alcudia' ? 520 :
                    selectedLocation === 'pollenca' ? 455 :
                    selectedLocation === 'manacor' ? 545 :
                    selectedLocation === 'santanyi' ? 520 :
                    selectedLocation === 'portocolom' ? 620 : 340
                  }
                  y2={
                    selectedLocation === 'palma' ? 370 :
                    selectedLocation === 'soller' ? 195 :
                    selectedLocation === 'valldemossa' ? 255 :
                    selectedLocation === 'deia' ? 210 :
                    selectedLocation === 'inca' ? 235 :
                    selectedLocation === 'alcudia' ? 130 :
                    selectedLocation === 'pollenca' ? 125 :
                    selectedLocation === 'manacor' ? 305 :
                    selectedLocation === 'santanyi' ? 400 :
                    selectedLocation === 'portocolom' ? 355 : 270
                  }
                  stroke="#f97316"
                  strokeWidth="2"
                  strokeDasharray="6 4"
                  opacity="0.7"
                />
              )}
              {/* Pulsing rings */}
              <circle cx="340" cy="270" r="22" fill="none" stroke="rgba(249, 115, 22, 0.5)" strokeWidth="2">
                <animate attributeName="r" values="22;32;22" dur="2s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.5;0.15;0.5" dur="2s" repeatCount="indefinite" />
              </circle>
              <circle cx="340" cy="270" r="16" fill="none" stroke="rgba(249, 115, 22, 0.4)" strokeWidth="2">
                <animate attributeName="r" values="16;24;16" dur="2s" repeatCount="indefinite" begin="0.3s" />
                <animate attributeName="opacity" values="0.4;0.1;0.4" dur="2s" repeatCount="indefinite" begin="0.3s" />
              </circle>
              {/* Main marker */}
              <circle cx="340" cy="270" r="14" fill="#f97316" stroke="white" strokeWidth="3" />
              <text x="340" y="275" textAnchor="middle" fill="white" fontSize="12">🏠</text>
              {/* Label */}
              <rect x="280" y="290" width="120" height="36" rx="8" fill="rgba(249, 115, 22, 0.95)" />
              <text x="340" y="308" textAnchor="middle" fill="white" fontSize="13" fontWeight="bold">Can Fressa</text>
              <text x="340" y="321" textAnchor="middle" fill="rgba(255,255,255,0.85)" fontSize="10">Alaró</text>
            </g>

            {/* Compass Rose */}
            <g transform="translate(735, 55)">
              <circle cx="0" cy="0" r="28" fill="rgba(0,0,0,0.4)" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
              <text x="0" y="-10" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold">N</text>
              <polygon points="0,-20 4,-8 0,-12 -4,-8" fill="white" />
              <text x="0" y="18" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="9">Z</text>
              <text x="-15" y="4" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="9">W</text>
              <text x="15" y="4" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="9">O</text>
            </g>

            {/* Scale bar */}
            <g transform="translate(50, 465)">
              <line x1="0" y1="0" x2="80" y2="0" stroke="white" strokeWidth="2" />
              <line x1="0" y1="-5" x2="0" y2="5" stroke="white" strokeWidth="2" />
              <line x1="80" y1="-5" x2="80" y2="5" stroke="white" strokeWidth="2" />
              <text x="40" y="15" textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize="9">~20 km</text>
            </g>
          </svg>

          {/* Distance popup when location selected */}
          {selectedLocation && DISTANCES_FROM_CAN_FRESSA[selectedLocation] && (
            <div className="absolute top-4 left-4 bg-orange-500/95 backdrop-blur-sm rounded-xl p-4 shadow-lg animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                  <span className="text-xl">🚗</span>
                </div>
                <div>
                  <p className="text-white/80 text-xs">Vanaf Can Fressa naar</p>
                  <p className="text-white font-bold capitalize">{selectedLocation === 'portocolom' ? 'Porto Colom' : selectedLocation.charAt(0).toUpperCase() + selectedLocation.slice(1)}</p>
                </div>
              </div>
              <div className="mt-3 flex gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-white">{DISTANCES_FROM_CAN_FRESSA[selectedLocation].minutes}</p>
                  <p className="text-xs text-white/70">minuten</p>
                </div>
                <div className="w-px bg-white/20" />
                <div className="text-center">
                  <p className="text-2xl font-bold text-white">{DISTANCES_FROM_CAN_FRESSA[selectedLocation].km}</p>
                  <p className="text-xs text-white/70">km</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedLocation(null)}
                className="mt-3 w-full py-1.5 rounded-lg bg-white/20 text-white/90 text-xs hover:bg-white/30 transition-colors"
              >
                Sluiten
              </button>
            </div>
          )}

          {/* Legend overlay */}
          <div className="absolute bottom-4 right-4 bg-black/60 backdrop-blur-sm rounded-lg p-3 text-xs space-y-1.5">
            <p className="text-white/50 text-[10px] mb-2">Klik op een plaats</p>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-orange-500 ring-2 ring-white/50" />
              <span className="text-white">Can Fressa</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-white/80" />
              <span className="text-white/70">Stadjes</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-cyan-400" />
              <span className="text-white/70">Kust/strand</span>
            </div>
          </div>
        </div>

        {/* Info section below map */}
        <div className="mt-4 p-4 bg-orange-500/10 border border-orange-500/20 rounded-lg">
          <p className="text-sm text-white/70">
            📍 <strong className="text-white">Can Fressa</strong> ligt in het dorpje Alaró, centraal op Mallorca
            aan de voet van de Serra de Tramuntana. Perfect gelegen om het hele eiland te ontdekken!
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

      {/* Flight Info + Program Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Flight Info */}
        <div className="card p-5 group/flight">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-sky-500/10 flex items-center justify-center group-hover/flight:scale-110 group-hover/flight:bg-sky-500/20 transition-all duration-300">
                <span className="text-lg group-hover/flight:translate-x-1 group-hover/flight:-translate-y-1 transition-transform">✈️</span>
              </div>
              <div>
                <h2 className="text-lg font-medium text-white">Vlieggegevens</h2>
                <p className="text-xs text-white/40">Vluchtinformatie en tijden</p>
              </div>
            </div>
            {userCanEdit && (
              <button
                onClick={() => {
                  if (flightInfo) setFlightForm(flightInfo)
                  setShowFlightModal(true)
                }}
                className="px-3 py-1.5 rounded-lg bg-sky-500/20 text-sky-400 text-xs font-medium hover:bg-sky-500/30 transition-colors flex items-center gap-1.5"
              >
                <Icons.edit size={12} />
                {flightInfo ? 'Wijzigen' : 'Toevoegen'}
              </button>
            )}
          </div>

          {flightInfo ? (
            <div className="space-y-4">
              {/* Outbound flight */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-sky-500/10 to-blue-500/10 border border-sky-500/20">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">🛫</span>
                  <span className="text-sky-400 font-medium text-sm">Heenvlucht</span>
                  <span className="text-white/40 text-xs ml-auto">{new Date(flightInfo.outbound.date).toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-white">{flightInfo.outbound.departureTime || '--:--'}</p>
                    <p className="text-xs text-white/50">{flightInfo.outbound.departureAirport}</p>
                  </div>
                  <div className="flex-1 mx-4 flex items-center">
                    <div className="flex-1 h-px bg-gradient-to-r from-sky-500/50 to-transparent" />
                    <span className="px-2 text-xs text-sky-400 font-medium">{flightInfo.outbound.flightNumber || '---'}</span>
                    <div className="flex-1 h-px bg-gradient-to-l from-sky-500/50 to-transparent" />
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-white">{flightInfo.outbound.arrivalTime || '--:--'}</p>
                    <p className="text-xs text-white/50">{flightInfo.outbound.arrivalAirport}</p>
                  </div>
                </div>
              </div>

              {/* Return flight */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-orange-500/10 to-amber-500/10 border border-orange-500/20">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">🛬</span>
                  <span className="text-orange-400 font-medium text-sm">Terugvlucht</span>
                  <span className="text-white/40 text-xs ml-auto">{new Date(flightInfo.return.date).toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-white">{flightInfo.return.departureTime || '--:--'}</p>
                    <p className="text-xs text-white/50">{flightInfo.return.departureAirport}</p>
                  </div>
                  <div className="flex-1 mx-4 flex items-center">
                    <div className="flex-1 h-px bg-gradient-to-r from-orange-500/50 to-transparent" />
                    <span className="px-2 text-xs text-orange-400 font-medium">{flightInfo.return.flightNumber || '---'}</span>
                    <div className="flex-1 h-px bg-gradient-to-l from-orange-500/50 to-transparent" />
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-white">{flightInfo.return.arrivalTime || '--:--'}</p>
                    <p className="text-xs text-white/50">{flightInfo.return.arrivalAirport}</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 rounded-xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center text-center">
              <span className="text-4xl mb-3 opacity-30">✈️</span>
              <p className="text-white/40 text-sm">Nog geen vluchtgegevens</p>
              <p className="text-white/25 text-xs mt-1">Klik op 'Toevoegen' om vluchten in te voeren</p>
            </div>
          )}
        </div>

        {/* Day Program */}
        <div className="card p-5 group/program">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center group-hover/program:scale-110 group-hover/program:bg-violet-500/20 transition-all duration-300">
                <span className="text-lg group-hover/program:rotate-12 transition-transform">📅</span>
              </div>
              <div>
                <h2 className="text-lg font-medium text-white">Dagprogramma</h2>
                <p className="text-xs text-white/40">30 sept - 4 okt 2026</p>
              </div>
            </div>
            {userCanEdit && (
              <button
                onClick={() => setShowProgramModal(true)}
                className="px-3 py-1.5 rounded-lg bg-violet-500/20 text-violet-400 text-xs font-medium hover:bg-violet-500/30 transition-colors flex items-center gap-1.5"
              >
                <Icons.plus size={12} />
                Toevoegen
              </button>
            )}
          </div>

          {programItems.length > 0 ? (
            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
              {/* Group items by date */}
              {(() => {
                const groupedByDate: Record<string, typeof programItems> = {}
                const tripDays = [
                  { date: '2026-09-30', label: 'Woensdag 30 september', subtitle: 'Aankomstdag' },
                  { date: '2026-10-01', label: 'Donderdag 1 oktober', subtitle: 'Dag 2' },
                  { date: '2026-10-02', label: 'Vrijdag 2 oktober', subtitle: 'Dag 3' },
                  { date: '2026-10-03', label: 'Zaterdag 3 oktober', subtitle: 'Dag 4' },
                  { date: '2026-10-04', label: 'Zondag 4 oktober', subtitle: 'Vertrekdag' },
                ]

                // Initialize all days
                tripDays.forEach(day => { groupedByDate[day.date] = [] })

                // Group items
                programItems.forEach(item => {
                  if (!groupedByDate[item.date]) groupedByDate[item.date] = []
                  groupedByDate[item.date].push(item)
                })

                // Only show days that have items
                const daysWithItems = tripDays.filter(day => groupedByDate[day.date].length > 0)

                return daysWithItems.map((day, dayIndex) => (
                  <div key={day.date} className="space-y-2">
                    {/* Day Header */}
                    <div className={`flex items-center gap-3 ${dayIndex > 0 ? 'pt-2 border-t border-white/5' : ''}`}>
                      <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-lg">
                          {day.date === '2026-09-30' ? '🛬' : day.date === '2026-10-04' ? '🛫' : '☀️'}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{day.label}</p>
                        <p className="text-[10px] text-violet-400">{day.subtitle}</p>
                      </div>
                    </div>

                    {/* Items for this day */}
                    <div className="ml-[52px] space-y-2">
                      {groupedByDate[day.date].map((item) => (
                        <div
                          key={item.id}
                          className="p-3 rounded-xl bg-white/5 border border-white/10 hover:border-violet-500/30 transition-colors group/item"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                {item.time && (
                                  <span className="text-xs text-violet-400 font-medium bg-violet-500/10 px-2 py-0.5 rounded">
                                    {item.time}
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-white font-medium">{item.title}</p>
                              {item.description && (
                                <p className="text-xs text-white/50 mt-1">{item.description}</p>
                              )}
                              {item.responsible.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {item.responsible.map((name) => (
                                    <span
                                      key={name}
                                      className="px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 text-[10px] font-medium"
                                    >
                                      {name}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                            {userCanEdit && (
                              <button
                                onClick={() => deleteProgramItem(item.id)}
                                className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover/item:opacity-100"
                              >
                                <Icons.x size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              })()}
            </div>
          ) : (
            <div className="p-8 rounded-xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center text-center">
              <span className="text-4xl mb-3 opacity-30">📅</span>
              <p className="text-white/40 text-sm">Nog geen programma</p>
              <p className="text-white/25 text-xs mt-1">Klik op 'Toevoegen' om activiteiten toe te voegen</p>
            </div>
          )}
        </div>
      </div>

      {/* Flight Modal */}
      {showFlightModal && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
          onClick={() => setShowFlightModal(false)}
        >
          <div
            className="absolute left-1/2 w-full max-w-lg bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl border border-white/10 shadow-2xl"
            style={{ top: '28%', transform: 'translateX(-50%)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-white/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">✈️</span>
                  <h3 className="text-xl font-semibold text-white">Vlieggegevens</h3>
                </div>
                <button
                  onClick={() => setShowFlightModal(false)}
                  className="p-2 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                >
                  <Icons.x size={20} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Outbound */}
              <div>
                <h4 className="text-sm font-medium text-sky-400 mb-3 flex items-center gap-2">
                  <span>🛫</span> Heenvlucht
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-white/50 block mb-1">Datum</label>
                    <input
                      type="date"
                      value={flightForm.outbound.date}
                      onChange={(e) => setFlightForm(prev => ({ ...prev, outbound: { ...prev.outbound, date: e.target.value } }))}
                      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:border-sky-500/50 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-white/50 block mb-1">Vluchtnummer</label>
                    <input
                      type="text"
                      value={flightForm.outbound.flightNumber}
                      onChange={(e) => setFlightForm(prev => ({ ...prev, outbound: { ...prev.outbound, flightNumber: e.target.value } }))}
                      placeholder="KL1234"
                      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:border-sky-500/50 focus:outline-none placeholder:text-white/20"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-white/50 block mb-1">Vertrek</label>
                    <div className="flex gap-2">
                      <input
                        type="time"
                        value={flightForm.outbound.departureTime}
                        onChange={(e) => setFlightForm(prev => ({ ...prev, outbound: { ...prev.outbound, departureTime: e.target.value } }))}
                        className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:border-sky-500/50 focus:outline-none"
                      />
                      <input
                        type="text"
                        value={flightForm.outbound.departureAirport}
                        onChange={(e) => setFlightForm(prev => ({ ...prev, outbound: { ...prev.outbound, departureAirport: e.target.value } }))}
                        className="w-16 px-2 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm text-center focus:border-sky-500/50 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-white/50 block mb-1">Aankomst</label>
                    <div className="flex gap-2">
                      <input
                        type="time"
                        value={flightForm.outbound.arrivalTime}
                        onChange={(e) => setFlightForm(prev => ({ ...prev, outbound: { ...prev.outbound, arrivalTime: e.target.value } }))}
                        className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:border-sky-500/50 focus:outline-none"
                      />
                      <input
                        type="text"
                        value={flightForm.outbound.arrivalAirport}
                        onChange={(e) => setFlightForm(prev => ({ ...prev, outbound: { ...prev.outbound, arrivalAirport: e.target.value } }))}
                        className="w-16 px-2 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm text-center focus:border-sky-500/50 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Return */}
              <div>
                <h4 className="text-sm font-medium text-orange-400 mb-3 flex items-center gap-2">
                  <span>🛬</span> Terugvlucht
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-white/50 block mb-1">Datum</label>
                    <input
                      type="date"
                      value={flightForm.return.date}
                      onChange={(e) => setFlightForm(prev => ({ ...prev, return: { ...prev.return, date: e.target.value } }))}
                      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:border-orange-500/50 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-white/50 block mb-1">Vluchtnummer</label>
                    <input
                      type="text"
                      value={flightForm.return.flightNumber}
                      onChange={(e) => setFlightForm(prev => ({ ...prev, return: { ...prev.return, flightNumber: e.target.value } }))}
                      placeholder="KL1235"
                      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:border-orange-500/50 focus:outline-none placeholder:text-white/20"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-white/50 block mb-1">Vertrek</label>
                    <div className="flex gap-2">
                      <input
                        type="time"
                        value={flightForm.return.departureTime}
                        onChange={(e) => setFlightForm(prev => ({ ...prev, return: { ...prev.return, departureTime: e.target.value } }))}
                        className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:border-orange-500/50 focus:outline-none"
                      />
                      <input
                        type="text"
                        value={flightForm.return.departureAirport}
                        onChange={(e) => setFlightForm(prev => ({ ...prev, return: { ...prev.return, departureAirport: e.target.value } }))}
                        className="w-16 px-2 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm text-center focus:border-orange-500/50 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-white/50 block mb-1">Aankomst</label>
                    <div className="flex gap-2">
                      <input
                        type="time"
                        value={flightForm.return.arrivalTime}
                        onChange={(e) => setFlightForm(prev => ({ ...prev, return: { ...prev.return, arrivalTime: e.target.value } }))}
                        className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:border-orange-500/50 focus:outline-none"
                      />
                      <input
                        type="text"
                        value={flightForm.return.arrivalAirport}
                        onChange={(e) => setFlightForm(prev => ({ ...prev, return: { ...prev.return, arrivalAirport: e.target.value } }))}
                        className="w-16 px-2 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm text-center focus:border-orange-500/50 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-white/10 flex justify-end gap-3">
              <button
                onClick={() => setShowFlightModal(false)}
                className="px-4 py-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
              >
                Annuleren
              </button>
              <button
                onClick={saveFlightInfo}
                disabled={isSavingFlight}
                className="px-6 py-2 rounded-lg bg-gradient-to-r from-sky-500 to-blue-500 text-white font-medium hover:from-sky-600 hover:to-blue-600 transition-colors disabled:opacity-50"
              >
                {isSavingFlight ? 'Opslaan...' : 'Opslaan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Program Modal */}
      {showProgramModal && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
          onClick={() => setShowProgramModal(false)}
        >
          <div
            className="absolute left-1/2 w-full max-w-lg bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl border border-white/10 shadow-2xl"
            style={{ top: '28%', transform: 'translateX(-50%)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-white/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">📅</span>
                  <h3 className="text-xl font-semibold text-white">Programma toevoegen</h3>
                </div>
                <button
                  onClick={() => setShowProgramModal(false)}
                  className="p-2 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                >
                  <Icons.x size={20} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-white/50 block mb-1">Datum</label>
                  <select
                    value={programForm.date}
                    onChange={(e) => setProgramForm(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:border-violet-500/50 focus:outline-none"
                  >
                    <option value="2026-09-30">Wo 30 sept - Aankomst</option>
                    <option value="2026-10-01">Do 1 okt</option>
                    <option value="2026-10-02">Vr 2 okt</option>
                    <option value="2026-10-03">Za 3 okt</option>
                    <option value="2026-10-04">Zo 4 okt - Vertrek</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-white/50 block mb-1">Tijd (optioneel)</label>
                  <input
                    type="time"
                    value={programForm.time}
                    onChange={(e) => setProgramForm(prev => ({ ...prev, time: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:border-violet-500/50 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-white/50 block mb-1">Activiteit</label>
                <input
                  type="text"
                  value={programForm.title}
                  onChange={(e) => setProgramForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Bijv. Gezamenlijk diner, Stranddag, Wijnproeverij..."
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:border-violet-500/50 focus:outline-none placeholder:text-white/20"
                />
              </div>

              <div>
                <label className="text-xs text-white/50 block mb-1">Beschrijving (optioneel)</label>
                <textarea
                  value={programForm.description}
                  onChange={(e) => setProgramForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Extra details..."
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:border-violet-500/50 focus:outline-none placeholder:text-white/20 resize-none"
                />
              </div>

              <div>
                <label className="text-xs text-white/50 block mb-2">Verantwoordelijk (optioneel)</label>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                  {teamMembers.map((member) => (
                    <button
                      key={member.id}
                      onClick={() => toggleResponsible(member.name)}
                      className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                        programForm.responsible.includes(member.name)
                          ? 'bg-violet-500/30 text-violet-300 border border-violet-500/50'
                          : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10'
                      }`}
                    >
                      {member.name}
                      {member.role === 'PARTNER' && <span className="ml-1 text-[10px] text-orange-400">●</span>}
                      {member.role === 'ADMIN' && <span className="ml-1 text-[10px] text-sky-400">●</span>}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-white/30 mt-2">
                  <span className="text-orange-400">●</span> Partner <span className="text-sky-400 ml-2">●</span> Admin
                </p>
              </div>
            </div>

            <div className="p-6 border-t border-white/10 flex justify-end gap-3">
              <button
                onClick={() => {
                  setProgramForm({ date: '2026-09-30', time: '', title: '', description: '', responsible: [] })
                  setShowProgramModal(false)
                }}
                className="px-4 py-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
              >
                Annuleren
              </button>
              <button
                onClick={saveProgramItem}
                disabled={!programForm.title.trim() || isSavingProgram}
                className="px-6 py-2 rounded-lg bg-gradient-to-r from-violet-500 to-purple-500 text-white font-medium hover:from-violet-600 hover:to-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSavingProgram ? 'Toevoegen...' : 'Toevoegen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hotspots Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3 group/hotspots">
            <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center group-hover/hotspots:scale-110 group-hover/hotspots:bg-orange-500/20 transition-all duration-300">
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
                <span className="hover:scale-125 transition-transform">{icons[cat]}</span>
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

      {/* Video Section */}
      <div className="card p-5 overflow-hidden group/video">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-pink-500/10 flex items-center justify-center group-hover/video:scale-110 group-hover/video:bg-pink-500/20 transition-all duration-300">
            <span className="text-lg">🎬</span>
          </div>
          <div>
            <h2 className="text-lg font-medium text-white">Een voorproefje van Mallorca</h2>
            <p className="text-xs text-white/40">Sfeerimpressie van het eiland</p>
          </div>
        </div>
        <div className="aspect-video rounded-xl overflow-hidden">
          <iframe
            src="https://www.youtube.com/embed/dzUpfYFFRVY?autoplay=1&mute=1&loop=1&playlist=dzUpfYFFRVY&controls=1&modestbranding=1&rel=0"
            title="Mallorca Video"
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      </div>

      {/* Packlist Section */}
      <div className="card p-5 group/packlist">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center group-hover/packlist:scale-110 group-hover/packlist:bg-purple-500/20 transition-all duration-300">
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
            onClick={async () => {
              setCheckedItems(new Set())
              try {
                await fetch('/api/lustrum/packlist', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ checkedItems: [] }),
                })
              } catch (error) {
                console.error('Error resetting packlist:', error)
              }
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
                <div className="flex items-center gap-2 mb-3 group/cat">
                  <span className="text-lg group-hover/cat:scale-125 transition-transform cursor-default">{icons[category]}</span>
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
      <div className="text-center py-8 group/footer">
        <p className="text-white/30 text-sm flex items-center justify-center gap-2">
          <span className="group-hover/footer:animate-bounce inline-block">🌴</span>
          <span>Tot op Mallorca!</span>
          <span className="group-hover/footer:animate-bounce inline-block" style={{ animationDelay: '0.1s' }}>🎉</span>
        </p>
      </div>
    </div>
  )
}
