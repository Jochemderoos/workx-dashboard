'use client'

import { forwardRef } from 'react'
import ReactDatePicker, { registerLocale } from 'react-datepicker'
import { nl } from 'date-fns/locale'
import { Icons } from './Icons'

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
        timeFormat="HH:mm"
        timeIntervals={15}
        isClearable={isClearable}
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
