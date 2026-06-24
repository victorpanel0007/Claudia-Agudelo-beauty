'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'

export default function EspecialistaLoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !password) { toast.error('Completa todos los campos'); return }
    setLoading(true)
    const { data: { session }, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      toast.error('Correo o contraseña incorrectos')
      setLoading(false)
    } else {
      // Si es admin, redirigir al panel admin
      const rol = session?.user?.user_metadata?.rol
      if (rol === 'admin') {
        router.push('/admin')
      } else {
        router.push('/especialista')
      }
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen bg-beauty-bg flex items-center justify-center p-4">
      <Toaster position="top-center" />
      <div className="bg-white rounded-3xl shadow-beauty-lg w-full max-w-sm p-8">

        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-beauty-primary/30 shadow-sm mb-4">
            <Image
              src="/WhatsApp Image 2026-06-18 at 8.53.37 PM_1254x1254.png"
              alt="Claudia Agudelo Beauty"
              width={80} height={80}
              className="w-full h-full object-cover"
              priority
            />
          </div>
          <h1 className="font-serif text-xl font-bold text-beauty-text-dark">Bienvenida</h1>
          <p className="text-beauty-text-muted text-sm mt-1">Accede a tus citas del día</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-beauty-text mb-1.5">Correo electrónico</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="tu@correo.com"
              className="input-beauty text-sm"
              autoComplete="email"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-beauty-text mb-1.5">Contraseña</label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="input-beauty text-sm pr-10"
                autoComplete="current-password"
              />
              <button type="button" onClick={() => setShowPass(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-beauty-text-muted hover:text-beauty-text transition-colors">
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button type="submit" disabled={loading}
            className="w-full bg-beauty-primary text-white font-semibold py-3 rounded-full text-sm hover:bg-beauty-primary-dark transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-2">
            {loading ? <><Loader2 size={16} className="animate-spin" /> Entrando...</> : 'Entrar'}
          </button>
        </form>

        <p className="text-center text-xs text-beauty-text-muted mt-6">
          ¿Problemas para acceder? Contacta a Claudia
        </p>
      </div>
    </div>
  )
}
