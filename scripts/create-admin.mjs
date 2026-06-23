import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

// Carga las variables desde .env.local
config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ Faltan variables de entorno: NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY')
  console.error('   Asegúrate de tener .env.local con esas variables.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

// ── Cambia estos datos antes de ejecutar ──────────────────
const ADMIN_EMAIL    = process.env.ADMIN_EMAIL    || 'admin@claudiaagudelobeauty.com'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'CambiaEstaContraseña2025!'
// ─────────────────────────────────────────────────────────

async function main() {
  console.log('🔐 Creando usuario administrador en Supabase Auth...\n')

  const { data: existing } = await supabase.auth.admin.listUsers()
  const alreadyExists = existing?.users?.find(u => u.email === ADMIN_EMAIL)

  if (alreadyExists) {
    console.log(`⚠️  El usuario ${ADMIN_EMAIL} ya existe.`)
    console.log('\n✅ Usa estas credenciales para entrar al panel:')
    console.log(`   📧 Email: ${ADMIN_EMAIL}`)
    console.log(`   🌐 URL:   http://localhost:3000/login`)
    return
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    email_confirm: true,
    user_metadata: { nombre: 'Claudia Agudelo', rol: 'admin' },
  })

  if (error) {
    console.error('❌ Error creando usuario:', error.message)
    process.exit(1)
  }

  console.log('✅ Usuario administrador creado correctamente!\n')
  console.log('─'.repeat(50))
  console.log('   📧 Email: ' + ADMIN_EMAIL)
  console.log('   🆔 ID:    ' + data.user.id)
  console.log('─'.repeat(50))
  console.log('\n🌐 Accede al panel en: http://localhost:3000/login')
  console.log('⚠️  IMPORTANTE: Cambia la contraseña después del primer acceso.')
}

main().catch(console.error)
