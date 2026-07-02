'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'
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

    const rol = session?.user?.user_metadata?.rol
    if (rol === 'especialista') {
      router.push('/especialista')
    } else {
      router.push(redirectTo)
    }
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-beauty-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-slide-up">

        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-beauty-primary/30 shadow-beauty mb-4">
            <Image
              src="/logo.png"
              alt="Claudia Agudelo Beauty"
              width={80} height={80}
              className="w-full h-full object-cover"
              priority
            />
          </div>
          <h1 className="font-serif text-beauty-text text-2xl font-bold">Claudia Agudelo Beauty</h1>
          <p className="text-beauty-text-muted text-sm mt-1">Panel Administrativo</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-beauty border border-beauty-primary/20 p-8">
          <h2 className="text-beauty-text font-bold text-xl mb-6 text-center">Iniciar Sesión</h2>

          <form onSubmit={handleLogin} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-beauty-text text-sm font-medium mb-1.5">
                Correo electrónico
              </label>
              <div className="relative">
                <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-beauty-text-muted" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="correo@ejemplo.com"
                  className="w-full border border-beauty-primary/40 rounded-xl pl-11 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-beauty-primary/30 focus:border-beauty-primary transition-colors"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-beauty-text text-sm font-medium mb-1.5">
                Contraseña
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-beauty-text-muted" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full border border-beauty-primary/40 rounded-xl pl-11 pr-12 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-beauty-primary/30 focus:border-beauty-primary transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-beauty-text-muted hover:text-beauty-text transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-beauty-primary text-white font-semibold py-3 rounded-full text-sm hover:bg-beauty-primary-dark transition-all disabled:opacity-60 flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <><Loader2 size={18} className="animate-spin" /> Ingresando...</>
              ) : (
                'Ingresar al Panel'
              )}
            </button>
          </form>

          <p className="text-center text-beauty-text-muted text-xs mt-5">
            Acceso restringido solo para personal autorizado
          </p>
        </div>

        <p className="text-center mt-5">
          <a href="/" className="text-beauty-secondary hover:text-beauty-secondary-dark text-sm transition-colors">
            ← Volver al sitio web
          </a>
        </p>
      </div>
    </div>
  )
}
