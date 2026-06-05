'use client'

import { forwardRef, useState, useEffect, useRef } from 'react'
import ReactDatePicker, { registerLocale } from 'react-datepicker'
import { nl } from 'date-fns/locale'
import { Icons } from './Icons'

// Custom header voor de calendar — vervangt de standaard react-datepicker
// header (en de lelijke scroll-jaar-lijst) door:
//   • klikbare maand-knop → 3×4 grid popover
//   • klikbare jaar-knop → 3×4 grid popover met decade-navigatie
const MONTHS_NL = ['Januari', 'Februari', 'Maart', 'April', 'Mei', 'Juni',
  'Juli', 'Augustus', 'September', 'Oktober', 'November', 'December']
const MONTHS_NL_SHORT = ['Jan', 'Feb', 'Mrt', 'Apr', 'Mei', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec']

function WorkxDatePickerHeader({
  date,
  changeYear,
  changeMonth,
  decreaseMonth,
  increaseMonth,
  prevMonthButtonDisabled,
  nextMonthButtonDisabled,
}: {
  date: Date
  changeYear: (year: number) => void
  changeMonth: (month: number) => void
  decreaseMonth: () => void
  increaseMonth: () => void
  prevMonthButtonDisabled: boolean
  nextMonthButtonDisabled: boolean
}) {
  const currentYear = date.getFullYear()
  const currentMonth = date.getMonth()
  const [monthOpen, setMonthOpen] = useState(false)
  const [yearOpen, setYearOpen] = useState(false)
  // 12-jaar grid — start bij begin van het decennium (e.g. 2020 voor 2026)
  const [decadeStart, setDecadeStart] = useState(currentYear - (currentYear % 10))
  const monthRef = useRef<HTMLDivElement>(null)
  const yearRef = useRef<HTMLDivElement>(null)

  // Klik buiten popovers → sluiten
  useEffect(() => {
    if (!monthOpen && !yearOpen) return
    const handler = (e: MouseEvent) => {
      const t = e.target as HTMLElement
      if (monthOpen && monthRef.current && !monthRef.current.contains(t)) setMonthOpen(false)
      if (yearOpen && yearRef.current && !yearRef.current.contains(t)) setYearOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [monthOpen, yearOpen])

  const triggerClass =
    'flex items-center gap-1 bg-white/5 hover:bg-white/10 text-white text-sm font-semibold px-2.5 py-1 rounded-lg border border-white/10 hover:border-workx-lime/30 transition-colors'

  return (
    <div className="flex items-center justify-between gap-2 px-2 pb-3 relative">
      <button
        type="button"
        onClick={decreaseMonth}
        disabled={prevMonthButtonDisabled}
        className="p-1 rounded-lg text-gray-400 hover:text-workx-lime hover:bg-white/5 transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
        aria-label="Vorige maand"
      >
        <Icons.chevronLeft size={16} />
      </button>

      <div className="flex items-center gap-1.5">
        {/* Maand-knop + popover */}
        <div ref={monthRef} className="relative">
          <button type="button" onClick={() => { setMonthOpen(!monthOpen); setYearOpen(false) }} className={triggerClass}>
            {MONTHS_NL[currentMonth]}
            <Icons.chevronDown size={12} className={`transition-transform ${monthOpen ? 'rotate-180' : ''}`} />
          </button>
          {monthOpen && (
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 p-2 bg-workx-dark border border-white/10 rounded-xl shadow-2xl">
              <div className="grid grid-cols-3 gap-1 w-48">
                {MONTHS_NL_SHORT.map((label, idx) => {
                  const isActive = idx === currentMonth
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => { changeMonth(idx); setMonthOpen(false) }}
                      className={`px-2 py-2 rounded-lg text-xs font-medium transition-colors ${
                        isActive ? 'bg-workx-lime text-black' : 'text-white/70 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Jaar-knop + popover met decade-grid */}
        <div ref={yearRef} className="relative">
          <button
            type="button"
            onClick={() => {
              setYearOpen(!yearOpen)
              setMonthOpen(false)
              setDecadeStart(currentYear - (currentYear % 10))
            }}
            className={triggerClass}
          >
            {currentYear}
            <Icons.chevronDown size={12} className={`transition-transform ${yearOpen ? 'rotate-180' : ''}`} />
          </button>
          {yearOpen && (
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 p-2 bg-workx-dark border border-white/10 rounded-xl shadow-2xl">
              <div className="flex items-center justify-between gap-1 mb-1.5 px-1">
                <button
                  type="button"
                  onClick={() => setDecadeStart(decadeStart - 10)}
                  className="p-1 rounded-lg text-gray-400 hover:text-workx-lime hover:bg-white/5"
                  aria-label="Vorig decennium"
                >
                  <Icons.chevronLeft size={14} />
                </button>
                <span className="text-xs text-white/60 font-medium">{decadeStart} – {decadeStart + 11}</span>
                <button
                  type="button"
                  onClick={() => setDecadeStart(decadeStart + 10)}
                  className="p-1 rounded-lg text-gray-400 hover:text-workx-lime hover:bg-white/5"
                  aria-label="Volgend decennium"
                >
                  <Icons.chevronRight size={14} />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-1 w-48">
                {Array.from({ length: 12 }, (_, i) => decadeStart + i).map(y => {
                  const isActive = y === currentYear
                  return (
                    <button
                      key={y}
                      type="button"
                      onClick={() => { changeYear(y); setYearOpen(false) }}
                      className={`px-2 py-2 rounded-lg text-sm font-medium tabular-nums transition-colors ${
                        isActive ? 'bg-workx-lime text-black' : 'text-white/70 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      {y}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={increaseMonth}
        disabled={nextMonthButtonDisabled}
        className="p-1 rounded-lg text-gray-400 hover:text-workx-lime hover:bg-white/5 transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
        aria-label="Volgende maand"
      >
        <Icons.chevronRight size={16} />
      </button>
    </div>
  )
}

import 'react-datepicker/dist/react-datepicker.css'

// Register Dutch locale
registerLocale('nl', nl)

interface DatePickerProps {
  selected: Date | null
  onChange: (date: Date | null) => void
  placeholder?: string
  minDate?: Date
  maxDate?: Date
  className?: string
  showTimeSelect?: boolean
  dateFormat?: string
  isClearable?: boolean
}

// Custom input component
const CustomInput = forwardRef<HTMLButtonElement, { value?: string; onClick?: () => void; placeholder?: string }>(
  ({ value, onClick, placeholder }, ref) => (
    <button
      type="button"
      onClick={onClick}
      ref={ref}
      className="w-full flex items-center gap-3 px-4 py-3 bg-gradient-to-br from-workx-gray/90 to-workx-dark/95 border border-white/10 rounded-xl text-left hover:border-workx-lime/30 hover:shadow-lg hover:shadow-workx-lime/5 focus:outline-none focus:border-workx-lime/50 focus:ring-2 focus:ring-workx-lime/20 transition-all duration-300 group"
    >
      <Icons.calendar size={18} className="text-white/40 group-hover:text-workx-lime group-focus:text-workx-lime transition-colors" />
      <span className={value ? 'text-white' : 'text-white/40'}>
        {value || placeholder || 'Selecteer datum...'}
      </span>
      <Icons.chevronDown size={16} className="ml-auto text-white/30 group-hover:text-workx-lime transition-colors" />
    </button>
  )
)
CustomInput.displayName = 'CustomInput'

export default function DatePicker({
  selected,
  onChange,
  placeholder = 'Selecteer datum...',
  minDate,
  maxDate,
  className = '',
  showTimeSelect = false,
  dateFormat = 'd MMMM yyyy',
  isClearable = false,
}: DatePickerProps) {
  return (
    <div className={`workx-datepicker ${className}`}>
      <ReactDatePicker
        selected={selected}
        onChange={onChange}
        locale="nl"
        dateFormat={showTimeSelect ? 'd MMMM yyyy HH:mm' : dateFormat}
        minDate={minDate}
        maxDate={maxDate}
        showTimeSelect={showTimeSelect}
        timeCaption="Tijd"
        timeFormat="HH:mm"
        timeIntervals={15}
        isClearable={isClearable}
        renderCustomHeader={(headerProps) => <WorkxDatePickerHeader {...headerProps} />}
        customInput={<CustomInput placeholder={placeholder} />}
        popperClassName="workx-datepicker-popper"
        calendarClassName="workx-calendar"
        showPopperArrow={false}
        popperPlacement="bottom-start"
        portalId="datepicker-portal"
      />
    </div>
  )
}

// Date range picker variant
interface DateRangePickerProps {
  startDate: Date | null
  endDate: Date | null
  onStartChange: (date: Date | null) => void
  onEndChange: (date: Date | null) => void
  startPlaceholder?: string
  endPlaceholder?: string
  className?: string
}

export function DateRangePicker({
  startDate,
  endDate,
  onStartChange,
  onEndChange,
  startPlaceholder = 'Van...',
  endPlaceholder = 'Tot...',
  className = '',
}: DateRangePickerProps) {
  return (
    <div className={`grid grid-cols-2 gap-3 ${className}`}>
      <DatePicker
        selected={startDate}
        onChange={onStartChange}
        placeholder={startPlaceholder}
        maxDate={endDate || undefined}
      />
      <DatePicker
        selected={endDate}
        onChange={onEndChange}
        placeholder={endPlaceholder}
        minDate={startDate || undefined}
      />
    </div>
  )
}
