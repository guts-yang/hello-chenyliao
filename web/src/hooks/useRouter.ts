import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Locale } from '@/types';

export type RouteKind = 'home' | 'project' | 'experience';

export interface AppRoute {
  path: string;
  locale: Locale;
  kind: RouteKind;
  slug?: string;
  hash: string;
}

function setMeta(name: string, content: string) {
  let element = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.name = name;
    document.head.append(element);
  }
  element.content = content;
}

function parsePath(pathname: string, hash: string): AppRoute {
  const clean = pathname.replace(/\/+$/, '') || '/';
  if (clean === '/') {
    return { path: '/zh', locale: 'zh', kind: 'home', hash };
  }

  const projectMatch = clean.match(/^\/(zh|en)\/projects\/([^/]+)$/);
  if (projectMatch) {
    return {
      path: clean,
      locale: projectMatch[1] as Locale,
      kind: 'project',
      slug: decodeURIComponent(projectMatch[2]),
      hash,
    };
  }

  const experienceMatch = clean.match(/^\/(zh|en)\/experience\/([^/]+)$/);
  if (experienceMatch) {
    return {
      path: clean,
      locale: experienceMatch[1] as Locale,
      kind: 'experience',
      slug: decodeURIComponent(experienceMatch[2]),
      hash,
    };
  }

  const homeMatch = clean.match(/^\/(zh|en)$/);
  if (homeMatch) {
    return {
      path: clean,
      locale: homeMatch[1] as Locale,
      kind: 'home',
      hash,
    };
  }

  return { path: '/zh', locale: 'zh', kind: 'home', hash: '' };
}

function applyDocumentMeta(route: AppRoute) {
  const detail = route.slug ? ` · ${route.slug.replaceAll('-', ' ')}` : '';
  document.documentElement.lang = route.locale;
  document.title =
    route.locale === 'zh'
      ? `gutsyang${detail} · AI 算法工程师`
      : `gutsyang${detail} · AI Engineer`;
  setMeta(
    'description',
    route.locale === 'zh'
      ? 'gutsyang 的项目、经历与 AI 研究。'
      : 'Projects, experience and AI research by gutsyang.',
  );
}

function readLocation(): AppRoute {
  return parsePath(window.location.pathname, window.location.hash);
}

export function useRouter() {
  const [route, setRoute] = useState<AppRoute>(() => {
    if (typeof window === 'undefined') {
      return { path: '/zh', locale: 'zh', kind: 'home', hash: '' };
    }
    return readLocation();
  });

  useEffect(() => {
    const current = readLocation();
    if (window.location.pathname === '/' || current.path !== window.location.pathname) {
      window.history.replaceState({}, '', current.path + current.hash);
    }
    setRoute(current);
    applyDocumentMeta(current);

    const onPopState = () => {
      const next = readLocation();
      setRoute(next);
      applyDocumentMeta(next);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    if (!route.hash || route.kind !== 'home') return;
    const id = route.hash.replace(/^#/, '');
    if (!id) return;
    const timer = window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
    return () => window.clearTimeout(timer);
  }, [route]);

  const navigate = useCallback((to: string, options?: { replace?: boolean }) => {
    const url = new URL(to, window.location.origin);
    const next = parsePath(url.pathname, url.hash);
    if (options?.replace) {
      window.history.replaceState({}, '', next.path + next.hash);
    } else {
      window.history.pushState({}, '', next.path + next.hash);
    }
    setRoute(next);
    applyDocumentMeta(next);
    if (!next.hash && next.kind !== 'home') {
      window.scrollTo({ top: 0 });
    }
  }, []);

  const switchLocale = useCallback(
    (nextLocale: Locale) => {
      const nextPath = route.path.replace(/^\/(zh|en)/, `/${nextLocale}`);
      navigate(nextPath + route.hash);
    },
    [navigate, route.hash, route.path],
  );

  return useMemo(
    () => ({ route, navigate, switchLocale }),
    [route, navigate, switchLocale],
  );
}
