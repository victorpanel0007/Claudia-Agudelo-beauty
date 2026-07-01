-- ============================================
-- SISTEMA DE NOTIFICACIONES A ESPECIALISTAS
-- ============================================

-- 1. Agregar campos a especialistas
ALTER TABLE especialistas
  ADD COLUMN IF NOT EXISTS whatsapp text,
  ADD COLUMN IF NOT EXISTS notificaciones boolean DEFAULT true;

-- 2. Historial de notificaciones
CREATE TABLE IF NOT EXISTS notificaciones_especialista (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  cita_id uuid REFERENCES citas(id) ON DELETE SET NULL,
  especialista_id uuid REFERENCES especialistas(id) ON DELETE SET NULL,
  especialista_nombre text,
  whatsapp_destino text NOT NULL,
  mensaje text NOT NULL,
  estado text NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('enviado','error','pendiente')),
  tipo text NOT NULL DEFAULT 'confirmacion'
    CHECK (tipo IN ('confirmacion','recordatorio_24h','recordatorio_1h','cancelacion','reprogramacion','finalizacion')),
  codigo_respuesta int,
  error_detalle text,
  created_at timestamptz DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_notif_cita ON notificaciones_especialista(cita_id);
CREATE INDEX IF NOT EXISTS idx_notif_esp ON notificaciones_especialista(especialista_id);
CREATE INDEX IF NOT EXISTS idx_notif_estado ON notificaciones_especialista(estado);
CREATE INDEX IF NOT EXISTS idx_notif_fecha ON notificaciones_especialista(created_at);

-- RLS
ALTER TABLE notificaciones_especialista ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Full access notificaciones" ON notificaciones_especialista
  USING (true) WITH CHECK (true);

-- Actualizar número de cada especialista (ajusta según corresponda)
-- UPDATE especialistas SET whatsapp = '3001234567' WHERE nombre = 'Claudia';
-- UPDATE especialistas SET whatsapp = '3022197673' WHERE nombre = 'Rosy';
