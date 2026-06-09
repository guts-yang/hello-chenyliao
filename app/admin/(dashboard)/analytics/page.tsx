import { Eye } from 'lucide-react';
import { GlassCard } from '@/components/glass-card';
import { CountUp } from '@/components/motion';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { DbViewRow } from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const SCOPE_LABEL: Record<DbViewRow['scope'], string> = {
  project: '项目',
  experience: '经历',
  post: '文章',
  home: '首页',
};

export default async function AdminAnalyticsPage() {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase!
    .from('views')
    .select('*')
    .order('count', { ascending: false })
    .limit(50);
  const rows = ((data ?? []) as DbViewRow[]).sort((a, b) => b.count - a.count);

  const total = rows.reduce((sum, r) => sum + r.count, 0);
  const byScope = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.scope] = (acc[r.scope] ?? 0) + r.count;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <header>
        <h1 className="display-headline text-3xl text-gradient">访问统计</h1>
        <p className="text-sm text-muted-foreground">
          所有受跟踪页面的浏览次数（按 60 秒/访客的窗口去重）
        </p>
      </header>

      {error && (
        <div className="rounded-2xl border border-rose-400/40 bg-rose-50/40 p-4 text-sm text-rose-500 dark:bg-rose-500/[0.06]">
          {error.message}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="总浏览" value={total} />
        <Stat label="项目浏览" value={byScope.project ?? 0} />
        <Stat label="经历浏览" value={byScope.experience ?? 0} />
        <Stat label="文章浏览" value={byScope.post ?? 0} />
      </div>

      <GlassCard>
        <div className="space-y-2">
          <h2 className="text-sm font-semibold">Top 50</h2>
          {rows.length === 0 && (
            <p className="text-sm text-muted-foreground">还没有访问记录。</p>
          )}
          <ul className="divide-y divide-border/60">
            {rows.map((row) => (
              <li
                key={`${row.scope}:${row.ref_id}`}
                className="flex items-center justify-between gap-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                    {SCOPE_LABEL[row.scope]}
                  </span>
                  <p className="truncate font-mono text-xs">{row.ref_id}</p>
                </div>
                <span className="inline-flex items-center gap-1 font-mono text-sm tabular-nums">
                  <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                  {row.count}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </GlassCard>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <GlassCard density="compact">
      <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-3xl font-semibold tracking-tight tabular-nums">
        <CountUp value={value} />
      </p>
    </GlassCard>
  );
}
