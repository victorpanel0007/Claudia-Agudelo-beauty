import Link from 'next/link'

export const metadata = {
  title: 'Política de Cookies | Claudia Agudelo Beauty',
  description: 'Política de cookies de Claudia Agudelo Beauty, Sabaneta, Antioquia.',
  alternates: { canonical: 'https://claudiaagudelobeauty.com/cookies' },
  robots: { index: true, follow: true },
}

export default function CookiesPage() {
  return (
    <main className="min-h-screen bg-[#F5F8F6] py-16 px-4">
      <div className="max-w-3xl mx-auto">

        {/* Volver */}
        <Link href="/" className="inline-flex items-center gap-2 text-xs text-[#829889] hover:text-[#29332E] transition-colors mb-8 tracking-wide uppercase font-medium">
          ← Volver al inicio
        </Link>

        {/* Encabezado */}
        <div className="mb-10">
          <p className="text-[#C5A675] text-xs font-semibold tracking-[0.25em] uppercase mb-2">Legal</p>
          <h1 className="font-serif text-4xl font-bold text-[#29332E] mb-3">Política de Cookies</h1>
          <p className="text-sm text-[#829889]">Claudia Agudelo Beauty · Última actualización: noviembre de 2026</p>
          <div className="mt-4 h-px w-16" style={{ background: 'linear-gradient(90deg,#C5A675,transparent)' }} />
        </div>

        {/* Info responsable */}
        <div className="bg-white rounded-2xl border border-[#DCE7DF] p-5 mb-10 text-sm text-[#29332E] space-y-1">
          <p><span className="font-semibold">Responsable:</span> Claudia Agudelo</p>
          <p><span className="font-semibold">Dirección:</span> Cl. 74 Sur #46-48, Sabaneta, Antioquia, Colombia</p>
          <p><span className="font-semibold">Teléfono:</span> 302 219 7673</p>
        </div>

        {/* Contenido */}
        <div className="space-y-8 text-[#29332E] text-sm leading-relaxed">

          <Section numero="1" titulo="Uso de cookies">
            <p>Actualmente, la página web de Claudia Agudelo Beauty no utiliza cookies propias ni cookies de terceros para recopilar información de los visitantes.</p>
            <p className="mt-2">La página no utiliza herramientas de analítica, publicidad ni sistemas de seguimiento de navegación.</p>
          </Section>

          <Section numero="2" titulo="Información recolectada">
            <p>La página web no recopila ni almacena direcciones IP ni datos de navegación de sus visitantes.</p>
            <p className="mt-2">La única información almacenada en la base de datos de gestión de citas es el nombre y el número de teléfono de los clientes, los cuales son registrados manualmente por el personal del establecimiento después de que el cliente solicita una cita por WhatsApp.</p>
          </Section>

          <Section numero="3" titulo="Servicios externos">
            <p>La página web no cuenta actualmente con integraciones de terceros destinadas a recopilar información mediante cookies.</p>
            <p className="mt-2">Si en el futuro se incorporan herramientas que utilicen cookies o tecnologías similares, esta política será actualizada para informar a los usuarios sobre su funcionamiento y las opciones de administración correspondientes.</p>
          </Section>

          <Section numero="4" titulo="Actualizaciones">
            <p>Esta política podrá modificarse cuando cambien las funcionalidades de la página web o las tecnologías utilizadas.</p>
          </Section>

          <Section numero="5" titulo="Contacto">
            <p>Para consultas relacionadas con esta política, el usuario podrá comunicarse a través de:</p>
            <div className="mt-3 bg-[#F5F8F6] rounded-xl p-4 border border-[#DCE7DF] space-y-1">
              <p><span className="font-semibold">Teléfono:</span> 302 219 7673</p>
              <p><span className="font-semibold">Dirección:</span> Cl. 74 Sur #46-48, Sabaneta, Antioquia, Colombia</p>
            </div>
          </Section>

        </div>

        {/* Footer links */}
        <div className="mt-14 pt-6 border-t border-[#DCE7DF] flex flex-wrap gap-4 text-xs text-[#829889]">
          <Link href="/privacidad" className="hover:text-[#29332E] transition-colors">Política de Privacidad</Link>
          <Link href="/terminos" className="hover:text-[#29332E] transition-colors">Términos y Condiciones</Link>
          <Link href="/" className="hover:text-[#29332E] transition-colors ml-auto">← Inicio</Link>
        </div>

      </div>
    </main>
  )
}

function Section({ numero, titulo, children }: { numero: string; titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <span className="font-serif text-lg font-bold" style={{ color: '#C5A675' }}>{numero}.</span>
        <h2 className="font-serif text-lg font-bold text-[#29332E]">{titulo}</h2>
      </div>
      <div className="pl-7 text-[#29332E]/80 space-y-2">{children}</div>
    </div>
  )
}
