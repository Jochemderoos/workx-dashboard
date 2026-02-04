'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import * as Popover from '@radix-ui/react-popover'
import { Icons } from '@/components/ui/Icons'
import DatePicker from '@/components/ui/DatePicker'
import TimePicker from '@/components/ui/TimePicker'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { formatDateForAPI, formatDateTimeForAPI } from '@/lib/date-utils'

interface CalendarEvent {
  id: string
  title: string
  description: string | null
  startTime: string
  endTime: string
  isAllDay: boolean
  location: string | null
  color: string
  category: 'GENERAL' | 'MEETING' | 'DEADLINE' | 'TRAINING' | 'SOCIAL'
  createdBy: { id: string; name: string }
}

interface TeamMember {
  name: string
  birthDate: string | null // format: MM-DD
}

// Vergaderruimte op kantoor
const MEETING_ROOM = { id: 'vergaderruimte', name: 'Vergaderruimte', capacity: 8, icon: '🏢' }

// Helper to check if event is a room booking
const isRoomBooking = (event: CalendarEvent) => {
  return event.location?.toLowerCase().includes('vergaderruimte') ||
         event.location?.toLowerCase().includes(MEETING_ROOM.id)
}

// Format room booking display
const formatRoomBookingTitle = (event: CalendarEvent, short = false) => {
  if (!isRoomBooking(event)) return event.title
  const creatorName = event.createdBy?.name?.split(' ')[0] || 'Onbekend' // Only first name
  if (short) return `🔔 VR: ${creatorName}`
  return `🔔 Vergaderruimte gereserveerd - ${creatorName}`
}

// View type for agenda
type AgendaView = 'month' | 'week' | 'day'

const categoryConfig = {
  GENERAL: { label: 'Algemeen', icon: Icons.calendar, color: '#f9ff85' },
  MEETING: { label: 'Vergadering', icon: Icons.users, color: '#60a5fa' },
  DEADLINE: { label: 'Deadline', icon: Icons.flag, color: '#f87171' },
  TRAINING: { label: 'Training', icon: Icons.award, color: '#a78bfa' },
  SOCIAL: { label: 'Sociaal', icon: Icons.coffee, color: '#34d399' },
}

export default function AgendaPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [teamBirthdays, setTeamBirthdays] = useState<TeamMember[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [currentView, setCurrentView] = useState<AgendaView>('month')
  const [showForm, setShowForm] = useState(false)
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date())

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState<Date | null>(null)
  const [startTime, setStartTime] = useState('09:00')
  const [endDate, setEndDate] = useState<Date | null>(null)
  const [endTime, setEndTime] = useState('10:00')
  const [isAllDay, setIsAllDay] = useState(false)

  const [location, setLocation] = useState('')
  const [category, setCategory] = useState<CalendarEvent['category']>('GENERAL')

  // Delete confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [eventToDelete, setEventToDelete] = useState<string | null>(null)

  // Day detail modal state (for week/month view on mobile and desktop)
  const [showDayModal, setShowDayModal] = useState(false)

  // Modal positioning - capture click Y to position modal at click height
  const [modalClickY, setModalClickY] = useState<number | undefined>(undefined)

  // Handle day click - open modal for week/month view
  const handleDayClick = (date: Date, e?: React.MouseEvent) => {
    setSelectedDate(date)
    if (e) setModalClickY(e.clientY)
    if (currentView !== 'day') {
      setShowDayModal(true)
    }
  }

  // Fetch birthdays from database
  useEffect(() => {
    fetch('/api/birthdays')
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        // Transform birthDate from ISO format to MM-DD format
        const transformed = data.map((u: any) => ({
          ...u,
          birthDate: u.birthDate
            ? `${String(new Date(u.birthDate).getMonth() + 1).padStart(2, '0')}-${String(new Date(u.birthDate).getDate()).padStart(2, '0')}`
            : null
        }))
        setTeamBirthdays(transformed)
      })
      .catch(() => setTeamBirthdays([]))
  }, [])

  // Calculate next birthday
  const nextBirthday = useMemo(() => {
    if (teamBirthdays.length === 0) return null

    const today = new Date()
    const currentYear = today.getFullYear()

    const upcomingBirthdays = teamBirthdays
      .filter(m => m.birthDate) // Filter out members without birthday
      .map(member => {
        const [month, day] = member.birthDate!.split('-').map(Number)
        let birthdayThisYear = new Date(currentYear, month - 1, day)

        // If birthday already passed this year, use next year
        if (birthdayThisYear < today) {
          birthdayThisYear = new Date(currentYear + 1, month - 1, day)
        }

        const daysUntil = Math.ceil((birthdayThisYear.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

        return { ...member, date: birthdayThisYear, daysUntil }
      }).sort((a, b) => a.daysUntil - b.daysUntil)

    return upcomingBirthdays[0] || null
  }, [teamBirthdays])

  // Check if meeting room is occupied at selected time
  const roomAvailability = useMemo(() => {
    if (!startDate || isAllDay) return { ...MEETING_ROOM, available: true, conflictEvent: null as string | null }

    const checkStart = new Date(formatDateForAPI(startDate) + 'T' + startTime)
    const checkEnd = new Date(formatDateForAPI(endDate || startDate) + 'T' + endTime)

    // Find conflicting events for the meeting room
    const conflict = events.find(event => {
      if (editingEvent && event.id === editingEvent.id) return false // Ignore self when editing
      if (!event.location?.toLowerCase().includes(MEETING_ROOM.name.toLowerCase()) &&
          !event.location?.toLowerCase().includes(MEETING_ROOM.id)) return false

      const eventStart = new Date(event.startTime)
      const eventEnd = new Date(event.endTime)

      // Check overlap
      return checkStart < eventEnd && checkEnd > eventStart
    })

    return {
      ...MEETING_ROOM,
      available: !conflict,
      conflictEvent: conflict?.title || null
    }
  }, [events, startDate, startTime, endDate, endTime, isAllDay, editingEvent])

  // Get all room bookings for current month (for overview)
  const roomBookingsThisMonth = useMemo(() => {
    return events.filter(event =>
      event.location?.toLowerCase().includes(MEETING_ROOM.name.toLowerCase()) ||
      event.location?.toLowerCase().includes(MEETING_ROOM.id)
    )
  }, [events])

  // Get birthdays for a specific date
  const getBirthdaysForDate = (date: Date) => {
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const dateStr = `${month}-${day}`
    return teamBirthdays.filter(m => m.birthDate && m.birthDate === dateStr)
  }

  useEffect(() => { fetchEvents() }, [currentMonth])

  const fetchEvents = async () => {
    try {
      const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
      const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0)
      // Fetch calendar events (vacations are handled separately in Vakantie&Verlof)
      const res = await fetch(`/api/calendar?startDate=${formatDateForAPI(startOfMonth)}&endDate=${formatDateForAPI(endOfMonth)}`)
      if (res.ok) setEvents(await res.json())
    } catch (error) {
      // Demo mode - use empty array
      setEvents([])
    } finally {
      setIsLoading(false)
    }
  }

  const resetForm = () => {
    setTitle(''); setDescription(''); setStartDate(null); setStartTime('09:00')
    setEndDate(null); setEndTime('10:00'); setIsAllDay(false); setLocation('')
    setCategory('GENERAL'); setEditingEvent(null); setShowForm(false); setModalClickY(undefined)
  }

  const handleAddEvent = (date?: Date, e?: React.MouseEvent) => {
    if (date) {
      setStartDate(date)
      setEndDate(date)
    }
    if (e) setModalClickY(e.clientY)
    setShowForm(true)
  }

  const handleBookRoom = (date?: Date) => {
    if (date) {
      setStartDate(date)
      setEndDate(date)
    }
    setCategory('MEETING')
    setLocation(MEETING_ROOM.name)
    setTitle('Vergadering: ')
    setShowForm(true)
  }

  const handleEdit = (event: CalendarEvent) => {
    setTitle(event.title)
    setDescription(event.description || '')
    setStartDate(new Date(event.startTime))
    setStartTime(event.startTime.split('T')[1]?.substring(0, 5) || '09:00')
    setEndDate(new Date(event.endTime))
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
      const startDateStr = formatDateForAPI(startDate)
      const endDateStr = formatDateForAPI(endDate)

      const startDateTime = isAllDay ? new Date(startDateStr + 'T00:00:00') : new Date(startDateStr + 'T' + startTime)
      const endDateTime = isAllDay ? new Date(endDateStr + 'T23:59:59') : new Date(endDateStr + 'T' + endTime)

      const res = await fetch(editingEvent ? `/api/calendar/${editingEvent.id}` : '/api/calendar', {
        method: editingEvent ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title, description: description || null, startTime: formatDateTimeForAPI(startDateTime),
          endTime: formatDateTimeForAPI(endDateTime), isAllDay, location: location || null,
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

  const handleDeleteClick = (id: string) => {
    setEventToDelete(id)
    setShowDeleteConfirm(true)
  }

  const handleDeleteConfirm = async () => {
    if (!eventToDelete) return
    try {
      await fetch(`/api/calendar/${eventToDelete}`, { method: 'DELETE' })
      toast.success('Event verwijderd')
      fetchEvents()
      setSelectedDate(null)
    } catch (error) {
      toast.error('Kon event niet verwijderen')
    } finally {
      setShowDeleteConfirm(false)
      setEventToDelete(null)
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
          <p className="text-gray-400">Agenda laden...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 sm:gap-3 mb-1 sm:mb-2">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/10 flex items-center justify-center">
              <Icons.calendar className="text-purple-400" size={18} />
            </div>
            <h1 className="text-xl sm:text-2xl font-semibold text-white">Agenda</h1>
          </div>
          <p className="text-gray-400 text-sm sm:text-base hidden sm:block">Gedeelde team kalender, events en verjaardagen</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={(e) => { setModalClickY(e.clientY); handleBookRoom() }} className="btn-secondary flex items-center gap-1.5 sm:gap-2 text-sm sm:text-base px-2.5 sm:px-4 py-2 sm:py-2.5">
            <span className="text-sm sm:text-base">🏢</span>
            <span className="hidden xs:inline">Vergaderruimte</span>
          </button>
          <button onClick={(e) => { setModalClickY(e.clientY); handleAddEvent() }} className="btn-primary flex items-center gap-1.5 sm:gap-2 text-sm sm:text-base px-2.5 sm:px-4 py-2 sm:py-2.5">
            <Icons.plus size={14} className="sm:w-4 sm:h-4" />
            <span className="hidden xs:inline">Nieuw</span>
          </button>
        </div>
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
              <p className="text-gray-400">
                <span className="text-pink-400 font-medium">{nextBirthday.name}</span>
                {' '}is jarig op{' '}
                <span className="text-white">
                  {nextBirthday.date.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })}
                </span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-pink-400">{nextBirthday.daysUntil}</p>
              <p className="text-xs text-gray-400">{nextBirthday.daysUntil === 1 ? 'dag' : 'dagen'}</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Calendar */}
        <div className="lg:col-span-3 card overflow-hidden relative">
          <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

          {/* Navigation and view toggle */}
          <div className="p-4 sm:p-5 border-b border-white/5 relative bg-gradient-to-r from-white/[0.02] to-transparent">
            {/* Top row: Navigation and View toggle */}
            <div className="flex items-center justify-between gap-2">
              {/* Navigation controls */}
              <div className="flex items-center gap-1.5 sm:gap-2">
                <button
                  onClick={() => {
                    if (currentView === 'month') setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))
                    else if (currentView === 'week') setSelectedDate(new Date((selectedDate || new Date()).getTime() - 7 * 24 * 60 * 60 * 1000))
                    else setSelectedDate(new Date((selectedDate || new Date()).getTime() - 24 * 60 * 60 * 1000))
                  }}
                  className="p-2 sm:p-2.5 text-white/50 hover:text-white hover:bg-white/[0.08] rounded-xl transition-all hover:scale-105"
                >
                  <Icons.chevronLeft size={18} />
                </button>
                <button
                  onClick={() => {
                    setSelectedDate(new Date())
                    setCurrentMonth(new Date())
                  }}
                  className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-workx-lime hover:bg-workx-lime/15 border border-workx-lime/30 rounded-xl transition-all hover:scale-105"
                >
                  Vandaag
                </button>
                <button
                  onClick={() => {
                    if (currentView === 'month') setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))
                    else if (currentView === 'week') setSelectedDate(new Date((selectedDate || new Date()).getTime() + 7 * 24 * 60 * 60 * 1000))
                    else setSelectedDate(new Date((selectedDate || new Date()).getTime() + 24 * 60 * 60 * 1000))
                  }}
                  className="p-2 sm:p-2.5 text-white/50 hover:text-white hover:bg-white/[0.08] rounded-xl transition-all hover:scale-105"
                >
                  <Icons.chevronRight size={18} />
                </button>
              </div>

              {/* Month/Week/Day title */}
              <h2 className="hidden sm:block font-semibold text-white capitalize text-lg">
                {currentView === 'day' && selectedDate?.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })}
                {currentView === 'week' && `Week ${Math.ceil(((selectedDate || new Date()).getDate()) / 7)} · ${(selectedDate || new Date()).toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' })}`}
                {currentView === 'month' && currentMonth.toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' })}
              </h2>

              {/* View toggle */}
              <div className="flex items-center bg-white/5 backdrop-blur-sm rounded-xl p-1 border border-white/5">
                {[
                  { id: 'day' as AgendaView, label: 'Dag', icon: Icons.sun },
                  { id: 'week' as AgendaView, label: 'Week', icon: Icons.grid },
                  { id: 'month' as AgendaView, label: 'Maand', icon: Icons.calendar },
                ].map((view) => (
                  <button
                    key={view.id}
                    onClick={() => setCurrentView(view.id)}
                    className={`px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg transition-all duration-200 flex items-center gap-1.5 ${
                      currentView === view.id
                        ? 'bg-gradient-to-r from-workx-lime to-[#d4d96e] text-black font-semibold shadow-lg shadow-workx-lime/20'
                        : 'text-white/50 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <view.icon size={14} className="hidden sm:block" />
                    {view.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Mobile title */}
            <h2 className="sm:hidden font-semibold text-white capitalize text-base text-center mt-3">
              {currentView === 'day' && selectedDate?.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' })}
              {currentView === 'week' && `Week ${Math.ceil(((selectedDate || new Date()).getDate()) / 7)} · ${(selectedDate || new Date()).toLocaleDateString('nl-NL', { month: 'short' })}`}
              {currentView === 'month' && currentMonth.toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' })}
            </h2>
          </div>

          {/* DAY VIEW */}
          {currentView === 'day' && selectedDate && (
            <div className="p-4 sm:p-5">
              {/* Day header with full date */}
              <div className="flex items-center justify-between mb-5 pb-4 border-b border-white/5">
                <div>
                  <h3 className="text-lg font-semibold text-white capitalize">
                    {selectedDate.toLocaleDateString('nl-NL', { weekday: 'long' })}
                  </h3>
                  <p className="text-sm text-white/50">
                    {selectedDate.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </div>
                {isToday(selectedDate) && (
                  <span className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-workx-lime/20 to-workx-lime/10 text-workx-lime border border-workx-lime/20">
                    Vandaag
                  </span>
                )}
              </div>

              {/* Time slots */}
              <div className="space-y-0 rounded-xl overflow-hidden border border-white/5">
                {Array.from({ length: 12 }, (_, i) => i + 8).map((hour, idx) => {
                  const hourEvents = getEventsForDate(selectedDate).filter(event => {
                    if (event.isAllDay) return hour === 8
                    const eventHour = new Date(event.startTime).getHours()
                    return eventHour === hour
                  })
                  const isCurrentHour = isToday(selectedDate) && new Date().getHours() === hour
                  return (
                    <div
                      key={hour}
                      className={`flex gap-4 min-h-[60px] ${idx > 0 ? 'border-t border-white/5' : ''} ${
                        isCurrentHour ? 'bg-workx-lime/[0.03]' : ''
                      }`}
                    >
                      <div className={`w-16 text-right text-sm pt-2 pr-3 font-medium ${
                        isCurrentHour ? 'text-workx-lime' : 'text-white/40'
                      }`}>
                        {hour}:00
                      </div>
                      <div className="flex-1 pt-2 pb-2 pr-3 space-y-2">
                        {hourEvents.map((event) => {
                          const IconComponent = categoryConfig[event.category]?.icon || Icons.calendar
                          return (
                            <div
                              key={event.id}
                              onClick={() => handleEdit(event)}
                              className="p-3 rounded-xl cursor-pointer hover:scale-[1.01] transition-all border group"
                              style={{
                                backgroundColor: event.color + '15',
                                borderColor: event.color + '30',
                                borderLeftWidth: '3px',
                                borderLeftColor: event.color
                              }}
                            >
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-7 h-7 rounded-lg flex items-center justify-center"
                                  style={{ backgroundColor: event.color + '25' }}
                                >
                                  <IconComponent size={14} style={{ color: event.color }} />
                                </div>
                                <span className="font-semibold text-white group-hover:text-workx-lime transition-colors">
                                  {isRoomBooking(event) ? formatRoomBookingTitle(event) : event.title}
                                </span>
                              </div>
                              {!event.isAllDay && (
                                <p className="text-xs text-white/50 mt-2 flex items-center gap-2">
                                  <Icons.clock size={12} />
                                  {formatTime(event.startTime)} - {formatTime(event.endTime)}
                                  {event.location && (
                                    <>
                                      <span className="text-white/20">·</span>
                                      <Icons.mapPin size={12} />
                                      {event.location}
                                    </>
                                  )}
                                </p>
                              )}
                              {event.isAllDay && (
                                <p className="text-xs text-white/50 mt-2 flex items-center gap-2">
                                  <Icons.sun size={12} />
                                  Hele dag
                                </p>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* WEEK VIEW */}
          {currentView === 'week' && selectedDate && (
            <div className="p-4 sm:p-5">
              {/* Week header */}
              <div className="grid grid-cols-8 mb-4 gap-1">
                <div className="text-[11px] text-white/40 py-2 font-semibold uppercase"></div>
                {Array.from({ length: 7 }, (_, i) => {
                  const day = new Date(selectedDate)
                  const dayOfWeek = day.getDay()
                  const diff = i - ((dayOfWeek + 6) % 7) // Adjust to start from Monday
                  day.setDate(day.getDate() + diff)
                  const clickDate = new Date(day) // Create new date instance for closure
                  const isTodayDay = isToday(day)
                  const isWeekendDay = day.getDay() === 0 || day.getDay() === 6
                  return (
                    <button
                      key={i}
                      onClick={(e) => handleDayClick(clickDate, e)}
                      className={`text-center py-2 px-1 rounded-xl transition-all duration-200 hover:bg-white/[0.08] hover:scale-105 ${
                        isTodayDay ? 'bg-gradient-to-br from-workx-lime/15 to-workx-lime/5' : ''
                      } ${isWeekendDay && !isTodayDay ? 'bg-white/[0.02]' : ''}`}
                    >
                      <div className={`text-[11px] font-semibold uppercase tracking-wide mb-1 ${
                        isTodayDay ? 'text-workx-lime' : 'text-white/40'
                      }`}>
                        {['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'][i]}
                      </div>
                      <div className={`text-lg font-bold transition-all ${
                        isTodayDay
                          ? 'bg-gradient-to-br from-workx-lime to-[#d4d96e] text-black w-9 h-9 rounded-xl flex items-center justify-center mx-auto shadow-lg shadow-workx-lime/30'
                          : 'text-white/80'
                      }`}>
                        {day.getDate()}
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* Time grid */}
              <div className="rounded-xl overflow-hidden border border-white/5">
                {Array.from({ length: 10 }, (_, i) => i + 8).map((hour, idx) => (
                  <div key={hour} className={`grid grid-cols-8 min-h-[52px] ${idx > 0 ? 'border-t border-white/5' : ''}`}>
                    <div className="text-[11px] text-white/40 pr-3 text-right pt-2 font-medium">{hour}:00</div>
                    {Array.from({ length: 7 }, (_, dayIndex) => {
                      const day = new Date(selectedDate)
                      const dayOfWeek = day.getDay()
                      const diff = dayIndex - ((dayOfWeek + 6) % 7)
                      day.setDate(day.getDate() + diff)
                      const isTodayDay = isToday(day)
                      const isWeekendDay = day.getDay() === 0 || day.getDay() === 6

                      const hourEvents = getEventsForDate(day).filter(event => {
                        if (event.isAllDay) return hour === 8
                        const eventHour = new Date(event.startTime).getHours()
                        return eventHour === hour
                      })

                      return (
                        <div
                          key={dayIndex}
                          className={`border-l border-white/5 px-1 py-1 ${
                            isTodayDay ? 'bg-workx-lime/[0.03]' : isWeekendDay ? 'bg-white/[0.01]' : ''
                          }`}
                        >
                          {hourEvents.map((event) => (
                            <div
                              key={event.id}
                              onClick={() => handleEdit(event)}
                              className="text-[11px] p-1.5 rounded-lg cursor-pointer hover:scale-[1.02] transition-all mb-1 border"
                              style={{
                                backgroundColor: event.color + '25',
                                color: event.color,
                                borderColor: event.color + '30'
                              }}
                            >
                              <span className="font-semibold truncate block">
                                {isRoomBooking(event) ? `🔔 ${event.createdBy?.name?.split(' ')[0]}` : event.title}
                              </span>
                              {!event.isAllDay && (
                                <span className="text-white/50 text-[10px]">{formatTime(event.startTime)}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* MONTH VIEW (modern calendar grid) */}
          {currentView === 'month' && (
            <div className="p-4 sm:p-5">
              {/* Day names header */}
              <div className="grid grid-cols-7 mb-2">
                {['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'].map((day) => (
                  <div key={day} className="text-center text-[11px] text-white/40 py-2 font-semibold uppercase tracking-wider">{day}</div>
                ))}
              </div>

              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-1.5">
                {getDaysInMonth(currentMonth).map((day, index) => {
                  const dayEvents = getEventsForDate(day.date)
                  const dayBirthdays = getBirthdaysForDate(day.date)
                  const isSelected = selectedDate?.toDateString() === day.date.toDateString()
                  const isWeekend = day.date.getDay() === 0 || day.date.getDay() === 6
                  const hasBirthday = dayBirthdays.length > 0
                  const isPopoverOpen = showDayModal && selectedDate?.toDateString() === day.date.toDateString()
                  const hasContent = dayEvents.length > 0 || hasBirthday

                  return (
                    <Popover.Root
                      key={index}
                      open={isPopoverOpen}
                      onOpenChange={(open) => {
                        if (open) {
                          setSelectedDate(day.date)
                          setShowDayModal(true)
                        } else {
                          setShowDayModal(false)
                        }
                      }}
                    >
                      <Popover.Trigger asChild>
                        <button
                          className={`relative p-2 min-h-[100px] rounded-xl text-left transition-all duration-200 group ${
                            day.isCurrentMonth
                              ? 'hover:bg-white/[0.08] hover:scale-[1.02] hover:shadow-lg hover:shadow-black/20'
                              : 'opacity-30'
                          } ${isSelected
                              ? 'bg-workx-lime/10 ring-1 ring-workx-lime/50 shadow-lg shadow-workx-lime/10'
                              : ''
                          } ${isToday(day.date)
                              ? 'bg-gradient-to-br from-workx-lime/15 to-workx-lime/5 ring-1 ring-workx-lime/40'
                              : ''
                          } ${isWeekend && day.isCurrentMonth && !isSelected && !isToday(day.date)
                              ? 'bg-white/[0.02]'
                              : ''
                          } ${hasBirthday && day.isCurrentMonth && !isToday(day.date) && !isSelected
                              ? 'ring-1 ring-pink-500/30 bg-pink-500/[0.03]'
                              : ''
                          }`}
                        >
                          {/* Day number and birthday icon */}
                          <div className="flex items-center justify-between mb-1.5">
                            <span className={`text-sm font-semibold transition-colors ${
                              isToday(day.date)
                                ? 'text-workx-lime'
                                : day.isCurrentMonth
                                  ? 'text-white/80 group-hover:text-white'
                                  : 'text-white/20'
                            }`}>
                              {day.date.getDate()}
                            </span>
                            {hasBirthday && day.isCurrentMonth && (
                              <span className="text-sm animate-bounce">🎂</span>
                            )}
                          </div>

                          {/* Events and birthdays */}
                          <div className="space-y-1">
                            {/* Show birthdays first */}
                            {dayBirthdays.map((person, i) => (
                              <div
                                key={`bday-${i}`}
                                className="flex items-center gap-1 text-[10px] px-1.5 py-1 rounded-lg truncate font-medium bg-gradient-to-r from-pink-500/25 to-pink-600/15 text-pink-300 border border-pink-500/20"
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
                                  className="flex items-center gap-1 text-[10px] px-1.5 py-1 rounded-lg truncate font-medium border transition-all group-hover:scale-[1.02]"
                                  style={{
                                    backgroundColor: event.color + '20',
                                    color: event.color,
                                    borderColor: event.color + '30'
                                  }}
                                >
                                  <IconComponent size={10} className="flex-shrink-0" />
                                  <span className="truncate">{isRoomBooking(event) ? formatRoomBookingTitle(event, true) : event.title}</span>
                                </div>
                              )
                            })}
                            {(dayEvents.length + dayBirthdays.length) > 2 && (
                              <span className="text-[10px] text-white/40 pl-1 font-medium">+{dayEvents.length + dayBirthdays.length - 2} meer</span>
                            )}
                          </div>

                          {/* Hover indicator dot for days with content */}
                          {hasContent && day.isCurrentMonth && (
                            <div className="absolute bottom-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-workx-lime/40 opacity-0 group-hover:opacity-100 transition-opacity" />
                          )}
                        </button>
                      </Popover.Trigger>

                      <Popover.Portal>
                        <Popover.Content
                          className="w-[320px] sm:w-[380px] bg-workx-gray rounded-2xl border border-white/10 shadow-2xl max-h-[70vh] overflow-hidden flex flex-col z-50 animate-modal-in"
                          sideOffset={8}
                          collisionPadding={16}
                          side="bottom"
                          align="center"
                        >
                          {/* Header */}
                          <div className="p-4 border-b border-white/5 flex items-center justify-between">
                            <div>
                              <h2 className="font-semibold text-white text-base capitalize">
                                {day.date.toLocaleDateString('nl-NL', { weekday: 'long' })}
                              </h2>
                              <p className="text-sm text-gray-400">
                                {day.date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' })}
                              </p>
                            </div>
                            <Popover.Close className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
                              <Icons.x size={18} />
                            </Popover.Close>
                          </div>

                          {/* Content */}
                          <div className="p-4 overflow-y-auto flex-1 space-y-2">
                            {/* Birthdays */}
                            {dayBirthdays.map((person, i) => (
                              <div
                                key={`popover-bday-${i}`}
                                className="p-3 rounded-xl bg-gradient-to-r from-pink-500/10 to-pink-600/5 border border-pink-500/20"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-lg bg-pink-500/20 flex items-center justify-center">
                                    <span className="text-base">🎂</span>
                                  </div>
                                  <div>
                                    <span className="text-sm font-medium text-pink-400">{person.name}</span>
                                    <p className="text-xs text-gray-400">Verjaardag!</p>
                                  </div>
                                </div>
                              </div>
                            ))}

                            {/* Events */}
                            {dayEvents.length === 0 && dayBirthdays.length === 0 ? (
                              <div className="py-6 text-center">
                                <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center mx-auto mb-3">
                                  <Icons.calendar className="text-purple-400/50" size={20} />
                                </div>
                                <p className="text-sm text-gray-400">Geen events</p>
                              </div>
                            ) : (
                              dayEvents.map((event) => {
                                const IconComponent = categoryConfig[event.category]?.icon || Icons.calendar
                                return (
                                  <div
                                    key={event.id}
                                    onClick={() => { setShowDayModal(false); handleEdit(event) }}
                                    className="p-3 rounded-xl bg-white/5 hover:bg-white/10 cursor-pointer transition-all group border border-white/5"
                                  >
                                    <div className="flex items-center gap-3">
                                      <div
                                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                                        style={{ backgroundColor: event.color + '20' }}
                                      >
                                        <IconComponent size={14} style={{ color: event.color }} />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <span className="text-sm font-medium text-white group-hover:text-workx-lime transition-colors block truncate">
                                          {isRoomBooking(event) ? formatRoomBookingTitle(event) : event.title}
                                        </span>
                                        <p className="text-xs text-gray-400">
                                          {!event.isAllDay ? `${formatTime(event.startTime)} - ${formatTime(event.endTime)}` : 'Hele dag'}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                )
                              })
                            )}
                          </div>

                          {/* Footer */}
                          <div className="p-3 border-t border-white/5">
                            <button
                              onClick={() => { setShowDayModal(false); handleAddEvent(day.date) }}
                              className="w-full btn-primary py-2.5 text-sm flex items-center justify-center gap-2"
                            >
                              <Icons.plus size={14} />
                              Event toevoegen
                            </button>
                          </div>

                          <Popover.Arrow className="fill-workx-gray" />
                        </Popover.Content>
                      </Popover.Portal>
                    </Popover.Root>
                  )
                })}
              </div>
            </div>
          )}

          {/* Category legend */}
          <div className="px-4 sm:px-5 pb-4 sm:pb-5 flex flex-wrap gap-2 sm:gap-3 border-t border-white/5 pt-4 bg-gradient-to-r from-white/[0.01] to-transparent">
            {Object.entries(categoryConfig).map(([key, config]) => {
              const IconComponent = config.icon
              return (
                <div
                  key={key}
                  className="flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg border transition-all hover:scale-105"
                  style={{
                    backgroundColor: config.color + '10',
                    borderColor: config.color + '20',
                    color: config.color
                  }}
                >
                  <IconComponent size={12} />
                  <span className="font-medium">{config.label}</span>
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
              <p className="text-sm text-gray-400 mb-4">
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
                        <p className="text-xs text-gray-400 mt-0.5">Verjaardag!</p>
                      </div>
                    </div>
                  </div>
                ))}

                {getEventsForDate(selectedDate).length === 0 && getBirthdaysForDate(selectedDate).length === 0 ? (
                  <div className="py-10 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-purple-500/10 flex items-center justify-center mx-auto mb-4">
                      <Icons.calendar className="text-purple-400/50" size={24} />
                    </div>
                    <p className="text-sm text-gray-400 mb-4">Geen events op deze dag</p>
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
                                  {isRoomBooking(event) ? formatRoomBookingTitle(event) : event.title}
                                </span>
                                <p className="text-xs text-gray-500 mt-0.5">
                                  {isRoomBooking(event) ? 'Vergaderruimte gereserveerd' : categoryConfig[event.category]?.label}
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeleteClick(event.id) }}
                              className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                            >
                              <Icons.trash size={14} />
                            </button>
                          </div>
                          <div className="mt-3 pt-3 border-t border-white/5 flex flex-wrap gap-3">
                            {!event.isAllDay ? (
                              <p className="text-xs text-gray-400 flex items-center gap-1.5">
                                <Icons.clock size={12} />
                                {formatTime(event.startTime)} - {formatTime(event.endTime)}
                              </p>
                            ) : (
                              <p className="text-xs text-gray-400 flex items-center gap-1.5">
                                <Icons.sun size={12} />
                                Hele dag
                              </p>
                            )}
                            {event.location && (
                              <p className="text-xs text-gray-400 flex items-center gap-1.5">
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
                      className="w-full p-3 rounded-xl border border-dashed border-white/10 text-sm text-gray-400 hover:text-white hover:border-white/20 hover:bg-white/5 transition-all flex items-center justify-center gap-2"
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
                  <Icons.calendar className="text-gray-500" size={24} />
                </div>
                <p className="text-sm text-gray-400">Klik op een dag in de kalender</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Event form modal - positioned near click */}
      {showForm && (
        <>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={resetForm} />
          <div
            className="fixed z-50 left-1/2 -translate-x-1/2 w-[calc(100%-32px)] max-w-lg bg-workx-gray rounded-2xl p-6 border border-white/10 shadow-2xl max-h-[80vh] overflow-y-auto animate-modal-in"
            style={{ top: `clamp(16px, ${modalClickY ? modalClickY - 20 : 100}px, calc(100vh - 500px))` }}
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
                className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
              >
                <Icons.x size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Titel</label>
                <div className="relative">
                  <Icons.edit className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
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
                <label className="block text-sm text-gray-400 mb-2">Categorie</label>
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
                            : 'border-white/10 text-gray-400 hover:border-white/20 hover:bg-white/5'
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
                  <p className="text-xs text-gray-400 mt-0.5">Event duurt de hele dag</p>
                </div>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Startdatum</label>
                  <DatePicker
                    selected={startDate}
                    onChange={(date) => { setStartDate(date); if (!endDate) setEndDate(date) }}
                    placeholder="Selecteer startdatum..."
                  />
                </div>
                {!isAllDay && (
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Starttijd</label>
                    <TimePicker
                      value={startTime}
                      onChange={setStartTime}
                      placeholder="Selecteer starttijd..."
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Einddatum</label>
                  <DatePicker
                    selected={endDate}
                    onChange={setEndDate}
                    placeholder="Selecteer einddatum..."
                    minDate={startDate || undefined}
                  />
                </div>
                {!isAllDay && (
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Eindtijd</label>
                    <TimePicker
                      value={endTime}
                      onChange={setEndTime}
                      placeholder="Selecteer eindtijd..."
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  {category === 'MEETING' ? 'Vergaderruimte' : 'Locatie'}
                </label>

                {/* Room picker for meetings */}
                {category === 'MEETING' ? (
                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={() => roomAvailability.available && setLocation(MEETING_ROOM.name)}
                      disabled={!roomAvailability.available}
                      className={`w-full p-4 rounded-xl border text-left transition-all ${
                        location === MEETING_ROOM.name
                          ? 'border-blue-500 bg-blue-500/20 text-white'
                          : roomAvailability.available
                          ? 'border-white/10 bg-white/5 text-white/80 hover:border-white/20 hover:bg-white/10'
                          : 'border-red-500/30 bg-red-500/10 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{MEETING_ROOM.icon}</span>
                        <div className="flex-1">
                          <p className={`font-medium ${!roomAvailability.available ? 'line-through' : ''}`}>
                            {MEETING_ROOM.name}
                          </p>
                          <p className="text-sm text-gray-400">
                            {roomAvailability.available ? (
                              <>Beschikbaar · max {MEETING_ROOM.capacity} personen</>
                            ) : (
                              <span className="text-red-400">Bezet: {roomAvailability.conflictEvent}</span>
                            )}
                          </p>
                        </div>
                        {location === MEETING_ROOM.name && roomAvailability.available && (
                          <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
                            <Icons.check size={14} className="text-white" />
                          </div>
                        )}
                        {!roomAvailability.available && (
                          <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center">
                            <Icons.x size={14} className="text-red-400" />
                          </div>
                        )}
                      </div>
                    </button>
                    {!startDate && (
                      <p className="text-xs text-amber-400/80 flex items-center gap-1">
                        <Icons.info size={12} />
                        Selecteer eerst een datum en tijd om beschikbaarheid te zien
                      </p>
                    )}
                    {startDate && roomAvailability.available && (
                      <p className="text-xs text-green-400/80 flex items-center gap-1">
                        <Icons.check size={12} />
                        Vergaderruimte is beschikbaar op dit tijdstip
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="relative">
                    <Icons.mapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="Kantoor, rechtbank, extern..."
                      className="input-field pl-10"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Beschrijving</label>
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
                    onClick={() => handleDeleteClick(editingEvent.id)}
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
        </>
      )}

      {/* Day Detail Modal - only for week view (month view uses Popover) */}
      {showDayModal && selectedDate && currentView === 'week' && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => { setShowDayModal(false); setModalClickY(undefined) }}
        >
          <div
            className="w-full max-w-md bg-workx-gray rounded-2xl border border-white/10 shadow-2xl max-h-[80vh] overflow-hidden flex flex-col animate-modal-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-5 border-b border-white/5 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-white text-lg capitalize">
                  {selectedDate.toLocaleDateString('nl-NL', { weekday: 'long' })}
                </h2>
                <p className="text-sm text-gray-400">
                  {selectedDate.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>
              <button
                onClick={() => setShowDayModal(false)}
                className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
              >
                <Icons.x size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 overflow-y-auto flex-1 space-y-3">
              {/* Birthdays */}
              {getBirthdaysForDate(selectedDate).map((person, i) => (
                <div
                  key={`modal-bday-${i}`}
                  className="p-4 rounded-xl bg-gradient-to-r from-pink-500/10 to-pink-600/5 border border-pink-500/20"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-pink-500/20 flex items-center justify-center">
                      <span className="text-lg">🎂</span>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-pink-400">{person.name}</span>
                      <p className="text-xs text-gray-400 mt-0.5">Verjaardag!</p>
                    </div>
                  </div>
                </div>
              ))}

              {/* Events */}
              {getEventsForDate(selectedDate).length === 0 && getBirthdaysForDate(selectedDate).length === 0 ? (
                <div className="py-10 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-purple-500/10 flex items-center justify-center mx-auto mb-4">
                    <Icons.calendar className="text-purple-400/50" size={24} />
                  </div>
                  <p className="text-sm text-gray-400 mb-4">Geen events op deze dag</p>
                </div>
              ) : (
                getEventsForDate(selectedDate).map((event, index) => {
                  const IconComponent = categoryConfig[event.category]?.icon || Icons.calendar
                  return (
                    <div
                      key={event.id}
                      onClick={() => { setShowDayModal(false); handleEdit(event) }}
                      className="p-4 rounded-xl bg-white/5 hover:bg-white/10 cursor-pointer transition-all group border border-white/5 hover:border-white/10"
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
                              {isRoomBooking(event) ? formatRoomBookingTitle(event) : event.title}
                            </span>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {isRoomBooking(event) ? 'Vergaderruimte gereserveerd' : (categoryConfig[event.category]?.label || 'Event')}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); setShowDayModal(false); handleDeleteClick(event.id) }}
                          className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <Icons.trash size={14} />
                        </button>
                      </div>
                      <div className="mt-3 pt-3 border-t border-white/5 flex flex-wrap gap-3">
                        {!event.isAllDay ? (
                          <p className="text-xs text-gray-400 flex items-center gap-1.5">
                            <Icons.clock size={12} />
                            {formatTime(event.startTime)} - {formatTime(event.endTime)}
                          </p>
                        ) : (
                          <p className="text-xs text-gray-400 flex items-center gap-1.5">
                            <Icons.sun size={12} />
                            Hele dag
                          </p>
                        )}
                        {event.location && (
                          <p className="text-xs text-gray-400 flex items-center gap-1.5">
                            <Icons.mapPin size={12} />
                            {event.location}
                          </p>
                        )}
                        {event.description && (
                          <p className="text-xs text-gray-400 w-full mt-1">
                            {event.description}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Footer with action button */}
            <div className="p-4 border-t border-white/5">
              <button
                onClick={() => { setShowDayModal(false); setModalClickY(undefined); handleAddEvent(selectedDate) }}
                className="w-full btn-primary py-3 flex items-center justify-center gap-2"
              >
                <Icons.plus size={16} />
                Event toevoegen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => { setShowDeleteConfirm(false); setEventToDelete(null) }}
        onConfirm={handleDeleteConfirm}
        title="Event verwijderen"
        message="Weet je zeker dat je dit event wilt verwijderen?"
        confirmText="Verwijderen"
        type="danger"
      />
    </div>
  )
}
