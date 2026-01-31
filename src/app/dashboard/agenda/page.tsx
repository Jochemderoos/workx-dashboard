'use client'

import { useState, useEffect, useMemo } from 'react'
import toast from 'react-hot-toast'
import { Icons } from '@/components/ui/Icons'

interface CalendarEvent {
  id: string
  title: string
  description: string | null
  startTime: string
  endTime: string
  isAllDay: boolean
  location: string | null
  color: string
  category: 'GENERAL' | 'MEETING' | 'DEADLINE' | 'TRAINING' | 'SOCIAL' | 'HOLIDAY' | 'BIRTHDAY'
  createdBy: { id: string; name: string }
}

interface TeamMember {
  name: string
  birthDate: string // format: MM-DD
}

const categoryConfig = {
  GENERAL: { label: 'Algemeen', icon: Icons.calendar, color: '#f9ff85' },
  MEETING: { label: 'Vergadering', icon: Icons.users, color: '#60a5fa' },
  DEADLINE: { label: 'Deadline', icon: Icons.flag, color: '#f87171' },
  TRAINING: { label: 'Training', icon: Icons.award, color: '#a78bfa' },
  SOCIAL: { label: 'Sociaal', icon: Icons.coffee, color: '#34d399' },
  HOLIDAY: { label: 'Feestdag', icon: Icons.star, color: '#fbbf24' },
  BIRTHDAY: { label: 'Verjaardag', icon: Icons.star, color: '#ec4899' },
}

// Team verjaardagen - format: MM-DD
// Echte data uit loonstroken - medewerkers
// Partners verjaardagen zijn onbekend (niet in loonstroken)
const TEAM_BIRTHDAYS: TeamMember[] = [
  // Medewerkers (echte data uit loonstroken)
  { name: 'Hanna Blaauboer', birthDate: '12-23' },        // 23-12-1991
  { name: 'Justine Schellekens', birthDate: '06-29' },    // 29-6-1994
  { name: 'Marlieke Schipper', birthDate: '01-10' },      // 10-1-1992
  { name: 'Wies van Pesch', birthDate: '01-16' },         // 16-1-1991
  { name: 'Emma van der Vos', birthDate: '09-04' },       // 4-9-1992
  { name: 'Alain Heunen', birthDate: '04-03' },           // 3-4-1991
  { name: 'Kay Maes', birthDate: '01-24' },               // 24-1-1999
  { name: 'Erika van Zadelhof', birthDate: '06-23' },     // 23-6-1995
  { name: 'Heleen Pesser', birthDate: '07-14' },          // 14-7-1999
  { name: 'Barbara Rip', birthDate: '04-04' },            // 4-4-1996
  { name: 'Lotte van Sint Truiden', birthDate: '06-03' }, // 3-6-2002
  { name: 'Julia Groen', birthDate: '07-15' },            // 15-7-1992
  // Partners (verjaardag onbekend - niet in loonstroken)
  { name: 'Jochem de Roos', birthDate: '03-02' },         // Enige bekende partner verjaardag
]

export default function AgendaPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [showForm, setShowForm] = useState(false)
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState('')
  const [startTime, setStartTime] = useState('09:00')
  const [endDate, setEndDate] = useState('')
  const [endTime, setEndTime] = useState('10:00')
  const [isAllDay, setIsAllDay] = useState(false)
  const [location, setLocation] = useState('')
  const [category, setCategory] = useState<CalendarEvent['category']>('GENERAL')

  // Calculate next birthday
  const nextBirthday = useMemo(() => {
    const today = new Date()
    const currentYear = today.getFullYear()

    const upcomingBirthdays = TEAM_BIRTHDAYS
      .filter(m => m.birthDate) // Filter out members without birthday
      .map(member => {
        const [month, day] = member.birthDate.split('-').map(Number)
        let birthdayThisYear = new Date(currentYear, month - 1, day)

        // If birthday already passed this year, use next year
        if (birthdayThisYear < today) {
          birthdayThisYear = new Date(currentYear + 1, month - 1, day)
        }

        const daysUntil = Math.ceil((birthdayThisYear.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

        return { ...member, date: birthdayThisYear, daysUntil }
      }).sort((a, b) => a.daysUntil - b.daysUntil)

    return upcomingBirthdays[0]
  }, [])

  // Get birthdays for a specific date
  const getBirthdaysForDate = (date: Date) => {
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const dateStr = `${month}-${day}`
    return TEAM_BIRTHDAYS.filter(m => m.birthDate && m.birthDate === dateStr)
  }

  useEffect(() => { fetchEvents() }, [currentMonth])

  const fetchEvents = async () => {
    try {
      const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
      const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0)
      const res = await fetch(`/api/calendar?startDate=${startOfMonth.toISOString()}&endDate=${endOfMonth.toISOString()}`)
      if (res.ok) setEvents(await res.json())
    } catch (error) {
      // Demo mode - use empty array
      setEvents([])
    } finally {
      setIsLoading(false)
    }
  }

  const resetForm = () => {
    setTitle(''); setDescription(''); setStartDate(''); setStartTime('09:00')
    setEndDate(''); setEndTime('10:00'); setIsAllDay(false); setLocation('')
    setCategory('GENERAL'); setEditingEvent(null); setShowForm(false)
  }

  const handleAddEvent = (date?: Date) => {
    if (date) {
      const dateStr = date.toISOString().split('T')[0]
      setStartDate(dateStr)
      setEndDate(dateStr)
    }
    setShowForm(true)
  }

  const handleEdit = (event: CalendarEvent) => {
    setTitle(event.title)
    setDescription(event.description || '')
    setStartDate(event.startTime.split('T')[0])
    setStartTime(event.startTime.split('T')[1]?.substring(0, 5) || '09:00')
    setEndDate(event.endTime.split('T')[0])
    setEndTime(event.endTime.split('T')[1]?.substring(0, 5) || '10:00')
    setIsAllDay(event.isAllDay)
    setLocation(event.location || '')
    setCategory(event.category)
    setEditingEvent(event)
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title || !startDate || !endDate) return toast.error('Vul alle verplichte velden in')

    try {
      const startDateTime = isAllDay ? new Date(startDate + 'T00:00:00') : new Date(startDate + 'T' + startTime)
      const endDateTime = isAllDay ? new Date(endDate + 'T23:59:59') : new Date(endDate + 'T' + endTime)

      const res = await fetch(editingEvent ? `/api/calendar/${editingEvent.id}` : '/api/calendar', {
        method: editingEvent ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title, description: description || null, startTime: startDateTime.toISOString(),
          endTime: endDateTime.toISOString(), isAllDay, location: location || null,
          color: categoryConfig[category].color, category,
        }),
      })
      if (!res.ok) throw new Error()
      toast.success(editingEvent ? 'Event bijgewerkt' : 'Event aangemaakt')
      resetForm()
      fetchEvents()
    } catch (error) {
      toast.error('Kon event niet opslaan')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Event verwijderen?')) return
    try {
      await fetch(`/api/calendar/${id}`, { method: 'DELETE' })
      toast.success('Event verwijderd')
      fetchEvents()
      setSelectedDate(null)
    } catch (error) {
      toast.error('Kon event niet verwijderen')
    }
  }

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const days: { date: Date; isCurrentMonth: boolean }[] = []
    const startingDay = (firstDay.getDay() + 6) % 7 // Monday first

    for (let i = startingDay - 1; i >= 0; i--) {
      days.push({ date: new Date(year, month, -i), isCurrentMonth: false })
    }
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push({ date: new Date(year, month, i), isCurrentMonth: true })
    }
    while (days.length < 42) {
      days.push({ date: new Date(year, month + 1, days.length - lastDay.getDate() - startingDay + 1), isCurrentMonth: false })
    }
    return days
  }

  const getEventsForDate = (date: Date) => events.filter(event => {
    const eventStart = new Date(event.startTime)
    const eventEnd = new Date(event.endTime)
    const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59)
    return eventStart <= dayEnd && eventEnd >= dayStart
  })

  const formatTime = (dateStr: string) => new Date(dateStr).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
  const isToday = (date: Date) => date.toDateString() === new Date().toDateString()

  if (isLoading) {
    return (
      <div className="h-[calc(100vh-10rem)] flex items-center justify-center">
        <div className="text-center">
          <span className="w-8 h-8 border-2 border-workx-lime border-t-transparent rounded-full animate-spin inline-block mb-4" />
          <p className="text-white/40">Agenda laden...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/10 flex items-center justify-center">
              <Icons.calendar className="text-purple-400" size={20} />
            </div>
            <h1 className="text-2xl font-semibold text-white">Agenda</h1>
          </div>
          <p className="text-white/40">Gedeelde team kalender, events en verjaardagen</p>
        </div>
        <button onClick={() => handleAddEvent()} className="btn-primary flex items-center gap-2">
          <Icons.plus size={16} />
          Nieuw event
        </button>
      </div>

      {/* Next Birthday Card */}
      {nextBirthday && (
        <div className="card p-5 border-pink-500/20 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
          <div className="relative flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-pink-500/20 to-pink-600/10 flex items-center justify-center">
              <span className="text-2xl">🎂</span>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-white">Eerstvolgende verjaardag</h3>
                {nextBirthday.daysUntil === 0 && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-pink-500/20 text-pink-400 animate-pulse">
                    Vandaag!
                  </span>
                )}
                {nextBirthday.daysUntil === 1 && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-500/20 text-orange-400">
                    Morgen!
                  </span>
                )}
              </div>
              <p className="text-white/60">
                <span className="text-pink-400 font-medium">{nextBirthday.name}</span>
                {' '}is jarig op{' '}
                <span className="text-white">
                  {nextBirthday.date.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })}
                </span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-pink-400">{nextBirthday.daysUntil}</p>
              <p className="text-xs text-white/40">{nextBirthday.daysUntil === 1 ? 'dag' : 'dagen'}</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Calendar */}
        <div className="lg:col-span-3 card overflow-hidden relative">
          <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

          {/* Month navigation */}
          <div className="p-5 flex items-center justify-between border-b border-white/5 relative">
            <button
              onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
              className="p-2.5 text-white/40 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
            >
              <Icons.chevronLeft size={18} />
            </button>
            <div className="text-center">
              <h2 className="font-semibold text-white capitalize text-lg">
                {currentMonth.toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' })}
              </h2>
              <button
                onClick={() => setCurrentMonth(new Date())}
                className="text-xs text-workx-lime hover:underline mt-0.5"
              >
                Naar vandaag
              </button>
            </div>
            <button
              onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
              className="p-2.5 text-white/40 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
            >
              <Icons.chevronRight size={18} />
            </button>
          </div>

          {/* Calendar grid */}
          <div className="p-5">
            <div className="grid grid-cols-7 mb-3">
              {['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'].map((day) => (
                <div key={day} className="text-center text-xs text-white/40 py-2 font-medium">{day}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {getDaysInMonth(currentMonth).map((day, index) => {
                const dayEvents = getEventsForDate(day.date)
                const dayBirthdays = getBirthdaysForDate(day.date)
                const isSelected = selectedDate?.toDateString() === day.date.toDateString()
                const isWeekend = day.date.getDay() === 0 || day.date.getDay() === 6
                const hasBirthday = dayBirthdays.length > 0

                return (
                  <button
                    key={index}
                    onClick={() => setSelectedDate(day.date)}
                    className={`relative p-2 min-h-[90px] rounded-xl text-left transition-all ${
                      day.isCurrentMonth ? 'hover:bg-white/5' : 'opacity-30'
                    } ${isSelected ? 'bg-white/5 ring-1 ring-workx-lime/50 shadow-lg shadow-workx-lime/5' : ''} ${
                      isToday(day.date) ? 'bg-workx-lime/10 ring-1 ring-workx-lime/30' : ''
                    } ${isWeekend && day.isCurrentMonth && !isSelected && !isToday(day.date) ? 'bg-white/[0.02]' : ''} ${
                      hasBirthday && day.isCurrentMonth ? 'ring-1 ring-pink-500/30' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-sm font-medium ${
                        isToday(day.date) ? 'text-workx-lime' : day.isCurrentMonth ? 'text-white/60' : 'text-white/20'
                      }`}>
                        {day.date.getDate()}
                      </span>
                      {hasBirthday && day.isCurrentMonth && (
                        <span className="text-sm">🎂</span>
                      )}
                    </div>

                    <div className="mt-1.5 space-y-1">
                      {/* Show birthdays first */}
                      {dayBirthdays.map((person, i) => (
                        <div
                          key={`bday-${i}`}
                          className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md truncate font-medium bg-pink-500/20 text-pink-400"
                        >
                          <span>🎂</span>
                          <span className="truncate">{person.name.split(' ')[0]}</span>
                        </div>
                      ))}
                      {/* Then show events */}
                      {dayEvents.slice(0, dayBirthdays.length > 0 ? 1 : 2).map((event) => {
                        const IconComponent = categoryConfig[event.category]?.icon || Icons.calendar
                        return (
                          <div
                            key={event.id}
                            className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md truncate font-medium"
                            style={{ backgroundColor: event.color + '20', color: event.color }}
                          >
                            <IconComponent size={10} />
                            <span className="truncate">{event.title}</span>
                          </div>
                        )
                      })}
                      {(dayEvents.length + dayBirthdays.length) > 2 && (
                        <span className="text-[10px] text-white/40 pl-1 font-medium">+{dayEvents.length + dayBirthdays.length - 2} meer</span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Category legend */}
          <div className="px-5 pb-5 flex flex-wrap gap-4 border-t border-white/5 pt-4">
            {Object.entries(categoryConfig).map(([key, config]) => {
              const IconComponent = config.icon
              return (
                <div key={key} className="flex items-center gap-2 text-xs text-white/50">
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: config.color + '30' }}>
                    <div className="w-full h-full rounded flex items-center justify-center" style={{ backgroundColor: config.color + '20' }} />
                  </div>
                  <IconComponent size={12} style={{ color: config.color }} />
                  <span>{config.label}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Sidebar: Selected day events */}
        <div className="card p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-workx-lime/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

          <div className="relative">
            <h3 className="font-semibold text-white mb-1">
              {selectedDate
                ? selectedDate.toLocaleDateString('nl-NL', { weekday: 'long' })
                : 'Selecteer een dag'}
            </h3>
            {selectedDate && (
              <p className="text-sm text-white/40 mb-4">
                {selectedDate.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            )}

            {selectedDate ? (
              <div className="space-y-3">
                {/* Show birthdays for selected date */}
                {getBirthdaysForDate(selectedDate).map((person, i) => (
                  <div
                    key={`bday-sidebar-${i}`}
                    className="p-4 rounded-xl bg-gradient-to-r from-pink-500/10 to-pink-600/5 border border-pink-500/20"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-pink-500/20 flex items-center justify-center">
                        <span className="text-lg">🎂</span>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-pink-400">{person.name}</span>
                        <p className="text-xs text-white/40 mt-0.5">Verjaardag!</p>
                      </div>
                    </div>
                  </div>
                ))}

                {getEventsForDate(selectedDate).length === 0 && getBirthdaysForDate(selectedDate).length === 0 ? (
                  <div className="py-10 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-purple-500/10 flex items-center justify-center mx-auto mb-4">
                      <Icons.calendar className="text-purple-400/50" size={24} />
                    </div>
                    <p className="text-sm text-white/40 mb-4">Geen events op deze dag</p>
                    <button
                      onClick={() => handleAddEvent(selectedDate)}
                      className="btn-primary text-sm py-2 px-4 inline-flex items-center gap-2"
                    >
                      <Icons.plus size={14} />
                      Event toevoegen
                    </button>
                  </div>
                ) : (
                  <>
                    {getEventsForDate(selectedDate).map((event, index) => {
                      const IconComponent = categoryConfig[event.category]?.icon || Icons.calendar
                      return (
                        <div
                          key={event.id}
                          onClick={() => handleEdit(event)}
                          className="p-4 rounded-xl bg-white/5 hover:bg-white/10 cursor-pointer transition-all group border border-white/5 hover:border-white/10"
                          style={{ animationDelay: `${index * 50}ms` }}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <div
                                className="w-10 h-10 rounded-xl flex items-center justify-center"
                                style={{ backgroundColor: event.color + '20' }}
                              >
                                <IconComponent size={18} style={{ color: event.color }} />
                              </div>
                              <div>
                                <span className="text-sm font-medium text-white group-hover:text-workx-lime transition-colors">
                                  {event.title}
                                </span>
                                <p className="text-xs text-white/30 mt-0.5">{categoryConfig[event.category].label}</p>
                              </div>
                            </div>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDelete(event.id) }}
                              className="p-1.5 text-white/20 hover:text-red-400 hover:bg-red-400/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                            >
                              <Icons.trash size={14} />
                            </button>
                          </div>
                          <div className="mt-3 pt-3 border-t border-white/5 flex flex-wrap gap-3">
                            {!event.isAllDay ? (
                              <p className="text-xs text-white/50 flex items-center gap-1.5">
                                <Icons.clock size={12} />
                                {formatTime(event.startTime)} - {formatTime(event.endTime)}
                              </p>
                            ) : (
                              <p className="text-xs text-white/50 flex items-center gap-1.5">
                                <Icons.sun size={12} />
                                Hele dag
                              </p>
                            )}
                            {event.location && (
                              <p className="text-xs text-white/50 flex items-center gap-1.5">
                                <Icons.mapPin size={12} />
                                {event.location}
                              </p>
                            )}
                          </div>
                        </div>
                      )
                    })}
                    <button
                      onClick={() => handleAddEvent(selectedDate)}
                      className="w-full p-3 rounded-xl border border-dashed border-white/10 text-sm text-white/40 hover:text-white hover:border-white/20 hover:bg-white/5 transition-all flex items-center justify-center gap-2"
                    >
                      <Icons.plus size={14} />
                      Event toevoegen
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div className="py-12 text-center">
                <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
                  <Icons.calendar className="text-white/20" size={24} />
                </div>
                <p className="text-sm text-white/40">Klik op een dag in de kalender</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Event form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={resetForm}>
          <div
            className="bg-workx-gray rounded-2xl p-6 w-full max-w-lg border border-white/10 shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                  <Icons.calendar className="text-purple-400" size={18} />
                </div>
                <h2 className="font-semibold text-white text-lg">{editingEvent ? 'Event bewerken' : 'Nieuw event'}</h2>
              </div>
              <button
                onClick={resetForm}
                className="p-2 text-white/40 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
              >
                <Icons.x size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm text-white/60 mb-2">Titel</label>
                <div className="relative">
                  <Icons.edit className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={16} />
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Event naam"
                    className="input-field pl-10"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-white/60 mb-2">Categorie</label>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(categoryConfig).map(([key, config]) => {
                    const IconComponent = config.icon
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setCategory(key as CalendarEvent['category'])}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-all text-sm ${
                          category === key
                            ? 'border-workx-lime bg-workx-lime/10 text-white'
                            : 'border-white/10 text-white/40 hover:border-white/20 hover:bg-white/5'
                        }`}
                      >
                        <IconComponent size={14} style={{ color: category === key ? config.color : undefined }} />
                        <span className="truncate">{config.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <label className="flex items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/5 cursor-pointer hover:border-white/10 transition-colors">
                <input
                  type="checkbox"
                  checked={isAllDay}
                  onChange={(e) => setIsAllDay(e.target.checked)}
                  className="w-5 h-5 rounded-lg accent-workx-lime"
                />
                <div>
                  <span className="text-white text-sm font-medium">Hele dag</span>
                  <p className="text-xs text-white/40 mt-0.5">Event duurt de hele dag</p>
                </div>
              </label>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-white/60 mb-2">Startdatum</label>
                  <div className="relative">
                    <Icons.calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={16} />
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => { setStartDate(e.target.value); if (!endDate) setEndDate(e.target.value) }}
                      className="input-field pl-10"
                      required
                    />
                  </div>
                </div>
                {!isAllDay && (
                  <div>
                    <label className="block text-sm text-white/60 mb-2">Starttijd</label>
                    <div className="relative">
                      <Icons.clock className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={16} />
                      <input
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="input-field pl-10"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-white/60 mb-2">Einddatum</label>
                  <div className="relative">
                    <Icons.calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={16} />
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      min={startDate}
                      className="input-field pl-10"
                      required
                    />
                  </div>
                </div>
                {!isAllDay && (
                  <div>
                    <label className="block text-sm text-white/60 mb-2">Eindtijd</label>
                    <div className="relative">
                      <Icons.clock className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={16} />
                      <input
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        className="input-field pl-10"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm text-white/60 mb-2">Locatie</label>
                <div className="relative">
                  <Icons.mapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={16} />
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Vergaderruimte, kantoor, online..."
                    className="input-field pl-10"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-white/60 mb-2">Beschrijving</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Details en notities..."
                  className="input-field resize-none"
                  rows={3}
                />
              </div>

              <div className="flex gap-3 pt-3">
                <button type="button" onClick={resetForm} className="flex-1 btn-secondary">
                  Annuleren
                </button>
                {editingEvent && (
                  <button
                    type="button"
                    onClick={() => handleDelete(editingEvent.id)}
                    className="px-4 py-2.5 text-red-400 hover:bg-red-400/10 rounded-xl transition-colors"
                  >
                    <Icons.trash size={16} />
                  </button>
                )}
                <button type="submit" className="flex-1 btn-primary flex items-center justify-center gap-2">
                  <Icons.check size={16} />
                  {editingEvent ? 'Bijwerken' : 'Aanmaken'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
