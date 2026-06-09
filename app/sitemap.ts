import type { MetadataRoute } from 'next';
import { locales } from '@/i18n';
import { getProjects, getExperiences } from '@/lib/content';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
  const [projects, experiences] = await Promise.all([
    getProjects(),
    getExperiences(),
  ]);

  const urls: MetadataRoute.Sitemap = [];

  for (const locale of locales) {
    urls.push({
      url: `${base}/${locale}`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    });
    for (const p of projects) {
      urls.push({
        url: `${base}/${locale}/projects/${p.slug}`,
        lastModified: new Date(),
        changeFrequency: 'monthly',
        priority: 0.7,
      });
    }
    for (const e of experiences) {
      urls.push({
        url: `${base}/${locale}/experience/${e.slug}`,
        lastModified: new Date(),
        changeFrequency: 'monthly',
        priority: 0.6,
      });
    }
  }

  return urls;
}
