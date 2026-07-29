export const metadata = {
  title: 'Política de Privacidad | Claudia Agudelo Beauty',
  description: 'Política de privacidad y tratamiento de datos personales de Claudia Agudelo Beauty.',
}

export default function PrivacidadPage() {
  return (
    <main className="min-h-screen bg-white py-16 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Política de Privacidad</h1>
        <p className="text-sm text-gray-500 mb-10">Última actualización: julio de 2026</p>

        <section className="space-y-8 text-gray-700 text-sm leading-relaxed">

          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">1. Responsable del tratamiento</h2>
            <p>
              <strong>Claudia Agudelo Beauty</strong> es responsable del tratamiento de los datos
              personales recopilados a través de su sitio web, aplicación y canal de WhatsApp,
              en cumplimiento de la Ley 1581 de 2012 y el Decreto 1377 de 2013 de la República de Colombia.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">2. Datos que recopilamos</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Nombre completo</li>
              <li>Número de teléfono (WhatsApp)</li>
              <li>Fecha y hora de citas agendadas</li>
              <li>Servicios solicitados</li>
              <li>Historial de conversaciones con el asistente virtual de WhatsApp</li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">3. Finalidad del tratamiento</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Gestión y confirmación de citas</li>
              <li>Envío de recordatorios de citas por WhatsApp</li>
              <li>Atención al cliente a través del asistente virtual</li>
              <li>Mejora del servicio prestado</li>
              <li>Comunicaciones relacionadas con los servicios de belleza ofrecidos</li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">4. Base legal</h2>
            <p>
              El tratamiento se realiza con el consentimiento del titular, obtenido al momento de
              agendar una cita o iniciar una conversación con nuestro asistente virtual de WhatsApp.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">5. Uso de WhatsApp Business API</h2>
            <p>
              Utilizamos la API oficial de WhatsApp Business (Meta Platforms, Inc.) para gestionar
              las conversaciones con nuestros clientes. Los mensajes son procesados a través de
              servidores seguros. No vendemos ni compartimos los datos de conversaciones con terceros.
              Meta puede procesar los datos según sus propias políticas de privacidad disponibles en{' '}
              <a href="https://www.whatsapp.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer"
                className="text-pink-600 underline">
                whatsapp.com/legal/privacy-policy
              </a>.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">6. Conservación de datos</h2>
            <p>
              Los datos personales se conservan durante el tiempo necesario para prestar el servicio
              y cumplir con las obligaciones legales aplicables. Las conversaciones de WhatsApp se
              almacenan por un máximo de 2 horas en estado activo y luego se eliminan automáticamente.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">7. Derechos del titular</h2>
            <p>Como titular de sus datos personales, usted tiene derecho a:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Conocer, actualizar y rectificar sus datos</li>
              <li>Solicitar la supresión de sus datos</li>
              <li>Revocar la autorización otorgada</li>
              <li>Acceder gratuitamente a sus datos</li>
            </ul>
            <p className="mt-2">
              Para ejercer estos derechos, escríbanos por WhatsApp al número{' '}
              <strong>+57 302 2197673</strong>.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">8. Seguridad</h2>
            <p>
              Implementamos medidas técnicas y organizativas para proteger sus datos contra acceso
              no autorizado, pérdida o divulgación indebida. Utilizamos conexiones cifradas (HTTPS)
              y bases de datos seguras.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">9. Cambios en esta política</h2>
            <p>
              Podemos actualizar esta política ocasionalmente. La versión vigente estará siempre
              disponible en esta página con la fecha de última actualización.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">10. Contacto</h2>
            <p>
              Para cualquier consulta relacionada con el tratamiento de sus datos personales:
            </p>
            <ul className="list-none mt-2 space-y-1">
              <li>📱 WhatsApp: <strong>+57 302 2197673</strong></li>
              <li>🌐 Web: <strong>www.claudiaagudelobeauty.sbs</strong></li>
            </ul>
          </div>

        </section>
      </div>
    </main>
  )
}
