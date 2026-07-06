import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function main() {
  // 1. Crear bucket galeria (público)
  const { error: bucketErr } = await sb.storage.createBucket('galeria', {
    public: true,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    fileSizeLimit: 5242880,
  })
  if (bucketErr && !bucketErr.message.includes('already exists')) {
    console.log('Error bucket:', bucketErr.message)
  } else {
    console.log('✅ Bucket galeria listo')
  }

  // 2. Verificar tabla galeria
  const { error: selectErr } = await sb.from('galeria').select('count').limit(1)
  if (selectErr) {
    console.log('⚠️  Tabla galeria no existe. Créala en Supabase SQL Editor con:')
    console.log(`
CREATE TABLE galeria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url text NOT NULL,
  storage_path text NOT NULL,
  categoria text NOT NULL DEFAULT 'General',
  descripcion text,
  orden int NOT NULL DEFAULT 0,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE galeria ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read" ON galeria FOR SELECT USING (true);
CREATE POLICY "Admin all" ON galeria USING (true) WITH CHECK (true);
    `)
  } else {
    console.log('✅ Tabla galeria existe y lista')
  }
}

main().catch(console.error)
