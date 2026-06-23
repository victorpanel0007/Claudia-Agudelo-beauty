import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ Faltan variables: NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

async function main() {
  // 1. Get category IDs
  const { data: cats, error: catErr } = await supabase
    .from('categorias')
    .select('id, nombre, orden')
    .order('orden')

  if (catErr || !cats?.length) {
    console.error('Error fetching categories:', catErr)
    process.exit(1)
  }

  console.log(`✅ ${cats.length} categorías encontradas`)
  const catMap = {}
  for (const c of cats) {
    catMap[c.orden.toString()] = c.id
    console.log(`  ${c.orden}. ${c.nombre} = ${c.id}`)
  }

  // 2. Clear existing services (duplicates prevention)
  await supabase.from('servicios').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  console.log('🗑️  Servicios anteriores eliminados')

  // 3. Build services list
  const servicios = [
    // Manicura y Pedicura
    { cat: '1', nombre: 'Manos tradicionales', precio: 24000, tipo: 'fijo', duracion: 60 },
    { cat: '1', nombre: 'Pies tradicionales', precio: 24000, tipo: 'fijo', duracion: 60 },
    { cat: '1', nombre: 'Manos y pies tradicionales', precio: 45000, tipo: 'fijo', duracion: 120 },
    { cat: '1', nombre: 'Manos semipermanente', precio: 46000, tipo: 'fijo', duracion: 90 },
    { cat: '1', nombre: 'Pies semipermanente', precio: 42000, tipo: 'fijo', duracion: 90 },
    { cat: '1', nombre: 'Manos y pies semipermanente', precio: 82000, tipo: 'fijo', duracion: 150 },
    { cat: '1', nombre: 'Base Rubber', precio: 56000, tipo: 'fijo', duracion: 90 },
    { cat: '1', nombre: 'Uñas acrílicas', precio_desde: 100000, tipo: 'desde', duracion: 120 },
    { cat: '1', nombre: 'Retoque acrílico', precio: 75000, tipo: 'fijo', duracion: 90 },
    { cat: '1', nombre: 'Polygel', precio_desde: 65000, tipo: 'desde', duracion: 120 },
    { cat: '1', nombre: 'Limpieza de manos o pies', precio: 17000, tipo: 'fijo', duracion: 30 },
    { cat: '1', nombre: 'Uñas Soft Gel o Press On', precio: 90000, tipo: 'fijo', duracion: 120 },
    { cat: '1', nombre: 'Pedicure Spa', precio: 25000, tipo: 'fijo', duracion: 60 },
    // Maquillaje
    { cat: '2', nombre: 'Maquillaje Social', tipo: 'valoracion', duracion: 90 },
    { cat: '2', nombre: 'Maquillaje de novia', tipo: 'valoracion', duracion: 120 },
    { cat: '2', nombre: 'Maquillaje Casual', tipo: 'valoracion', duracion: 60 },
    // Masajes
    { cat: '3', nombre: 'Masaje de relajación', precio: 170000, tipo: 'fijo', duracion: 60 },
    { cat: '3', nombre: 'Masaje solo espalda', precio: 80000, tipo: 'fijo', duracion: 30 },
    // Limpieza Facial
    { cat: '4', nombre: 'Limpieza facial', precio: 100000, tipo: 'fijo', duracion: 60 },
    // Cejas y Pestañas
    { cat: '5', nombre: 'Depilación de cejas con hilo', tipo: 'valoracion', duracion: 15 },
    { cat: '5', nombre: 'Depilación de cejas con cera', tipo: 'valoracion', duracion: 15 },
    { cat: '5', nombre: 'Depilación de cejas con cuchilla', tipo: 'valoracion', duracion: 15 },
    { cat: '5', nombre: 'Depilación y pigmento', tipo: 'valoracion', duracion: 45 },
    { cat: '5', nombre: 'Laminado de cejas', tipo: 'valoracion', duracion: 60 },
    { cat: '5', nombre: 'Laminado de cejas + tinte', tipo: 'valoracion', duracion: 75 },
    { cat: '5', nombre: 'Lifting de pestañas', tipo: 'valoracion', duracion: 90 },
    { cat: '5', nombre: 'Lifting efecto pestañina', tipo: 'valoracion', duracion: 90 },
    { cat: '5', nombre: 'Pestañas punto a punto', tipo: 'valoracion', duracion: 120 },
    { cat: '5', nombre: 'Pestañas pelo a pelo', tipo: 'valoracion', duracion: 150 },
    // Peinados
    { cat: '6', nombre: 'Peinado Social', tipo: 'valoracion', duracion: 60 },
    { cat: '6', nombre: 'Peinado de novia', tipo: 'valoracion', duracion: 120 },
    { cat: '6', nombre: 'Peinado Casual', tipo: 'valoracion', duracion: 45 },
    { cat: '6', nombre: 'Peinado de niña', tipo: 'valoracion', duracion: 30 },
    { cat: '6', nombre: 'Trenzas', tipo: 'valoracion', duracion: 90 },
    // Barbería
    { cat: '7', nombre: 'Corte clásico', tipo: 'valoracion', duracion: 30 },
    { cat: '7', nombre: 'Corte moderno', tipo: 'valoracion', duracion: 45 },
    { cat: '7', nombre: 'Arreglo de barba', tipo: 'valoracion', duracion: 20 },
    { cat: '7', nombre: 'Afeitado', tipo: 'valoracion', duracion: 30 },
    // Depilación Corporal
    { cat: '8', nombre: 'Depilación axilas', tipo: 'valoracion', duracion: 20 },
    { cat: '8', nombre: 'Depilación media pierna', tipo: 'valoracion', duracion: 30 },
    { cat: '8', nombre: 'Depilación pierna completa', tipo: 'valoracion', duracion: 45 },
    { cat: '8', nombre: 'Depilación bikini', tipo: 'valoracion', duracion: 30 },
    { cat: '8', nombre: 'Depilación bozo', tipo: 'valoracion', duracion: 15 },
    { cat: '8', nombre: 'Depilación nariz', tipo: 'valoracion', duracion: 15 },
    // Peluquería
    { cat: '9', nombre: 'Hidratación capilar', tipo: 'valoracion', duracion: 60 },
    { cat: '9', nombre: 'Cepillado', tipo: 'valoracion', duracion: 45 },
    { cat: '9', nombre: 'Ondas', tipo: 'valoracion', duracion: 60 },
    { cat: '9', nombre: 'Planchado', tipo: 'valoracion', duracion: 45 },
    { cat: '9', nombre: 'Lavado de cabello', tipo: 'valoracion', duracion: 20 },
    { cat: '9', nombre: 'Keratina', precio_desde: 150000, tipo: 'desde', duracion: 180 },
    { cat: '9', nombre: 'Reposición de aminoácidos', tipo: 'valoracion', duracion: 120 },
    { cat: '9', nombre: 'Contornos', tipo: 'valoracion', duracion: 90 },
    { cat: '9', nombre: 'Balayage', tipo: 'valoracion', duracion: 180, requiere: true },
    { cat: '9', nombre: 'Mechas', tipo: 'valoracion', duracion: 150, requiere: true },
    { cat: '9', nombre: 'Baby Light', tipo: 'valoracion', duracion: 180, requiere: true },
    { cat: '9', nombre: 'Rayitos', tipo: 'valoracion', duracion: 120, requiere: true },
    { cat: '9', nombre: 'Highlights', tipo: 'valoracion', duracion: 150, requiere: true },
    { cat: '9', nombre: 'Split Ender', tipo: 'valoracion', duracion: 60 },
    { cat: '9', nombre: 'Corte de puntas', tipo: 'valoracion', duracion: 30 },
    { cat: '9', nombre: 'Radiofrecuencia capilar', tipo: 'valoracion', duracion: 60 },
    { cat: '9', nombre: 'Diseño de corte', tipo: 'valoracion', duracion: 60 },
    { cat: '9', nombre: 'Extensiones de cabello', tipo: 'valoracion', duracion: 240, requiere: true },
  ]

  const rows = servicios.map(s => ({
    categoria_id: catMap[s.cat],
    nombre: s.nombre,
    tipo_precio: s.tipo,
    duracion_minutos: s.duracion,
    activo: true,
    requiere_valoracion: s.requiere || false,
    ...(s.precio ? { precio: s.precio } : {}),
    ...(s.precio_desde ? { precio_desde: s.precio_desde } : {}),
  }))

  const { data, error } = await supabase.from('servicios').insert(rows).select('id')

  if (error) {
    console.error('❌ Error inserting services:', error.message)
    process.exit(1)
  }

  console.log(`✅ ${data.length} servicios insertados correctamente`)

  // 4. Verify specialists
  const { data: esps } = await supabase.from('especialistas').select('id, nombre')
  console.log(`✅ Especialistas: ${esps?.map(e => e.nombre).join(', ')}`)

  console.log('\n🎉 Base de datos lista para producción!')
}

main().catch(console.error)
