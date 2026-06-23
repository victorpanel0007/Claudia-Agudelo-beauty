// Test del parser de fechas - ejecutar con: node scripts/test-date-parser.mjs
import { parseFlexibleDate } from '../src/lib/date-parser.ts'

// Como es TypeScript, usamos la version compilada desde .next
// En su lugar probamos la logica directamente

const MESES = {enero:1,ene:1,febrero:2,feb:2,marzo:3,mar:3,abril:4,abr:4,mayo:5,may:5,
  junio:6,jun:6,julio:7,jul:7,agosto:8,ago:8,septiembre:9,sep:9,octubre:10,oct:10,noviembre:11,nov:11,diciembre:12,dic:12}
const DIAS_SEMANA = {domingo:0,lunes:1,martes:2,miercoles:3,jueves:4,viernes:5,sabado:6}
const DIAS_N = ['domingo','lunes','martes','miercoles','jueves','viernes','sabado']
const MESES_N = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']

function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate()+n); return r }
function nextWeekday(from, target) {
  const d = new Date(from); let diff = target - d.getDay()
  if (diff <= 0) diff += 7; d.setDate(d.getDate()+diff); return d
}
function guessYear(day, month) {
  const y = new Date().getFullYear()
  const c = new Date(y, month-1, day)
  const t = new Date(); t.setHours(0,0,0,0)
  return c < t ? y+1 : y
}
function fmt(d) {
  if (!d || isNaN(d.getTime())) return 'ERROR'
  const dd = d.getDate().toString().padStart(2,'0')
  const mm = (d.getMonth()+1).toString().padStart(2,'0')
  return `${dd}/${mm}/${d.getFullYear()} (${DIAS_N[d.getDay()]} ${dd} de ${MESES_N[d.getMonth()]})`
}

function parse(input) {
  const text = input.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  const today = new Date(); today.setHours(0,0,0,0)

  if (/^(hoy)$/.test(text)) return fmt(today)
  if (/^manana$/.test(text)) return fmt(addDays(today,1))
  if (/^pasado\s*manana$/.test(text)) return fmt(addDays(today,2))

  let m = text.match(/dentro\s+de\s+(\d+)\s+dias?/)
  if (m) return fmt(addDays(today, parseInt(m[1])))

  m = text.match(/en\s+(\d+)\s+dias?/)
  if (m) return fmt(addDays(today, parseInt(m[1])))

  m = text.match(/(lunes|martes|miercoles|jueves|viernes|sabado|domingo)/)
  if (m && DIAS_SEMANA[m[1]] !== undefined) return fmt(nextWeekday(today, DIAS_SEMANA[m[1]]))

  m = text.match(/^(\d{1,2})[\/\-\s](\d{1,2})[\/\-\s](\d{4})$/)
  if (m) return fmt(new Date(+m[3], +m[2]-1, +m[1]))

  m = text.match(/^(\d{1,2})[\/\-\s](\d{1,2})$/)
  if (m) return fmt(new Date(guessYear(+m[1],+m[2]), +m[2]-1, +m[1]))

  m = text.match(/(\d{1,2})\s+(?:de\s+)?([a-z]+)(?:\s+(?:de\s+)?(\d{4}))?/)
  if (m && MESES[m[2]]) {
    const mes=MESES[m[2]], d=+m[1], y=m[3]?+m[3]:guessYear(d,mes)
    return fmt(new Date(y, mes-1, d))
  }

  m = text.match(/([a-z]+)\s+(\d{1,2})(?:\s+(\d{4}))?/)
  if (m && MESES[m[1]]) {
    const mes=MESES[m[1]], d=+m[2], y=m[3]?+m[3]:guessYear(d,mes)
    return fmt(new Date(y, mes-1, d))
  }

  return 'NO_MATCH'
}

const tests = [
  '13/06/2026',
  '13-06-2026',
  '13 06 2026',
  '13/06',
  '13-06',
  '13 06',
  '13 junio 2026',
  '13 de junio de 2026',
  'junio 13 2026',
  'manana',
  'pasado manana',
  'dentro de 5 dias',
  'en 3 dias',
  'proximo lunes',
  'proximo sabado',
  'el viernes',
  'hoy',
  '15',
]

console.log('=== TEST PARSER DE FECHAS ===\n')
tests.forEach(input => {
  const result = parse(input)
  const ok = result !== 'NO_MATCH'
  console.log(` ${ok ? '[OK]' : '[!!]'} "${input.padEnd(28)}" -> ${result}`)
})
console.log('\n=== TODOS LOS FORMATOS PROBADOS ===')
