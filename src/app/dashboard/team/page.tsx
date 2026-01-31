'use client'

import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { Icons } from '@/components/ui/Icons'

interface TeamMember {
  id: string
  name: string
  email: string
  role: string
  department: string | null
  phoneNumber: string | null
  createdAt: string
  _count: { assignedWork: number }
}

const roleConfig: Record<string, { label: string; color: string; bg: string }> = {
  PARTNER: { label: 'Partner', color: 'text-purple-400', bg: 'bg-purple-500/10' },
  ADMIN: { label: 'Kantoor', color: 'text-workx-lime', bg: 'bg-workx-lime/10' },
  MANAGER: { label: 'Manager', color: 'text-blue-400', bg: 'bg-blue-500/10' },
  EMPLOYEE: { label: 'Medewerker', color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
}

export default function TeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterRole, setFilterRole] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [showRoleDropdown, setShowRoleDropdown] = useState(false)

  useEffect(() => { fetchMembers() }, [])

  const fetchMembers = async () => {
    try {
      const res = await fetch('/api/team')
      if (res.ok) setMembers(await res.json())
    } catch (error) {
      toast.error('Kon team niet laden')
    } finally {
      setIsLoading(false)
    }
  }

  const filteredMembers = members.filter(member => {
    const matchesSearch = member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.department?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesRole = filterRole === 'all' || member.role === filterRole
    return matchesSearch && matchesRole
  })

  const stats = {
    total: members.length,
    partners: members.filter(m => m.role === 'PARTNER').length,
    employees: members.filter(m => m.role === 'EMPLOYEE').length,
    totalWork: members.reduce((sum, m) => sum + m._count.assignedWork, 0),
  }

  if (isLoading) {
    return (
      <div className="h-[calc(100vh-10rem)] flex items-center justify-center">
        <div className="text-center">
          <span className="w-8 h-8 border-2 border-workx-lime border-t-transparent rounded-full animate-spin inline-block mb-4" />
          <p className="text-white/40">Team laden...</p>
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
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 flex items-center justify-center">
              <Icons.users className="text-cyan-400" size={20} />
            </div>
            <h1 className="text-2xl font-semibold text-white">Team</h1>
          </div>
          <p className="text-white/40">Overzicht van alle teamleden en hun rollen</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:bg-cyan-500/10 transition-colors" />
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center mb-3">
              <Icons.users className="text-cyan-400" size={18} />
            </div>
            <p className="text-2xl font-semibold text-white">{stats.total}</p>
            <p className="text-sm text-white/40">Teamleden</p>
          </div>
        </div>

        <div className="card p-5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:bg-purple-500/10 transition-colors" />
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center mb-3">
              <Icons.award className="text-purple-400" size={18} />
            </div>
            <p className="text-2xl font-semibold text-white">{stats.partners}</p>
            <p className="text-sm text-white/40">Partners</p>
          </div>
        </div>

        <div className="card p-5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:bg-cyan-500/10 transition-colors" />
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center mb-3">
              <Icons.user className="text-cyan-400" size={18} />
            </div>
            <p className="text-2xl font-semibold text-white">{stats.employees}</p>
            <p className="text-sm text-white/40">Medewerkers</p>
          </div>
        </div>

        <div className="card p-5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:bg-orange-500/10 transition-colors" />
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center mb-3">
              <Icons.briefcase className="text-orange-400" size={18} />
            </div>
            <p className="text-2xl font-semibold text-white">{stats.totalWork}</p>
            <p className="text-sm text-white/40">Actieve zaken</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 w-full sm:w-auto">
          <div className="relative flex-1 sm:max-w-xs">
            <Icons.search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={16} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Zoek teamleden..."
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-workx-lime/30 focus:bg-white/10 transition-all"
            />
          </div>

          <div className="relative">
            <button
              onClick={() => setShowRoleDropdown(!showRoleDropdown)}
              className="flex items-center gap-3 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white hover:border-white/20 hover:bg-white/10 transition-all focus:outline-none focus:border-workx-lime/30"
            >
              {filterRole === 'all' ? (
                <span className="text-white/70">Alle rollen</span>
              ) : (
                <span className={roleConfig[filterRole]?.color}>{roleConfig[filterRole]?.label}</span>
              )}
              <Icons.chevronDown size={16} className={`text-white/40 transition-transform ${showRoleDropdown ? 'rotate-180' : ''}`} />
            </button>
            {showRoleDropdown && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowRoleDropdown(false)} />
                <div className="absolute left-0 top-full mt-2 w-48 z-50 bg-workx-dark/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden fade-in">
                  <div className="py-1">
                    <button
                      onClick={() => { setFilterRole('all'); setShowRoleDropdown(false) }}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-all ${filterRole === 'all' ? 'bg-workx-lime/10 text-white' : 'text-white/70 hover:bg-white/5 hover:text-white'}`}
                    >
                      <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center">
                        <Icons.users size={12} className="text-white/50" />
                      </div>
                      <span>Alle rollen</span>
                      {filterRole === 'all' && <Icons.check size={16} className="ml-auto text-workx-lime" />}
                    </button>
                    {Object.entries(roleConfig).map(([key, config]) => (
                      <button
                        key={key}
                        onClick={() => { setFilterRole(key); setShowRoleDropdown(false) }}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-all ${filterRole === key ? 'bg-workx-lime/10 text-white' : 'text-white/70 hover:bg-white/5 hover:text-white'}`}
                      >
                        <div className={`w-6 h-6 rounded-lg ${config.bg} flex items-center justify-center`}>
                          <Icons.user size={12} className={config.color} />
                        </div>
                        <span>{config.label}</span>
                        {filterRole === key && <Icons.check size={16} className="ml-auto text-workx-lime" />}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex gap-1 p-1 bg-white/5 rounded-xl">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-workx-lime text-workx-dark' : 'text-white/40 hover:text-white'}`}
          >
            <Icons.grid size={16} />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-workx-lime text-workx-dark' : 'text-white/40 hover:text-white'}`}
          >
            <Icons.list size={16} />
          </button>
        </div>
      </div>

      {/* Team Members */}
      {filteredMembers.length === 0 ? (
        <div className="card p-16 text-center">
          <div className="w-20 h-20 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
            <Icons.users className="text-white/20" size={32} />
          </div>
          <h3 className="text-lg font-medium text-white mb-2">Geen teamleden gevonden</h3>
          <p className="text-white/40">
            {searchQuery || filterRole !== 'all' ? 'Probeer andere filters' : 'Er zijn nog geen teamleden toegevoegd'}
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMembers.map((member, index) => {
            const config = roleConfig[member.role] || roleConfig.EMPLOYEE
            return (
              <div
                key={member.id}
                className="card p-6 hover:border-white/10 transition-all group relative overflow-hidden"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-workx-lime/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity" />

                <div className="relative">
                  {/* Avatar & Name */}
                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-workx-lime to-workx-lime/80 flex items-center justify-center flex-shrink-0 shadow-lg shadow-workx-lime/20">
                      <span className="text-workx-dark font-semibold text-xl">
                        {member.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-white text-lg truncate">{member.name}</h3>
                      <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full ${config.bg} ${config.color} mt-1`}>
                        {config.label}
                      </span>
                    </div>
                  </div>

                  {/* Contact Info */}
                  <div className="space-y-2.5">
                    <a
                      href={`mailto:${member.email}`}
                      className="flex items-center gap-3 text-sm text-white/50 hover:text-workx-lime transition-colors group/link"
                    >
                      <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center group-hover/link:bg-workx-lime/10 transition-colors">
                        <Icons.mail size={14} className="group-hover/link:text-workx-lime" />
                      </div>
                      <span className="truncate">{member.email}</span>
                    </a>

                    {member.phoneNumber && (
                      <a
                        href={`tel:${member.phoneNumber}`}
                        className="flex items-center gap-3 text-sm text-white/50 hover:text-workx-lime transition-colors group/link"
                      >
                        <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center group-hover/link:bg-workx-lime/10 transition-colors">
                          <Icons.phone size={14} className="group-hover/link:text-workx-lime" />
                        </div>
                        <span>{member.phoneNumber}</span>
                      </a>
                    )}

                    {member.department && (
                      <div className="flex items-center gap-3 text-sm text-white/50">
                        <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
                          <Icons.briefcase size={14} />
                        </div>
                        <span>{member.department}</span>
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="mt-5 pt-4 border-t border-white/5 flex items-center justify-between">
                    <span className="text-xs text-white/30 flex items-center gap-1.5">
                      <Icons.calendar size={12} />
                      Sinds {new Date(member.createdAt).toLocaleDateString('nl-NL', { month: 'short', year: 'numeric' })}
                    </span>
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/5">
                      <Icons.briefcase size={12} className="text-white/40" />
                      <span className="text-xs text-white/60">{member._count.assignedWork} zaken</span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left text-xs font-medium text-white/40 uppercase tracking-wider p-4">Naam</th>
                <th className="text-left text-xs font-medium text-white/40 uppercase tracking-wider p-4 hidden sm:table-cell">Email</th>
                <th className="text-left text-xs font-medium text-white/40 uppercase tracking-wider p-4 hidden md:table-cell">Afdeling</th>
                <th className="text-left text-xs font-medium text-white/40 uppercase tracking-wider p-4">Rol</th>
                <th className="text-right text-xs font-medium text-white/40 uppercase tracking-wider p-4">Zaken</th>
              </tr>
            </thead>
            <tbody>
              {filteredMembers.map((member, index) => {
                const config = roleConfig[member.role] || roleConfig.EMPLOYEE
                return (
                  <tr
                    key={member.id}
                    className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors"
                    style={{ animationDelay: `${index * 30}ms` }}
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-workx-lime to-workx-lime/80 flex items-center justify-center flex-shrink-0">
                          <span className="text-workx-dark font-semibold text-sm">
                            {member.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <span className="font-medium text-white">{member.name}</span>
                      </div>
                    </td>
                    <td className="p-4 hidden sm:table-cell">
                      <a href={`mailto:${member.email}`} className="text-sm text-white/50 hover:text-workx-lime transition-colors">
                        {member.email}
                      </a>
                    </td>
                    <td className="p-4 hidden md:table-cell">
                      <span className="text-sm text-white/50">{member.department || '-'}</span>
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full ${config.bg} ${config.color}`}>
                        {config.label}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <span className="text-sm text-white/60">{member._count.assignedWork}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
