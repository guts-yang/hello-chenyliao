import { slugify } from './slugify';

export type TocEntry = {
  id: string;
  level: 2 | 3;
  text: string;
};

/**
 * Pull H2/H3 headings out of a markdown / MDX source so we can render a
 * sticky table of contents alongside the article. We avoid a full AST parse on
 * purpose: this runs on every render and 99% of headings are well-formed `##`
 * lines outside of fenced code blocks.
 */
export function extractToc(source: string | null | undefined): TocEntry[] {
  if (!source) return [];

  const out: TocEntry[] = [];
  const seen = new Set<string>();
  const lines = source.split(/\r?\n/);
  let inFence = false;

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^\s{0,3}(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const match = /^\s{0,3}(#{2,3})\s+(.+?)\s*#*\s*$/.exec(line);
    if (!match) continue;
    const level = match[1].length === 2 ? 2 : 3;
    const text = match[2].replace(/\s+/g, ' ').trim();
    if (!text) continue;
    let id = slugify(text);
    if (!id) continue;
    let suffix = 2;
    while (seen.has(id)) {
      id = `${slugify(text)}-${suffix++}`;
    }
    seen.add(id);
    out.push({ id, level, text });
  }
  return out;
}

/**
 * Estimate reading minutes (Chinese ~ 500cpm, English ~ 220wpm, take the
 * conservative middle).
 */
export function estimateReadingMinutes(source: string | null | undefined): number {
  if (!source) return 1;
  const text = source.replace(/```[\s\S]*?```/g, ' ');
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const otherWords = text
    .replace(/[\u4e00-\u9fff]/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length;
  const minutes = Math.ceil(chineseChars / 450 + otherWords / 220);
  return Math.max(1, minutes);
}
