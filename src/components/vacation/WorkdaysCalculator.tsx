'use client'

import { useState, useEffect } from 'react'
import DatePicker from '@/components/ui/DatePicker'
import { Icons } from '@/components/ui/Icons'
import { calculateWorkdays, getHolidaysInRange, getDutchHolidays } from '@/lib/vacation-utils'

interface WorkdaysCalculatorProps {
  onClose?: () => void
}

export default function WorkdaysCalculator({ onClose }: WorkdaysCalculatorProps) {
  const [startDate, setStartDate] = useState<Date | null>(null)
  const [endDate, setEndDate] = useState<Date | null>(null)
  const [workdays, setWorkdays] = useState<number>(0)
  const [holidaysInRange, setHolidaysInRange] = useState<{ date: Date; name: string }[]>([])

  // Calculate workdays whenever dates change
  useEffect(() => {
    if (startDate && endDate) {
      const days = calculateWorkdays(startDate, endDate, true)
      setWorkdays(days)
      const holidays = getHolidaysInRange(startDate, endDate)
      setHolidaysInRange(holidays)
    } else {
      setWorkdays(0)
      setHolidaysInRange([])
    }
  }, [startDate, endDate])

  // Calculate calendar days
  const calendarDays = startDate && endDate
    ? Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
    : 0

  // Calculate weekend days
  const weekendDays = startDate && endDate
    ? (() => {
        let count = 0
        const current = new Date(startDate)
        while (current <= endDate) {
          const day = current.getDay()
          if (day === 0 || day === 6) count++
          current.setDate(current.getDate() + 1)
        }
        return count
      })()
    : 0

  // Holidays that fall on weekdays
  const holidaysOnWeekdays = holidaysInRange.filter(h => {
    const day = h.date.getDay()
    return day !== 0 && day !== 6
  })

  // Get upcoming holidays for current year
  const currentYear = new Date().getFullYear()
  const upcomingHolidays = getDutchHolidays(currentYear)
    .filter(h => h >= new Date())
    .slice(0, 5)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
            <Icons.calculator className="text-blue-400" size={20} />
          </div>
          <div>
            <h3 className="font-semibold text-white">Werkdagen Calculator</h3>
            <p className="text-xs text-gray-400">Bereken werkdagen tussen twee datums</p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
          >
            <Icons.x size={18} />
          </button>
        )}
      </div>

      {/* Date Range */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-gray-400 mb-2">Van</label>
          <DatePicker
            selected={startDate}
            onChange={setStartDate}
            placeholder="Selecteer startdatum..."
            maxDate={endDate || undefined}
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-2">Tot en met</label>
          <DatePicker
            selected={endDate}
            onChange={setEndDate}
            placeholder="Selecteer einddatum..."
            minDate={startDate || undefined}
          />
        </div>
      </div>

      {/* Result */}
      {startDate && endDate && (
        <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-gray-300">Werkdagen</span>
            <span className="text-3xl font-bold text-blue-400">
              {workdays}
              <span className="text-sm font-normal text-gray-400 ml-1">dagen</span>
            </span>
          </div>

          {/* Breakdown */}
          <div className="text-xs text-gray-500 space-y-1 pt-2 border-t border-white/5">
            <div className="flex justify-between">
              <span>Kalenderdagen:</span>
              <span>{calendarDays}</span>
            </div>
            <div className="flex justify-between text-blue-400/70">
              <span>Weekenddagen:</span>
              <span>-{weekendDays}</span>
            </div>
            {holidaysOnWeekdays.length > 0 && (
              <div className="flex justify-between text-orange-400/70">
                <span>Feestdagen:</span>
                <span>-{holidaysOnWeekdays.length}</span>
              </div>
            )}
          </div>

          <p className="text-xs text-gray-500">
            {startDate.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })}
            {' t/m '}
            {endDate.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
      )}

      {/* Holidays in range */}
      {holidaysOnWeekdays.length > 0 && (
        <div className="p-3 bg-orange-500/10 border border-orange-500/20 rounded-xl">
          <div className="flex items-start gap-2">
            <Icons.calendar className="text-orange-400 mt-0.5 shrink-0" size={16} />
            <div>
              <p className="text-sm text-orange-300 font-medium">
                Feestdagen in deze periode
              </p>
              <ul className="text-xs text-gray-400 mt-1 space-y-0.5">
                {holidaysOnWeekdays.map((h, i) => (
                  <li key={i}>
                    {h.name} - {h.date.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Upcoming holidays */}
      <div className="pt-3 border-t border-white/5">
        <p className="text-xs text-gray-500 mb-2">Eerstvolgende feestdagen {currentYear}:</p>
        <div className="flex flex-wrap gap-2">
          {upcomingHolidays.map((h, i) => {
            const name = (() => {
              // Get holiday name from the getHolidaysInRange function
              const holidays = getHolidaysInRange(h, h)
              return holidays[0]?.name || ''
            })()
            return (
              <span
                key={i}
                className="text-xs px-2 py-1 bg-white/5 text-gray-400 rounded-lg"
              >
                {name}: {h.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
              </span>
            )
          })}
        </div>
      </div>
    </div>
  )
}
