import Link from 'next/link';
import { Plus, Pencil } from 'lucide-react';
import { GlassCard } from '@/components/glass-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { DbPostRow } from '@/lib/supabase/types';
import { DeleteButton } from '../delete-button';
import { deletePost } from '@/app/admin/actions';

export default async function AdminPostsPage() {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase!
    .from('posts')
    .select('*')
    .order('display_order', { ascending: false })
    .order('published_at', { ascending: false, nullsFirst: false });
  const rows = (data ?? []) as DbPostRow[];

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="display-headline text-3xl text-gradient">Posts</h1>
          <p className="text-sm text-muted-foreground">{rows.length} 条记录</p>
        </div>
        <Button asChild variant="gradient" size="sm">
          <Link href="/admin/posts/new">
            <Plus className="h-4 w-4" />
            新建
          </Link>
        </Button>
      </header>

      <div className="grid gap-3">
        {rows.map((row) => (
          <GlassCard key={row.id}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {!row.is_published && <Badge tone="muted">draft</Badge>}
                  <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                    {row.reading_minutes} min
                  </span>
                </div>
                <p className="mt-1 truncate text-base font-medium">
                  {row.title_zh} <span className="text-muted-foreground">· {row.title_en}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  /posts/{row.slug} · order {row.display_order}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link href={`/admin/posts/${row.id}`}>
                    <Pencil className="h-3.5 w-3.5" />
                    编辑
                  </Link>
                </Button>
                <DeleteButton id={row.id} action={deletePost} />
              </div>
            </div>
          </GlassCard>
        ))}
        {rows.length === 0 && (
          <div className="rounded-3xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
            还没有文章。点击右上角「新建」开始写作。
          </div>
        )}
      </div>
    </div>
  );
}
