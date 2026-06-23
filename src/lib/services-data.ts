export const CATEGORIAS = [
  { id: '1', nombre: 'Manicura y Pedicura', icono: '💅', orden: 1 },
  { id: '2', nombre: 'Maquillaje', icono: '💄', orden: 2 },
  { id: '3', nombre: 'Masajes', icono: '💆‍♀️', orden: 3 },
  { id: '4', nombre: 'Limpieza Facial', icono: '✨', orden: 4 },
  { id: '5', nombre: 'Cejas y Pestañas', icono: '👁️', orden: 5 },
  { id: '6', nombre: 'Peinados', icono: '💇‍♀️', orden: 6 },
  { id: '7', nombre: 'Barbería', icono: '💈', orden: 7 },
  { id: '8', nombre: 'Depilación Corporal', icono: '🪒', orden: 8 },
  { id: '9', nombre: 'Peluquería', icono: '💇‍♀️', orden: 9 },
]

export const SERVICIOS_DATA = [
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
  { cat: '9', nombre: 'Keratina', tipo: 'desde', precio_desde: 150000, duracion: 180 },
  { cat: '9', nombre: 'Reposición de aminoácidos', tipo: 'valoracion', duracion: 120 },
  { cat: '9', nombre: 'Contornos', tipo: 'valoracion', duracion: 90 },
  { cat: '9', nombre: 'Balayage', tipo: 'valoracion', duracion: 180, requiere_valoracion: true },
  { cat: '9', nombre: 'Mechas', tipo: 'valoracion', duracion: 150, requiere_valoracion: true },
  { cat: '9', nombre: 'Baby Light', tipo: 'valoracion', duracion: 180, requiere_valoracion: true },
  { cat: '9', nombre: 'Rayitos', tipo: 'valoracion', duracion: 120, requiere_valoracion: true },
  { cat: '9', nombre: 'Highlights', tipo: 'valoracion', duracion: 150, requiere_valoracion: true },
  { cat: '9', nombre: 'Split Ender', tipo: 'valoracion', duracion: 60 },
  { cat: '9', nombre: 'Corte de puntas', tipo: 'valoracion', duracion: 30 },
  { cat: '9', nombre: 'Radiofrecuencia capilar', tipo: 'valoracion', duracion: 60 },
  { cat: '9', nombre: 'Diseño de corte', tipo: 'valoracion', duracion: 60 },
  { cat: '9', nombre: 'Extensiones de cabello', tipo: 'valoracion', duracion: 240, requiere_valoracion: true },
]

export function buildWhatsAppMenu(): string {
  const menu = CATEGORIAS.map((cat, i) => `${getNumberEmoji(i + 1)} ${cat.nombre}`).join('\n')
  return `🤖 *MENÚ PRINCIPAL*

¡Hola! 👋 Bienvenido(a) a *Claudia Agudelo Beauty* 💖

Por favor responde con el número del servicio que deseas:

${menu}

✍️ Escribe el número de la opción deseada.`
}

export function buildCategoryMenu(categoriaId: string): string {
  const cat = CATEGORIAS.find(c => c.id === categoriaId)
  if (!cat) return ''

  const servicios = SERVICIOS_DATA.filter(s => s.cat === categoriaId)
  const lista = servicios.map((s, i) => {
    let precio = ''
    if (s.tipo === 'fijo' && s.precio) {
      precio = ` — $${s.precio.toLocaleString('es-CO')}`
    } else if (s.tipo === 'desde' && s.precio_desde) {
      precio = ` desde — $${s.precio_desde.toLocaleString('es-CO')}`
    }
    return `${getNumberEmoji(i + 1)} ${s.nombre}${precio}`
  }).join('\n')

  return `${cat.icono} *${cat.nombre.toUpperCase()}*\n\n${lista}\n\n✍️ Escribe el número del servicio deseado.`
}

function getNumberEmoji(n: number): string {
  const emojis: Record<number, string> = {
    1: '1️⃣', 2: '2️⃣', 3: '3️⃣', 4: '4️⃣', 5: '5️⃣',
    6: '6️⃣', 7: '7️⃣', 8: '8️⃣', 9: '9️⃣', 10: '🔟',
    11: '1️⃣1️⃣', 12: '1️⃣2️⃣', 13: '1️⃣3️⃣', 14: '1️⃣4️⃣',
    15: '1️⃣5️⃣', 16: '1️⃣6️⃣', 17: '1️⃣7️⃣', 18: '1️⃣8️⃣',
  }
  return emojis[n] || `${n}.`
}
