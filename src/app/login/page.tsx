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
    <div className="min-h-screen bg-workx-dark flex items-center justify-center p-6 relative overflow-hidden">
      {/* Ambient glow effects - animated */}
      <div className="fixed top-0 right-0 w-[600px] h-[600px] bg-workx-lime/5 rounded-full blur-[150px] pointer-events-none animate-pulse" style={{ animationDuration: '4s' }} />
      <div className="fixed bottom-0 left-1/4 w-[400px] h-[400px] bg-workx-lime/3 rounded-full blur-[120px] pointer-events-none animate-pulse" style={{ animationDuration: '6s', animationDelay: '1s' }} />
      <div className="fixed top-1/3 left-0 w-[300px] h-[300px] bg-purple-500/5 rounded-full blur-[100px] pointer-events-none animate-pulse" style={{ animationDuration: '5s', animationDelay: '2s' }} />

      {/* Subtle floating particles */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute w-2 h-2 bg-workx-lime/20 rounded-full" style={{ top: '20%', left: '15%', animation: 'float 8s ease-in-out infinite' }} />
        <div className="absolute w-1.5 h-1.5 bg-workx-lime/15 rounded-full" style={{ top: '60%', left: '80%', animation: 'float 10s ease-in-out infinite', animationDelay: '-3s' }} />
        <div className="absolute w-1 h-1 bg-workx-lime/25 rounded-full" style={{ top: '75%', left: '25%', animation: 'float 7s ease-in-out infinite', animationDelay: '-5s' }} />
      </div>

      {/* Grachtenpand */}
      <div className="grachtenpand" />

      <div className="w-full max-w-sm relative z-10 fade-in">
        {/* Logo */}
        <div className="text-center mb-10">
          <WorkxLogo size={56} className="mx-auto mb-4" />
          <h1 className="text-2xl font-semibold text-white">Workx</h1>
          <p className="text-white/40 text-sm mt-1">Advocaten Dashboard</p>
        </div>

        {/* Form Card */}
        <form onSubmit={handleSubmit} className="card p-6 space-y-5 relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-workx-lime/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
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
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
              >
                {showPassword ? <Icons.eyeOff size={16} /> : <Icons.eye size={16} />}
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
