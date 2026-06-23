# 💅 Claudia Agudelo Beauty

Sistema completo de reservas y gestión para salón de belleza — construido con **Next.js 15**, **Supabase** y **WhatsApp Bot** (Evolution API).

## 🚀 Demo
Sitio web con reservas online, panel administrativo y bot de WhatsApp para agendar citas automáticamente.

---

## 🛠 Stack Tecnológico

| Capa | Tecnología |
|---|---|
| Framework | Next.js 15 (App Router) |
| Base de datos | Supabase (PostgreSQL) |
| Autenticación | Supabase Auth |
| WhatsApp Bot | Evolution API |
| Estilos | Tailwind CSS |
| Animaciones | Framer Motion |
| Formularios | React Hook Form + Zod |
| Despliegue | Vercel |

---

## ⚙️ Instalación

### 1. Clona el repositorio
```bash
git clone https://github.com/tu-usuario/claudia-agudelo-beauty.git
cd claudia-agudelo-beauty
```

### 2. Instala dependencias
```bash
npm install
```

### 3. Configura variables de entorno
```bash
cp .env.example .env.local
# Edita .env.local con tus credenciales de Supabase y Evolution API
```

### 4. Configura la base de datos
Ejecuta el schema en Supabase SQL Editor:
```bash
# Copia el contenido de supabase/schema.sql en el SQL Editor de Supabase
```

### 5. Carga los datos iniciales
```bash
node scripts/seed.mjs
```

### 6. Crea el usuario administrador
```bash
node scripts/create-admin.mjs
```

### 7. Levanta el servidor de desarrollo
```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000)

---

## 📁 Estructura del Proyecto

```
src/
├── app/
│   ├── (auth)/login/        # Página de login
│   ├── admin/               # Panel administrativo
│   ├── api/                 # API Routes
│   └── page.tsx             # Sitio web público
├── components/
│   ├── admin/               # Componentes del panel admin
│   └── website/             # Componentes del sitio público
├── lib/
│   ├── supabase/            # Clientes de Supabase
│   ├── scheduling.ts        # Lógica de disponibilidad
│   ├── evolution-api.ts     # Integración WhatsApp
│   └── services-data.ts     # Catálogo de servicios
└── types/
    └── database.ts          # Tipos TypeScript
```

---

## 🔑 Variables de Entorno

Ver `.env.example` para la lista completa de variables requeridas.

> ⚠️ **NUNCA** subas `.env.local` ni credenciales reales a GitHub.

---

## 🚢 Despliegue en Vercel

1. Conecta el repositorio en [vercel.com](https://vercel.com)
2. Agrega las variables de entorno del `.env.example`
3. Despliega — Vercel detecta Next.js automáticamente

---

## 📱 Funcionalidades

- ✅ Sitio web con paleta de colores del salón
- ✅ Sistema de reservas online (3 pasos)
- ✅ Panel administrativo completo
- ✅ Agenda visual semanal con detalle de citas
- ✅ Gestión de clientes, especialistas y servicios
- ✅ Bot de WhatsApp para reservas automáticas
- ✅ Recordatorios automáticos por WhatsApp
- ✅ Reportes e ingresos
- ✅ Autenticación segura con Supabase Auth

---

## 📄 Licencia

Uso privado — Claudia Agudelo Beauty © 2025
