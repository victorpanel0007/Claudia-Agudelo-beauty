import type { Metadata } from 'next'
import { Toaster } from 'react-hot-toast'

export const metadata: Metadata = {
  title: 'Mis Citas — Claudia Agudelo Beauty',
  robots: 'noindex',
}

// Layout neutro — la auth la maneja cada page individualmente
export default function EspecialistaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-beauty-bg">
      <Toaster position="top-center" />
      {children}
    </div>
  )
}
