import axios from 'axios'

const BASE_URL = process.env.EVOLUTION_API_URL
const API_KEY = process.env.EVOLUTION_API_KEY
const INSTANCE = process.env.EVOLUTION_INSTANCE_NAME

export async function sendWhatsAppMessage(to: string, message: string): Promise<boolean> {
  try {
    // Strip non-digits, ensure country code
    const phone = to.replace(/\D/g, '')

    // Evolution API v2 format
    await axios.post(
      `${BASE_URL}/message/sendText/${INSTANCE}`,
      {
        number: phone,
        text: message,
      },
      {
        headers: {
          apikey: API_KEY,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    )
    return true
  } catch (error) {
    console.error('Error sending WhatsApp message:', error)
    return false
  }
}

export async function sendWhatsAppReminder(
  to: string,
  serviceName: string,
  fecha: string,
  hora: string
): Promise<boolean> {
  const message = `⏰ *Recordatorio de cita*

Servicio: *${serviceName}*
Fecha: *${fecha}*
Hora: *${hora}*

Te esperamos en *Claudia Agudelo Beauty* 💖

¿Necesitas reprogramar? Escríbenos 😊`
  return sendWhatsAppMessage(to, message)
}

export async function sendAppointmentConfirmation(
  to: string,
  data: {
    cliente: string
    servicio: string
    especialista: string
    fecha: string
    hora: string
    precio: string
  }
): Promise<boolean> {
  const message = `✅ *Cita reservada correctamente*

👤 Cliente: *${data.cliente}*
💅 Servicio: *${data.servicio}*
👩 Especialista: *${data.especialista}*
📅 Fecha: *${data.fecha}*
⏰ Hora: *${data.hora}*
💵 Valor: *${data.precio}*

Gracias por elegir *Claudia Agudelo Beauty* 💖`
  return sendWhatsAppMessage(to, message)
}
