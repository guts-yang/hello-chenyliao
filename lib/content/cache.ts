import 'server-only';
import { unstable_cache } from 'next/cache';
import { CONTENT_TAGS, type ContentTagName } from './types';

export { CONTENT_TAGS };
export type { ContentTagName };

/**
 * Wrap a server-side reader with Next.js' on-demand cache, scoped by a stable
 * cache key + a list of revalidation tags. The default 5-minute TTL is a soft
 * upper-bound; admin writes always punch through via revalidateTag().
 */
export function withTags<TArgs extends unknown[], TResult>(
  key: string,
  tags: ContentTagName[],
  fn: (...args: TArgs) => Promise<TResult>,
  options: { revalidate?: number | false } = {},
) {
  const cached = unstable_cache(fn, [key], {
    tags,
    revalidate: options.revalidate ?? 300,
  });
  return cached;
}

export const CONTENT_REVALIDATE_SECONDS = 300;
