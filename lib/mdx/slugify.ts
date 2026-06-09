/**
 * Stable, locale-friendly slugifier used to derive heading ids in MDX content
 * and TOC entries. Keeps unicode letters (so Chinese headings stay readable in
 * the URL fragment) and collapses everything else to `-`.
 */
const DROP = /[\u0000-\u001F\u007F!"#$%&'()*+,./:;<=>?@\[\\\]^`{|}~]/g;

export function slugify(input: string | null | undefined): string {
  if (!input) return '';
  const lowered = String(input).normalize('NFKC').toLowerCase();
  const cleaned = lowered
    .replace(DROP, ' ')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return cleaned || 'section';
}

/**
 * React children -> plain text. Used by the MDX heading components so we can
 * derive ids from JSX-tree headings, not just markdown strings.
 */
export function reactChildrenToString(node: unknown): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(reactChildrenToString).join('');
  if (typeof node === 'object' && 'props' in (node as Record<string, unknown>)) {
    const props = (node as { props?: { children?: unknown } }).props;
    return reactChildrenToString(props?.children);
  }
  return '';
}
