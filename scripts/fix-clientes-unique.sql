-- ============================================================
-- FIX: Tabla clientes — unicidad de teléfono e índice rápido
-- Ejecutar en Supabase → SQL Editor
-- ============================================================

-- 1. Ver duplicados actuales (para limpiarlos manualmente si hay)
SELECT telefono, COUNT(*) as total, array_agg(id) as ids
FROM clientes
GROUP BY telefono
HAVING COUNT(*) > 1;

-- 2. Crear índice único en teléfono (si no existe)
-- ATENCIÓN: si hay duplicados, este comando fallará.
-- Primero limpia los duplicados con la query anterior.
CREATE UNIQUE INDEX IF NOT EXISTS clientes_telefono_unique
  ON clientes (telefono);

-- 3. Crear índice normal para búsquedas rápidas (por si el único ya existe)
CREATE INDEX IF NOT EXISTS clientes_telefono_idx
  ON clientes (telefono);

-- 4. RLS policies para clientes (asegurar que el service_role puede leer/escribir)
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clientes_all" ON clientes;
CREATE POLICY "clientes_all" ON clientes
  FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON clientes TO service_role;
GRANT ALL ON clientes TO authenticated;

-- 5. Verificar
SELECT COUNT(*) as total_clientes,
       COUNT(DISTINCT telefono) as telefonos_unicos
FROM clientes;
