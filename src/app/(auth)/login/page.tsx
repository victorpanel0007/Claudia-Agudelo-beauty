import { Suspense } from 'react'
import LoginForm from '@/components/admin/LoginForm'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Iniciar Sesión — Claudia Agudelo Beauty Admin',
  robots: 'noindex',
}

export default function LoginPage() {
  return (
    <div
      className="min-h-screen bg-beauty-text flex items-center justify-center px-4 relative overflow-hidden"
      suppressHydrationWarning
    >
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-beauty-secondary/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-beauty-primary/5 rounded-full blur-3xl pointer-events-none" />
      <div className="relative z-10 w-full max-w-sm">
        <Suspense fallback={
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-beauty-secondary/20 flex items-center justify-center mx-auto mb-4 animate-pulse">
              <span className="text-3xl">💅</span>
            </div>
            <p className="text-white/50 text-sm">Cargando...</p>
          </div>
        }>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  )
}
