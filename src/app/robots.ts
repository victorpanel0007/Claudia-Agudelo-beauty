import { MetadataRoute } from 'next'

const BASE_URL = 'https://claudiaagudelobeauty.com'

/**
 * robots.txt generado dinámicamente por Next.js.
 *
 * Política:
 * - Las páginas públicas (/, /privacidad) están permitidas para todos los crawlers.
 * - Las rutas privadas (/admin, /api, /login, /especialista) están bloqueadas.
 * - Los crawlers de IA pueden acceder al contenido público para incluir el negocio
 *   en resultados de búsqueda conversacionales.
 * - Google-Extended y Applebot-Extended se permiten porque el contenido del sitio
 *   es información pública del negocio que queremos difundir.
 * - OAI-SearchBot (ChatGPT Search) se permite explícitamente para búsquedas web.
 * - Claude-SearchBot (Anthropic) se permite para búsquedas web.
 * - Perplexity-User se permite para el motor de búsqueda de Perplexity.
 *
 * Nota: robots.txt NO proporciona seguridad. Las rutas privadas están
 * protegidas por autenticación en el servidor, no solo por este archivo.
 */
export default function robots(): MetadataRoute.Robots {
  const privateRoutes = [
    '/admin',
    '/admin/',
    '/api/',
    '/login',
    '/especialista',
    '/especialista/',
  ]

  return {
    rules: [
      // ── Google Search & crawlers generales ────────────────────────────
      {
        userAgent: 'Googlebot',
        allow: ['/', '/privacidad'],
        disallow: privateRoutes,
      },
      // ── Google-Extended: modelos de IA de Google (Gemini, etc.) ───────
      // Permitimos que comprendan el negocio para búsquedas conversacionales
      {
        userAgent: 'Google-Extended',
        allow: ['/', '/privacidad'],
        disallow: privateRoutes,
      },
      // ── OpenAI — Entrenamiento de modelos ─────────────────────────────
      // GPTBot se usa para entrenamiento; bloqueamos rutas privadas
      {
        userAgent: 'GPTBot',
        allow: ['/', '/privacidad'],
        disallow: privateRoutes,
      },
      // ── OpenAI — ChatGPT Search (búsquedas web en tiempo real) ────────
      {
        userAgent: 'OAI-SearchBot',
        allow: ['/', '/privacidad'],
        disallow: privateRoutes,
      },
      // ── OpenAI — ChatGPT navegación (usuario usa Browse) ──────────────
      {
        userAgent: 'ChatGPT-User',
        allow: ['/', '/privacidad'],
        disallow: privateRoutes,
      },
      // ── Anthropic / Claude ────────────────────────────────────────────
      {
        userAgent: 'ClaudeBot',
        allow: ['/', '/privacidad'],
        disallow: privateRoutes,
      },
      {
        userAgent: 'Claude-SearchBot',
        allow: ['/', '/privacidad'],
        disallow: privateRoutes,
      },
      // ── Perplexity AI ─────────────────────────────────────────────────
      {
        userAgent: 'PerplexityBot',
        allow: ['/', '/privacidad'],
        disallow: privateRoutes,
      },
      // ── Apple (Siri, Spotlight, Safari) ───────────────────────────────
      {
        userAgent: 'Applebot',
        allow: ['/', '/privacidad'],
        disallow: privateRoutes,
      },
      // ── Apple-Extended: Apple Intelligence ────────────────────────────
      {
        userAgent: 'Applebot-Extended',
        allow: ['/', '/privacidad'],
        disallow: privateRoutes,
      },
      // ── Regla por defecto para el resto de crawlers ───────────────────
      {
        userAgent: '*',
        allow: ['/', '/privacidad'],
        disallow: privateRoutes,
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  }
}
