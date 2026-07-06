export default function Footer() {
  return (
    <footer className="bg-beauty-bg border-t border-beauty-primary/20 py-6 sm:py-8">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-beauty-text-muted">
          <p className="text-center sm:text-left">© 2026 Claudia Agudelo Beauty. Todos los derechos reservados.</p>
          <div className="flex items-center gap-3">
            <p>Hecho en Colombia 🇨🇴 por{' '}
              <a href="https://victorh4k.com" target="_blank" rel="noopener noreferrer"
                className="text-beauty-secondary font-semibold hover:underline transition-colors">
                Victorh4k
              </a>
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}
