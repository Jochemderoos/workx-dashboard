'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Icons } from '@/components/ui/Icons'

// Official Workx logo
function WorkxLogoBox() {
  return (
    <img
      src="/workx-logo.png"
      alt="Workx Advocaten"
      className="h-20 w-auto mx-auto"
      draggable={false}
    />
  )
}

export default function LoginPage() {
  const router = useRouter()
  const [isLogin, setIsLogin] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showForgotPassword, setShowForgotPassword] = useState(false)
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

      {/* Workx Pand illustratie */}
      <div className="fixed bottom-0 right-10 pointer-events-none opacity-30 z-0">
        <img src="/workx-pand.png" alt="Workx Pand" className="h-[400px] object-contain" />
      </div>

      <div className="w-full max-w-sm relative z-10 fade-in">
        {/* Logo */}
        <div className="text-center mb-10">
          <WorkxLogoBox />
          <p className="text-white/40 text-sm mt-3">Dashboard</p>
        </div>

        {/* Form Card */}
        <form onSubmit={handleSubmit} className="card p-6 space-y-5 relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-workx-lime/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

          {!isLogin && (
            <div>
              <label className="block text-sm text-white/60 mb-2">Naam</label>
              <div className="input-with-icon">
                <Icons.user className="input-icon" size={16} />
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input-field"
                  placeholder="Je naam"
                  required={!isLogin}
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm text-white/60 mb-2">Email</label>
            <div className="input-with-icon">
              <Icons.mail className="input-icon" size={16} />
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="input-field"
                placeholder="naam@workxadvocaten.nl"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-white/60 mb-2">Wachtwoord</label>
            <div className="input-with-icon">
              <Icons.lock className="input-icon" size={16} />
              <input
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="input-field pr-10"
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors z-10"
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

          {isLogin && (
            <button
              type="button"
              onClick={() => setShowForgotPassword(true)}
              className="w-full text-center text-sm text-white/40 hover:text-workx-lime transition-colors"
            >
              Wachtwoord vergeten?
            </button>
          )}
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

      {/* Forgot Password Modal */}
      {showForgotPassword && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowForgotPassword(false)}>
          <div className="card p-6 w-full max-w-sm relative" onClick={e => e.stopPropagation()}>
            <div className="absolute top-0 right-0 w-24 h-24 bg-workx-lime/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-workx-lime/10 flex items-center justify-center">
                <Icons.lock className="text-workx-lime" size={18} />
              </div>
              <h2 className="font-semibold text-white text-lg">Wachtwoord vergeten?</h2>
            </div>

            <p className="text-white/60 text-sm mb-6">
              Neem contact op met Hanna om je wachtwoord te laten resetten.
            </p>

            <div className="space-y-3 mb-6">
              <a
                href="mailto:hanna.blaauboer@workxadvocaten.nl?subject=Wachtwoord reset aanvraag"
                className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors group"
              >
                <div className="w-8 h-8 rounded-lg bg-workx-lime/10 flex items-center justify-center">
                  <Icons.mail className="text-workx-lime" size={14} />
                </div>
                <div>
                  <p className="text-sm text-white group-hover:text-workx-lime transition-colors">hanna.blaauboer@workxadvocaten.nl</p>
                  <p className="text-xs text-white/40">Stuur een email</p>
                </div>
              </a>

              <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5">
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <Icons.phone className="text-purple-400" size={14} />
                </div>
                <div>
                  <p className="text-sm text-white">+31 (0)20 308 03 20</p>
                  <p className="text-xs text-white/40">Kantoor bellen</p>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowForgotPassword(false)}
              className="btn-secondary w-full"
            >
              Sluiten
            </button>
          </div>
        </div>
      )}

        {/* Footer */}
        <p className="text-center mt-10 text-xs text-white/20">
          Workx Advocaten © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
