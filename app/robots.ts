// app/robots.ts
import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/auth/login',
          '/auth/signup',
          '/watermarks/create',
          '/collections/create',
          '/collections',
          '/watermarks',
          '/account',
        ],
        disallow: [
          '/admin/',
          '/api/',
          
        ],
      },
    ],
    sitemap: 'https://stettoposts.com/sitemap.xml',
  };
}
