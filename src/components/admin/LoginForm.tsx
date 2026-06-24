'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Eye, EyeOff, Lock, Mail, Loader2 } from 'lucide-react'

export default function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect') || '/admin'
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { data: { session }, error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError('Credenciales incorrectas. Verifica tu email y contraseña.')
      setLoading(false)
      return
    }

    // Redirigir según el rol
    const rol = session?.user?.user_metadata?.rol
    if (rol === 'especialista') {
      router.push('/especialista')
    } else {
      router.push(redirectTo)
    }
    router.refresh()
  }

  return (
    <div className="animate-slide-up">
      {/* Logo */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-full bg-gradient-gold flex items-center justify-center mx-auto mb-4 shadow-beauty-lg">
          <span className="text-3xl">💅</span>
        </div>
        <h1 className="font-serif text-beauty-gold text-2xl font-bold">
          Claudia Agudelo Beauty
        </h1>
        <p className="text-white/50 text-sm mt-1">Panel Administrativo</p>
      </div>

      {/* Card */}
      <div className="bg-white/5 border border-beauty-gold/20 rounded-2xl p-7 backdrop-blur-sm">
        <h2 className="text-white font-semibold text-lg mb-6 text-center">
          Iniciar Sesión
        </h2>

        <form onSubmit={handleLogin} className="space-y-4">
          {/* Email */}
          <div>
            <label className="block text-white/70 text-sm font-medium mb-1.5">
              Correo electrónico
            </label>
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="admin@claudiabeauty.com"
                className="w-full bg-white/10 border border-white/20 focus:border-beauty-gold rounded-xl pl-9 pr-4 py-3 text-white placeholder-white/30 text-sm outline-none focus:ring-2 focus:ring-beauty-gold/30 transition-all"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-white/70 text-sm font-medium mb-1.5">
              Contraseña
            </label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full bg-white/10 border border-white/20 focus:border-beauty-gold rounded-xl pl-9 pr-10 py-3 text-white placeholder-white/30 text-sm outline-none focus:ring-2 focus:ring-beauty-gold/30 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full btn-beauty justify-center py-3 text-base disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Ingresando...
              </>
            ) : (
              'Ingresar al Panel'
            )}
          </button>
        </form>

        <p className="text-center text-white/30 text-xs mt-5">
          Acceso restringido solo para personal autorizado
        </p>
      </div>

      <p className="text-center mt-5">
        <a href="/" className="text-beauty-gold/60 hover:text-beauty-gold text-sm transition-colors">
          ← Volver al sitio web
        </a>
      </p>
    </div>
  )
}
