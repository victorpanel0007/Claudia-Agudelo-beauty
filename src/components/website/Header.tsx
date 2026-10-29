'use client'

import Link from 'next/link'
import Image from 'next/image'
import { LayoutDashboard } from 'lucide-react'

export default function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-transparent py-3">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between gap-2">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white/60 shadow-sm shrink-0">
            <Image
              src="/logo.png"
              alt="Claudia Agudelo Beauty"
              width={40}
              height={40}
              className="w-full h-full object-cover"
              priority
              sizes="40px"
              quality={85}
            />
          </div>
          <div className="hidden xs:block">
            <p className="font-serif font-bold text-sm leading-tight text-white drop-shadow">Claudia Agudelo</p>
            <p className="text-[10px] font-medium tracking-widest uppercase text-white/80 drop-shadow">Beauty</p>
          </div>
        </Link>

        {/* Solo icono Admin — siempre visible, sin menú */}
        <Link
          href="/admin"
          className="flex items-center justify-center w-10 h-10 rounded-full border border-white/50 text-white hover:bg-white/20 transition-all"
          aria-label="Panel Admin"
        >
          <LayoutDashboard size={16} />
        </Link>

      </div>
    </header>
  )
}
