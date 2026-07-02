-- ============================================
-- MÓDULO DE COMISIONES Y PAGOS
-- ============================================

-- 1. Agregar columnas a citas para guardar comisión al momento de finalizar
ALTER TABLE citas
  ADD COLUMN IF NOT EXISTS porcentaje_comision numeric,
  ADD COLUMN IF NOT EXISTS comision_especialista numeric,
  ADD COLUMN IF NOT EXISTS ganancia_spa numeric,
  ADD COLUMN IF NOT EXISTS pago_estado text DEFAULT 'pendiente'
    CHECK (pago_estado IN ('pendiente','pagado','parcial'));

-- 2. La tabla comisiones_config ya existe (del módulo anterior)
-- Solo actualizamos para garantizar que tiene porcentaje
ALTER TABLE comisiones_config
  ADD COLUMN IF NOT EXISTS porcentaje numeric NOT NULL DEFAULT 40;

-- 3. Registro de pagos a especialistas
CREATE TABLE IF NOT EXISTS pagos_especialistas (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  especialista_id uuid REFERENCES especialistas(id) ON DELETE CASCADE,
  especialista_nombre text NOT NULL,
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  periodo text NOT NULL DEFAULT 'semanal'
    CHECK (periodo IN ('semanal','quincenal','mensual','personalizado')),
  fecha_inicio_periodo date,
  fecha_fin_periodo date,
  valor_pagado numeric NOT NULL CHECK (valor_pagado > 0),
  metodo_pago text NOT NULL DEFAULT 'efectivo'
    CHECK (metodo_pago IN ('efectivo','transferencia','nequi','daviplata','cheque','otro')),
  observaciones text,
  registrado_por text,
  created_at timestamptz DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_pagos_esp ON pagos_especialistas(especialista_id);
CREATE INDEX IF NOT EXISTS idx_pagos_fecha ON pagos_especialistas(fecha);

-- RLS
ALTER TABLE pagos_especialistas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Full access pagos" ON pagos_especialistas
  USING (true) WITH CHECK (true);

-- RLS para comisiones_config (por si no existe)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='comisiones_config' AND policyname='Full access comisiones'
  ) THEN
    CREATE POLICY "Full access comisiones" ON comisiones_config USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Insertar comisión 40% por defecto para especialistas sin config
INSERT INTO comisiones_config (especialista_id, porcentaje)
SELECT id, 40 FROM especialistas
WHERE id NOT IN (SELECT especialista_id FROM comisiones_config WHERE especialista_id IS NOT NULL)
ON CONFLICT DO NOTHING;
