'use client'

import { useState, useEffect } from 'react'
import DatePicker from '@/components/ui/DatePicker'
import WerkdagenSelector from './WerkdagenSelector'
import { Icons } from '@/components/ui/Icons'
import { calculateVacationDays, getHolidaysInRange, DEFAULT_WERKDAGEN } from '@/lib/vacation-utils'

export interface VacationPeriodFormData {
  startDate: Date | null
  endDate: Date | null
  werkdagen: number[]
  note: string
}

interface VacationPeriodFormProps {
  initialData?: VacationPeriodFormData
  onSubmit: (data: VacationPeriodFormData) => void
  onCancel: () => void
  isSubmitting?: boolean
  submitLabel?: string
}

export default function VacationPeriodForm({
  initialData,
  onSubmit,
  onCancel,
  isSubmitting = false,
  submitLabel = 'Toevoegen'
}: VacationPeriodFormProps) {
  const [startDate, setStartDate] = useState<Date | null>(initialData?.startDate || null)
  const [endDate, setEndDate] = useState<Date | null>(initialData?.endDate || null)
  const [werkdagen, setWerkdagen] = useState<number[]>(initialData?.werkdagen || DEFAULT_WERKDAGEN)
  const [note, setNote] = useState(initialData?.note || '')
  const [calculatedDays, setCalculatedDays] = useState<number>(0)
  const [holidaysInRange, setHolidaysInRange] = useState<{ date: Date; name: string }[]>([])

  // Calculate days and holidays whenever dates or werkdagen change
  useEffect(() => {
    if (startDate && endDate) {
      const days = calculateVacationDays(startDate, endDate, werkdagen, true)
      setCalculatedDays(days)
      const holidays = getHolidaysInRange(startDate, endDate)
      setHolidaysInRange(holidays)
    } else {
      setCalculatedDays(0)
      setHolidaysInRange([])
    }
  }, [startDate, endDate, werkdagen])

  // Calculate calendar days for comparison
  const calendarDays = startDate && endDate
    ? Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
    : 0

  // Count weekend days excluded
  const weekendDaysExcluded = startDate && endDate
    ? (() => {
        let count = 0
        const current = new Date(startDate)
        while (current <= endDate) {
          const jsDay = current.getDay()
          const ourDay = jsDay === 0 ? 7 : jsDay
          // If it's a weekend day that's NOT in werkdagen
          if ((ourDay === 6 || ourDay === 7) && !werkdagen.includes(ourDay)) {
            count++
          }
          current.setDate(current.getDate() + 1)
        }
        return count
      })()
    : 0

  // Count holidays that fall on werkdagen (these are actually excluded)
  const holidaysExcluded = holidaysInRange.filter(h => {
    const jsDay = h.date.getDay()
    const ourDay = jsDay === 0 ? 7 : jsDay
    return werkdagen.includes(ourDay)
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!startDate || !endDate || werkdagen.length === 0) return

    onSubmit({
      startDate,
      endDate,
      werkdagen,
      note,
    })
  }

  const isValid = startDate && endDate && werkdagen.length > 0

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
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

      {/* Werkdagen Selector */}
      <div>
        <label className="block text-sm text-gray-400 mb-2">
          Werkdagen die meetellen
        </label>
        <WerkdagenSelector value={werkdagen} onChange={setWerkdagen} />
        {werkdagen.length === 0 && (
          <p className="text-xs text-red-400 mt-2">Selecteer minstens 1 werkdag</p>
        )}
      </div>

      {/* Live Calculation */}
      {startDate && endDate && (
        <div className="p-4 bg-workx-lime/10 border border-workx-lime/20 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icons.calculator className="text-workx-lime" size={18} />
              <span className="text-sm text-gray-300">Berekende vakantiedagen</span>
            </div>
            <span className="text-2xl font-bold text-workx-lime">
              {calculatedDays}
              <span className="text-sm font-normal text-gray-400 ml-1">
                {calculatedDays === 1 ? 'dag' : 'dagen'}
              </span>
            </span>
          </div>

          {/* Breakdown */}
          <div className="text-xs text-gray-500 space-y-1 pt-2 border-t border-white/5">
            <div className="flex justify-between">
              <span>Kalenderdagen:</span>
              <span>{calendarDays}</span>
            </div>
            {weekendDaysExcluded > 0 && (
              <div className="flex justify-between text-blue-400/70">
                <span>Weekenddagen (niet geteld):</span>
                <span>-{weekendDaysExcluded}</span>
              </div>
            )}
            {holidaysExcluded.length > 0 && (
              <div className="flex justify-between text-orange-400/70">
                <span>Feestdagen (niet geteld):</span>
                <span>-{holidaysExcluded.length}</span>
              </div>
            )}
          </div>

          <p className="text-xs text-gray-500">
            {startDate.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' })}
            {' t/m '}
            {endDate.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
      )}

      {/* Holidays warning */}
      {holidaysExcluded.length > 0 && (
        <div className="p-3 bg-orange-500/10 border border-orange-500/20 rounded-xl">
          <div className="flex items-start gap-2">
            <Icons.alertCircle className="text-orange-400 mt-0.5 shrink-0" size={16} />
            <div>
              <p className="text-sm text-orange-300 font-medium">
                {holidaysExcluded.length === 1 ? 'Feestdag in deze periode' : 'Feestdagen in deze periode'}
              </p>
              <ul className="text-xs text-gray-400 mt-1 space-y-0.5">
                {holidaysExcluded.map((h, i) => (
                  <li key={i}>
                    {h.name} - {h.date.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-gray-500 mt-2">
                Deze {holidaysExcluded.length === 1 ? 'dag telt' : 'dagen tellen'} niet mee als vakantiedag.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Note */}
      <div>
        <label className="block text-sm text-gray-400 mb-2">Notitie (optioneel)</label>
        <div className="relative">
          <Icons.edit className="absolute left-3 top-3 text-gray-500" size={16} />
          <input
            type="text"
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Bijv. zomervakantie, skivakantie..."
            className="input-field pl-10"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-3">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 btn-secondary"
          disabled={isSubmitting}
        >
          Annuleren
        </button>
        <button
          type="submit"
          disabled={!isValid || isSubmitting}
          className="flex-1 btn-primary flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <span className="w-4 h-4 border-2 border-workx-dark/30 border-t-workx-dark rounded-full animate-spin" />
          ) : (
            <Icons.check size={16} />
          )}
          {submitLabel}
        </button>
      </div>
    </form>
  )
}
