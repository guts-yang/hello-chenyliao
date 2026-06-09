import { Download } from 'lucide-react';
import { GlassCard } from '@/components/glass-card';
import { cn } from '@/lib/utils';
import type { Locale } from '@/i18n';

export function ResumeDownloadCard({
  locale,
  className,
}: {
  locale: Locale;
  className?: string;
}) {
  const isZh = locale === 'zh';

  return (
    <GlassCard density="compact" className={cn('h-full', className)}>
      <div className="flex h-full flex-col justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            {isZh ? '简历' : 'Resume'}
          </p>
          <h3 className="display-headline text-2xl">
            {isZh ? '下载 PDF 简历' : 'Download PDF'}
          </h3>
          <p className="text-sm text-muted-foreground">
            {isZh ? '快速了解项目、经历与技能亮点。' : 'A compact overview of projects, experience, and skills.'}
          </p>
        </div>
        <a
          href="/resume.pdf"
          className="inline-flex w-fit items-center gap-2 rounded-full border border-white/40 bg-white/40 px-3.5 py-2 text-xs font-medium backdrop-blur-md transition hover:-translate-y-0.5 hover:bg-white/60 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
        >
          <Download className="h-3.5 w-3.5" />
          {isZh ? '查看简历' : 'View resume'}
        </a>
      </div>
    </GlassCard>
  );
}
