'use client';

import { motion } from 'framer-motion';
import { ArrowUpRight, Briefcase } from 'lucide-react';
import { GlassCard } from '@/components/glass-card';
import { TransitionLink } from '@/components/transition-link';
import { pickLocale, type Experience } from '@/lib/profile';
import type { Locale } from '@/i18n';
import { cn, formatDate } from '@/lib/utils';

export function ExperienceCard({
  experience,
  locale,
  className,
}: {
  experience: Experience;
  locale: Locale;
  className?: string;
}) {
  return (
    <TransitionLink
      href={`/${locale}/experience/${experience.slug}`}
      className={cn('group block h-full', className)}
      data-cursor="grow"
    >
      <GlassCard interactive className="h-full">
        <motion.div layoutId={`experience-${experience.slug}`} className="flex h-full flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="inline-flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
              <Briefcase className="h-3.5 w-3.5" />
              {formatDate(experience.startedAt, locale)} —{' '}
              {experience.endedAt ? formatDate(experience.endedAt, locale) : locale === 'zh' ? '至今' : 'Present'}
            </div>
            <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground" />
          </div>
          <div>
            <h3
              className="display-headline text-2xl"
              style={{ viewTransitionName: `experience-title-${experience.slug}` }}
            >
              {pickLocale(experience.org, locale)}
            </h3>
            <p className="text-sm text-muted-foreground">{pickLocale(experience.role, locale)}</p>
          </div>
          <p className="text-sm text-foreground/85">{pickLocale(experience.summary, locale)}</p>
          <ul className="mt-auto grid grid-cols-1 gap-2 sm:grid-cols-3">
            {experience.metrics.slice(0, 3).map((m, i) => (
              <li
                key={i}
                className="rounded-xl border border-white/40 dark:border-white/10 bg-white/40 dark:bg-white/5 px-3 py-2 text-xs text-foreground/85"
              >
                {pickLocale(m, locale)}
              </li>
            ))}
          </ul>
        </motion.div>
      </GlassCard>
    </TransitionLink>
  );
}
