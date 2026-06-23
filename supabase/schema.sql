-- ============================================
-- CLAUDIA AGUDELO BEAUTY — SUPABASE SCHEMA
-- ============================================

-- Enable extensions
create extension if not exists "uuid-ossp";

-- ============================================
-- TABLAS
-- ============================================

-- Usuarios (admin panel)
create table if not exists usuarios (
  id uuid primary key default uuid_generate_v4(),
  nombre text not null,
  email text unique not null,
  rol text not null default 'admin' check (rol in ('admin', 'especialista', 'recepcionista')),
  created_at timestamptz default now()
);

-- Clientes
create table if not exists clientes (
  id uuid primary key default uuid_generate_v4(),
  nombre text not null,
  telefono text not null,
  email text,
  notas text,
  fecha_registro timestamptz default now(),
  updated_at timestamptz default now()
);

-- Especialistas
create table if not exists especialistas (
  id uuid primary key default uuid_generate_v4(),
  nombre text not null,
  foto text,
  activo boolean default true,
  especialidades text[],
  horario_inicio text default '08:00',
  horario_fin text default '18:00',
  dias_laborales int[] default '{1,2,3,4,5,6}',
  created_at timestamptz default now()
);

-- Categorias
create table if not exists categorias (
  id uuid primary key default uuid_generate_v4(),
  nombre text not null,
  icono text default '💅',
  orden int default 0
);

-- Servicios
create table if not exists servicios (
  id uuid primary key default uuid_generate_v4(),
  categoria_id uuid references categorias(id) on delete set null,
  nombre text not null,
  precio numeric,
  precio_desde numeric,
  tipo_precio text not null default 'fijo' check (tipo_precio in ('fijo', 'desde', 'valoracion')),
  duracion_minutos int not null default 60,
  requiere_valoracion boolean default false,
  descripcion text,
  activo boolean default true,
  created_at timestamptz default now()
);

-- Servicio — Especialista (relación muchos a muchos)
create table if not exists servicio_especialista (
  id uuid primary key default uuid_generate_v4(),
  servicio_id uuid references servicios(id) on delete cascade,
  especialista_id uuid references especialistas(id) on delete cascade,
  unique(servicio_id, especialista_id)
);

-- Citas
create table if not exists citas (
  id uuid primary key default uuid_generate_v4(),
  cliente_id uuid references clientes(id) on delete set null,
  especialista_id uuid references especialistas(id) on delete set null,
  servicio_id uuid references servicios(id) on delete set null,
  fecha_inicio timestamptz not null,
  fecha_fin timestamptz not null,
  estado text not null default 'confirmada' check (
    estado in ('pendiente', 'confirmada', 'en_proceso', 'completada', 'cancelada', 'no_asistio')
  ),
  valor_final numeric,
  observaciones text,
  canal text default 'whatsapp' check (canal in ('whatsapp', 'web', 'admin', 'telefono')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Mensajes WhatsApp
create table if not exists mensajes_whatsapp (
  id uuid primary key default uuid_generate_v4(),
  cliente_id uuid references clientes(id) on delete set null,
  telefono text not null,
  mensaje text not null,
  fecha timestamptz default now(),
  tipo text not null default 'entrante' check (tipo in ('entrante', 'saliente', 'sistema')),
  metadata jsonb
);

-- ============================================
-- INDICES
-- ============================================
create index if not exists idx_citas_fecha on citas(fecha_inicio);
create index if not exists idx_citas_especialista on citas(especialista_id);
create index if not exists idx_citas_cliente on citas(cliente_id);
create index if not exists idx_citas_estado on citas(estado);
create index if not exists idx_clientes_telefono on clientes(telefono);
create index if not exists idx_mensajes_telefono on mensajes_whatsapp(telefono);

-- ============================================
-- FUNCIONES Y TRIGGERS
-- ============================================

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_citas_updated_at
  before update on citas
  for each row execute function update_updated_at();

create trigger trg_clientes_updated_at
  before update on clientes
  for each row execute function update_updated_at();

-- View: stats por cliente
create or replace view clientes_con_stats as
select
  c.*,
  count(ct.id) as total_citas,
  coalesce(sum(ct.valor_final), 0) as total_gastado,
  max(ct.fecha_inicio) as ultima_visita
from clientes c
left join citas ct on ct.cliente_id = c.id and ct.estado = 'completada'
group by c.id;

-- ============================================
-- REALTIME
-- ============================================
alter publication supabase_realtime add table citas;
alter publication supabase_realtime add table clientes;
alter publication supabase_realtime add table mensajes_whatsapp;

-- ============================================
-- RLS (Row Level Security)
-- ============================================
alter table citas enable row level security;
alter table clientes enable row level security;
alter table servicios enable row level security;
alter table categorias enable row level security;
alter table especialistas enable row level security;
alter table mensajes_whatsapp enable row level security;

-- Public read for services/categories/specialists
create policy "Public read servicios" on servicios for select using (activo = true);
create policy "Public read categorias" on categorias for select using (true);
create policy "Public read especialistas" on especialistas for select using (activo = true);

-- Service role has full access (for API routes using service role key)
create policy "Service role full access citas" on citas using (true) with check (true);
create policy "Service role full access clientes" on clientes using (true) with check (true);
create policy "Service role full access mensajes" on mensajes_whatsapp using (true) with check (true);

-- ============================================
-- DATOS INICIALES
-- ============================================

-- Categorias
insert into categorias (nombre, icono, orden) values
  ('Manicura y Pedicura', '💅', 1),
  ('Maquillaje', '💄', 2),
  ('Masajes', '💆‍♀️', 3),
  ('Limpieza Facial', '✨', 4),
  ('Cejas y Pestañas', '👁️', 5),
  ('Peinados', '💇‍♀️', 6),
  ('Barbería', '💈', 7),
  ('Depilación Corporal', '🪒', 8),
  ('Peluquería', '💇‍♀️', 9)
on conflict do nothing;

-- Especialistas
insert into especialistas (nombre, activo, horario_inicio, horario_fin, dias_laborales) values
  ('Claudia', true, '08:00', '18:00', '{1,2,3,4,5,6}'),
  ('Andrea', true, '08:00', '18:00', '{1,2,3,4,5,6}')
on conflict do nothing;
