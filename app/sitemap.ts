import type { MetadataRoute } from 'next';
import { locales } from '@/i18n';
import { getProjects, getExperiences, getPosts } from '@/lib/content';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
  const [projects, experiences, posts] = await Promise.all([
    getProjects(),
    getExperiences(),
    getPosts(),
  ]);

  const urls: MetadataRoute.Sitemap = [];

  for (const locale of locales) {
    urls.push({
      url: `${base}/${locale}`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    });
    urls.push({
      url: `${base}/${locale}/blog`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    });
    urls.push({
      url: `${base}/${locale}/contact`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
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
    for (const post of posts) {
      urls.push({
        url: `${base}/${locale}/posts/${post.slug}`,
        lastModified: post.publishedAt ? new Date(post.publishedAt) : new Date(),
        changeFrequency: 'monthly',
        priority: 0.65,
      });
    }
  }

  return urls;
}
