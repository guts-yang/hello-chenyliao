import { getTranslations } from 'next-intl/server';
import type { Locale } from '@/i18n';
import { ProfileHubCard } from './profile-hub-card';
import { ProjectCard } from './project-card';
import { ExperienceCard } from './experience-card';
import { HonorsCard } from './honors-card';
import { TimelineCard } from './timeline-card';
import { EducationCard } from './education-card';
import { getHomeContent } from '@/lib/content';
import { RevealGradientText } from '@/components/animated-text';

export async function BentoGrid({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: 'sections' });
  const { profile, projects, experiences, honors, education, timeline } = await getHomeContent();

  const projectCards = projects.slice(0, 3);
  const academicHero = projectCards.find((p) => p.kind === 'academic') ?? projectCards[0];
  const sideProjects = projectCards.filter((p) => p !== academicHero).slice(0, 2);
  const primaryExperience = experiences[0];
  const primaryEducation = education[0];

  // 12-col grid on md+, single column on mobile. `auto-rows-fr` keeps each row's
  // cards aligned so col-span/row-span produce a clean magazine mosaic.
  return (
    <section
      id="home"
      className="grid grid-cols-1 gap-4 py-4 md:grid-cols-12 md:gap-5 md:py-8 lg:gap-6 md:auto-rows-[minmax(180px,auto)]"
    >
      {/* Row 1-2: Hero profile (8x2) + education card */}
      <ProfileHubCard
        profile={profile}
        locale={locale}
        className="md:col-span-8 md:row-span-2"
      />
      {primaryEducation && (
        <EducationCard
          education={primaryEducation}
          locale={locale}
          className="md:col-span-4 md:row-span-2"
        />
      )}

      {/* Section: Projects */}
      <SectionHeader
        id="projects"
        title={t('projects.title')}
        subtitle={t('projects.subtitle')}
      />

      {academicHero && (
        <ProjectCard
          project={academicHero}
          locale={locale}
          className="md:col-span-8 md:row-span-2"
        />
      )}
      {sideProjects.map((p) => (
        <ProjectCard key={p.slug} project={p} locale={locale} className="md:col-span-4" />
      ))}

      {/* Section: Experience + Honors */}
      <SectionHeader
        id="experience"
        title={t('experience.title')}
        subtitle={t('experience.subtitle')}
      />
      {primaryExperience && (
        <ExperienceCard
          experience={primaryExperience}
          locale={locale}
          className="md:col-span-7"
        />
      )}
      <HonorsCard honors={honors} locale={locale} className="md:col-span-5" />

      {/* Section: Timeline */}
      <SectionHeader
        id="timeline"
        title={t('timeline.title')}
        subtitle={t('timeline.subtitle')}
      />
      <TimelineCard events={timeline} locale={locale} className="md:col-span-12" />
    </section>
  );
}

function SectionHeader({
  id,
  title,
  subtitle,
}: {
  id: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div
      id={id}
      className="mt-8 flex items-end justify-between gap-4 md:col-span-12 md:mt-10"
    >
      <h2 className="display-headline text-3xl sm:text-4xl md:text-5xl">
        <RevealGradientText text={title} />
      </h2>
      {subtitle && (
        <p className="hidden text-sm text-muted-foreground sm:block">{subtitle}</p>
      )}
    </div>
  );
}
