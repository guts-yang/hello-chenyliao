import { notFound } from 'next/navigation';
import { PostForm } from '../post-form';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { DbPostRow } from '@/lib/supabase/types';

export default async function EditPostPage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase!.from('posts').select('*').eq('id', params.id).maybeSingle();
  if (!data) notFound();
  return (
    <div className="space-y-4">
      <h1 className="display-headline text-3xl text-gradient">编辑文章</h1>
      <PostForm row={data as unknown as DbPostRow} />
    </div>
  );
}
