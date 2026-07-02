-- ================================================================
-- MIGRACIONES PENDIENTES — Claudia Agudelo Beauty
-- Ejecutar en orden en el SQL Editor de Supabase
-- ================================================================
-- Todas las sentencias usan IF NOT EXISTS / IF EXISTS / ON CONFLICT
-- para que puedan ejecutarse varias veces sin error.
-- ================================================================


-- ────────────────────────────────────────────────────────────────
-- 1. ESPECIALISTAS — nuevas columnas y horario correcto
-- ────────────────────────────────────────────────────────────────

-- Agregar columnas de notificaciones WhatsApp si no existen
ALTER TABLE especialistas
  ADD COLUMN IF NOT EXISTS whatsapp      text,
  ADD COLUMN IF NOT EXISTS notificaciones boolean DEFAULT true;

-- Corregir horario: el seed original insertó 08:00/18:00
-- El horario real del spa es 09:00–19:00
UPDATE especialistas
SET
  horario_inicio = '09:00',
  horario_fin    = '19:00'
WHERE
  horario_inicio = '08:00'
  AND horario_fin = '18:00';

-- Actualizar defaults de la tabla para futuros inserts
ALTER TABLE especialistas
  ALTER COLUMN horario_inicio SET DEFAULT '09:00';

ALTER TABLE especialistas
  ALTER COLUMN horario_fin SET DEFAULT '19:00';


-- ────────────────────────────────────────────────────────────────
-- 2. NOTIFICACIONES A ESPECIALISTAS
-- ────────────────────────────────────────────────────────────────

-- Historial de mensajes WhatsApp enviados a especialistas
CREATE TABLE IF NOT EXISTS notificaciones_especialista (
  id                  uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  cita_id             uuid        REFERENCES citas(id) ON DELETE SET NULL,
  especialista_id     uuid        REFERENCES especialistas(id) ON DELETE SET NULL,
  especialista_nombre text,
  whatsapp_destino    text        NOT NULL DEFAULT '',
  mensaje             text        NOT NULL,
  estado              text        NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('enviado', 'error', 'pendiente')),
  tipo                text        NOT NULL DEFAULT 'confirmacion'
    CHECK (tipo IN (
      'confirmacion', 'recordatorio_24h', 'recordatorio_1h',
      'cancelacion', 'reprogramacion', 'finalizacion', 'prueba'
    )),
  codigo_respuesta    int,
  error_detalle       text,
  created_at          timestamptz DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_notif_cita    ON notificaciones_especialista(cita_id);
CREATE INDEX IF NOT EXISTS idx_notif_esp     ON notificaciones_especialista(especialista_id);
CREATE INDEX IF NOT EXISTS idx_notif_estado  ON notificaciones_especialista(estado);
CREATE INDEX IF NOT EXISTS idx_notif_fecha   ON notificaciones_especialista(created_at DESC);

-- RLS
ALTER TABLE notificaciones_especialista ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'notificaciones_especialista'
      AND policyname = 'Full access notificaciones'
  ) THEN
    CREATE POLICY "Full access notificaciones"
      ON notificaciones_especialista
      USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Agregar tipo 'prueba' al CHECK si la tabla ya existía sin él
-- (Supabase no soporta ALTER CHECK directamente; se hace recreando la constraint)
-- Si la tabla es nueva (línea de arriba), este bloque no hace nada.
DO $$ BEGIN
  -- Solo ejecuta si la restricción original no incluye 'prueba'
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notificaciones_especialista'
      AND column_name = 'tipo'
  ) THEN
    -- Actualizar constraint de tipo para incluir 'prueba'
    ALTER TABLE notificaciones_especialista
      DROP CONSTRAINT IF EXISTS notificaciones_especialista_tipo_check;
    ALTER TABLE notificaciones_especialista
      ADD CONSTRAINT notificaciones_especialista_tipo_check
      CHECK (tipo IN (
        'confirmacion', 'recordatorio_24h', 'recordatorio_1h',
        'cancelacion', 'reprogramacion', 'finalizacion', 'prueba'
      ));
  END IF;
END $$;

-- Asegurar que whatsapp_destino admite string vacío (mensajes de error sin número)
ALTER TABLE notificaciones_especialista
  ALTER COLUMN whatsapp_destino SET DEFAULT '';


-- ────────────────────────────────────────────────────────────────
-- 3. COMISIONES Y PAGOS
-- ────────────────────────────────────────────────────────────────

-- Agregar columnas de comisión a citas
ALTER TABLE citas
  ADD COLUMN IF NOT EXISTS porcentaje_comision   numeric,
  ADD COLUMN IF NOT EXISTS comision_especialista numeric,
  ADD COLUMN IF NOT EXISTS ganancia_spa          numeric,
  ADD COLUMN IF NOT EXISTS pago_estado           text DEFAULT 'pendiente'
    CHECK (pago_estado IN ('pendiente', 'pagado', 'parcial'));

-- Tabla de configuración de comisiones por especialista
CREATE TABLE IF NOT EXISTS comisiones_config (
  id              uuid    PRIMARY KEY DEFAULT uuid_generate_v4(),
  especialista_id uuid    REFERENCES especialistas(id) ON DELETE CASCADE UNIQUE,
  porcentaje      numeric NOT NULL DEFAULT 40
    CHECK (porcentaje >= 0 AND porcentaje <= 100),
  updated_at      timestamptz DEFAULT now()
);

ALTER TABLE comisiones_config ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'comisiones_config'
      AND policyname = 'Full access comisiones'
  ) THEN
    CREATE POLICY "Full access comisiones"
      ON comisiones_config USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Tabla de registro de pagos realizados a especialistas
CREATE TABLE IF NOT EXISTS pagos_especialistas (
  id                   uuid    PRIMARY KEY DEFAULT uuid_generate_v4(),
  especialista_id      uuid    REFERENCES especialistas(id) ON DELETE CASCADE,
  especialista_nombre  text    NOT NULL,
  fecha                date    NOT NULL DEFAULT CURRENT_DATE,
  periodo              text    NOT NULL DEFAULT 'semanal'
    CHECK (periodo IN ('semanal', 'quincenal', 'mensual', 'personalizado')),
  fecha_inicio_periodo date,
  fecha_fin_periodo    date,
  valor_pagado         numeric NOT NULL CHECK (valor_pagado > 0),
  metodo_pago          text    NOT NULL DEFAULT 'efectivo'
    CHECK (metodo_pago IN ('efectivo', 'transferencia', 'nequi', 'daviplata', 'cheque', 'otro')),
  observaciones        text,
  registrado_por       text,
  created_at           timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pagos_esp   ON pagos_especialistas(especialista_id);
CREATE INDEX IF NOT EXISTS idx_pagos_fecha ON pagos_especialistas(fecha);

ALTER TABLE pagos_especialistas ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'pagos_especialistas'
      AND policyname = 'Full access pagos'
  ) THEN
    CREATE POLICY "Full access pagos"
      ON pagos_especialistas USING (true) WITH CHECK (true);
  END IF;
END $$;


-- ────────────────────────────────────────────────────────────────
-- 4. CONTABILIDAD — Gastos y Liquidaciones
-- ────────────────────────────────────────────────────────────────

-- Gastos del negocio
CREATE TABLE IF NOT EXISTS gastos (
  id              uuid    PRIMARY KEY DEFAULT uuid_generate_v4(),
  fecha           date    NOT NULL DEFAULT CURRENT_DATE,
  categoria       text    NOT NULL CHECK (categoria IN (
    'Productos', 'Insumos', 'Arriendo', 'Publicidad',
    'Servicios Públicos', 'Nómina Administrativa',
    'Equipos', 'Mantenimiento', 'Otros'
  )),
  descripcion     text    NOT NULL,
  valor           numeric NOT NULL CHECK (valor > 0),
  comprobante_url text,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE gastos ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'gastos' AND policyname = 'Full access gastos'
  ) THEN
    CREATE POLICY "Full access gastos" ON gastos USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Liquidaciones quincenales / semanales
CREATE TABLE IF NOT EXISTS liquidaciones (
  id                  uuid    PRIMARY KEY DEFAULT uuid_generate_v4(),
  especialista_id     uuid    REFERENCES especialistas(id) ON DELETE CASCADE,
  semana_inicio       date    NOT NULL,
  semana_fin          date    NOT NULL,
  total_facturado     numeric NOT NULL DEFAULT 0,
  porcentaje_comision numeric NOT NULL DEFAULT 40,
  valor_comision      numeric NOT NULL DEFAULT 0,
  anticipos           numeric NOT NULL DEFAULT 0,
  total_a_pagar       numeric NOT NULL DEFAULT 0,
  estado              text    NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'pagada')),
  fecha_pago          date,
  metodo_pago         text,
  observaciones       text,
  created_at          timestamptz DEFAULT now()
);

ALTER TABLE liquidaciones ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'liquidaciones' AND policyname = 'Full access liquidaciones'
  ) THEN
    CREATE POLICY "Full access liquidaciones"
      ON liquidaciones USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Insertar comisión 40% por defecto para especialistas que no tengan config
INSERT INTO comisiones_config (especialista_id, porcentaje)
SELECT id, 40 FROM especialistas
ON CONFLICT (especialista_id) DO NOTHING;


-- ────────────────────────────────────────────────────────────────
-- 5. CITAS — columna canal (por si no existe)
-- ────────────────────────────────────────────────────────────────

ALTER TABLE citas
  ADD COLUMN IF NOT EXISTS canal text DEFAULT 'web'
    CHECK (canal IN ('whatsapp', 'web', 'admin', 'telefono'));


-- ────────────────────────────────────────────────────────────────
-- 6. VERIFICACIÓN FINAL
-- ────────────────────────────────────────────────────────────────

-- Muestra el estado final de todas las tablas y especialistas
SELECT
  'especialistas' AS tabla,
  COUNT(*) AS filas
FROM especialistas
UNION ALL
SELECT 'citas',                  COUNT(*) FROM citas
UNION ALL
SELECT 'notificaciones_esp',     COUNT(*) FROM notificaciones_especialista
UNION ALL
SELECT 'comisiones_config',      COUNT(*) FROM comisiones_config
UNION ALL
SELECT 'gastos',                 COUNT(*) FROM gastos
UNION ALL
SELECT 'liquidaciones',          COUNT(*) FROM liquidaciones
UNION ALL
SELECT 'pagos_especialistas',    COUNT(*) FROM pagos_especialistas
ORDER BY tabla;

-- Verificar horarios de especialistas
SELECT nombre, horario_inicio, horario_fin, whatsapp, notificaciones
FROM especialistas
ORDER BY nombre;
