import Link from 'next/link'

export const metadata = {
  title: 'Términos y Condiciones | Claudia Agudelo Beauty',
  description: 'Términos y condiciones de uso de los servicios de Claudia Agudelo Beauty, Sabaneta, Antioquia.',
  alternates: { canonical: 'https://claudiaagudelobeauty.com/terminos' },
  robots: { index: true, follow: true },
}

export default function TerminosPage() {
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
          <h1 className="font-serif text-4xl font-bold text-[#29332E] mb-3">Términos y Condiciones</h1>
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

          <Section numero="1" titulo="Objeto">
            <p>Los presentes términos y condiciones regulan el uso de la página web y los servicios ofrecidos por <strong>Claudia Agudelo Beauty</strong>, salón de belleza ubicado en Sabaneta, Antioquia, Colombia.</p>
            <p className="mt-2">El acceso y uso de la página web implica la aceptación plena de estos términos.</p>
          </Section>

          <Section numero="2" titulo="Servicios">
            <p>Claudia Agudelo Beauty ofrece servicios de belleza y cuidado personal, entre ellos:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1 text-[#29332E]/80">
              <li>Manicure y pedicure.</li>
              <li>Maquillaje.</li>
              <li>Masajes.</li>
              <li>Limpieza facial.</li>
              <li>Cejas y pestañas.</li>
              <li>Peinados.</li>
              <li>Barbería.</li>
              <li>Depilación corporal.</li>
              <li>Peluquería.</li>
              <li>Podología.</li>
            </ul>
          </Section>

          <Section numero="3" titulo="Reserva de citas">
            <p>Las citas pueden agendarse a través de la página web o por WhatsApp. La reserva queda confirmada una vez el cliente recibe respuesta del establecimiento.</p>
            <p className="mt-2">Claudia Agudelo Beauty se reserva el derecho de modificar o cancelar una cita en caso de inconvenientes operativos, notificando al cliente con la mayor anticipación posible.</p>
          </Section>

          <Section numero="4" titulo="Cancelaciones y reprogramaciones">
            <p>El cliente podrá cancelar o reprogramar su cita comunicándose directamente con el establecimiento por WhatsApp.</p>
            <p className="mt-2">Se solicita avisar con al menos <strong>24 horas de anticipación</strong> para permitir la reorganización de la agenda y atender a otros clientes.</p>
          </Section>

          <Section numero="5" titulo="Precios">
            <p>Los precios de los servicios están sujetos a cambios sin previo aviso. El valor definitivo será informado al cliente antes de la prestación del servicio.</p>
            <p className="mt-2">Claudia Agudelo Beauty no garantiza precios específicos publicados en canales externos no oficiales.</p>
          </Section>

          <Section numero="6" titulo="Responsabilidad">
            <p>Claudia Agudelo Beauty prestará sus servicios con diligencia y cuidado profesional. No obstante, no será responsable por reacciones adversas derivadas de condiciones de salud preexistentes que el cliente no haya informado previamente.</p>
            <p className="mt-2">Se recomienda al cliente informar al personal sobre alergias, sensibilidades o condiciones médicas relevantes antes de recibir cualquier servicio.</p>
          </Section>

          <Section numero="7" titulo="Propiedad intelectual">
            <p>El contenido de la página web, incluyendo textos, imágenes, logotipo y diseño, es propiedad de Claudia Agudelo Beauty. Queda prohibida su reproducción, distribución o uso sin autorización expresa.</p>
          </Section>

          <Section numero="8" titulo="Uso de la página web">
            <p>El usuario se compromete a utilizar la página web de forma lícita y a no realizar acciones que puedan dañar, inutilizar o sobrecargar los sistemas del sitio.</p>
          </Section>

          <Section numero="9" titulo="Modificaciones">
            <p>Claudia Agudelo Beauty podrá actualizar estos términos en cualquier momento. La versión vigente estará siempre disponible en la página web.</p>
          </Section>

          <Section numero="10" titulo="Legislación aplicable">
            <p>Estos términos se rigen por la legislación de la República de Colombia. Cualquier controversia será resuelta conforme a las normas vigentes en el territorio colombiano.</p>
          </Section>

          <Section numero="11" titulo="Contacto">
            <div className="bg-[#F5F8F6] rounded-xl p-4 border border-[#DCE7DF] space-y-1">
              <p><span className="font-semibold">Teléfono:</span> 302 219 7673</p>
              <p><span className="font-semibold">Dirección:</span> Cl. 74 Sur #46-48, Sabaneta, Antioquia, Colombia</p>
            </div>
          </Section>

        </div>

        {/* Footer links */}
        <div className="mt-14 pt-6 border-t border-[#DCE7DF] flex flex-wrap gap-4 text-xs text-[#829889]">
          <Link href="/privacidad" className="hover:text-[#29332E] transition-colors">Política de Privacidad</Link>
          <Link href="/cookies" className="hover:text-[#29332E] transition-colors">Política de Cookies</Link>
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
