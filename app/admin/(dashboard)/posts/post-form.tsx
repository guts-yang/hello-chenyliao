'use client';

import * as React from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { GlassCard } from '@/components/glass-card';
import { Button } from '@/components/ui/button';
import { Field, TextInput, TextArea, Switch } from '@/components/admin/form-fields';
import { ImageUploader } from '@/components/admin/image-uploader';
import { savePost } from '@/app/admin/actions';
import type { DbPostRow } from '@/lib/supabase/types';

type FormResult = { ok: boolean; message: string } | undefined;

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="gradient" disabled={pending}>
      {pending ? '保存中…' : '保存'}
    </Button>
  );
}

export function PostForm({ row }: { row?: DbPostRow }) {
  const [state, formAction] = useFormState<FormResult, FormData>(savePost as never, undefined);

  return (
    <form action={formAction} className="space-y-5">
      {row && <input type="hidden" name="id" value={row.id} />}
      <GlassCard>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Slug" hint="URL 标识">
            <TextInput name="slug" defaultValue={row?.slug} required />
          </Field>
          <Field label="发布时间">
            <TextInput
              type="datetime-local"
              name="published_at"
              defaultValue={row?.published_at ? row.published_at.slice(0, 16) : ''}
            />
          </Field>
          <Field label="标题（中文）">
            <TextInput name="title_zh" defaultValue={row?.title_zh} required />
          </Field>
          <Field label="Title (English)">
            <TextInput name="title_en" defaultValue={row?.title_en} required />
          </Field>
          <Field label="摘要（中文）" className="sm:col-span-2">
            <TextArea name="excerpt_zh" defaultValue={row?.excerpt_zh} rows={3} />
          </Field>
          <Field label="Excerpt (English)" className="sm:col-span-2">
            <TextArea name="excerpt_en" defaultValue={row?.excerpt_en} rows={3} />
          </Field>
          <Field label="正文 · 中文 (MDX)" className="sm:col-span-2" hint="支持 ## 二级标题 · ```ts 代码块 · <Callout>">
            <TextArea
              name="body_zh"
              defaultValue={row?.body_zh}
              rows={14}
              className="font-mono text-[12.5px]"
            />
          </Field>
          <Field label="Body · English (MDX)" className="sm:col-span-2">
            <TextArea
              name="body_en"
              defaultValue={row?.body_en}
              rows={14}
              className="font-mono text-[12.5px]"
            />
          </Field>
          <Field label="标签（逗号分隔）" className="sm:col-span-2">
            <TextInput name="tags" defaultValue={row?.tags?.join(', ') ?? ''} />
          </Field>
          <Field label="封面图" className="sm:col-span-2">
            <ImageUploader name="cover_url" defaultUrl={row?.cover_url ?? ''} folder="posts" />
          </Field>
          <Field label="阅读时长（分钟）">
            <TextInput type="number" min={1} name="reading_minutes" defaultValue={row?.reading_minutes ?? 1} />
          </Field>
          <Field label="排序">
            <TextInput type="number" name="display_order" defaultValue={row?.display_order ?? 0} />
          </Field>
          <Field label="发布">
            <Switch name="is_published" defaultChecked={row?.is_published ?? false} />
          </Field>
        </div>
      </GlassCard>

      <div className="flex items-center gap-3">
        <SubmitButton />
        {state?.ok === false && <p className="text-xs text-rose-500">{state.message}</p>}
      </div>
    </form>
  );
}
