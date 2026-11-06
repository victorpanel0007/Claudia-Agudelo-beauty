import { MetadataRoute } from 'next'

const BASE_URL = 'https://claudiaagudelobeauty.com'

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
      lastModified: new Date('2026-11-06'),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/cookies`,
      lastModified: new Date('2026-11-06'),
      changeFrequency: 'yearly',
      priority: 0.2,
    },
    {
      url: `${BASE_URL}/terminos`,
      lastModified: new Date('2026-11-06'),
      changeFrequency: 'yearly',
      priority: 0.2,
    },
  ]
}
