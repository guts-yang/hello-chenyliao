import { useCallback, useEffect, useMemo, useState } from 'react';

export type RouteKind =
  | 'home'
  | 'project'
  | 'experience'
  | 'admin'
  | 'admin-login'
  | 'admin-404';

export type AdminSection =
  | 'dashboard'
  | 'profile'
  | 'projects'
  | 'experiences'
  | 'honors'
  | 'education'
  | 'timeline'
  | 'resume'
  | 'media'
  | 'visuals'
  | 'settings'
  | 'audit';

export interface AppRoute {
  path: string;
  kind: RouteKind;
  slug?: string;
  hash: string;
  adminSection?: AdminSection;
  adminId?: string;
}

const ADMIN_SECTIONS: AdminSection[] = [
  'dashboard',
  'profile',
  'projects',
  'experiences',
  'honors',
  'education',
  'timeline',
  'resume',
  'media',
  'visuals',
  'settings',
  'audit',
];

function setMeta(name: string, content: string) {
  let element = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.name = name;
    document.head.append(element);
  }
  element.content = content;
}

function canonicalizeLegacyPath(pathname: string): string | null {
  if (pathname === '/zh' || pathname === '/en') return '/';
  const legacyProject = pathname.match(/^\/(zh|en)\/projects\/([^/]+)$/);
  if (legacyProject) return `/projects/${decodeURIComponent(legacyProject[2])}`;
  const legacyExperience = pathname.match(/^\/(zh|en)\/experience\/([^/]+)$/);
  if (legacyExperience) return `/experience/${decodeURIComponent(legacyExperience[2])}`;
  return null;
}

function parsePath(pathname: string, hash: string): AppRoute {
  const clean = pathname.replace(/\/+$/, '') || '/';

  if (clean === '/admin/login') {
    return { path: clean, kind: 'admin-login', hash: '' };
  }
  if (clean === '/admin') {
    return { path: clean, kind: 'admin', adminSection: 'dashboard', hash: '' };
  }
  const adminMatch = clean.match(/^\/admin\/([^/]+)(?:\/([^/]+))?$/);
  if (adminMatch) {
    const section = adminMatch[1] as AdminSection;
    if (!ADMIN_SECTIONS.includes(section) || section === 'dashboard') {
      return { path: clean, kind: 'admin-404', hash: '' };
    }
    return {
      path: clean,
      kind: 'admin',
      adminSection: section,
      adminId: adminMatch[2] ? decodeURIComponent(adminMatch[2]) : undefined,
      hash: '',
    };
  }
  if (clean.startsWith('/admin')) {
    return { path: clean, kind: 'admin-404', hash: '' };
  }

  const projectMatch = clean.match(/^\/projects\/([^/]+)$/);
  if (projectMatch) {
    return {
      path: clean,
      kind: 'project',
      slug: decodeURIComponent(projectMatch[1]),
      hash,
    };
  }

  const experienceMatch = clean.match(/^\/experience\/([^/]+)$/);
  if (experienceMatch) {
    return {
      path: clean,
      kind: 'experience',
      slug: decodeURIComponent(experienceMatch[1]),
      hash,
    };
  }

  if (clean === '/') {
    return { path: '/', kind: 'home', hash };
  }

  return { path: '/', kind: 'home', hash: '' };
}

function applyDocumentMeta(route: AppRoute) {
  if (route.kind.startsWith('admin')) {
    document.documentElement.lang = 'zh-CN';
    document.title = '廖晨扬 Admin';
    setMeta('description', '廖晨扬内容管理后台');
    return;
  }
  const detail = route.slug ? ` · ${route.slug.replaceAll('-', ' ')}` : '';
  document.documentElement.lang = 'zh-CN';
  document.title = `廖晨扬${detail} · AI 算法工程师`;
  setMeta('description', '廖晨扬的项目、经历与 AI 研究。');
}

function readLocation(): AppRoute {
  return parsePath(window.location.pathname, window.location.hash);
}

export function useRouter() {
  const [route, setRoute] = useState<AppRoute>(() => {
    if (typeof window === 'undefined') {
      return { path: '/', kind: 'home', hash: '' };
    }
    return readLocation();
  });

  useEffect(() => {
    const legacy = canonicalizeLegacyPath(window.location.pathname);
    if (legacy) {
      const target = legacy + window.location.hash;
      window.history.replaceState({}, '', target);
    }

    const current = readLocation();
    if (current.path !== window.location.pathname && !current.kind.startsWith('admin')) {
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
    const legacy = canonicalizeLegacyPath(url.pathname);
    const pathname = legacy || url.pathname;
    const next = parsePath(pathname, url.hash);
    const target = next.path + next.hash;
    if (options?.replace) {
      window.history.replaceState({}, '', target);
    } else {
      window.history.pushState({}, '', target);
    }
    setRoute(next);
    applyDocumentMeta(next);
    if (!next.hash) {
      window.scrollTo({ top: 0 });
    }
  }, []);

  return useMemo(() => ({ route, navigate }), [route, navigate]);
}
