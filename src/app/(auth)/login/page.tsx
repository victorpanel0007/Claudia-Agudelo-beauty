import { Suspense } from 'react'
import LoginForm from '@/components/admin/LoginForm'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Iniciar Sesión — Claudia Agudelo Beauty',
  robots: 'noindex',
}

export const dynamic = 'force-dynamic'

export default function LoginPage() {
  return (
    <div className="min-h-screen w-full bg-beauty-bg flex items-center justify-center px-4">
      <Suspense fallback={
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-beauty-primary/20 flex items-center justify-center mx-auto mb-4 animate-pulse">
            <span className="text-3xl">🌸</span>
          </div>
          <p className="text-beauty-text-muted text-sm">Cargando...</p>
        </div>
      }>
        <LoginForm />
      </Suspense>
    </div>
  )
}
