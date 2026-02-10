'use client'

import { useState } from 'react'
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

export default function WerkverdelingTable({ distributions, employees, onUpdate }: WerkverdelingTableProps) {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)

  const handleSelect = (partnerName: string, employee: Employee | null) => {
    const updated = distributions.map(d =>
      d.partnerName === partnerName
        ? { ...d, employeeName: employee?.name || null, employeeId: employee?.id || null }
        : d
    )
    onUpdate(updated.map(d => ({
      partnerName: d.partnerName,
      employeeName: d.employeeName,
      employeeId: d.employeeId,
    })))
    setOpenDropdown(null)
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
          const employeePhoto = dist.employeeName ? getPhotoUrl(dist.employeeName) : null
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

              {/* Employee dropdown */}
              <div className="relative">
                <button
                  onClick={() => setOpenDropdown(openDropdown === dist.partnerName ? null : dist.partnerName)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:border-white/20 transition-all w-full"
                >
                  {dist.employeeName ? (
                    <>
                      {employeePhoto && (
                        <img src={employeePhoto} alt={dist.employeeName} className="w-5 h-5 rounded-md object-cover" />
                      )}
                      <span className="text-sm text-white flex-1 text-left truncate">{dist.employeeName}</span>
                    </>
                  ) : (
                    <span className="text-sm text-gray-500 flex-1 text-left">Selecteer...</span>
                  )}
                  <Icons.chevronDown size={14} className="text-gray-400 flex-shrink-0" />
                </button>
                {openDropdown === dist.partnerName && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setOpenDropdown(null)} />
                    <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-workx-dark border border-white/10 rounded-lg shadow-xl py-1 max-h-48 overflow-y-auto">
                      <button
                        onClick={() => handleSelect(dist.partnerName, null)}
                        className="w-full text-left px-3 py-1.5 text-sm text-gray-500 hover:bg-white/5 transition-colors"
                      >
                        <span className="italic">Geen</span>
                      </button>
                      {employees.map((emp) => (
                        <button
                          key={emp.id}
                          onClick={() => handleSelect(dist.partnerName, emp)}
                          className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm transition-colors ${
                            dist.employeeName === emp.name ? 'text-workx-lime bg-workx-lime/10' : 'text-white/70 hover:bg-white/5 hover:text-white'
                          }`}
                        >
                          {getPhotoUrl(emp.name) && (
                            <img src={getPhotoUrl(emp.name)!} alt={emp.name} className="w-5 h-5 rounded-md object-cover" />
                          )}
                          <span>{emp.name}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
