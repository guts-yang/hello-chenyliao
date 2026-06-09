'use client';

import { motion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { HoverSplitText } from '@/components/animated-text';
import { GlassCard } from '@/components/glass-card';
import { Badge } from '@/components/ui/badge';
import { TransitionLink } from '@/components/transition-link';
import { Tilt } from '@/components/motion';
import { pickLocale, type Project } from '@/lib/profile';
import type { Locale } from '@/i18n';
import { cn } from '@/lib/utils';

export function ProjectCard({
  project,
  locale,
  className,
}: {
  project: Project;
  locale: Locale;
  className?: string;
}) {
  const t = useTranslations('sections.projects');

  return (
    <TransitionLink
      href={`/${locale}/projects/${project.slug}`}
      className={cn('group block h-full', className)}
      data-cursor="grow"
    >
      <Tilt className="h-full">
        <GlassCard interactive className="h-full">
          <motion.div
            layoutId={`project-${project.slug}`}
            className="flex h-full flex-col justify-between gap-5"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Badge tone={project.kind === 'academic' ? 'accent' : 'default'}>
                  {project.kind === 'academic' ? t('academic') : t('engineering')}
                </Badge>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground" />
              </div>
              <h3
                className="display-headline text-2xl sm:text-3xl"
                style={{ viewTransitionName: `project-title-${project.slug}` }}
              >
                <HoverSplitText>{pickLocale(project.title, locale)}</HoverSplitText>
              </h3>
              <p className="text-sm text-muted-foreground transition-colors duration-300 group-hover:text-foreground/75">
                {pickLocale(project.tagline, locale)}
              </p>
            </div>

            {project.highlights.length > 0 && (
              <ul className="space-y-1.5 text-xs text-foreground/80">
                {project.highlights.slice(0, 3).map((h, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-[hsl(var(--primary))]" />
                    <span>{pickLocale(h, locale)}</span>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex flex-wrap gap-1.5">
              {project.tags.slice(0, 5).map((tag) => (
                <Badge key={tag} tone="muted" className="text-[10px]">
                  {tag}
                </Badge>
              ))}
            </div>
          </motion.div>
        </GlassCard>
      </Tilt>
    </TransitionLink>
  );
}
