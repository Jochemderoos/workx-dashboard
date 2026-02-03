'use client'

import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import * as Popover from '@radix-ui/react-popover'
import { Icons } from '@/components/ui/Icons'
import { useSession } from 'next-auth/react'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

interface User {
  id: string
  email: string
  name: string
  role: string
  department: string | null
  isActive: boolean
  createdAt: string
}

export default function SettingsPage() {
  const { data: session } = useSession()
  const [isLoading, setIsLoading] = useState(false)
  const [profile, setProfile] = useState({ name: '', phone: '', department: '', birthDate: '' })
  const [profileLoaded, setProfileLoaded] = useState(false)

  // Load profile from API
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const res = await fetch('/api/user/profile')
        if (res.ok) {
          const data = await res.json()
          setProfile({
            name: data.name || session?.user?.name || '',
            phone: data.phoneNumber || '',
            department: data.department || '',
            birthDate: data.birthDate || ''
          })
        } else {
          // Fallback to session data
          setProfile(prev => ({
            ...prev,
            name: session?.user?.name || ''
          }))
        }
      } catch (e) {
        // Fallback to session data
        setProfile(prev => ({
          ...prev,
          name: session?.user?.name || ''
        }))
      } finally {
        setProfileLoaded(true)
      }
    }
    if (session?.user) {
      loadProfile()
    }
  }, [session])
  const [password, setPassword] = useState({ current: '', new: '', confirm: '' })
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'notifications' | 'admin'>('profile')

  // Admin state
  const [users, setUsers] = useState<User[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showResetModal, setShowResetModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [newUser, setNewUser] = useState({ email: '', name: '', password: '', role: 'EMPLOYEE', department: '' })
  const [newPassword, setNewPassword] = useState('')
  const [createLoading, setCreateLoading] = useState(false)

  // Check if current user is admin/partner
  const isAdmin = session?.user?.role === 'ADMIN' || session?.user?.role === 'PARTNER'

  // Fetch users when admin tab is active
  useEffect(() => {
    if (activeTab === 'admin' && isAdmin) {
      fetchUsers()
    }
  }, [activeTab, isAdmin])

  const fetchUsers = async () => {
    setUsersLoading(true)
    try {
      const res = await fetch('/api/admin/users')
      if (res.ok) {
        const data = await res.json()
        setUsers(data)
      }
    } catch (e) {
      toast.error('Kon gebruikers niet laden')
    } finally {
      setUsersLoading(false)
    }
  }

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newUser.email || !newUser.name || !newUser.password) {
      return toast.error('Vul alle verplichte velden in')
    }
    if (newUser.password.length < 6) {
      return toast.error('Wachtwoord moet minimaal 6 tekens zijn')
    }

    setCreateLoading(true)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      toast.success(`Account aangemaakt voor ${newUser.name}`)
      setShowCreateModal(false)
      setNewUser({ email: '', name: '', password: '', role: 'EMPLOYEE', department: '' })
      fetchUsers()
    } catch (e: any) {
      toast.error(e.message || 'Kon account niet aanmaken')
    } finally {
      setCreateLoading(false)
    }
  }

  const resetPassword = async () => {
    if (!selectedUser || !newPassword) return
    if (newPassword.length < 6) {
      return toast.error('Wachtwoord moet minimaal 6 tekens zijn')
    }

    setCreateLoading(true)
    try {
      const res = await fetch('/api/admin/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedUser.id, newPassword })
      })
      if (!res.ok) throw new Error()

      toast.success(`Wachtwoord gereset voor ${selectedUser.name}`)
      setShowResetModal(false)
      setSelectedUser(null)
      setNewPassword('')
    } catch (e) {
      toast.error('Kon wachtwoord niet resetten')
    } finally {
      setCreateLoading(false)
    }
  }

  const toggleUserActive = async (user: User) => {
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, isActive: !user.isActive })
      })
      if (!res.ok) throw new Error()

      toast.success(user.isActive ? `${user.name} gedeactiveerd` : `${user.name} geactiveerd`)
      fetchUsers()
    } catch (e) {
      toast.error('Kon status niet wijzigen')
    }
  }

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'ADMIN': return 'badge badge-lime'
      case 'PARTNER': return 'badge bg-purple-500/20 text-purple-300'
      default: return 'badge bg-white/10 text-gray-400'
    }
  }

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'ADMIN': return 'Head of Office'
      case 'PARTNER': return 'Partner'
      default: return 'Medewerker'
    }
  }

  const updateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: profile.name,
          phoneNumber: profile.phone || null,
          department: profile.department || null,
          birthDate: profile.birthDate || null
        }),
      })
      if (!res.ok) throw new Error()
      toast.success('Profiel bijgewerkt')
    } catch (e) {
      toast.error('Kon niet opslaan')
    } finally {
      setIsLoading(false)
    }
  }

  const updatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.new !== password.confirm) return toast.error('Wachtwoorden komen niet overeen')
    if (password.new.length < 6) return toast.error('Minimaal 6 tekens')

    setIsLoading(true)
    try {
      const res = await fetch('/api/user/password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: password.current, newPassword: password.new }),
      })
      if (!res.ok) throw new Error()
      toast.success('Wachtwoord gewijzigd')
      setPassword({ current: '', new: '', confirm: '' })
    } catch (e) {
      toast.error('Kon niet wijzigen')
    } finally {
      setIsLoading(false)
    }
  }

  const tabs = [
    { id: 'profile' as const, label: 'Profiel', icon: Icons.user, iconAnim: 'icon-users-hover' },
    { id: 'security' as const, label: 'Beveiliging', icon: Icons.shield, iconAnim: 'icon-zap-hover' },
    { id: 'notifications' as const, label: 'Notificaties', icon: Icons.bell, iconAnim: 'icon-bell-hover' },
    ...(isAdmin ? [{ id: 'admin' as const, label: 'Beheer', icon: Icons.users, iconAnim: 'icon-users-hover' }] : []),
  ]

  return (
    <div className="max-w-4xl space-y-8 fade-in">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 sm:gap-3 mb-1 sm:mb-2">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center">
            <Icons.settings className="text-gray-400" size={18} />
          </div>
          <h1 className="text-xl sm:text-2xl font-semibold text-white">Instellingen</h1>
        </div>
        <p className="text-gray-400 text-sm sm:text-base hidden sm:block">Beheer je account en voorkeuren</p>
      </div>

      {/* Account Info Card */}
      <div className="card p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-workx-lime/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative flex items-center gap-5">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-workx-lime to-workx-lime/80 flex items-center justify-center shadow-lg shadow-workx-lime/20">
            <span className="text-workx-dark font-bold text-3xl">
              {(profile.name || session?.user?.name || 'U').charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">{profile.name || session?.user?.name || 'Gebruiker'}</h2>
            <p className="text-gray-400">{session?.user?.email || ''}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className={session?.user?.role === 'ADMIN' ? 'badge badge-lime' : session?.user?.role === 'PARTNER' ? 'badge bg-purple-500/20 text-purple-300' : 'badge bg-white/10 text-gray-400'}>
                {session?.user?.role === 'ADMIN' ? 'Head of Office' : session?.user?.role === 'PARTNER' ? 'Partner' : 'Medewerker'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-white/5 rounded-xl w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-workx-lime text-workx-dark'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'profile' && (
        <div className="card p-6 space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-white/5">
            <Icons.user className="text-gray-400" size={18} />
            <h2 className="font-medium text-white">Profiel informatie</h2>
          </div>

          <form onSubmit={updateProfile} className="space-y-5">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Email</label>
              <input
                type="email"
                value={session?.user?.email || ''}
                disabled
                className="input-field opacity-50 cursor-not-allowed"
              />
              <p className="text-xs text-white/30 mt-1.5">Email kan niet worden gewijzigd</p>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Volledige naam</label>
              <div className="relative">
                <Icons.user className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={16} />
                <input
                  type="text"
                  value={profile.name}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                  className="input-field pl-11"
                  placeholder="Je naam"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Telefoonnummer</label>
                <div className="relative">
                  <Icons.phone className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={16} />
                  <input
                    type="tel"
                    value={profile.phone}
                    onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                    className="input-field pl-11"
                    placeholder="+31 6 12345678"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Afdeling</label>
                <div className="relative">
                  <Icons.briefcase className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={16} />
                  <input
                    type="text"
                    value={profile.department}
                    onChange={(e) => setProfile({ ...profile, department: e.target.value })}
                    className="input-field pl-11"
                    placeholder="Arbeidsrecht"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Verjaardag</label>
              <Popover.Root>
                <Popover.Trigger asChild>
                  <button
                    type="button"
                    className="w-full flex items-center gap-3 px-4 py-3 bg-gradient-to-br from-workx-gray/90 to-workx-dark/95 border border-white/10 rounded-xl text-left hover:border-workx-lime/30 hover:shadow-lg hover:shadow-workx-lime/5 focus:outline-none focus:border-workx-lime/50 focus:ring-2 focus:ring-workx-lime/20 transition-all duration-300 group"
                  >
                    <span className="text-lg">🎂</span>
                    <span className={profile.birthDate ? 'text-white' : 'text-white/40'}>
                      {profile.birthDate
                        ? (() => {
                            const [m, d] = profile.birthDate.split('-')
                            const months = ['', 'januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december']
                            return `${parseInt(d)} ${months[parseInt(m)]}`
                          })()
                        : 'Selecteer je verjaardag...'}
                    </span>
                    <Icons.chevronDown size={16} className="ml-auto text-white/30 group-hover:text-workx-lime transition-colors" />
                  </button>
                </Popover.Trigger>
                <Popover.Portal>
                  <Popover.Content
                    className="w-72 bg-workx-gray rounded-2xl border border-white/10 p-4 shadow-2xl z-50 animate-modal-in"
                    sideOffset={8}
                    align="start"
                  >
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs text-gray-400 mb-2">Dag</label>
                        <div className="grid grid-cols-7 gap-1">
                          {Array.from({ length: 31 }, (_, i) => i + 1).map(d => {
                            const dayStr = String(d).padStart(2, '0')
                            const isSelected = profile.birthDate?.split('-')[1] === dayStr
                            return (
                              <button
                                key={d}
                                type="button"
                                onClick={() => {
                                  const month = profile.birthDate ? profile.birthDate.split('-')[0] : '01'
                                  setProfile({ ...profile, birthDate: `${month}-${dayStr}` })
                                }}
                                className={`w-8 h-8 rounded-lg text-sm font-medium transition-all ${
                                  isSelected
                                    ? 'bg-workx-lime text-workx-dark'
                                    : 'text-white hover:bg-white/10'
                                }`}
                              >
                                {d}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-2">Maand</label>
                        <div className="grid grid-cols-3 gap-1">
                          {[
                            { val: '01', label: 'Jan' },
                            { val: '02', label: 'Feb' },
                            { val: '03', label: 'Mrt' },
                            { val: '04', label: 'Apr' },
                            { val: '05', label: 'Mei' },
                            { val: '06', label: 'Jun' },
                            { val: '07', label: 'Jul' },
                            { val: '08', label: 'Aug' },
                            { val: '09', label: 'Sep' },
                            { val: '10', label: 'Okt' },
                            { val: '11', label: 'Nov' },
                            { val: '12', label: 'Dec' },
                          ].map(m => {
                            const isSelected = profile.birthDate?.split('-')[0] === m.val
                            return (
                              <button
                                key={m.val}
                                type="button"
                                onClick={() => {
                                  const day = profile.birthDate ? profile.birthDate.split('-')[1] : '01'
                                  setProfile({ ...profile, birthDate: `${m.val}-${day}` })
                                }}
                                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                                  isSelected
                                    ? 'bg-workx-lime text-workx-dark'
                                    : 'text-white hover:bg-white/10'
                                }`}
                              >
                                {m.label}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                    <Popover.Arrow className="fill-workx-gray" />
                  </Popover.Content>
                </Popover.Portal>
              </Popover.Root>
              <p className="text-xs text-white/30 mt-2">Wordt getoond in de verjaardagen widget</p>
            </div>

            <div className="pt-4">
              <button type="submit" disabled={isLoading} className="btn-primary w-full sm:w-auto disabled:opacity-50 flex items-center justify-center gap-2">
                {isLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-workx-dark border-t-transparent rounded-full animate-spin" />
                    Opslaan...
                  </>
                ) : (
                  <>
                    <Icons.check size={16} />
                    Wijzigingen opslaan
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {activeTab === 'security' && (
        <div className="card p-6 space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-white/5">
            <Icons.shield className="text-gray-400" size={18} />
            <h2 className="font-medium text-white">Wachtwoord wijzigen</h2>
          </div>

          <form onSubmit={updatePassword} className="space-y-5">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Huidig wachtwoord</label>
              <div className="relative">
                <Icons.lock className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={16} />
                <input
                  type="password"
                  value={password.current}
                  onChange={(e) => setPassword({ ...password, current: e.target.value })}
                  className="input-field pl-11"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Nieuw wachtwoord</label>
              <div className="relative">
                <Icons.lock className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={16} />
                <input
                  type="password"
                  value={password.new}
                  onChange={(e) => setPassword({ ...password, new: e.target.value })}
                  className="input-field pl-11"
                  placeholder="••••••••"
                />
              </div>
              <p className="text-xs text-white/30 mt-1.5">Minimaal 6 tekens</p>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Bevestig nieuw wachtwoord</label>
              <div className="relative">
                <Icons.lock className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={16} />
                <input
                  type="password"
                  value={password.confirm}
                  onChange={(e) => setPassword({ ...password, confirm: e.target.value })}
                  className="input-field pl-11"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="pt-4">
              <button type="submit" disabled={isLoading} className="btn-primary w-full sm:w-auto disabled:opacity-50 flex items-center justify-center gap-2">
                {isLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-workx-dark border-t-transparent rounded-full animate-spin" />
                    Wijzigen...
                  </>
                ) : (
                  <>
                    <Icons.shield size={16} />
                    Wachtwoord wijzigen
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Security Tips */}
          <div className="mt-6 pt-6 border-t border-white/5">
            <h3 className="text-sm font-medium text-white mb-4">Beveiligingstips</h3>
            <div className="space-y-3">
              {[
                { icon: Icons.check, text: 'Gebruik een uniek wachtwoord voor dit account', done: true },
                { icon: Icons.check, text: 'Combineer letters, cijfers en symbolen', done: true },
                { icon: Icons.x, text: 'Schakel tweefactorauthenticatie in', done: false },
              ].map((tip, i) => (
                <div key={i} className={`flex items-center gap-3 text-sm ${tip.done ? 'text-green-400' : 'text-gray-400'}`}>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center ${tip.done ? 'bg-green-500/10' : 'bg-white/5'}`}>
                    <tip.icon size={12} />
                  </div>
                  <span>{tip.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'notifications' && (
        <div className="card p-6 space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-white/5">
            <Icons.bell className="text-gray-400" size={18} />
            <h2 className="font-medium text-white">Notificatie voorkeuren</h2>
          </div>

          <div className="space-y-4">
            {[
              { id: 'email', title: 'Email notificaties', desc: 'Ontvang updates per email', enabled: true },
              { id: 'chat', title: 'Chat berichten', desc: 'Notificaties voor nieuwe berichten', enabled: true },
              { id: 'calendar', title: 'Agenda herinneringen', desc: 'Herinneringen voor aankomende events', enabled: true },
              { id: 'vacation', title: 'Vakantie updates', desc: 'Status updates van je aanvragen', enabled: false },
              { id: 'work', title: 'Werk toewijzingen', desc: 'Notificaties voor nieuwe taken', enabled: true },
            ].map((setting) => (
              <label key={setting.id} className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/5 cursor-pointer hover:border-white/10 transition-colors">
                <div>
                  <h4 className="text-sm font-medium text-white">{setting.title}</h4>
                  <p className="text-xs text-gray-400 mt-0.5">{setting.desc}</p>
                </div>
                <div className="relative">
                  <input
                    type="checkbox"
                    defaultChecked={setting.enabled}
                    className="peer sr-only"
                  />
                  <div className="w-11 h-6 bg-white/10 peer-checked:bg-workx-lime rounded-full transition-colors" />
                  <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-all peer-checked:translate-x-5 peer-checked:bg-workx-dark" />
                </div>
              </label>
            ))}
          </div>

          <div className="pt-4">
            <button className="btn-primary w-full sm:w-auto flex items-center justify-center gap-2">
              <Icons.check size={16} />
              Voorkeuren opslaan
            </button>
          </div>
        </div>
      )}

      {activeTab === 'admin' && isAdmin && (
        <div className="space-y-6">
          {/* Header with Add button */}
          <div className="card p-6">
            <div className="flex items-center justify-between pb-4 border-b border-white/5">
              <div className="flex items-center gap-3">
                <Icons.users className="text-gray-400" size={18} />
                <h2 className="font-medium text-white">Gebruikersbeheer</h2>
              </div>
              <Popover.Root open={showCreateModal} onOpenChange={setShowCreateModal}>
                <Popover.Trigger asChild>
                  <button className="btn-primary flex items-center gap-2">
                    <Icons.plus size={16} />
                    Nieuw account
                  </button>
                </Popover.Trigger>
                <Popover.Portal>
                  <Popover.Content
                    className="w-[90vw] max-w-md bg-workx-gray rounded-2xl border border-white/10 p-6 shadow-2xl max-h-[80vh] overflow-y-auto z-50 animate-modal-in"
                    sideOffset={8}
                    collisionPadding={16}
                    side="bottom"
                    align="end"
                  >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-workx-lime/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

                    <div className="relative">
                      <div className="flex items-center gap-4 mb-6">
                        <div className="w-12 h-12 rounded-xl bg-workx-lime/10 flex items-center justify-center">
                          <Icons.userPlus className="text-workx-lime" size={24} />
                        </div>
                        <div>
                          <h2 className="font-semibold text-white text-lg">Nieuw account aanmaken</h2>
                          <p className="text-sm text-gray-400">Voeg een nieuwe medewerker toe</p>
                        </div>
                      </div>

                      <form onSubmit={createUser} className="space-y-4">
                        <div>
                          <label className="block text-sm text-gray-400 mb-2">Naam *</label>
                          <div className="relative">
                            <Icons.user className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={16} />
                            <input
                              type="text"
                              value={newUser.name}
                              onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                              className="input-field pl-11"
                              placeholder="Volledige naam"
                              required
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm text-gray-400 mb-2">Email *</label>
                          <div className="relative">
                            <Icons.mail className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={16} />
                            <input
                              type="email"
                              value={newUser.email}
                              onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                              className="input-field pl-11"
                              placeholder="naam@workxadvocaten.nl"
                              required
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm text-gray-400 mb-2">Wachtwoord *</label>
                          <div className="relative">
                            <Icons.lock className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={16} />
                            <input
                              type="password"
                              value={newUser.password}
                              onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                              className="input-field pl-11"
                              placeholder="Minimaal 6 tekens"
                              required
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm text-gray-400 mb-2">Rol</label>
                            <select
                              value={newUser.role}
                              onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                              className="input-field"
                            >
                              <option value="EMPLOYEE">Medewerker</option>
                              <option value="PARTNER">Partner</option>
                              <option value="ADMIN">Admin</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm text-gray-400 mb-2">Afdeling</label>
                            <input
                              type="text"
                              value={newUser.department}
                              onChange={(e) => setNewUser({ ...newUser, department: e.target.value })}
                              className="input-field"
                              placeholder="Optioneel"
                            />
                          </div>
                        </div>

                        <div className="flex gap-3 pt-4">
                          <Popover.Close asChild>
                            <button
                              type="button"
                              className="flex-1 btn-secondary"
                            >
                              Annuleren
                            </button>
                          </Popover.Close>
                          <button
                            type="submit"
                            disabled={createLoading}
                            className="flex-1 btn-primary disabled:opacity-50 flex items-center justify-center gap-2"
                          >
                            {createLoading ? (
                              <span className="w-4 h-4 border-2 border-workx-dark/30 border-t-workx-dark rounded-full animate-spin" />
                            ) : (
                              <>
                                <Icons.check size={16} />
                                Aanmaken
                              </>
                            )}
                          </button>
                        </div>
                      </form>
                    </div>
                    <Popover.Arrow className="fill-workx-gray" />
                  </Popover.Content>
                </Popover.Portal>
              </Popover.Root>
            </div>

            {/* Users list */}
            {usersLoading ? (
              <div className="flex items-center justify-center py-12">
                <span className="w-6 h-6 border-2 border-workx-lime/30 border-t-workx-lime rounded-full animate-spin" />
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {users.map((user) => (
                  <div
                    key={user.id}
                    className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                      user.isActive
                        ? 'bg-white/[0.02] border-white/5 hover:border-white/10'
                        : 'bg-red-500/5 border-red-500/20 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-semibold ${
                        user.isActive
                          ? 'bg-gradient-to-br from-workx-lime to-workx-lime/80 text-workx-dark'
                          : 'bg-white/10 text-gray-400'
                      }`}>
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-white">{user.name}</h4>
                          <span className={getRoleBadge(user.role)}>{getRoleLabel(user.role)}</span>
                          {!user.isActive && (
                            <span className="badge bg-red-500/20 text-red-300">Inactief</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-400">{user.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Popover.Root
                        open={showResetModal && selectedUser?.id === user.id}
                        onOpenChange={(open) => {
                          if (open) {
                            setSelectedUser(user)
                            setShowResetModal(true)
                          } else {
                            setShowResetModal(false)
                            setSelectedUser(null)
                            setNewPassword('')
                          }
                        }}
                      >
                        <Popover.Trigger asChild>
                          <button
                            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-all"
                            title="Wachtwoord resetten"
                          >
                            <Icons.lock size={16} />
                          </button>
                        </Popover.Trigger>
                        <Popover.Portal>
                          <Popover.Content
                            className="w-[90vw] max-w-md bg-workx-gray rounded-2xl border border-white/10 p-6 shadow-2xl max-h-[80vh] overflow-y-auto z-50 animate-modal-in"
                            sideOffset={8}
                            collisionPadding={16}
                            side="bottom"
                            align="end"
                          >
                            <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

                            <div className="relative">
                              <div className="flex items-center gap-4 mb-6">
                                <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center">
                                  <Icons.lock className="text-orange-400" size={24} />
                                </div>
                                <div>
                                  <h2 className="font-semibold text-white text-lg">Wachtwoord resetten</h2>
                                  <p className="text-sm text-gray-400">{user.name}</p>
                                </div>
                              </div>

                              <div className="space-y-4">
                                <div>
                                  <label className="block text-sm text-gray-400 mb-2">Nieuw wachtwoord</label>
                                  <div className="relative">
                                    <Icons.lock className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={16} />
                                    <input
                                      type="password"
                                      value={newPassword}
                                      onChange={(e) => setNewPassword(e.target.value)}
                                      className="input-field pl-11"
                                      placeholder="Minimaal 6 tekens"
                                    />
                                  </div>
                                </div>

                                <div className="flex gap-3 pt-2">
                                  <Popover.Close asChild>
                                    <button className="flex-1 btn-secondary">
                                      Annuleren
                                    </button>
                                  </Popover.Close>
                                  <button
                                    onClick={resetPassword}
                                    disabled={createLoading || newPassword.length < 6}
                                    className="flex-1 px-4 py-2.5 rounded-xl font-medium bg-orange-500 hover:bg-orange-600 text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                  >
                                    {createLoading ? (
                                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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
                            <Popover.Arrow className="fill-workx-gray" />
                          </Popover.Content>
                        </Popover.Portal>
                      </Popover.Root>
                      <button
                        onClick={() => toggleUserActive(user)}
                        className={`p-2 rounded-lg transition-all ${
                          user.isActive
                            ? 'text-gray-400 hover:text-red-400 hover:bg-red-500/10'
                            : 'text-green-400 hover:bg-green-500/10'
                        }`}
                        title={user.isActive ? 'Deactiveren' : 'Activeren'}
                      >
                        {user.isActive ? <Icons.userMinus size={16} /> : <Icons.userPlus size={16} />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Danger Zone */}
      <div className="card p-6 border-red-500/20">
        <div className="flex items-center gap-3 pb-4 border-b border-white/5">
          <Icons.alertTriangle className="text-red-400" size={18} />
          <h2 className="font-medium text-white">Gevaarlijke zone</h2>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div>
            <h4 className="text-sm font-medium text-white">Account verwijderen</h4>
            <p className="text-xs text-gray-400 mt-0.5">Dit kan niet ongedaan worden gemaakt</p>
          </div>
          <button className="px-4 py-2 text-sm text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/10 transition-colors">
            Account verwijderen
          </button>
        </div>
      </div>
    </div>
  )
}
