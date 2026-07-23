import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { motion, useInView } from 'framer-motion';
import {
  Archive,
  ArrowRight,
  BookOpen,
  Briefcase,
  Check,
  ChevronRight,
  GraduationCap,
  Inbox,
  Paperclip,
  Search,
  Sparkles,
  Star,
} from 'lucide-react';
import { ScrollRevealText } from '@/components/motion/AnimatedLetter';
import { WordsPullUp } from '@/components/motion/WordsPullUp';
import { WordsPullUpMultiStyle } from '@/components/motion/WordsPullUpMultiStyle';
import { CreamButton, SectionEyebrow } from '@/components/primitives';
import { useChat } from '@/hooks/useChat';
import { useContent } from '@/hooks/useContent';
import { t } from '@/i18n';
import { apiUrl } from '@/lib/api';
import { localized } from '@/lib/utils';
import type { Locale } from '@/types';

const HERO_VIDEO =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260405_170732_8a9ccda6-5cff-4628-b164-059c500a2b41.mp4';
const FEATURE_VIDEO =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260406_133058_0504132a-0cf3-4450-a370-8ea3b05c95d4.mp4';
const ICON_STORYBOARD =
  'https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260405_171918_4a5edc79-d78f-4637-ac8b-53c43c220606.png&w=1280&q=85';
const ICON_CRITIQUES =
  'https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260405_171741_ed9845ab-f5b2-4018-8ce7-07cc01823522.png&w=1280&q=85';
const ICON_IMMERSION =
  'https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260405_171809_f56666dc-c099-4778-ad82-9ad4f209567b.png&w=1280&q=85';

function FeatureCard({
  children,
  index,
  className,
  onClick,
}: {
  children: ReactNode;
  index: number;
  className?: string;
  onClick?: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const inView = useInView(ref as RefObject<Element>, { once: true, margin: '-100px' });
  const animation = {
    initial: { opacity: 0, scale: 0.95 },
    animate: inView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.95 },
    transition: { duration: 0.7, delay: index * 0.15, ease: [0.22, 1, 0.36, 1] as const },
  };

  if (onClick) {
    return (
      <motion.button
        ref={ref}
        type="button"
        onClick={onClick}
        className={className}
        {...animation}
      >
        {children}
      </motion.button>
    );
  }

  return (
    <motion.div className={className} {...animation}>
      {children}
    </motion.div>
  );
}

export function HomeView({
  locale,
  navigate,
}: {
  locale: Locale;
  navigate: (to: string) => void;
}) {
  const content = useContent();
  const chat = useChat();
  const copy = t(locale);
  const data = content.data;
  const { load } = content;

  useEffect(() => {
    void load();
  }, [load]);

  if (content.loading && !data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-gray-500">
        {copy.common.loading}
      </div>
    );
  }

  if (!data) return null;

  const name = locale === 'zh' ? data.profile.nameZh : data.profile.nameEn;
  const role = localized(data.profile.role, locale);
  const slogan = localized(data.profile.slogan, locale);
  const bio = localized(data.profile.bio, locale);
  const brand = data.profile.handle || 'gutsyang';
  const tags = Array.from(new Set(data.projects.flatMap((project) => project.tags))).slice(0, 8);
  const activeProject = data.projects[0];

  const aboutLead =
    locale === 'zh' ? `我是${name}，` : `I am ${name.split(' ')[0] || name},`;
  const aboutAccent = locale === 'zh' ? role : role.toLowerCase().replace(/^an?\s+/i, '');
  const aboutTail = slogan;

  const deskItems = [
    ...data.projects.slice(0, 3).map((project) => ({
      id: project.slug,
      kind: 'project' as const,
      title: localized(project.title, locale),
      preview: localized(project.tagline, locale),
      meta: project.startedAt,
      unread: true,
    })),
    ...data.experiences.slice(0, 2).map((item) => ({
      id: item.slug,
      kind: 'experience' as const,
      title: localized(item.org, locale),
      preview: localized(item.role, locale),
      meta: item.startedAt,
      unread: false,
    })),
    ...data.timeline.slice(0, 1).map((event) => ({
      id: event.id || event.date,
      kind: 'timeline' as const,
      title: localized(event.title, locale),
      preview: localized(event.body, locale),
      meta: event.date,
      unread: false,
    })),
  ].slice(0, 6);

  const navRows = [
    { icon: Inbox, label: copy.home.deskNav.overview, count: data.projects.length + data.experiences.length, active: true },
    { icon: Star, label: copy.home.deskNav.projects, count: data.projects.length },
    { icon: Briefcase, label: copy.home.deskNav.experience, count: data.experiences.length },
    { icon: BookOpen, label: copy.home.deskNav.honors, count: data.honors.length },
    { icon: GraduationCap, label: copy.home.deskNav.education },
    { icon: Archive, label: copy.home.deskNav.timeline, count: data.timeline.length },
  ];

  const featureCards = [
    {
      title: copy.home.projects,
      number: '01',
      icon: ICON_STORYBOARD,
      items: data.projects.slice(0, 4).map((item) => localized(item.title, locale)),
      href: `/${locale}#projects`,
    },
    {
      title: copy.home.experience,
      number: '02',
      icon: ICON_CRITIQUES,
      items: data.experiences.slice(0, 3).map((item) => localized(item.org, locale)),
      href: `/${locale}#experience`,
    },
    {
      title: copy.home.education,
      number: '03',
      icon: ICON_IMMERSION,
      items: data.education.slice(0, 3).map((item) => localized(item.school, locale)),
      href: `/${locale}#experience`,
    },
  ];

  return (
    <div className="relative">
      {/* Hero */}
      <section className="h-screen p-4 md:p-6">
        <div className="relative h-full overflow-hidden rounded-2xl md:rounded-[2rem]">
          <video
            autoPlay
            loop
            muted
            playsInline
            className="absolute inset-0 h-full w-full object-cover"
            src={HERO_VIDEO}
          />
          <div className="noise-overlay pointer-events-none absolute inset-0 opacity-[0.7] mix-blend-overlay" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/60" />

          <div className="absolute bottom-0 left-0 right-0 grid grid-cols-1 gap-6 p-5 md:grid-cols-12 md:gap-8 md:p-8 lg:p-10">
            <div className="md:col-span-8">
              <h1
                className="font-medium leading-[0.85] tracking-[-0.07em] text-[26vw] sm:text-[24vw] md:text-[22vw] lg:text-[20vw] xl:text-[19vw] 2xl:text-[20vw]"
                style={{ color: '#E1E0CC' }}
              >
                <WordsPullUp text={brand} showAsterisk />
              </h1>
            </div>
            <div className="flex flex-col justify-end gap-5 md:col-span-4 md:pb-4">
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                className="text-xs leading-[1.2] text-primary/70 sm:text-sm md:text-base"
              >
                {bio}
              </motion.p>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                className="flex flex-wrap items-center gap-3"
              >
                <CreamButton label={copy.nav.resume} href={apiUrl('/api/resume.pdf')} />
                <button
                  type="button"
                  onClick={() => navigate(`/${locale}#projects`)}
                  className="inline-flex items-center gap-2 rounded-full border border-primary/20 px-4 py-2.5 text-sm text-primary/80 hover:bg-white/5"
                >
                  {copy.home.projects}
                  <ChevronRight className="h-4 w-4" />
                </button>
              </motion.div>
              <div className="flex flex-wrap gap-4 text-xs text-gray-400">
                {data.profile.socials?.map((social) => (
                  <a key={social.type} href={social.href} target="_blank" rel="noreferrer" className="hover:text-primary">
                    {social.label || social.type}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* About */}
      <section className="bg-black px-4 py-16 md:px-6 md:py-24">
        <div className="mx-auto max-w-6xl rounded-[2rem] bg-[#101010] px-6 py-14 text-center sm:px-10 md:py-20">
          <div className="text-[10px] text-primary sm:text-xs">{copy.home.triageEyebrow}</div>
          <div className="mx-auto mt-6 max-w-3xl text-3xl leading-[0.95] sm:text-4xl sm:leading-[0.9] md:text-5xl lg:text-6xl xl:text-7xl">
            <WordsPullUpMultiStyle
              segments={[
                { text: aboutLead, className: 'font-normal text-[#E1E0CC]' },
                { text: aboutAccent, className: 'font-serif italic text-[#E1E0CC]' },
                { text: aboutTail, className: 'font-normal text-[#E1E0CC]' },
              ]}
            />
          </div>
          <ScrollRevealText
            text={bio}
            className="mx-auto mt-10 max-w-3xl text-xs sm:text-sm md:text-base"
            style={{ color: '#DEDBC8' }}
          />
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            {copy.home.chips.map((chip) => (
              <span
                key={chip}
                className="rounded-full border border-primary/15 bg-white/[0.03] px-3 py-1.5 text-xs text-primary/70"
              >
                {chip}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="relative min-h-screen bg-black px-4 py-16 md:px-6 md:py-24">
        <div className="bg-noise pointer-events-none absolute inset-0 opacity-[0.15]" />
        <div className="relative mx-auto max-w-6xl">
          <div className="mx-auto max-w-3xl text-center">
            <WordsPullUpMultiStyle
              className="text-xl font-normal sm:text-2xl md:text-3xl lg:text-4xl"
              segments={[
                {
                  text: locale === 'zh' ? '面向愿景型创作者的工作室级工作流。' : 'Studio-grade workflows for visionary creators.',
                  className: 'text-[#E1E0CC]',
                },
                {
                  text: locale === 'zh' ? '为纯粹视野而生，以研究与工程驱动。' : 'Built for pure vision. Powered by art.',
                  className: 'text-gray-500',
                },
              ]}
            />
          </div>

          <div className="mt-12 grid grid-cols-1 gap-3 sm:gap-2 md:grid-cols-2 md:gap-1 lg:h-[480px] lg:grid-cols-4">
            <FeatureCard
              index={0}
              className="relative overflow-hidden rounded-2xl text-left lg:h-full"
              onClick={() => activeProject && navigate(`/${locale}/projects/${activeProject.slug}`)}
            >
              <video autoPlay loop muted playsInline className="absolute inset-0 h-full w-full object-cover" src={FEATURE_VIDEO} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
              <div className="relative flex min-h-[280px] items-end p-5 lg:min-h-full">
                <span className="text-lg font-medium" style={{ color: '#E1E0CC' }}>
                  {locale === 'zh' ? '你的创作画布。' : 'Your creative canvas.'}
                </span>
              </div>
            </FeatureCard>

            {featureCards.map((card, index) => (
              <FeatureCard
                key={card.number}
                index={index + 1}
                className="flex h-full min-h-[280px] flex-col rounded-2xl bg-[#212121] p-5 text-left lg:min-h-0"
                onClick={() => navigate(card.href)}
              >
                <img
                  src={card.icon}
                  alt=""
                  className="h-10 w-10 rounded-lg object-cover sm:h-12 sm:w-12"
                />
                <div className="mt-6 flex items-baseline gap-2">
                  <h3 className="text-lg font-medium text-[#E1E0CC] sm:text-xl">{card.title}</h3>
                  <span className="text-xs text-gray-500">{card.number}</span>
                </div>
                <ul className="mt-5 flex-1 space-y-3">
                  {card.items.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-gray-400">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span className="line-clamp-2">{item}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-6 inline-flex items-center gap-2 text-sm text-primary">
                  {copy.common.open}
                  <ArrowRight className="h-4 w-4 -rotate-45" />
                </div>
              </FeatureCard>
            ))}
          </div>
        </div>
      </section>

      {/* Profile desk */}
      <section className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-24">
        <div className="relative overflow-hidden rounded-2xl border border-primary/10 bg-[#101010]">
          <div className="relative flex h-11 items-center justify-center border-b border-primary/10 px-4">
            <div className="absolute left-4 flex gap-2">
              <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
              <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
              <span className="h-3 w-3 rounded-full bg-[#28c840]" />
            </div>
            <span className="text-xs text-gray-500">{copy.home.deskTitle}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 md:h-[520px]">
            <aside className="border-b border-primary/10 bg-black/40 p-4 md:col-span-3 md:border-b-0 md:border-r">
              <button
                type="button"
                onClick={() => chat.setOpen(true)}
                className="mb-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-black"
              >
                <Sparkles className="h-3.5 w-3.5" />
                {copy.home.deskCompose}
              </button>
              <div className="space-y-1">
                {navRows.map((row) => (
                  <div
                    key={row.label}
                    className={
                      row.active
                        ? 'flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm text-[#E1E0CC]'
                        : 'flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-400 hover:bg-white/5'
                    }
                  >
                    <row.icon className="h-4 w-4" />
                    <span className="flex-1">{row.label}</span>
                    {typeof row.count === 'number' ? <span className="text-xs text-gray-500">{row.count}</span> : null}
                  </div>
                ))}
              </div>
            </aside>

            <div className="border-b border-primary/10 md:col-span-4 md:border-b-0 md:border-r">
              <div className="flex items-center gap-2 border-b border-primary/10 px-4 py-3 text-sm text-gray-500">
                <Search className="h-4 w-4" />
                {copy.home.search}
              </div>
              <div className="divide-y divide-primary/5">
                {deskItems.map((item, index) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      if (item.kind === 'project') navigate(`/${locale}/projects/${item.id}`);
                      if (item.kind === 'experience') navigate(`/${locale}/experience/${item.id}`);
                      if (item.kind === 'timeline') navigate(`/${locale}#timeline`);
                    }}
                    className={index === 0 ? 'w-full bg-white/10 px-4 py-3 text-left' : 'w-full px-4 py-3 text-left hover:bg-white/5'}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className={`text-sm ${item.unread ? 'font-semibold text-[#E1E0CC]' : 'text-primary/80'}`}>
                        {item.title}
                      </span>
                      <span className="text-[11px] text-gray-500">{item.meta}</span>
                    </div>
                    <div className="mt-1 truncate text-xs text-gray-400">{item.preview}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="p-4 md:col-span-5">
              {activeProject ? (
                <>
                  <h3 className="text-lg font-semibold text-[#E1E0CC]">{localized(activeProject.title, locale)}</h3>
                  <div className="mt-3 flex items-center gap-3">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-black">
                      G
                    </div>
                    <div>
                      <div className="text-sm text-[#E1E0CC]">{data.profile.handle}</div>
                      <div className="text-xs text-gray-500">
                        {role} · {activeProject.startedAt}
                      </div>
                    </div>
                  </div>
                  <div className="mt-5 rounded-xl border border-primary/10 bg-[#212121] p-4">
                    <div className="mb-2 flex items-center gap-2 text-xs font-medium text-primary">
                      <Sparkles className="h-3.5 w-3.5" />
                      {copy.home.summaryBy}
                    </div>
                    <p className="text-sm leading-relaxed text-gray-400">
                      {localized(activeProject.highlights[0], locale) || localized(activeProject.summary, locale)}
                    </p>
                  </div>
                  <p className="mt-5 text-sm leading-relaxed text-gray-400">{localized(activeProject.summary, locale)}</p>
                  <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-primary/10 px-3 py-1.5 text-xs text-gray-400">
                    <Paperclip className="h-3.5 w-3.5" />
                    resume.pdf
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {/* Tech tags */}
      <section className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-20">
        <div className="text-center text-xs uppercase tracking-widest text-gray-500">{copy.home.trusted}</div>
        <div className="mt-10 grid grid-cols-2 gap-6 sm:grid-cols-4 lg:grid-cols-8">
          {(tags.length ? tags : ['LLM', 'PyTorch', 'LangGraph', 'React', 'Go', 'MySQL', 'Redis', 'Vite']).map(
            (tag, index) => (
              <motion.div
                key={tag}
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05, duration: 0.4 }}
                className="text-center text-sm font-semibold tracking-tight text-gray-500 hover:text-primary"
              >
                {tag}
              </motion.div>
            ),
          )}
        </div>
      </section>

      {/* Projects */}
      <section id="projects" className="mx-auto max-w-6xl px-4 py-20 md:px-6 md:py-28">
        <SectionEyebrow label="01" tag={copy.home.projects} />
        <h2 className="mt-5 text-3xl font-normal tracking-tight text-[#E1E0CC] md:text-5xl">{copy.home.projects}</h2>
        <div className="mt-10 grid gap-3 md:grid-cols-2">
          {data.projects.map((project, index) => (
            <motion.button
              key={project.slug}
              type="button"
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ delay: index * 0.05, duration: 0.5 }}
              onClick={() => navigate(`/${locale}/projects/${project.slug}`)}
              className={`rounded-2xl bg-[#212121] p-6 text-left ${index === 0 ? 'md:col-span-2' : ''}`}
            >
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span className="rounded-full border border-primary/15 px-2 py-0.5 text-primary/70">{project.kind}</span>
                <span>{project.startedAt}</span>
              </div>
              <h3 className="mt-5 text-2xl font-normal tracking-tight text-[#E1E0CC] md:text-3xl">
                {localized(project.title, locale)}
              </h3>
              <p className="mt-3 text-primary/80">{localized(project.tagline, locale)}</p>
              <p className="mt-2 text-sm text-gray-400">{localized(project.summary, locale)}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {project.tags.map((tag) => (
                  <span key={tag} className="rounded-full border border-primary/10 px-2.5 py-1 text-xs text-gray-400">
                    {tag}
                  </span>
                ))}
              </div>
              <div className="mt-6 inline-flex items-center gap-2 text-sm text-primary">
                {copy.common.open}
                <ArrowRight className="h-4 w-4 -rotate-45" />
              </div>
            </motion.button>
          ))}
        </div>
      </section>

      {/* Experience + Education */}
      <section id="experience" className="mx-auto max-w-6xl px-4 py-20 md:px-6 md:py-28">
        <div className="grid gap-10 md:grid-cols-2">
          <div>
            <SectionEyebrow label="02" tag={copy.home.experience} />
            <h2 className="mt-5 text-3xl font-normal tracking-tight text-[#E1E0CC] md:text-4xl">{copy.home.experience}</h2>
            <div className="mt-8 space-y-3">
              {data.experiences.map((item) => (
                <button
                  key={item.slug}
                  type="button"
                  onClick={() => navigate(`/${locale}/experience/${item.slug}`)}
                  className="block w-full rounded-2xl bg-[#212121] p-6 text-left"
                >
                  <div className="text-xs text-gray-500">{item.startedAt}</div>
                  <h3 className="mt-3 text-xl font-normal text-[#E1E0CC]">{localized(item.org, locale)}</h3>
                  <div className="mt-1 text-sm text-primary/80">{localized(item.role, locale)}</div>
                  <p className="mt-3 text-sm text-gray-400">{localized(item.summary, locale)}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {item.metrics.map((metric) => (
                      <span key={localized(metric, locale)} className="rounded-lg bg-black/40 px-3 py-2 text-xs text-primary/80">
                        {localized(metric, locale)}
                      </span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </div>
          <div>
            <SectionEyebrow label="03" tag={copy.home.education} />
            <h2 className="mt-5 text-3xl font-normal tracking-tight text-[#E1E0CC] md:text-4xl">{copy.home.education}</h2>
            <div className="mt-8 space-y-3">
              {data.education.map((item) => (
                <article key={item.id || item.startedAt} className="rounded-2xl bg-[#212121] p-6">
                  <div className="text-xs text-gray-500">
                    {item.startedAt} — {item.endedAt || copy.common.present}
                  </div>
                  <h3 className="mt-3 text-xl font-normal text-[#E1E0CC]">{localized(item.school, locale)}</h3>
                  <div className="mt-1 text-sm text-primary/80">{localized(item.degree, locale)}</div>
                  {item.notes ? <p className="mt-3 text-sm text-gray-400">{localized(item.notes, locale)}</p> : null}
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Honors */}
      <section id="honors" className="mx-auto max-w-6xl border-t border-primary/10 px-4 py-20 md:px-6 md:py-28">
        <SectionEyebrow label="04" tag={copy.home.honors} />
        <h2 className="mt-5 text-3xl font-normal tracking-tight text-[#E1E0CC] md:text-5xl">{copy.home.honors}</h2>
        <div className="mt-10 grid gap-3 md:grid-cols-3">
          {data.honors.map((honor) => (
            <figure key={honor.id || honor.pillar} className="rounded-2xl bg-[#212121] p-6">
              <blockquote className="text-sm leading-[1.6] text-primary/80">
                “{localized(honor.story, locale)}”
              </blockquote>
              <figcaption className="mt-6 border-t border-primary/10 pt-5">
                <div className="text-sm font-semibold text-[#E1E0CC]">{localized(honor.title, locale)}</div>
                <div className="mt-1 text-xs text-gray-500">{honor.pillar}</div>
                <div className="mt-2 text-xs font-semibold tracking-wide text-primary">GUTSYANG</div>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* Timeline */}
      <section id="timeline" className="mx-auto max-w-6xl px-4 py-20 md:px-6 md:py-28">
        <SectionEyebrow label="05" tag={copy.home.timeline} />
        <h2 className="mt-5 text-3xl font-normal tracking-tight text-[#E1E0CC] md:text-5xl">{copy.home.timeline}</h2>
        <div className="relative mt-10 max-w-3xl">
          <div className="absolute bottom-3 left-[7.75rem] top-3 hidden w-px bg-primary/10 sm:block" />
          <div className="space-y-6">
            {data.timeline.map((event) => (
              <article
                key={event.id || `${event.date}-${event.kind}`}
                className="grid grid-cols-[88px_24px_1fr] gap-3 sm:grid-cols-[100px_48px_1fr]"
              >
                <time className="pt-1 text-xs text-gray-500">{event.date}</time>
                <div className="relative z-10 mt-2 h-2.5 w-2.5 justify-self-center rounded-full bg-primary shadow-[0_0_0_7px_#000]" />
                <div className="rounded-2xl bg-[#212121] p-5">
                  <span className="rounded-full border border-primary/10 px-2 py-0.5 text-[11px] text-gray-500">
                    {event.kind}
                  </span>
                  <h3 className="mt-3 text-lg font-normal text-[#E1E0CC]">{localized(event.title, locale)}</h3>
                  <p className="mt-2 text-sm text-gray-400">{localized(event.body, locale)}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-6xl px-4 py-20 md:px-6 md:py-32">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative overflow-hidden rounded-3xl bg-[#101010] px-8 py-16 text-center md:py-24"
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-30"
            style={{
              background: 'radial-gradient(600px circle at 50% 0%, rgba(222,219,200,0.18), transparent 70%)',
            }}
          />
          <h2 className="relative text-4xl font-normal leading-[1.02] tracking-tight text-[#E1E0CC] md:text-6xl">
            {copy.home.ctaTitleA}
            <br />
            {copy.home.ctaTitleB}
          </h2>
          <p className="relative mx-auto mt-6 max-w-md text-sm leading-[1.6] text-gray-400">{copy.home.ctaBody}</p>
          <div className="relative mt-8 flex flex-wrap items-center justify-center gap-3">
            <CreamButton label={copy.nav.resume} href={apiUrl('/api/resume.pdf')} />
            <button
              type="button"
              onClick={() => chat.setOpen(true)}
              className="inline-flex items-center gap-2 rounded-full border border-primary/20 px-5 py-3 text-sm font-medium text-primary hover:bg-white/5"
            >
              {copy.nav.chat}
              <ArrowRight className="h-4 w-4 -rotate-45" />
            </button>
          </div>
        </motion.div>
      </section>
    </div>
  );
}
