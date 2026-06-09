import Link from 'next/link';
import { GlassCard } from '@/components/glass-card';
import { createSupabaseServerClient } from '@/lib/supabase/server';

async function counts() {
  const supabase = createSupabaseServerClient();
  if (!supabase) return { projects: 0, experiences: 0, honors: 0, posts: 0, views: 0 };
  const [{ count: projects }, { count: experiences }, { count: honors }, { count: posts }, viewsRes] = await Promise.all([
    supabase.from('projects').select('*', { count: 'exact', head: true }),
    supabase.from('experiences').select('*', { count: 'exact', head: true }),
    supabase.from('honors').select('*', { count: 'exact', head: true }),
    supabase.from('posts').select('*', { count: 'exact', head: true }),
    supabase.from('views').select('count'),
  ]);
  const viewsTotal = ((viewsRes.data ?? []) as Array<{ count: number }>).reduce(
    (s, r) => s + (r.count ?? 0),
    0,
  );
  return {
    projects: projects ?? 0,
    experiences: experiences ?? 0,
    honors: honors ?? 0,
    posts: posts ?? 0,
    views: viewsTotal,
  };
}

export default async function AdminHomePage() {
  const c = await counts();
  const tiles = [
    { label: '项目', value: c.projects, href: '/admin/projects' },
    { label: '经历', value: c.experiences, href: '/admin/experiences' },
    { label: '荣誉', value: c.honors, href: '/admin/honors' },
  ];
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="display-headline text-3xl text-gradient">总览</h1>
        <p className="text-sm text-muted-foreground">直接编辑数据库内容；保存后前台立即同步。</p>
      </header>
      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {tiles.map((t) => (
          <Link key={t.href} href={t.href} className="block">
            <GlassCard interactive className="h-full">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">{t.label}</p>
              <p className="mt-2 display-headline text-4xl text-gradient tabular-nums">
                {t.value.toLocaleString()}
              </p>
            </GlassCard>
          </Link>
        ))}
      </div>
    </div>
  );
}
