import Link from 'next/link'

export const metadata = {
  title: 'Política de Privacidad | Claudia Agudelo Beauty',
  description: 'Política de privacidad y tratamiento de datos personales de Claudia Agudelo Beauty, Sabaneta, Antioquia.',
  alternates: { canonical: 'https://claudiaagudelobeauty.com/privacidad' },
  robots: { index: true, follow: true },
}

export default function PrivacidadPage() {
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
          <h1 className="font-serif text-4xl font-bold text-[#29332E] mb-3">Política de Privacidad</h1>
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

          <Section numero="1" titulo="Datos personales recolectados">
            <p>Claudia Agudelo Beauty recolecta únicamente los siguientes datos personales de sus clientes:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1 text-[#29332E]/80">
              <li>Nombre del cliente.</li>
              <li>Número de teléfono.</li>
            </ul>
            <p className="mt-3">Estos datos son proporcionados por los clientes cuando solicitan una cita a través de WhatsApp. Posteriormente, el personal del establecimiento los registra manualmente en la base de datos de gestión de citas de la página web.</p>
            <p className="mt-2">La página web no solicita ni almacena direcciones IP, datos de navegación, información financiera ni otros datos personales a través de su sistema de gestión de citas.</p>
          </Section>

          <Section numero="2" titulo="Finalidad del tratamiento">
            <p>Los datos personales se utilizan exclusivamente para:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1 text-[#29332E]/80">
              <li>Registrar las citas solicitadas por los clientes.</li>
              <li>Organizar y gestionar las reservas.</li>
              <li>Contactar al cliente en relación con su cita.</li>
              <li>Atender solicitudes de modificación o cancelación de citas.</li>
            </ul>
            <p className="mt-3">Los datos no se utilizan para enviar publicidad ni promociones.</p>
          </Section>

          <Section numero="3" titulo="Autorización">
            <p>El tratamiento de los datos personales se realizará conforme a la legislación colombiana aplicable. Cuando sea requerida, se solicitará la autorización previa, expresa e informada del titular.</p>
          </Section>

          <Section numero="4" titulo="Derechos del titular">
            <p>El titular de los datos personales podrá:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1 text-[#29332E]/80">
              <li>Conocer, actualizar y rectificar sus datos.</li>
              <li>Solicitar información sobre el tratamiento de sus datos.</li>
              <li>Solicitar la supresión de sus datos o la revocatoria de la autorización cuando sea procedente.</li>
              <li>Presentar consultas o reclamos relacionados con el tratamiento de su información.</li>
              <li>Presentar quejas ante la Superintendencia de Industria y Comercio, conforme a la ley.</li>
            </ul>
          </Section>

          <Section numero="5" titulo="Conservación y seguridad">
            <p>Los datos se conservarán durante el tiempo necesario para gestionar las citas y cumplir las obligaciones legales aplicables.</p>
            <p className="mt-2">Claudia Agudelo Beauty adoptará medidas razonables para proteger la información contra el acceso no autorizado, pérdida, alteración o uso indebido.</p>
          </Section>

          <Section numero="6" titulo="Comunicación de datos">
            <p>Claudia Agudelo Beauty no vende ni comparte los datos personales de sus clientes con terceros para fines comerciales.</p>
            <p className="mt-2">Los datos se utilizan únicamente para las finalidades descritas en esta política, salvo que exista una obligación legal de divulgarlos.</p>
          </Section>

          <Section numero="7" titulo="Consultas y reclamos">
            <p>Para consultas o solicitudes relacionadas con los datos personales, el titular podrá comunicarse a través de:</p>
            <div className="mt-3 bg-[#F5F8F6] rounded-xl p-4 border border-[#DCE7DF] space-y-1">
              <p><span className="font-semibold">Teléfono:</span> 302 219 7673</p>
              <p><span className="font-semibold">Dirección:</span> Cl. 74 Sur #46-48, Sabaneta, Antioquia, Colombia</p>
            </div>
          </Section>

          <Section numero="8" titulo="Vigencia">
            <p>Esta política podrá actualizarse cuando cambien las prácticas de tratamiento de datos o las disposiciones legales aplicables. La versión vigente estará disponible en la página web.</p>
          </Section>

        </div>

        {/* Footer links */}
        <div className="mt-14 pt-6 border-t border-[#DCE7DF] flex flex-wrap gap-4 text-xs text-[#829889]">
          <Link href="/cookies" className="hover:text-[#29332E] transition-colors">Política de Cookies</Link>
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
