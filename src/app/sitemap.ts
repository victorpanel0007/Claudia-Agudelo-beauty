import { MetadataRoute } from 'next'

const BASE_URL = 'https://claudiaagudelobeauty.com'

/**
 * Sitemap generado dinámicamente por Next.js.
 * Solo incluye URLs públicas, canónicas y del dominio principal.
 * Excluye: /admin, /api, /login, /especialista y cualquier ruta privada.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${BASE_URL}/`,
      lastModified: new Date('2026-11-01'),
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/privacidad`,
      lastModified: new Date('2026-07-01'),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ]
}
