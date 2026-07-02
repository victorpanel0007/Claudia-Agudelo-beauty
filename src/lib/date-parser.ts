/**
 * Parser de fechas inteligente para el bot de WhatsApp
 * Acepta múltiples formatos en español sin necesitar OpenAI
 */

const MESES: Record<string, number> = {
  enero: 1, ene: 1,
  febrero: 2, feb: 2,
  marzo: 3, mar: 3,
  abril: 4, abr: 4,
  mayo: 5, may: 5,
  junio: 6, jun: 6,
  julio: 7, jul: 7,
  agosto: 8, ago: 8,
  septiembre: 9, sep: 9, sept: 9,
  octubre: 10, oct: 10,
  noviembre: 11, nov: 11,
  diciembre: 12, dic: 12,
}

const DIAS_SEMANA: Record<string, number> = {
  domingo: 0, dom: 0,
  lunes: 1, lun: 1,
  martes: 2, mar: 2,
  miércoles: 3, miercoles: 3, mie: 3, mié: 3,
  jueves: 4, jue: 4,
  viernes: 5, vie: 5,
  sábado: 6, sabado: 6, sab: 6, sáb: 6,
}

export interface ParsedDate {
  fecha: Date | null
  display: string        // "13/06/2026"
  interpreted: string    // "miércoles 13 de junio de 2026"
  iso: string            // "2026-06-13"
  error?: string
}

export function parseFlexibleDate(input: string): ParsedDate {
  const text = input.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

  // ── Relative keywords ──────────────────────────────────────────
  // Obtener "hoy" en Colombia para no depender de la zona del servidor
  const todayColStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
  const today = new Date(`${todayColStr}T00:00:00-05:00`)

  if (/^hoy$/.test(text)) {
    return buildResult(today)
  }
  if (/^ma[nñ]ana$/.test(text)) {
    return buildResult(addDays(today, 1))
  }
  if (/^pasado\s*ma[nñ]ana$/.test(text)) {
    return buildResult(addDays(today, 2))
  }

  // "dentro de X días"
  const dentroMatch = text.match(/dentro\s+de\s+(\d+)\s+d[ií]as?/)
  if (dentroMatch) {
    return buildResult(addDays(today, parseInt(dentroMatch[1])))
  }

  // "en X días"
  const enDiasMatch = text.match(/en\s+(\d+)\s+d[ií]as?/)
  if (enDiasMatch) {
    return buildResult(addDays(today, parseInt(enDiasMatch[1])))

  }

  // "el próximo lunes / el lunes / próximo viernes"
  const proximoMatch = text.match(/(proximo|el\s+proximo|el|este)?\s*(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)/)
  if (proximoMatch) {
    const diaTexto = proximoMatch[2].replace(/[aeiouáéíóú]/g, m =>
      ({ á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u' }[m] || m)
    )
    const targetDay = DIAS_SEMANA[diaTexto]
    if (targetDay !== undefined) {
      const isProximo = text.includes('proximo') || text.includes('siguiente')
      return buildResult(nextWeekday(today, targetDay, isProximo))
    }
  }

  // "esta semana / la próxima semana" — not super useful, skip

  // ── Numeric formats ─────────────────────────────────────────────

  // DD/MM/YYYY | DD-MM-YYYY | DD MM YYYY
  const fullNumeric = text.match(/^(\d{1,2})[\/\-\s](\d{1,2})[\/\-\s](\d{4})$/)
  if (fullNumeric) {
    return fromDMY(parseInt(fullNumeric[1]), parseInt(fullNumeric[2]), parseInt(fullNumeric[3]))
  }

  // DD/MM | DD-MM | DD MM  (assume current/next year)
  const shortNumeric = text.match(/^(\d{1,2})[\/\-\s](\d{1,2})$/)
  if (shortNumeric) {
    const d = parseInt(shortNumeric[1])
    const m = parseInt(shortNumeric[2])
    return fromDMY(d, m, guessYear(d, m))
  }

  // ── Text month formats ───────────────────────────────────────────

  // "13 junio 2026" | "13 de junio de 2026" | "13 junio"
  const textMonth1 = text.match(/(\d{1,2})\s+(?:de\s+)?([a-záéíóúñ]+)(?:\s+(?:de\s+)?(\d{4}))?/)
  if (textMonth1) {
    const mes = MESES[textMonth1[2]]
    if (mes) {
      const d = parseInt(textMonth1[1])
      const y = textMonth1[3] ? parseInt(textMonth1[3]) : guessYear(d, mes)
      return fromDMY(d, mes, y)
    }
  }

  // "junio 13 2026" | "junio 13"
  const textMonth2 = text.match(/([a-záéíóúñ]+)\s+(\d{1,2})(?:\s+(\d{4}))?/)
  if (textMonth2) {
    const mes = MESES[textMonth2[1]]
    if (mes) {
      const d = parseInt(textMonth2[2])
      const y = textMonth2[3] ? parseInt(textMonth2[3]) : guessYear(d, mes)
      return fromDMY(d, mes, y)
    }
  }

  // Just a number 1-31 → assume current or next month
  const soloNum = text.match(/^(\d{1,2})$/)
  if (soloNum) {
    const d = parseInt(soloNum[1])
    if (d >= 1 && d <= 31) {
      const t = new Date(today)
      t.setDate(d)
      if (t < today) t.setMonth(t.getMonth() + 1)
      if (t < today) t.setFullYear(t.getFullYear() + 1)
      return buildResult(t)
    }
  }

  return {
    fecha: null,
    display: '',
    interpreted: '',
    iso: '',
    error: `No pude entender la fecha "${input}". Por favor escríbela así: *DD/MM/AAAA*\nEjemplo: *15/06/2026* o simplemente *mañana*`,
  }
}

// ── Helpers ──────────────────────────────────────────────────────

function fromDMY(d: number, m: number, y: number): ParsedDate {
  if (d < 1 || d > 31 || m < 1 || m > 12 || y < 2020) {
    return {
      fecha: null, display: '', interpreted: '', iso: '',
      error: `La fecha ${d}/${m}/${y} no es válida. Por favor verifica el día y el mes.`,
    }
  }
  // ✅ CORRECTO: usar offset -05:00 explícito para Colombia
  // NUNCA: new Date(y, m-1, d) — eso usa UTC en Vercel y cambia el día
  const dStr = String(d).padStart(2, '0')
  const mStr = String(m).padStart(2, '0')
  const iso = `${y}-${mStr}-${dStr}`
  const fecha = new Date(`${iso}T00:00:00-05:00`)

  // Verificar que la fecha sea válida (ej: 31 de febrero no existe)
  const fechaCheck = new Date(`${iso}T12:00:00-05:00`)
  if (fechaCheck.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }) !== iso) {
    return {
      fecha: null, display: '', interpreted: '', iso: '',
      error: `El día ${d} no existe en ese mes. Por favor verifica la fecha.`,
    }
  }
  return buildResult(fecha)
}

function buildResult(fecha: Date): ParsedDate {
  // Obtener la fecha en Colombia para mostrar correctamente
  const isoCol = fecha.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
  const [y, m, d] = isoCol.split('-')

  const DIAS_NOMBRES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
  const MESES_NOMBRES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

  // Obtener día de semana en Colombia
  const diaSemana = new Date(`${isoCol}T12:00:00-05:00`).toLocaleDateString('es-CO', {
    timeZone: 'America/Bogota',
    weekday: 'long',
  })
  const mesNombre = MESES_NOMBRES[parseInt(m) - 1]

  return {
    fecha,
    display: `${d}/${m}/${y}`,
    interpreted: `${diaSemana} ${parseInt(d)} de ${mesNombre} de ${y}`,
    iso: isoCol,
  }
}

function addDays(date: Date, days: number): Date {
  // Obtener fecha en Colombia, sumar días, volver a crear con offset correcto
  const isoCol = date.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
  const [y, m, d] = isoCol.split('-').map(Number)
  const temp = new Date(y, m - 1, d + days)
  const newIso = temp.toLocaleDateString('en-CA')
  return new Date(`${newIso}T00:00:00-05:00`)
}

function nextWeekday(from: Date, targetDay: number, forceNext = false): Date {
  const isoCol = from.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
  const current = new Date(`${isoCol}T12:00:00-05:00`).getDay()
  let diff = targetDay - current
  if (diff <= 0 || forceNext) diff += 7
  return addDays(from, diff)
}

function guessYear(day: number, month: number): number {
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
  const [y] = todayStr.split('-').map(Number)
  const mStr = String(month).padStart(2, '0')
  const dStr = String(day).padStart(2, '0')
  const candidate = `${y}-${mStr}-${dStr}`
  // Si ya pasó, usar el próximo año
  return candidate < todayStr ? y + 1 : y
}
