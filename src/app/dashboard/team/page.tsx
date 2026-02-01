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

interface TeamMember {
  id: string
  name: string
  email: string
  role: string
  department: string | null
  phoneNumber: string | null
  startDate: string | null
  createdAt: string
  _count: { assignedWork: number }
}

const roleConfig: Record<string, { label: string; color: string; bg: string }> = {
  PARTNER: { label: 'Partner', color: 'text-purple-400', bg: 'bg-purple-500/10' },
  ADMIN: { label: 'Staff', color: 'text-workx-lime', bg: 'bg-workx-lime/10' },
  MANAGER: { label: 'Manager', color: 'text-blue-400', bg: 'bg-blue-500/10' },
  EMPLOYEE: { label: 'Advocaat', color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
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

  // Check if current user can reset passwords (ADMIN or PARTNER)
  const canResetPasswords = session?.user?.role === 'ADMIN' || session?.user?.role === 'PARTNER'

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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="card p-4 sm:p-5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:bg-cyan-500/10 transition-colors" />
          <div className="relative">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center mb-2 sm:mb-3">
              <Icons.users className="text-cyan-400" size={16} />
            </div>
            <p className="text-xl sm:text-2xl font-semibold text-white">{stats.total}</p>
            <p className="text-xs sm:text-sm text-white/40">Teamleden</p>
          </div>
        </div>

        <div className="card p-4 sm:p-5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:bg-purple-500/10 transition-colors" />
          <div className="relative">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-purple-500/10 flex items-center justify-center mb-2 sm:mb-3">
              <Icons.award className="text-purple-400" size={16} />
            </div>
            <p className="text-xl sm:text-2xl font-semibold text-white">{stats.partners}</p>
            <p className="text-xs sm:text-sm text-white/40">Partners</p>
          </div>
        </div>

        <div className="card p-4 sm:p-5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:bg-cyan-500/10 transition-colors" />
          <div className="relative">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center mb-2 sm:mb-3">
              <Icons.user className="text-cyan-400" size={16} />
            </div>
            <p className="text-xl sm:text-2xl font-semibold text-white">{stats.employees}</p>
            <p className="text-xs sm:text-sm text-white/40">Medewerkers</p>
          </div>
        </div>

        <div className="card p-4 sm:p-5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:bg-orange-500/10 transition-colors" />
          <div className="relative">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-orange-500/10 flex items-center justify-center mb-2 sm:mb-3">
              <Icons.briefcase className="text-orange-400" size={16} />
            </div>
            <p className="text-xl sm:text-2xl font-semibold text-white">{stats.totalWork}</p>
            <p className="text-xs sm:text-sm text-white/40">Actieve zaken</p>
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

                  {/* Datum in dienst - alleen voor niet-partners */}
                  {member.role !== 'PARTNER' && member.startDate && (
                    <div className="text-xs text-white/40 flex items-center gap-1.5">
                      <Icons.calendar size={12} />
                      In dienst sinds {new Date(member.startDate).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                  )}
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
                <th className="text-left text-xs font-medium text-white/40 uppercase tracking-wider p-4">Functie</th>
                <th className="text-left text-xs font-medium text-white/40 uppercase tracking-wider p-4 hidden md:table-cell">In dienst</th>
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
                    <td className="p-4">
                      <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full ${config.bg} ${config.color}`}>
                        {config.label}
                      </span>
                    </td>
                    <td className="p-4 hidden md:table-cell">
                      <span className="text-sm text-white/50">
                        {member.role === 'PARTNER' ? '-' : (member.startDate
                          ? new Date(member.startDate).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
                          : '-')}
                      </span>
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
