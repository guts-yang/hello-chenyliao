'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import { Github, MessageCircle, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { AuroraText, RotatingPhraseText } from '@/components/animated-text';
import { GlassCard } from '@/components/glass-card';
import { Badge } from '@/components/ui/badge';
import { pickLocale } from '@/lib/profile';
import { cn } from '@/lib/utils';
import type { Locale } from '@/i18n';
import type { ProfileBundle } from '@/lib/content';

const WECHAT_QR_SRC = '/wechat-qr-placeholder.jpg';

const focusPhrases = {
  zh: ['LLM 机器遗忘', '多智能体系统', 'AI 工具链', '全栈产品化'],
  en: ['LLM unlearning', 'multi-agent systems', 'AI tooling', 'full-stack products'],
} as const;

const iconFor = {
  github: Github,
  wechat: MessageCircle,
  linkedin: Github,
  twitter: Github,
} as const;

type VisibleSocialType = keyof typeof iconFor;

function isVisibleSocial(type: string): type is VisibleSocialType {
  return type in iconFor;
}

export function ProfileHubCard({
  profile,
  locale,
  className,
}: {
  profile: ProfileBundle;
  locale: Locale;
  className?: string;
}) {
  const t = useTranslations();
  const tProfile = useTranslations('sections.profile');
  const [wechatOpen, setWechatOpen] = React.useState(false);
  const displayName = locale === 'zh' ? profile.nameZh : profile.nameEn;
  const initials = profile.handle.slice(0, 2).toUpperCase();

  const visibleSocials: Array<(typeof profile.socials)[number] & { type: VisibleSocialType }> =
    profile.socials.filter(
      (s): s is (typeof profile.socials)[number] & { type: VisibleSocialType } =>
        isVisibleSocial(s.type),
    );

  // Close on Escape and lock the background scroll while the modal is open so
  // users on small screens cannot accidentally scroll the page underneath the
  // dialog while trying to long-press the QR.
  React.useEffect(() => {
    if (!wechatOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setWechatOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [wechatOpen]);

  const wechatLabel = t('social.wechat');
  const wechatTip = t('social.wechatTip');

  return (
    <>
      <GlassCard density="comfy" className={cn('group', className)}>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex h-full flex-col justify-between gap-6 lg:gap-10"
        >
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.05 }}
            className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between lg:gap-10"
          >
            <div className="space-y-3 lg:space-y-4">
              <Badge tone="accent" className="uppercase tracking-[0.2em]">
                {tProfile('openToRoles')}
              </Badge>
              <p className="text-sm text-muted-foreground">{t('hero.greeting')}</p>
              <h1
                className={cn(
                  'text-foreground',
                  locale === 'zh' ? 'name-art' : 'display-headline',
                )}
                style={{ fontSize: 'clamp(3rem, 8.5vw, 8rem)', lineHeight: 0.95 }}
              >
                <AuroraText>{displayName}</AuroraText>
              </h1>
              <p className="text-base font-medium text-foreground/85 sm:text-lg lg:text-xl">
                {pickLocale(profile.role, locale)}
              </p>
            </div>

            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="relative hidden h-28 w-28 shrink-0 sm:block lg:h-36 lg:w-36"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
                className="absolute -inset-1.5 rounded-full bg-[conic-gradient(from_0deg,hsl(var(--aurora-1)),hsl(var(--aurora-2)),hsl(var(--aurora-3)),hsl(var(--aurora-4)),hsl(var(--aurora-1)))] blur-md opacity-80"
              />
              <div className="relative grid h-full w-full place-items-center overflow-hidden rounded-full bg-white/70 text-3xl font-bold text-gradient backdrop-blur-md dark:bg-zinc-900/70 lg:text-5xl">
                {profile.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profile.avatarUrl}
                    alt={displayName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  initials
                )}
              </div>
            </motion.div>
          </motion.div>

          <div className="grid gap-5 sm:grid-cols-1 lg:grid-cols-[2fr_1fr] lg:gap-10">
            <div className="space-y-2">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                {tProfile('about')}
              </p>
              <p className="text-pretty text-base leading-relaxed text-foreground/90 sm:text-lg lg:text-xl">
                {pickLocale(profile.slogan, locale)}
              </p>
              <RotatingPhraseText
                prefix={locale === 'zh' ? '正在打磨' : 'Crafting'}
                phrases={focusPhrases[locale]}
              />
              <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
                {pickLocale(profile.bio, locale)}
              </p>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.12 }}
              className="flex flex-col gap-3 lg:items-end lg:text-right"
            >
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                {tProfile('contact')}
              </p>
              <motion.div
                initial="hidden"
                animate="show"
                variants={{
                  hidden: {},
                  show: { transition: { staggerChildren: 0.06, delayChildren: 0.15 } },
                }}
                className="flex flex-wrap items-center gap-2 lg:justify-end"
              >
                {visibleSocials.map((s) => {
                  const Icon = iconFor[s.type];
                  const isWechat = s.type === 'wechat';
                  const label =
                    s.type === 'github' || s.type === 'wechat'
                      ? t(`social.${s.type}` as 'social.github' | 'social.wechat')
                      : (s.label ?? s.type);

                  if (isWechat) {
                    return (
                      <motion.button
                        key={s.type}
                        type="button"
                        onClick={() => setWechatOpen((open) => !open)}
                        aria-expanded={wechatOpen}
                        aria-haspopup="dialog"
                        variants={{
                          hidden: { opacity: 0, y: 6 },
                          show: { opacity: 1, y: 0 },
                        }}
                        className="group/social inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/40 px-3.5 py-1.5 text-xs font-medium backdrop-blur-md transition-all hover:-translate-y-0.5 hover:bg-white/60 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                      >
                        <Icon className="h-3.5 w-3.5" />
                        <span>{label}</span>
                      </motion.button>
                    );
                  }

                  return (
                    <motion.a
                      key={s.type}
                      href={s.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      variants={{
                        hidden: { opacity: 0, y: 6 },
                        show: { opacity: 1, y: 0 },
                      }}
                      className="group/social inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/40 px-3.5 py-1.5 text-xs font-medium backdrop-blur-md transition-all hover:-translate-y-0.5 hover:bg-white/60 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span>{label}</span>
                    </motion.a>
                  );
                })}
              </motion.div>
            </motion.div>
          </div>
        </motion.div>
      </GlassCard>

      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {wechatOpen && (
              <motion.div
                key="wechat-backdrop"
                role="dialog"
                aria-modal="true"
                aria-label={wechatLabel}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                onClick={() => setWechatOpen(false)}
                className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
              >
                <motion.div
                  initial={{ scale: 0.92, opacity: 0, y: 8 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.94, opacity: 0, y: 6 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                  onClick={(event) => event.stopPropagation()}
                  className="glass-strong relative flex flex-col items-center gap-3 rounded-3xl p-6 shadow-2xl"
                >
                  <button
                    type="button"
                    onClick={() => setWechatOpen(false)}
                    aria-label={locale === 'zh' ? '关闭' : 'Close'}
                    className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full border border-white/40 bg-white/60 text-foreground/70 transition hover:bg-white/80 dark:border-white/10 dark:bg-white/10 dark:hover:bg-white/20"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={WECHAT_QR_SRC}
                    alt={wechatTip}
                    width={224}
                    height={224}
                    // object-contain (not cover) — a QR code must never be
                    // cropped or it stops scanning. White background ensures
                    // contrast on dark theme.
                    className="h-56 w-56 rounded-2xl bg-white object-contain p-2"
                  />
                  <p className="max-w-[14rem] text-center text-sm text-muted-foreground">{wechatTip}</p>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}
