/**
 * Configura el webhook de Evolution API
 * Uso: node scripts/set-webhook.mjs https://tu-dominio.com
 */

const EVOLUTION_URL = 'https://evolution-api-production-c57f.up.railway.app'
const API_KEY = '144A36EE5B57-4F70-8373-443246DE1D4F'
const INSTANCE = 'claudia-beauty'

const webhookUrl = process.argv[2]

if (!webhookUrl) {
  console.error('❌ Uso: node scripts/set-webhook.mjs https://tu-dominio.com')
  console.error('   Ejemplo con ngrok:  node scripts/set-webhook.mjs https://abc123.ngrok-free.app')
  console.error('   Ejemplo con Vercel: node scripts/set-webhook.mjs https://claudia-beauty.vercel.app')
  process.exit(1)
}

const fullWebhookUrl = `${webhookUrl}/api/whatsapp/webhook`

async function setWebhook() {
  console.log(`\n🔧 Configurando webhook en Evolution API...`)
  console.log(`   Instancia: ${INSTANCE}`)
  console.log(`   URL: ${fullWebhookUrl}\n`)

  const res = await fetch(`${EVOLUTION_URL}/webhook/set/${INSTANCE}`, {
    method: 'POST',
    headers: {
      'apikey': API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      webhook: {
        url: fullWebhookUrl,
        enabled: true,
        webhookByEvents: false,
        webhookBase64: false,
        events: ['MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'CONNECTION_UPDATE'],
      },
    }),
  })

  const data = await res.json()

  if (res.ok) {
    console.log('✅ Webhook configurado correctamente!')
    console.log(`   URL activa: ${fullWebhookUrl}`)
    console.log('\n📱 Ahora envía "Hola" al número de WhatsApp para probar el bot.')
  } else {
    console.error('❌ Error configurando webhook:')
    console.error(data)
  }
}

setWebhook().catch(console.error)
