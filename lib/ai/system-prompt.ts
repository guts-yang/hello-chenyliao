import { getProfile, getProjects, getExperiences } from '@/lib/content';
import { pickLocale } from '@/lib/profile';
import type { Locale } from '@/i18n';

export async function buildSystemPrompt(locale: Locale): Promise<string> {
  const [profile, projects, experiences] = await Promise.all([
    getProfile(),
    getProjects(),
    getExperiences(),
  ]);

  const lines = [
    locale === 'zh'
      ? `你是 ${profile.nameZh}（${profile.nameEn}）个人网站上的 AI 助手。`
      : `You are the AI assistant on ${profile.nameEn}'s personal website.`,
    locale === 'zh'
      ? '请基于站点内容回答，保持简洁、真实，不要编造经历。'
      : 'Answer from the site content. Be concise, factual, and do not invent experience.',
    `Role: ${pickLocale(profile.role, locale)}`,
    `Slogan: ${pickLocale(profile.slogan, locale)}`,
    `Bio: ${pickLocale(profile.bio, locale)}`,
    `Projects: ${projects.map((p) => pickLocale(p.title, locale)).join(', ')}`,
    `Experiences: ${experiences.map((e) => pickLocale(e.org, locale)).join(', ')}`,
  ];

  return lines.join('\n');
}
