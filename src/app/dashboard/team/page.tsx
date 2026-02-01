'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'
import { Icons } from '@/components/ui/Icons'
import { getPhotoUrl } from '@/lib/team-photos'

// Team Avatar Component
function TeamAvatar({
  name,
  size = 'medium',
  className = ''
}: {
  name: string
  size?: 'small' | 'medium' | 'large'
  className?: string
}) {
  const photoUrl = getPhotoUrl(name)
  const [imageError, setImageError] = useState(false)

  const sizeClasses = {
    small: 'w-9 h-9 rounded-lg text-sm',
    medium: 'w-14 h-14 rounded-xl text-xl',
    large: 'w-12 h-12 rounded-xl text-lg',
  }

  const containerSizes = {
    small: 'team-photo-small',
    medium: 'team-photo-medium',
    large: 'team-photo-large',
  }

  if (photoUrl && !imageError) {
    return (
      <div className={`team-photo-container team-photo-glow ${containerSizes[size]} flex-shrink-0 ${className}`}>
        <img
          src={photoUrl}
          alt={name}
          className="team-photo"
          onError={() => setImageError(true)}
          loading="lazy"
        />
      </div>
    )
  }

  // Fallback to letter avatar
  return (
    <div className={`team-avatar-fallback ${sizeClasses[size]} flex-shrink-0 shadow-lg shadow-workx-lime/20 ${className}`}>
      <span>{name.charAt(0).toUpperCase()}</span>
    </div>
  )
}

interface VacationBalance {
  opbouwLopendJaar: number
  overgedragenVorigJaar: number
  bijgekocht: number
  opgenomenLopendJaar: number
  note: string | null
}

interface ParentalLeave {
  betaaldTotaalWeken: number
  betaaldOpgenomenWeken: number
  onbetaaldTotaalWeken: number
  onbetaaldOpgenomenWeken: number
  eindDatum: string | null
  note: string | null
}

interface TeamMember {
  id: string
  name: string
  email: string
  role: string
  department: string | null
  phoneNumber: string | null
  createdAt: string
  _count: { assignedWork: number }
  vacationBalance?: VacationBalance | null
  parentalLeave?: ParentalLeave | null
}

const roleConfig: Record<string, { label: string; color: string; bg: string }> = {
  PARTNER: { label: 'Partner', color: 'text-purple-400', bg: 'bg-purple-500/10' },
  ADMIN: { label: 'Kantoor', color: 'text-workx-lime', bg: 'bg-workx-lime/10' },
  MANAGER: { label: 'Manager', color: 'text-blue-400', bg: 'bg-blue-500/10' },
  EMPLOYEE: { label: 'Medewerker', color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
}

export default function TeamPage() {
  const { data: session } = useSession()
  const [members, setMembers] = useState<TeamMember[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterRole, setFilterRole] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [showRoleDropdown, setShowRoleDropdown] = useState(false)

  // Password reset state
  const [showResetModal, setShowResetModal] = useState(false)
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [isResetting, setIsResetting] = useState(false)

  // Vacation modal state
  const [showVacationModal, setShowVacationModal] = useState(false)
  const [vacationMember, setVacationMember] = useState<TeamMember | null>(null)

  // Check if current user can reset passwords (ADMIN or PARTNER)
  const canResetPasswords = session?.user?.role === 'ADMIN' || session?.user?.role === 'PARTNER'
  const canSeeVacation = canResetPasswords

  const openVacationModal = (member: TeamMember) => {
    setVacationMember(member)
    setShowVacationModal(true)
  }

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

  const handleResetPassword = async () => {
    if (!selectedMember || !newPassword) return
    if (newPassword.length < 6) {
      toast.error('Wachtwoord moet minimaal 6 tekens bevatten')
      return
    }

    setIsResetting(true)
    try {
      const res = await fetch('/api/admin/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedMember.id, newPassword }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Kon wachtwoord niet resetten')

      toast.success(`Wachtwoord gereset voor ${selectedMember.name}`)
      setShowResetModal(false)
      setSelectedMember(null)
      setNewPassword('')
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setIsResetting(false)
    }
  }

  const openResetModal = (member: TeamMember) => {
    setSelectedMember(member)
    setNewPassword('')
    setShowResetModal(true)
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
                    <TeamAvatar name={member.name} size="medium" />
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

                  {/* Vacation summary for admins/partners */}
                  {canSeeVacation && member.vacationBalance && (
                    <button
                      onClick={() => openVacationModal(member)}
                      className="w-full mt-4 p-3 rounded-xl bg-gradient-to-r from-green-500/10 to-blue-500/10 border border-green-500/20 hover:border-green-500/40 transition-all text-left group/vac"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Icons.sun size={14} className="text-green-400" />
                          <span className="text-xs text-white/60">Vakantiedagen</span>
                        </div>
                        <Icons.chevronRight size={14} className="text-white/30 group-hover/vac:text-green-400 transition-colors" />
                      </div>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-lg font-semibold text-green-400">
                          {(member.vacationBalance.opbouwLopendJaar + member.vacationBalance.overgedragenVorigJaar + member.vacationBalance.bijgekocht - member.vacationBalance.opgenomenLopendJaar).toFixed(1)}
                        </span>
                        <span className="text-xs text-white/40">dagen over</span>
                        {member.parentalLeave && (
                          <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400">O.V.</span>
                        )}
                      </div>
                    </button>
                  )}

                  {/* Footer */}
                  <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
                    <span className="text-xs text-white/30 flex items-center gap-1.5">
                      <Icons.calendar size={12} />
                      Sinds {new Date(member.createdAt).toLocaleDateString('nl-NL', { month: 'short', year: 'numeric' })}
                    </span>
                    <div className="flex items-center gap-2">
                      {canResetPasswords && (
                        <button
                          onClick={() => openResetModal(member)}
                          className="p-1.5 text-white/30 hover:text-workx-lime hover:bg-workx-lime/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                          title="Wachtwoord resetten"
                        >
                          <Icons.lock size={14} />
                        </button>
                      )}
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/5">
                        <Icons.briefcase size={12} className="text-white/40" />
                        <span className="text-xs text-white/60">{member._count.assignedWork} zaken</span>
                      </div>
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
                {canResetPasswords && <th className="text-right text-xs font-medium text-white/40 uppercase tracking-wider p-4 w-20">Acties</th>}
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
                        <TeamAvatar name={member.name} size="small" />
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
                    {canResetPasswords && (
                      <td className="p-4 text-right">
                        <button
                          onClick={() => openResetModal(member)}
                          className="p-2 text-white/30 hover:text-workx-lime hover:bg-workx-lime/10 rounded-lg transition-all"
                          title="Wachtwoord resetten"
                        >
                          <Icons.lock size={14} />
                        </button>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Vacation Details Modal */}
      {showVacationModal && vacationMember && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowVacationModal(false)}>
          <div className="card p-6 w-full max-w-md relative" onClick={e => e.stopPropagation()}>
            <div className="absolute top-0 right-0 w-24 h-24 bg-green-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                  <Icons.sun className="text-green-400" size={18} />
                </div>
                <h2 className="font-semibold text-white text-lg">Verlof overzicht</h2>
              </div>
              <button
                onClick={() => setShowVacationModal(false)}
                className="p-2 text-white/40 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
              >
                <Icons.x size={18} />
              </button>
            </div>

            {/* User info */}
            <div className="flex items-center gap-4 p-4 mb-6 rounded-xl bg-white/5 border border-white/10">
              <TeamAvatar name={vacationMember.name} size="large" />
              <div>
                <p className="font-medium text-white">{vacationMember.name}</p>
                <p className="text-sm text-white/40">{vacationMember.email}</p>
              </div>
            </div>

            {/* Vacation Balance */}
            {vacationMember.vacationBalance && (
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-white/60 uppercase tracking-wider">Vakantiedagen 2026</h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-white/5">
                    <p className="text-xs text-white/40">Opbouw dit jaar</p>
                    <p className="text-xl font-semibold text-white">{vacationMember.vacationBalance.opbouwLopendJaar}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-white/5">
                    <p className="text-xs text-white/40">Overgedragen</p>
                    <p className="text-xl font-semibold text-blue-400">{vacationMember.vacationBalance.overgedragenVorigJaar}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-white/5">
                    <p className="text-xs text-white/40">Bijgekocht</p>
                    <p className="text-xl font-semibold text-purple-400">{vacationMember.vacationBalance.bijgekocht}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-white/5">
                    <p className="text-xs text-white/40">Opgenomen</p>
                    <p className="text-xl font-semibold text-orange-400">{vacationMember.vacationBalance.opgenomenLopendJaar}</p>
                  </div>
                </div>

                {/* Total and remaining */}
                <div className="p-4 rounded-xl bg-gradient-to-r from-green-500/10 to-green-500/5 border border-green-500/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-white/40">Totaal beschikbaar</p>
                      <p className="text-sm text-white/60">
                        {vacationMember.vacationBalance.opbouwLopendJaar} + {vacationMember.vacationBalance.overgedragenVorigJaar} + {vacationMember.vacationBalance.bijgekocht} = {(vacationMember.vacationBalance.opbouwLopendJaar + vacationMember.vacationBalance.overgedragenVorigJaar + vacationMember.vacationBalance.bijgekocht).toFixed(1)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-white/40">Resterend</p>
                      <p className="text-2xl font-bold text-green-400">
                        {(vacationMember.vacationBalance.opbouwLopendJaar + vacationMember.vacationBalance.overgedragenVorigJaar + vacationMember.vacationBalance.bijgekocht - vacationMember.vacationBalance.opgenomenLopendJaar).toFixed(1)}
                      </p>
                    </div>
                  </div>
                </div>

                {vacationMember.vacationBalance.note && (
                  <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
                    <p className="text-xs text-blue-400 flex items-center gap-2">
                      <Icons.info size={12} />
                      {vacationMember.vacationBalance.note}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Parental Leave */}
            {vacationMember.parentalLeave && (
              <div className="mt-6 pt-6 border-t border-white/10 space-y-4">
                <h3 className="text-sm font-medium text-white/60 uppercase tracking-wider flex items-center gap-2">
                  <Icons.heart size={14} className="text-purple-400" />
                  Ouderschapsverlof
                </h3>

                <div className="space-y-3">
                  {/* Betaald verlof */}
                  <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/20">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-green-400 font-medium">Betaald (70% UWV)</span>
                      <span className="text-xs text-white/40">
                        {vacationMember.parentalLeave.betaaldOpgenomenWeken} / {vacationMember.parentalLeave.betaaldTotaalWeken} weken
                      </span>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-400 rounded-full"
                        style={{ width: `${(vacationMember.parentalLeave.betaaldOpgenomenWeken / vacationMember.parentalLeave.betaaldTotaalWeken) * 100}%` }}
                      />
                    </div>
                    <p className="text-xs text-green-400 mt-1">
                      {vacationMember.parentalLeave.betaaldTotaalWeken - vacationMember.parentalLeave.betaaldOpgenomenWeken} weken resterend
                    </p>
                  </div>

                  {/* Onbetaald verlof */}
                  {vacationMember.parentalLeave.onbetaaldTotaalWeken > 0 && (
                    <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-purple-400 font-medium">Onbetaald</span>
                        <span className="text-xs text-white/40">
                          {vacationMember.parentalLeave.onbetaaldOpgenomenWeken} / {vacationMember.parentalLeave.onbetaaldTotaalWeken} weken
                        </span>
                      </div>
                      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-purple-400 rounded-full"
                          style={{ width: `${(vacationMember.parentalLeave.onbetaaldOpgenomenWeken / vacationMember.parentalLeave.onbetaaldTotaalWeken) * 100}%` }}
                        />
                      </div>
                      <p className="text-xs text-purple-400 mt-1">
                        {vacationMember.parentalLeave.onbetaaldTotaalWeken - vacationMember.parentalLeave.onbetaaldOpgenomenWeken} weken resterend
                      </p>
                    </div>
                  )}

                  {vacationMember.parentalLeave.eindDatum && (
                    <p className="text-xs text-white/40">
                      Te gebruiken tot: {new Date(vacationMember.parentalLeave.eindDatum).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                  )}

                  {vacationMember.parentalLeave.note && (
                    <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20">
                      <p className="text-xs text-purple-400 flex items-center gap-2">
                        <Icons.info size={12} />
                        {vacationMember.parentalLeave.note}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            <button
              onClick={() => setShowVacationModal(false)}
              className="w-full btn-secondary mt-6"
            >
              Sluiten
            </button>
          </div>
        </div>
      )}

      {/* Password Reset Modal */}
      {showResetModal && selectedMember && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowResetModal(false)}>
          <div className="card p-6 w-full max-w-md relative" onClick={e => e.stopPropagation()}>
            <div className="absolute top-0 right-0 w-24 h-24 bg-workx-lime/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-workx-lime/10 flex items-center justify-center">
                  <Icons.lock className="text-workx-lime" size={18} />
                </div>
                <h2 className="font-semibold text-white text-lg">Wachtwoord resetten</h2>
              </div>
              <button
                onClick={() => setShowResetModal(false)}
                className="p-2 text-white/40 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
              >
                <Icons.x size={18} />
              </button>
            </div>

            {/* Selected user info */}
            <div className="flex items-center gap-4 p-4 mb-6 rounded-xl bg-white/5 border border-white/10">
              <TeamAvatar name={selectedMember.name} size="large" />
              <div>
                <p className="font-medium text-white">{selectedMember.name}</p>
                <p className="text-sm text-white/40">{selectedMember.email}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-white/60 mb-2">Nieuw wachtwoord</label>
                <div className="relative">
                  <Icons.lock className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={16} />
                  <input
                    type="text"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className="input-field pl-10"
                    placeholder="Minimaal 6 tekens..."
                    autoFocus
                  />
                </div>
                <p className="text-xs text-white/30 mt-1.5">
                  Het nieuwe wachtwoord is direct actief. Informeer de medewerker over het nieuwe wachtwoord.
                </p>
              </div>

              {/* Quick password suggestions */}
              <div>
                <p className="text-xs text-white/40 mb-2">Snelle suggesties:</p>
                <div className="flex flex-wrap gap-2">
                  {['Workx2024!', 'Welkom123!', 'Reset2024!'].map(pwd => (
                    <button
                      key={pwd}
                      type="button"
                      onClick={() => setNewPassword(pwd)}
                      className="px-3 py-1.5 text-xs bg-white/5 hover:bg-white/10 text-white/60 hover:text-white rounded-lg transition-colors"
                    >
                      {pwd}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowResetModal(false)}
                className="flex-1 btn-secondary"
              >
                Annuleren
              </button>
              <button
                onClick={handleResetPassword}
                disabled={!newPassword || newPassword.length < 6 || isResetting}
                className="flex-1 btn-primary flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isResetting ? (
                  <span className="w-4 h-4 border-2 border-workx-dark border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Icons.check size={16} />
                    Resetten
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
