'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Icons } from '@/components/ui/Icons'
import { getPhotoUrl } from '@/lib/team-photos'

interface Distribution {
  id?: string
  partnerName: string
  employeeName: string | null
  employeeId: string | null
}

interface Employee {
  id: string
  name: string
}

interface WerkverdelingTableProps {
  distributions: Distribution[]
  employees: Employee[]
  onUpdate: (distributions: { partnerName: string; employeeName: string | null; employeeId: string | null }[]) => void
}

function parseNames(value: string | null): string[] {
  if (!value) return []
  return value.split(', ').filter(Boolean)
}

function joinNames(names: string[]): string | null {
  if (names.length === 0) return null
  return names.join(', ')
}

interface DropdownProps {
  anchorRef: React.RefObject<HTMLButtonElement | null>
  employees: Employee[]
  selectedNames: string[]
  onToggle: (employee: Employee) => void
  onClose: () => void
}

function EmployeeDropdown({ anchorRef, employees, selectedNames, onToggle, onClose }: DropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [style, setStyle] = useState<React.CSSProperties>({})

  const updatePosition = useCallback(() => {
    if (!anchorRef.current) return
    const rect = anchorRef.current.getBoundingClientRect()
    const dropdownHeight = 240
    const spaceBelow = window.innerHeight - rect.bottom
    const showAbove = spaceBelow < dropdownHeight && rect.top > dropdownHeight

    setStyle({
      position: 'fixed',
      left: rect.left,
      width: rect.width,
      top: showAbove ? undefined : rect.bottom + 4,
      bottom: showAbove ? window.innerHeight - rect.top + 4 : undefined,
      zIndex: 9999,
    })
  }, [anchorRef])

  useEffect(() => {
    updatePosition()
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)
    return () => {
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [updatePosition])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        anchorRef.current && !anchorRef.current.contains(e.target as Node)
      ) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [anchorRef, onClose])

  return createPortal(
    <div
      ref={dropdownRef}
      style={style}
      className="bg-workx-dark border border-white/10 rounded-lg shadow-2xl py-1 max-h-60 overflow-y-auto"
    >
      {employees.map((emp) => {
        const isSelected = selectedNames.includes(emp.name)
        const photo = getPhotoUrl(emp.name)
        return (
          <button
            key={emp.id}
            onClick={() => onToggle(emp)}
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
              isSelected ? 'text-workx-lime bg-workx-lime/10' : 'text-white/70 hover:bg-white/5 hover:text-white'
            }`}
          >
            <div className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-all ${
              isSelected ? 'bg-workx-lime/20 border-workx-lime/50' : 'border-white/20'
            }`}>
              {isSelected && <Icons.check size={10} className="text-workx-lime" />}
            </div>
            {photo && (
              <img src={photo} alt={emp.name} className="w-5 h-5 rounded-md object-cover" />
            )}
            <span>{emp.name}</span>
          </button>
        )
      })}
      {employees.length === 0 && (
        <div className="px-3 py-2 text-sm text-gray-500 italic">Geen medewerkers beschikbaar</div>
      )}
    </div>,
    document.body
  )
}

export default function WerkverdelingTable({ distributions, employees, onUpdate }: WerkverdelingTableProps) {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  const handleToggleEmployee = (partnerName: string, employee: Employee) => {
    const dist = distributions.find(d => d.partnerName === partnerName)
    if (!dist) return

    const currentNames = parseNames(dist.employeeName)
    const currentIds = parseNames(dist.employeeId)

    let newNames: string[]
    let newIds: string[]

    const idx = currentNames.indexOf(employee.name)
    if (idx >= 0) {
      // Remove
      newNames = currentNames.filter((_, i) => i !== idx)
      newIds = currentIds.filter((_, i) => i !== idx)
    } else {
      // Add
      newNames = [...currentNames, employee.name]
      newIds = [...currentIds, employee.id]
    }

    const updated = distributions.map(d =>
      d.partnerName === partnerName
        ? { ...d, employeeName: joinNames(newNames), employeeId: joinNames(newIds) }
        : d
    )
    onUpdate(updated.map(d => ({
      partnerName: d.partnerName,
      employeeName: d.employeeName,
      employeeId: d.employeeId,
    })))
  }

  const handleRemoveEmployee = (partnerName: string, nameToRemove: string) => {
    const dist = distributions.find(d => d.partnerName === partnerName)
    if (!dist) return

    const currentNames = parseNames(dist.employeeName)
    const currentIds = parseNames(dist.employeeId)

    const idx = currentNames.indexOf(nameToRemove)
    if (idx < 0) return

    const newNames = currentNames.filter((_, i) => i !== idx)
    const newIds = currentIds.filter((_, i) => i !== idx)

    const updated = distributions.map(d =>
      d.partnerName === partnerName
        ? { ...d, employeeName: joinNames(newNames), employeeId: joinNames(newIds) }
        : d
    )
    onUpdate(updated.map(d => ({
      partnerName: d.partnerName,
      employeeName: d.employeeName,
      employeeId: d.employeeId,
    })))
  }

  return (
    <div className="rounded-xl border border-white/10 overflow-hidden">
      <div className="grid grid-cols-[1fr_1fr] gap-0 text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-2 bg-white/[0.02] border-b border-white/5">
        <span>Partner</span>
        <span>Werkverdelingsgesprek met</span>
      </div>
      <div className="divide-y divide-white/5">
        {distributions.map((dist) => {
          const partnerPhoto = getPhotoUrl(dist.partnerName)
          const selectedNames = parseNames(dist.employeeName)

          return (
            <div key={dist.partnerName} className="grid grid-cols-[1fr_1fr] gap-0 px-4 py-2.5 items-center hover:bg-white/[0.02] transition-colors">
              {/* Partner */}
              <div className="flex items-center gap-2">
                {partnerPhoto ? (
                  <img src={partnerPhoto} alt={dist.partnerName} className="w-7 h-7 rounded-lg object-cover ring-1 ring-white/10" />
                ) : (
                  <div className="w-7 h-7 rounded-lg bg-workx-lime/10 flex items-center justify-center text-workx-lime text-xs font-bold">
                    {dist.partnerName.charAt(0)}
                  </div>
                )}
                <span className="text-sm text-white font-medium">{dist.partnerName}</span>
              </div>

              {/* Employee multi-select */}
              <div className="flex flex-wrap items-center gap-1.5">
                {selectedNames.map((name) => {
                  const photo = getPhotoUrl(name)
                  return (
                    <div
                      key={name}
                      className="flex items-center gap-1.5 pl-1 pr-1.5 py-0.5 rounded-lg bg-workx-lime/10 border border-workx-lime/20"
                    >
                      {photo ? (
                        <img src={photo} alt={name} className="w-5 h-5 rounded-md object-cover" />
                      ) : (
                        <div className="w-5 h-5 rounded-md bg-workx-lime/20 flex items-center justify-center text-workx-lime text-[10px] font-bold">
                          {name.charAt(0)}
                        </div>
                      )}
                      <span className="text-xs text-workx-lime font-medium">{name}</span>
                      <button
                        onClick={() => handleRemoveEmployee(dist.partnerName, name)}
                        className="p-0.5 rounded hover:bg-white/10 text-workx-lime/60 hover:text-workx-lime transition-colors"
                      >
                        <Icons.x size={10} />
                      </button>
                    </div>
                  )
                })}
                <button
                  ref={(el) => { buttonRefs.current[dist.partnerName] = el }}
                  onClick={() => setOpenDropdown(openDropdown === dist.partnerName ? null : dist.partnerName)}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 border border-white/10 hover:border-white/20 text-gray-400 hover:text-white transition-all text-xs"
                >
                  <Icons.plus size={12} />
                  <span>{selectedNames.length === 0 ? 'Selecteer medewerker...' : 'Toevoegen'}</span>
                </button>
                {openDropdown === dist.partnerName && buttonRefs.current[dist.partnerName] && (
                  <EmployeeDropdown
                    anchorRef={{ current: buttonRefs.current[dist.partnerName] }}
                    employees={employees}
                    selectedNames={selectedNames}
                    onToggle={(emp) => handleToggleEmployee(dist.partnerName, emp)}
                    onClose={() => setOpenDropdown(null)}
                  />
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
