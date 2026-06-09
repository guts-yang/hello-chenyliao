/**
 * Public facade for the content layer.
 *
 * Import paths like `@/lib/content` keep working after the refactor; new
 * surfaces (posts, notes, settings, search) live under the same module.
 */
export * from './types';
export * from './readers';
export * from './search';
export { CONTENT_REVALIDATE_SECONDS } from './cache';
