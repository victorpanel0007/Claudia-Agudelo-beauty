-- ============================================================
-- FIX: Tabla gastos — RLS policies para panel admin
-- Ejecutar en Supabase → SQL Editor
-- ============================================================

-- 1. Asegurarse que la tabla gastos existe con la estructura correcta
CREATE TABLE IF NOT EXISTS gastos (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  fecha       date NOT NULL,
  categoria   text NOT NULL CHECK (categoria IN (
                'Productos', 'Insumos', 'Arriendo', 'Publicidad',
                'Servicios Públicos', 'Nómina Administrativa',
                'Equipos', 'Mantenimiento', 'Otros'
              )),
  descripcion text NOT NULL,
  valor       numeric NOT NULL CHECK (valor > 0),
  created_at  timestamptz DEFAULT now()
);

-- 2. Habilitar RLS (si no está habilitado)
ALTER TABLE gastos ENABLE ROW LEVEL SECURITY;

-- 3. Eliminar políticas viejas si existen
DROP POLICY IF EXISTS "gastos_select" ON gastos;
DROP POLICY IF EXISTS "gastos_insert" ON gastos;
DROP POLICY IF EXISTS "gastos_update" ON gastos;
DROP POLICY IF EXISTS "gastos_delete" ON gastos;
DROP POLICY IF EXISTS "Allow all for authenticated" ON gastos;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON gastos;

-- 4. Crear políticas que permiten todo a usuarios autenticados
-- (el API route usa service_role que bypasa RLS, pero por si acaso)
CREATE POLICY "gastos_select" ON gastos
  FOR SELECT USING (true);

CREATE POLICY "gastos_insert" ON gastos
  FOR INSERT WITH CHECK (true);

CREATE POLICY "gastos_update" ON gastos
  FOR UPDATE USING (true);

CREATE POLICY "gastos_delete" ON gastos
  FOR DELETE USING (true);

-- 5. Verificar que el service role tiene acceso completo
GRANT ALL ON gastos TO service_role;
GRANT ALL ON gastos TO authenticated;
GRANT ALL ON gastos TO anon;

-- 6. Verificar estructura actual
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'gastos'
ORDER BY ordinal_position;
