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

interface SickDayEntry {
  id: string
  userId: string
  startDate: string
  endDate: string
  workDays: number
  note: string | null
  user: { id: string; name: string }
}

interface SickDaysResponse {
  entries: SickDayEntry[]
  totals: { userId: string; totalDays: number }[]
}

const roleConfig: Record<string, { label: string; color: string; bg: string }> = {
  PARTNER: { label: 'Partner', color: 'text-purple-400', bg: 'bg-purple-500/10' },
  ADMIN: { label: 'Head of Office', color: 'text-workx-lime', bg: 'bg-workx-lime/10' },
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

  // Sick days state
  const [sickDaysData, setSickDaysData] = useState<SickDaysResponse>({ entries: [], totals: [] })
  const [showSickDaysModal, setShowSickDaysModal] = useState(false)
  const [sickDaysMember, setSickDaysMember] = useState<TeamMember | null>(null)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [entryMode, setEntryMode] = useState<'single' | 'period'>('single')
  const [sickStartDate, setSickStartDate] = useState('')
  const [sickEndDate, setSickEndDate] = useState('')
  const [sickDaysNote, setSickDaysNote] = useState('')
  const [isSavingSickDays, setIsSavingSickDays] = useState(false)
  const [isDeletingEntry, setIsDeletingEntry] = useState<string | null>(null)

  // Check if current user can manage (ADMIN or PARTNER)
  const canManage = session?.user?.role === 'ADMIN' || session?.user?.role === 'PARTNER'
  // Check if current user can reset passwords (ADMIN or PARTNER)
  const canResetPasswords = canManage

  useEffect(() => { fetchMembers() }, [])

  // Fetch sick days when user can manage or year changes
  useEffect(() => {
    if (canManage) {
      fetchSickDays()
    }
  }, [canManage, selectedYear])

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

  const fetchSickDays = async () => {
    try {
      const res = await fetch(`/api/sick-days?year=${selectedYear}`)
      if (res.ok) {
        const data = await res.json()
        setSickDaysData(data)
      }
    } catch (error) {
      console.error('Error fetching sick days:', error)
    }
  }

  const getSickDaysForMember = (memberId: string) => {
    return sickDaysData.totals.find(t => t.userId === memberId)?.totalDays || 0
  }

  const getMemberEntries = (memberId: string) => {
    return sickDaysData.entries.filter(e => e.userId === memberId)
  }

  const openSickDaysModal = (member: TeamMember) => {
    setSickDaysMember(member)
    setEntryMode('single')
    setSickStartDate('')
    setSickEndDate('')
    setSickDaysNote('')
    setShowSickDaysModal(true)
  }

  const handleSaveSickDays = async () => {
    if (!sickDaysMember || !sickStartDate) {
      toast.error('Selecteer een datum')
      return
    }

    // Voor periode mode moet er ook een einddatum zijn
    if (entryMode === 'period' && !sickEndDate) {
      toast.error('Selecteer een einddatum')
      return
    }

    setIsSavingSickDays(true)
    try {
      const res = await fetch('/api/sick-days', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: sickDaysMember.id,
          startDate: sickStartDate,
          endDate: entryMode === 'period' ? sickEndDate : sickStartDate,
          note: sickDaysNote || null,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Kon niet opslaan')
      }

      toast.success(`Ziektedag(en) toegevoegd voor ${sickDaysMember.name}`)
      // Reset form
      setSickStartDate('')
      setSickEndDate('')
      setSickDaysNote('')
      fetchSickDays()
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setIsSavingSickDays(false)
    }
  }

  const handleDeleteEntry = async (entryId: string) => {
    setIsDeletingEntry(entryId)
    try {
      const res = await fetch(`/api/sick-days?id=${entryId}`, {
        method: 'DELETE',
      })

      if (!res.ok) throw new Error('Kon niet verwijderen')

      toast.success('Ziektedag verwijderd')
      fetchSickDays()
    } catch (error) {
      toast.error('Kon ziektedag niet verwijderen')
    } finally {
      setIsDeletingEntry(null)
    }
  }

  const formatDateNL = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('nl-NL', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    })
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
          <p className="text-gray-400">Team laden...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 sm:gap-3 mb-1 sm:mb-2">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 flex items-center justify-center">
              <Icons.users className="text-cyan-400" size={18} />
            </div>
            <h1 className="text-xl sm:text-2xl font-semibold text-white">Team</h1>
          </div>
          <p className="text-gray-400 text-sm sm:text-base hidden sm:block">Overzicht van alle teamleden en hun rollen</p>
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
            <p className="text-xs sm:text-sm text-gray-400">Teamleden</p>
          </div>
        </div>

        <div className="card p-4 sm:p-5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:bg-purple-500/10 transition-colors" />
          <div className="relative">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-purple-500/10 flex items-center justify-center mb-2 sm:mb-3">
              <Icons.award className="text-purple-400" size={16} />
            </div>
            <p className="text-xl sm:text-2xl font-semibold text-white">{stats.partners}</p>
            <p className="text-xs sm:text-sm text-gray-400">Partners</p>
          </div>
        </div>

        <div className="card p-4 sm:p-5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:bg-cyan-500/10 transition-colors" />
          <div className="relative">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center mb-2 sm:mb-3">
              <Icons.user className="text-cyan-400" size={16} />
            </div>
            <p className="text-xl sm:text-2xl font-semibold text-white">{stats.employees}</p>
            <p className="text-xs sm:text-sm text-gray-400">Medewerkers</p>
          </div>
        </div>

        <div className="card p-4 sm:p-5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:bg-orange-500/10 transition-colors" />
          <div className="relative">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-orange-500/10 flex items-center justify-center mb-2 sm:mb-3">
              <Icons.briefcase className="text-orange-400" size={16} />
            </div>
            <p className="text-xl sm:text-2xl font-semibold text-white">{stats.totalWork}</p>
            <p className="text-xs sm:text-sm text-gray-400">Actieve zaken</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 w-full sm:w-auto">
          <div className="relative flex-1 sm:max-w-xs">
            <Icons.search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
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
                <span className="text-gray-300">Alle rollen</span>
              ) : (
                <span className={roleConfig[filterRole]?.color}>{roleConfig[filterRole]?.label}</span>
              )}
              <Icons.chevronDown size={16} className={`text-gray-400 transition-transform ${showRoleDropdown ? 'rotate-180' : ''}`} />
            </button>
            {showRoleDropdown && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowRoleDropdown(false)} />
                <div className="absolute left-0 top-full mt-2 w-48 z-50 bg-workx-dark/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden fade-in">
                  <div className="py-1">
                    <button
                      onClick={() => { setFilterRole('all'); setShowRoleDropdown(false) }}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-all ${filterRole === 'all' ? 'bg-workx-lime/10 text-white' : 'text-gray-300 hover:bg-white/5 hover:text-white'}`}
                    >
                      <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center">
                        <Icons.users size={12} className="text-gray-400" />
                      </div>
                      <span>Alle rollen</span>
                      {filterRole === 'all' && <Icons.check size={16} className="ml-auto text-workx-lime" />}
                    </button>
                    {Object.entries(roleConfig).map(([key, config]) => (
                      <button
                        key={key}
                        onClick={() => { setFilterRole(key); setShowRoleDropdown(false) }}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-all ${filterRole === key ? 'bg-workx-lime/10 text-white' : 'text-gray-300 hover:bg-white/5 hover:text-white'}`}
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
            className={`p-2.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-workx-lime text-workx-dark' : 'text-gray-400 hover:text-white'}`}
          >
            <Icons.grid size={16} />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-workx-lime text-workx-dark' : 'text-gray-400 hover:text-white'}`}
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
          <p className="text-gray-400">
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
                    <div className="text-xs text-gray-400 flex items-center gap-1.5">
                      <Icons.calendar size={12} />
                      In dienst sinds {new Date(member.startDate).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                  )}

                  {/* Sick days button for managers */}
                  {canManage && member.role !== 'PARTNER' && (
                    <div className="mt-4 pt-4 border-t border-white/5">
                      <button
                        onClick={() => openSickDaysModal(member)}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 hover:bg-red-500/10 text-gray-400 hover:text-red-400 transition-all text-sm"
                      >
                        <span className="flex items-center gap-2">
                          <Icons.heart size={14} />
                          Ziektedagen {selectedYear}
                        </span>
                        <span className={`font-medium ${getSickDaysForMember(member.id) > 0 ? 'text-red-400' : 'text-gray-500'}`}>
                          {getSickDaysForMember(member.id)} dagen
                        </span>
                      </button>
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
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider p-4">Naam</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider p-4">Functie</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider p-4 hidden md:table-cell">In dienst</th>
                {canManage && <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider p-4 hidden lg:table-cell">Ziektedagen</th>}
                {canResetPasswords && <th className="text-right text-xs font-medium text-gray-400 uppercase tracking-wider p-4 w-24">Acties</th>}
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
                      <span className="text-sm text-gray-400">
                        {member.role === 'PARTNER' ? '-' : (member.startDate
                          ? new Date(member.startDate).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
                          : '-')}
                      </span>
                    </td>
                    {canManage && (
                      <td className="p-4 hidden lg:table-cell">
                        {member.role === 'PARTNER' ? (
                          <span className="text-sm text-gray-500">-</span>
                        ) : (
                          <span className={`text-sm font-medium ${getSickDaysForMember(member.id) > 0 ? 'text-red-400' : 'text-gray-500'}`}>
                            {getSickDaysForMember(member.id)} dagen
                          </span>
                        )}
                      </td>
                    )}
                    {canResetPasswords && (
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {member.role !== 'PARTNER' && (
                            <button
                              onClick={() => openSickDaysModal(member)}
                              className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                              title="Ziektedagen bewerken"
                            >
                              <Icons.heart size={14} />
                            </button>
                          )}
                          <button
                            onClick={() => openResetModal(member)}
                            className="p-2 text-gray-500 hover:text-workx-lime hover:bg-workx-lime/10 rounded-lg transition-all"
                            title="Wachtwoord resetten"
                          >
                            <Icons.lock size={14} />
                          </button>
                        </div>
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
                className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
              >
                <Icons.x size={18} />
              </button>
            </div>

            {/* Selected user info */}
            <div className="flex items-center gap-4 p-4 mb-6 rounded-xl bg-white/5 border border-white/10">
              <TeamAvatar name={selectedMember.name} size="large" />
              <div>
                <p className="font-medium text-white">{selectedMember.name}</p>
                <p className="text-sm text-gray-400">{selectedMember.email}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Nieuw wachtwoord</label>
                <div className="relative">
                  <Icons.lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                  <input
                    type="text"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className="input-field pl-10"
                    placeholder="Minimaal 6 tekens..."
                    autoFocus
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1.5">
                  Het nieuwe wachtwoord is direct actief. Informeer de medewerker over het nieuwe wachtwoord.
                </p>
              </div>

              {/* Quick password suggestions */}
              <div>
                <p className="text-xs text-gray-400 mb-2">Snelle suggesties:</p>
                <div className="flex flex-wrap gap-2">
                  {['Workx2024!', 'Welkom123!', 'Reset2024!'].map(pwd => (
                    <button
                      key={pwd}
                      type="button"
                      onClick={() => setNewPassword(pwd)}
                      className="px-3 py-1.5 text-xs bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-lg transition-colors"
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

      {/* Sick Days Modal */}
      {showSickDaysModal && sickDaysMember && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowSickDaysModal(false)}>
          <div className="card p-6 w-full max-w-lg relative max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                  <Icons.heart className="text-red-400" size={18} />
                </div>
                <div>
                  <h2 className="font-semibold text-white text-lg">Ziektedagen</h2>
                  {/* Year selector */}
                  <select
                    value={selectedYear}
                    onChange={e => setSelectedYear(parseInt(e.target.value))}
                    className="mt-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-sm text-gray-300 focus:outline-none focus:border-red-500/30"
                  >
                    {[2025, 2026, 2027, 2028, 2029, 2030].map(year => (
                      <option key={year} value={year} className="bg-workx-dark">{year}</option>
                    ))}
                  </select>
                </div>
              </div>
              <button
                onClick={() => setShowSickDaysModal(false)}
                className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
              >
                <Icons.x size={18} />
              </button>
            </div>

            {/* Selected user info with total */}
            <div className="flex items-center justify-between p-4 mb-6 rounded-xl bg-white/5 border border-white/10">
              <div className="flex items-center gap-4">
                <TeamAvatar name={sickDaysMember.name} size="large" />
                <div>
                  <p className="font-medium text-white">{sickDaysMember.name}</p>
                  <p className="text-sm text-gray-400">{sickDaysMember.email}</p>
                </div>
              </div>
              <div className="text-right">
                <p className={`text-2xl font-semibold ${getSickDaysForMember(sickDaysMember.id) > 0 ? 'text-red-400' : 'text-gray-500'}`}>
                  {getSickDaysForMember(sickDaysMember.id)}
                </p>
                <p className="text-xs text-gray-500">werkdagen</p>
              </div>
            </div>

            {/* Existing entries */}
            {getMemberEntries(sickDaysMember.id).length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm text-gray-400 mb-3">Geregistreerde periodes</h3>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {getMemberEntries(sickDaysMember.id).map(entry => (
                    <div key={entry.id} className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/5 group hover:border-red-500/20 transition-all">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                          <Icons.calendar size={14} className="text-red-400" />
                        </div>
                        <div>
                          <p className="text-sm text-white">
                            {formatDateNL(entry.startDate)}
                            {entry.startDate !== entry.endDate && (
                              <span className="text-gray-400"> - {formatDateNL(entry.endDate)}</span>
                            )}
                          </p>
                          {entry.note && (
                            <p className="text-xs text-gray-500 mt-0.5">{entry.note}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-red-400 font-medium">{entry.workDays} {entry.workDays === 1 ? 'dag' : 'dagen'}</span>
                        <button
                          onClick={() => handleDeleteEntry(entry.id)}
                          disabled={isDeletingEntry === entry.id}
                          className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                          title="Verwijderen"
                        >
                          {isDeletingEntry === entry.id ? (
                            <span className="w-3 h-3 border-2 border-red-400 border-t-transparent rounded-full animate-spin inline-block" />
                          ) : (
                            <Icons.trash size={14} />
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add new entry */}
            <div className="border-t border-white/5 pt-6">
              <h3 className="text-sm text-gray-400 mb-4">Nieuwe ziektedag(en) toevoegen</h3>

              {/* Entry mode toggle */}
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setEntryMode('single')}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                    entryMode === 'single'
                      ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                      : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-transparent'
                  }`}
                >
                  <Icons.calendar size={14} className="inline mr-2" />
                  Enkele dag
                </button>
                <button
                  onClick={() => setEntryMode('period')}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                    entryMode === 'period'
                      ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                      : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-transparent'
                  }`}
                >
                  <Icons.calendar size={14} className="inline mr-2" />
                  Periode
                </button>
              </div>

              <div className="space-y-4">
                {/* Date inputs */}
                <div className={`grid gap-4 ${entryMode === 'period' ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">
                      {entryMode === 'single' ? 'Datum' : 'Startdatum'}
                    </label>
                    <input
                      type="date"
                      value={sickStartDate}
                      onChange={e => setSickStartDate(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-red-500/30 focus:bg-white/10 transition-all"
                    />
                  </div>
                  {entryMode === 'period' && (
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">Einddatum</label>
                      <input
                        type="date"
                        value={sickEndDate}
                        onChange={e => setSickEndDate(e.target.value)}
                        min={sickStartDate}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-red-500/30 focus:bg-white/10 transition-all"
                      />
                    </div>
                  )}
                </div>

                {/* Note */}
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Notitie (optioneel)</label>
                  <input
                    type="text"
                    value={sickDaysNote}
                    onChange={e => setSickDaysNote(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-red-500/30 focus:bg-white/10 transition-all"
                    placeholder="Bijv. griep, rugklachten..."
                  />
                </div>

                <p className="text-xs text-gray-500">
                  Werkdagen (ma-vr) worden automatisch berekend. Weekenden worden overgeslagen.
                </p>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowSickDaysModal(false)}
                  className="flex-1 btn-secondary"
                >
                  Sluiten
                </button>
                <button
                  onClick={handleSaveSickDays}
                  disabled={isSavingSickDays || !sickStartDate || (entryMode === 'period' && !sickEndDate)}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white font-medium py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSavingSickDays ? (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Icons.plus size={16} />
                      Toevoegen
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
