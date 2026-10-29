export default function Footer() {
  return (
    <footer className="py-8 sm:py-10">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">

        <div className="text-center md:text-left mb-5">
          <p className="font-serif text-white font-bold text-xl drop-shadow-lg">
            Claudia Agudelo Beauty
          </p>
          <p className="text-white/90 text-sm mt-1 drop-shadow">Salón de Belleza Premium</p>
        </div>

        <div className="gold-divider mb-5" />

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-white">
          <p className="text-center sm:text-left drop-shadow">© 2026 Claudia Agudelo Beauty. Todos los derechos reservados.</p>
          <p className="drop-shadow">Hecho con 💖 en Colombia</p>
        </div>

      </div>
    </footer>
  )
}
