-- ============================================
-- MÓDULO DE CONTABILIDAD
-- ============================================

-- Gastos del negocio
CREATE TABLE IF NOT EXISTS gastos (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  categoria text NOT NULL CHECK (categoria IN (
    'Productos','Insumos','Arriendo','Publicidad',
    'Servicios Públicos','Nómina Administrativa',
    'Equipos','Mantenimiento','Otros'
  )),
  descripcion text NOT NULL,
  valor numeric NOT NULL CHECK (valor > 0),
  comprobante_url text,
  created_at timestamptz DEFAULT now()
);

-- Comisiones de especialistas
CREATE TABLE IF NOT EXISTS comisiones_config (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  especialista_id uuid REFERENCES especialistas(id) ON DELETE CASCADE UNIQUE,
  porcentaje numeric NOT NULL DEFAULT 40 CHECK (porcentaje >= 0 AND porcentaje <= 100),
  updated_at timestamptz DEFAULT now()
);

-- Liquidaciones semanales
CREATE TABLE IF NOT EXISTS liquidaciones (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  especialista_id uuid REFERENCES especialistas(id) ON DELETE CASCADE,
  semana_inicio date NOT NULL,
  semana_fin date NOT NULL,
  total_facturado numeric NOT NULL DEFAULT 0,
  porcentaje_comision numeric NOT NULL DEFAULT 40,
  valor_comision numeric NOT NULL DEFAULT 0,
  anticipos numeric NOT NULL DEFAULT 0,
  total_a_pagar numeric NOT NULL DEFAULT 0,
  estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','pagada')),
  fecha_pago date,
  metodo_pago text,
  observaciones text,
  created_at timestamptz DEFAULT now()
);

-- RLS permisivo
ALTER TABLE gastos ENABLE ROW LEVEL SECURITY;
ALTER TABLE comisiones_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE liquidaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Full access gastos" ON gastos USING (true) WITH CHECK (true);
CREATE POLICY "Full access comisiones" ON comisiones_config USING (true) WITH CHECK (true);
CREATE POLICY "Full access liquidaciones" ON liquidaciones USING (true) WITH CHECK (true);

-- Insertar comisión por defecto para especialistas existentes
INSERT INTO comisiones_config (especialista_id, porcentaje)
SELECT id, 40 FROM especialistas
ON CONFLICT (especialista_id) DO NOTHING;
