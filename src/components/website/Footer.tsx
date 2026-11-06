import Link from 'next/link'
import Image from 'next/image'

export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer
      className="py-14 sm:py-20"
      style={{
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderTop: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <div className="max-w-2xl mx-auto px-4 sm:px-6 flex flex-col items-center text-center gap-6">

        {/* Logo */}
        <div className="w-20 h-20 rounded-full overflow-hidden border border-white/20 shadow-lg">
          <Image
            src="/logo.png"
            alt="Claudia Agudelo Beauty"
            width={80}
            height={80}
            className="w-full h-full object-cover"
          />
        </div>

        {/* Frase */}
        <p className="font-serif italic text-white/70 text-sm sm:text-base tracking-wide drop-shadow">
          Tu refugio de belleza y bienestar en Sabaneta, Antioquia.
        </p>

        {/* Divisor dorado */}
        <div className="w-16 h-px" style={{ background: 'linear-gradient(90deg,transparent,#C5A675,transparent)' }} />

        {/* Links legales */}
        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          <Link
            href="/privacidad"
            className="text-white/50 hover:text-white text-[11px] font-medium tracking-widest uppercase transition-colors"
          >
            Política de Privacidad
          </Link>
          <span className="text-white/20 text-xs hidden sm:block">·</span>
          <Link
            href="/cookies"
            className="text-white/50 hover:text-white text-[11px] font-medium tracking-widest uppercase transition-colors"
          >
            Política de Cookies
          </Link>
          <span className="text-white/20 text-xs hidden sm:block">·</span>
          <Link
            href="/terminos"
            className="text-white/50 hover:text-white text-[11px] font-medium tracking-widest uppercase transition-colors"
          >
            Términos y Condiciones
          </Link>
        </nav>

        {/* Copyright */}
        <p className="text-white/30 text-[11px] tracking-wide">
          © {year} Claudia Agudelo Beauty. Todos los derechos reservados. | Página web creada por{' '}
          <a
            href="https://wa.link/9kgtc0"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white/50 hover:text-white transition-colors"
          >
            Victor Deavila
          </a>
        </p>

      </div>
    </footer>
  )
}
