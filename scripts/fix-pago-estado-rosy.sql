-- Marcar como pagadas todas las citas completadas de Rosy
-- anteriores al 22 de julio de 2026 (ya fueron pagadas)
--
-- PASO 1: Verificar primero qué citas se van a afectar
SELECT
  c.id,
  c.fecha_inicio,
  c.valor_final,
  c.pago_estado,
  e.nombre AS especialista,
  s.nombre AS servicio
FROM citas c
JOIN especialistas e ON e.id = c.especialista_id
LEFT JOIN servicios s ON s.id = c.servicio_id
WHERE e.nombre ILIKE '%rosy%'
  AND c.estado = 'completada'
  AND c.pago_estado = 'pendiente'
  AND c.fecha_inicio < '2026-07-22T00:00:00-05:00'
ORDER BY c.fecha_inicio DESC;

-- PASO 2: Una vez verificado, ejecutar la actualización
-- (descomenta las líneas de abajo)

-- UPDATE citas
-- SET pago_estado = 'pagado'
-- WHERE especialista_id = (
--   SELECT id FROM especialistas WHERE nombre ILIKE '%rosy%' LIMIT 1
-- )
-- AND estado = 'completada'
-- AND pago_estado = 'pendiente'
-- AND fecha_inicio < '2026-07-22T00:00:00-05:00';
