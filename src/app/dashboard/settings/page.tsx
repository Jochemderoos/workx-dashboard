'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import { Icons } from '@/components/ui/Icons'

export default function SettingsPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [profile, setProfile] = useState({ name: 'Admin Workx', phone: '', department: '' })
  const [password, setPassword] = useState({ current: '', new: '', confirm: '' })
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'notifications'>('profile')

  const updateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: profile.name, phoneNumber: profile.phone || null, department: profile.department || null }),
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
  ]

  return (
    <div className="max-w-4xl space-y-8 fade-in">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center">
            <Icons.settings className="text-white/60" size={20} />
          </div>
          <h1 className="text-2xl font-semibold text-white">Instellingen</h1>
        </div>
        <p className="text-white/40">Beheer je account en voorkeuren</p>
      </div>

      {/* Account Info Card */}
      <div className="card p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-workx-lime/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative flex items-center gap-5">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-workx-lime to-workx-lime/80 flex items-center justify-center shadow-lg shadow-workx-lime/20">
            <span className="text-workx-dark font-bold text-3xl">
              {profile.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">{profile.name}</h2>
            <p className="text-white/40">admin@workxadvocaten.nl</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="badge badge-lime">Administrator</span>
              <span className="text-xs text-white/30">Actief sinds jan 2024</span>
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
                : 'text-white/50 hover:text-white hover:bg-white/5'
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
            <Icons.user className="text-white/40" size={18} />
            <h2 className="font-medium text-white">Profiel informatie</h2>
          </div>

          <form onSubmit={updateProfile} className="space-y-5">
            <div>
              <label className="block text-sm text-white/60 mb-2">Email</label>
              <div className="relative">
                <Icons.mail className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={16} />
                <input
                  type="email"
                  value="admin@workxadvocaten.nl"
                  disabled
                  className="input-field pl-11 opacity-50 cursor-not-allowed"
                />
              </div>
              <p className="text-xs text-white/30 mt-1.5">Email kan niet worden gewijzigd</p>
            </div>

            <div>
              <label className="block text-sm text-white/60 mb-2">Volledige naam</label>
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
                <label className="block text-sm text-white/60 mb-2">Telefoonnummer</label>
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
                <label className="block text-sm text-white/60 mb-2">Afdeling</label>
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
            <Icons.shield className="text-white/40" size={18} />
            <h2 className="font-medium text-white">Wachtwoord wijzigen</h2>
          </div>

          <form onSubmit={updatePassword} className="space-y-5">
            <div>
              <label className="block text-sm text-white/60 mb-2">Huidig wachtwoord</label>
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
              <label className="block text-sm text-white/60 mb-2">Nieuw wachtwoord</label>
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
              <label className="block text-sm text-white/60 mb-2">Bevestig nieuw wachtwoord</label>
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
                <div key={i} className={`flex items-center gap-3 text-sm ${tip.done ? 'text-green-400' : 'text-white/40'}`}>
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
            <Icons.bell className="text-white/40" size={18} />
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
                  <p className="text-xs text-white/40 mt-0.5">{setting.desc}</p>
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

      {/* Danger Zone */}
      <div className="card p-6 border-red-500/20">
        <div className="flex items-center gap-3 pb-4 border-b border-white/5">
          <Icons.alertTriangle className="text-red-400" size={18} />
          <h2 className="font-medium text-white">Gevaarlijke zone</h2>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div>
            <h4 className="text-sm font-medium text-white">Account verwijderen</h4>
            <p className="text-xs text-white/40 mt-0.5">Dit kan niet ongedaan worden gemaakt</p>
          </div>
          <button className="px-4 py-2 text-sm text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/10 transition-colors">
            Account verwijderen
          </button>
        </div>
      </div>
    </div>
  )
}
