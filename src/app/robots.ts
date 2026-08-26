import { MetadataRoute } from 'next'

const BASE_URL = 'https://claudiaagudelobeauty.com'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/privacidad'],
        disallow: [
          '/admin',
          '/admin/',
          '/api/',
          '/login',
          '/especialista',
          '/especialista/',
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  }
}
