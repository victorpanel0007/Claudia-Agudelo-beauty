import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="py-8 sm:py-10">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">

        {/* Identidad del negocio */}
        <div className="text-center md:text-left mb-4">
          <p className="font-serif text-white font-bold text-xl drop-shadow-lg">
            Claudia Agudelo Beauty
          </p>
          <p className="text-white/90 text-sm mt-1 drop-shadow">
            Cl. 74 Sur #46-48, Sabaneta, Antioquia, Colombia
          </p>
        </div>

        <div className="gold-divider mb-4" />

        {/* Información de contacto y enlaces */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-4 text-xs text-white/80 mb-5">

          {/* Contacto */}
          <div className="text-center sm:text-left space-y-1">
            <p>
              <a
                href="tel:+573022197673"
                className="hover:text-white transition-colors drop-shadow"
                aria-label="Llamar a Claudia Agudelo Beauty"
              >
                📞 +57 302 219 7673
              </a>
            </p>
            <p>
              <a
                href="https://maps.app.goo.gl/Zp81HQMAva6wmwUM7"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-white transition-colors drop-shadow"
                aria-label="Ver Claudia Agudelo Beauty en Google Maps"
              >
                📍 Cl. 74 Sur #46-48, Sabaneta
              </a>
            </p>
          </div>

          {/* Horario */}
          <div className="text-center space-y-1">
            <p className="drop-shadow">🕘 Lun – Sáb: 9:00 a. m. – 7:00 p. m.</p>
            <p className="drop-shadow">Domingos cerrado</p>
          </div>

          {/* Links */}
          <div className="text-center sm:text-right space-y-1">
            <p>
              <Link
                href="/privacidad"
                className="hover:text-white transition-colors drop-shadow"
              >
                Política de Privacidad
              </Link>
            </p>
            <p>
              <a
                href="https://www.instagram.com/claudiaagudelobeauty"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-white transition-colors drop-shadow"
                aria-label="Instagram de Claudia Agudelo Beauty"
              >
                Instagram
              </a>
            </p>
          </div>
        </div>

        <div className="gold-divider mb-4" />

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-white">
          <p className="text-center sm:text-left drop-shadow">
            © 2026 Claudia Agudelo Beauty. Todos los derechos reservados.
          </p>
          <p className="drop-shadow">Hecho con 💖 en Colombia</p>
        </div>

      </div>
    </footer>
  )
}
