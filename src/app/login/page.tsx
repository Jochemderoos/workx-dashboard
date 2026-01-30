'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Icons, WorkxLogo } from '@/components/ui/Icons'

export default function LoginPage() {
  const router = useRouter()
  const [isLogin, setIsLogin] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [formData, setFormData] = useState({ name: '', email: '', password: '' })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      if (isLogin) {
        const result = await signIn('credentials', { email: formData.email, password: formData.password, redirect: false })
        if (result?.error) { toast.error(result.error) }
        else { toast.success('Welkom terug'); router.push('/dashboard') }
      } else {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Registratie mislukt')
        toast.success('Account aangemaakt')
        setIsLogin(true)
        setFormData({ ...formData, password: '' })
      }
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-workx-dark flex items-center justify-center p-6">
      {/* Grachtenpand */}
      <div className="grachtenpand" />

      <div className="w-full max-w-sm relative z-10">
        {/* Logo */}
        <div className="text-center mb-10">
          <WorkxLogo size={56} className="mx-auto mb-4" />
          <h1 className="text-2xl font-semibold text-white">Workx</h1>
          <p className="text-white/40 text-sm mt-1">Advocaten Dashboard</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="block text-sm text-white/60 mb-2">Naam</label>
              <div className="relative">
                <Icons.user className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={16} />
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input-field pl-10"
                  placeholder="Je naam"
                  required={!isLogin}
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm text-white/60 mb-2">Email</label>
            <div className="relative">
              <Icons.mail className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={16} />
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="input-field pl-10"
                placeholder="naam@workxadvocaten.nl"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-white/60 mb-2">Wachtwoord</label>
            <div className="relative">
              <Icons.lock className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={16} />
              <input
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="input-field pl-10 pr-10"
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
              >
                {showPassword ? <Icons.x size={16} /> : <Icons.check size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isLoading ? (
              <span className="w-4 h-4 border-2 border-workx-dark border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                {isLogin ? 'Inloggen' : 'Account aanmaken'}
                <Icons.arrowRight size={16} />
              </>
            )}
          </button>
        </form>

        {/* Toggle */}
        <p className="text-center mt-6 text-sm text-white/40">
          {isLogin ? 'Nog geen account? ' : 'Al een account? '}
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-workx-lime hover:underline"
          >
            {isLogin ? 'Registreren' : 'Inloggen'}
          </button>
        </p>

        {/* Footer */}
        <p className="text-center mt-10 text-xs text-white/20">
          Workx Advocaten © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
