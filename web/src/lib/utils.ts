import type { Locale, Localized } from '@/types';

export function localized(value: Localized | undefined, locale: Locale): string {
  return value?.[locale] ?? value?.zh ?? '';
}

export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}
