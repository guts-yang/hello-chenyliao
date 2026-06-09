import 'server-only';
import {
  getExperienceBySlug,
  getProjectBySlug,
  searchAll,
} from '@/lib/content';
import { pickLocale, type Locale } from '@/lib/profile';

/**
 * Tool registry shared between the streaming chat endpoint and any future
 * non-streaming caller (e.g. an action that asks "summarize me in one line").
 *
 * Each tool returns a JSON-friendly payload. The shape is what the client
 * eventually renders as a rich card — the model never sees the raw payload,
 * only a stringified version that we feed back into the conversation as the
 * `tool` role message.
 */

type ToolContext = { locale: Locale };

export type ToolPayload =
  | {
      kind: 'projects';
      items: Array<{ slug: string; title: string; tagline: string; href: string }>;
    }
  | {
      kind: 'posts';
      items: Array<{ slug: string; title: string; excerpt: string; href: string }>;
    }
  | {
      kind: 'experience';
      slug: string;
      org: string;
      role: string;
      summary: string;
      href: string;
    }
  | {
      kind: 'project';
      slug: string;
      title: string;
      tagline: string;
      summary: string;
      href: string;
    }
  | {
      kind: 'resume';
      href: string;
      label: string;
    }
  | {
      kind: 'error';
      message: string;
    };

export type ToolDef = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

export const TOOL_DEFS: ToolDef[] = [
  {
    name: 'search_projects',
    description:
      'Look up the most relevant projects (research or engineering) by a free-text query. Use this whenever the user asks about specific projects or wants to see examples of work.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Free-text search query.' },
      },
      required: ['query'],
    },
  },
  {
    name: 'search_posts',
    description:
      'Find blog posts by free-text query. Prefer this for "have you written about X?" style questions.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string' },
      },
      required: ['query'],
    },
  },
  {
    name: 'show_project',
    description: 'Surface a specific project by slug.',
    parameters: {
      type: 'object',
      properties: { slug: { type: 'string' } },
      required: ['slug'],
    },
  },
  {
    name: 'show_experience',
    description: 'Surface a specific work / practice experience by slug.',
    parameters: {
      type: 'object',
      properties: { slug: { type: 'string' } },
      required: ['slug'],
    },
  },
  {
    name: 'show_resume',
    description:
      'Offer the visitor a download link to the latest PDF resume. Use when they ask for a CV / resume / 简历.',
    parameters: {
      type: 'object',
      properties: {
        lang: { type: 'string', enum: ['zh', 'en'] },
      },
    },
  },
];

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolPayload> {
  try {
    switch (name) {
      case 'search_projects': {
        const q = typeof args.query === 'string' ? args.query : '';
        const hits = await searchAll(q, ctx.locale, 6);
        return {
          kind: 'projects',
          items: hits
            .filter((h) => h.scope === 'project')
            .slice(0, 4)
            .map((h) => ({
              slug: h.slug,
              title: pickLocale(h.title, ctx.locale),
              tagline: pickLocale(h.excerpt, ctx.locale),
              href: h.href,
            })),
        };
      }
      case 'search_posts': {
        const q = typeof args.query === 'string' ? args.query : '';
        const hits = await searchAll(q, ctx.locale, 6);
        return {
          kind: 'posts',
          items: hits
            .filter((h) => h.scope === 'post')
            .slice(0, 4)
            .map((h) => ({
              slug: h.slug,
              title: pickLocale(h.title, ctx.locale),
              excerpt: pickLocale(h.excerpt, ctx.locale),
              href: h.href,
            })),
        };
      }
      case 'show_project': {
        const slug = String(args.slug ?? '');
        const p = await getProjectBySlug(slug);
        if (!p) return { kind: 'error', message: `project not found: ${slug}` };
        return {
          kind: 'project',
          slug: p.slug,
          title: pickLocale(p.title, ctx.locale),
          tagline: pickLocale(p.tagline, ctx.locale),
          summary: pickLocale(p.summary, ctx.locale),
          href: `/${ctx.locale}/projects/${p.slug}`,
        };
      }
      case 'show_experience': {
        const slug = String(args.slug ?? '');
        const e = await getExperienceBySlug(slug);
        if (!e) return { kind: 'error', message: `experience not found: ${slug}` };
        return {
          kind: 'experience',
          slug: e.slug,
          org: pickLocale(e.org, ctx.locale),
          role: pickLocale(e.role, ctx.locale),
          summary: pickLocale(e.summary, ctx.locale),
          href: `/${ctx.locale}/experience/${e.slug}`,
        };
      }
      case 'show_resume': {
        const lang = args.lang === 'en' ? 'en' : ctx.locale;
        return {
          kind: 'resume',
          href: `/api/resume.pdf?lang=${lang}`,
          label: lang === 'zh' ? '下载简历 PDF' : 'Download resume PDF',
        };
      }
      default:
        return { kind: 'error', message: `unknown tool: ${name}` };
    }
  } catch (err) {
    return { kind: 'error', message: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Compact, human-readable summary of a tool result that we feed BACK to the
 * model as the next `tool` message. Models do better with short structured
 * text than with raw JSON.
 */
export function summarizeToolResult(payload: ToolPayload): string {
  switch (payload.kind) {
    case 'projects':
      if (payload.items.length === 0) return 'No matching projects.';
      return payload.items
        .map((p, i) => `${i + 1}. ${p.title} — ${p.tagline} (${p.href})`)
        .join('\n');
    case 'posts':
      if (payload.items.length === 0) return 'No matching posts.';
      return payload.items
        .map((p, i) => `${i + 1}. ${p.title} — ${p.excerpt} (${p.href})`)
        .join('\n');
    case 'project':
      return `Project ${payload.title}: ${payload.tagline}. Summary: ${payload.summary}. URL: ${payload.href}`;
    case 'experience':
      return `Experience ${payload.org} (${payload.role}): ${payload.summary}. URL: ${payload.href}`;
    case 'resume':
      return `Resume PDF available at ${payload.href}`;
    case 'error':
      return `(tool error) ${payload.message}`;
  }
}
