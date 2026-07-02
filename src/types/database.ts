export type UserRole = 'admin' | 'especialista' | 'recepcionista'
export type AppointmentStatus = 'pendiente' | 'confirmada' | 'en_proceso' | 'completada' | 'cancelada' | 'no_asistio'
export type PriceType = 'fijo' | 'desde' | 'valoracion'
export type MessageType = 'entrante' | 'saliente' | 'sistema'

export interface Usuario {
  id: string
  nombre: string
  email: string
  rol: UserRole
  created_at: string
}

export interface Cliente {
  id: string
  nombre: string
  telefono: string
  email?: string
  fecha_registro: string
  notas?: string
  total_citas?: number
  total_gastado?: number
  ultima_visita?: string
}

export interface Especialista {
  id: string
  nombre: string
  foto?: string
  activo: boolean
  especialidades?: string[]
  horario_inicio: string
  horario_fin: string
  dias_laborales: number[]
  whatsapp?: string
  notificaciones?: boolean
  created_at: string
}

export interface Categoria {
  id: string
  nombre: string
  icono: string
  orden: number
}

export interface Servicio {
  id: string
  categoria_id: string
  nombre: string
  precio?: number
  precio_desde?: number
  tipo_precio: PriceType
  duracion_minutos: number
  requiere_valoracion: boolean
  descripcion?: string
  activo: boolean
  categoria?: Categoria
  especialistas?: Especialista[]
}

export interface ServicioEspecialista {
  id: string
  servicio_id: string
  especialista_id: string
}

export interface Cita {
  id: string
  cliente_id: string
  especialista_id: string
  servicio_id: string
  fecha_inicio: string
  fecha_fin: string
  estado: AppointmentStatus
  valor_final?: number
  observaciones?: string
  created_at: string
  cliente?: Cliente
  especialista?: Especialista
  servicio?: Servicio
}

export interface MensajeWhatsapp {
  id: string
  cliente_id?: string
  telefono: string
  mensaje: string
  fecha: string
  tipo: MessageType
  metadata?: Record<string, unknown>
}

export interface HorarioOcupado {
  especialista_id: string
  fecha_inicio: string
  fecha_fin: string
}

// WhatsApp conversation state
export interface ConversationState {
  telefono: string
  paso: ConversationStep
  categoria_id?: string
  servicio_id?: string
  nombre?: string
  fecha?: string
  especialista_id?: string
  servicio_nombre?: string
  duracion?: number
  precio?: string
  created_at: string
}

export type ConversationStep =
  | 'inicio'
  | 'seleccion_categoria'
  | 'seleccion_servicio'
  | 'solicitar_nombre'
  | 'solicitar_telefono'
  | 'solicitar_fecha'
  | 'seleccion_especialista'
  | 'seleccion_horario'
  | 'confirmar'
  | 'completado'
