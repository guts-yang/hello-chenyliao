import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { SectionEyebrow } from '@/components/primitives';
import { copy } from '@/copy';
import { useContent } from '@/hooks/useContent';
import type { Experience, Project } from '@/types';

export function DetailView({ kind, slug, navigate }: { kind: 'project' | 'experience'; slug: string; navigate: (to: string) => void }) {
  const store = useContent();
  const [item, setItem] = useState<Project | Experience>();
  const [loading, setLoading] = useState(true);
  const isProject = kind === 'project';
  const { project, experience, data: homeData } = store;
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const next = isProject ? await project(slug) : await experience(slug);
      if (!cancelled) { setItem(next); setLoading(false); if (next) document.title = `${'title' in next ? next.title : next.org} · 廖晨扬`; }
    })();
    return () => { cancelled = true; };
  }, [experience, isProject, project, slug]);
  const items = useMemo(() => (isProject ? homeData?.projects ?? [] : homeData?.experiences ?? []), [homeData, isProject]);
  const index = items.findIndex((entry) => entry.slug === slug);
  const previous = index > 0 ? items[index - 1] : undefined;
  const next = index >= 0 ? items[index + 1] : undefined;
  const title = item ? ('title' in item ? item.title : item.org) : '';
  const sections = isProject ? [{ id: 'overview', label: copy.detail.overview }, { id: 'highlights', label: copy.detail.highlights }, { id: 'stack', label: copy.detail.stack }] : [{ id: 'overview', label: copy.detail.overview }, { id: 'metrics', label: copy.detail.metrics }];
  const linkFor = (value: string) => `/${isProject ? 'projects' : 'experience'}/${value}`;
  if (loading) return <div className="flex min-h-[60vh] items-center justify-center pt-24 text-sm text-gray-500">{copy.common.loading}</div>;
  if (!item) return <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 pt-24 text-center"><h1 className="text-5xl font-normal text-[#E1E0CC]">404</h1><p className="text-gray-500">{copy.common.notFound}</p><button type="button" className="rounded-full border border-primary/20 px-5 py-3 text-sm text-primary" onClick={() => navigate('/')}>{copy.detail.back}</button></div>;
  const subtitle = isProject ? (item as Project).tagline : (item as Experience).role;
  return <div className="mx-auto grid max-w-6xl gap-8 px-6 py-24 md:grid-cols-[200px_minmax(0,1fr)] md:py-28">
    <aside className="h-max rounded-2xl bg-[#101010] p-5 md:sticky md:top-24"><button type="button" className="mb-4 block text-sm text-primary" onClick={() => navigate('/')}>← {copy.detail.back}</button><div className="flex flex-wrap gap-3 md:flex-col">{sections.map((section) => <a key={section.id} href={`#${section.id}`} className="text-sm text-gray-400 hover:text-primary">{section.label}</a>)}</div></aside>
    <article className="min-w-0 space-y-4">
      <motion.header initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl bg-[#101010] p-8 md:p-12">
        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500"><span className="rounded-full border border-primary/15 px-2 py-0.5 text-primary/70">{isProject ? (item as Project).kind : '经历'}</span><span>{item.startedAt} — {item.endedAt || copy.common.present}</span></div>
        <h1 className="mt-8 text-4xl font-normal tracking-tight text-[#E1E0CC] md:text-6xl">{title}</h1><p className="mt-4 max-w-2xl text-lg text-primary/70 md:text-2xl">{subtitle}</p>
      </motion.header>
      <section id="overview" className="rounded-3xl bg-[#212121] p-8 md:p-10"><SectionEyebrow label="01" tag={copy.detail.overview} /><h2 className="mt-4 text-2xl font-normal text-[#E1E0CC]">{copy.detail.overview}</h2><p className="mt-4 max-w-3xl text-base leading-relaxed text-gray-400 md:text-lg">{item.summary}</p></section>
      {isProject ? <><section id="highlights" className="rounded-3xl bg-[#212121] p-8 md:p-10"><SectionEyebrow label="02" tag={copy.detail.highlights} /><h2 className="mt-4 text-2xl font-normal text-[#E1E0CC]">{copy.detail.highlights}</h2><ul className="mt-4 space-y-3">{(item as Project).highlights.map((highlight) => <li key={highlight} className="text-gray-400">{highlight}</li>)}</ul></section><section id="stack" className="rounded-3xl bg-[#212121] p-8 md:p-10"><SectionEyebrow label="03" tag={copy.detail.stack} /><h2 className="mt-4 text-2xl font-normal text-[#E1E0CC]">{copy.detail.stack}</h2><div className="mt-4 flex flex-wrap gap-2">{(item as Project).tags.map((tag) => <span key={tag} className="rounded-full border border-primary/10 bg-black/30 px-3 py-1.5 text-sm text-gray-400">{tag}</span>)}</div></section></> : <section id="metrics" className="rounded-3xl bg-[#212121] p-8 md:p-10"><SectionEyebrow label="02" tag={copy.detail.metrics} /><h2 className="mt-4 text-2xl font-normal text-[#E1E0CC]">{copy.detail.metrics}</h2><div className="mt-4 grid gap-3">{(item as Experience).metrics.map((metric) => <div key={metric} className="rounded-2xl border border-primary/10 bg-black/30 px-4 py-4 text-base text-primary/80">{metric}</div>)}</div></section>}
      <nav className="grid gap-4 md:grid-cols-2">{previous ? <button type="button" onClick={() => navigate(linkFor(previous.slug))} className="rounded-2xl bg-[#212121] p-5 text-left"><small className="text-primary">← {copy.detail.previous}</small><strong className="mt-2 block font-normal text-[#E1E0CC]">{'title' in previous ? previous.title : previous.org}</strong></button> : <span />}{next ? <button type="button" onClick={() => navigate(linkFor(next.slug))} className="rounded-2xl bg-[#212121] p-5 text-right"><small className="text-primary">{copy.detail.next} →</small><strong className="mt-2 block font-normal text-[#E1E0CC]">{'title' in next ? next.title : next.org}</strong></button> : null}</nav>
    </article>
  </div>;
}
