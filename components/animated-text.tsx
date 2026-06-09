'use client';

import * as React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

type TextProps = {
  children: React.ReactNode;
  className?: string;
};

export function AuroraText({ children, className }: TextProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.span
      className={cn('animated-text-gradient animated-text-aurora inline-block whitespace-nowrap', className)}
      whileHover={
        prefersReducedMotion
          ? undefined
          : {
              scale: 1.015,
              filter: 'drop-shadow(0 12px 28px hsl(var(--primary) / 0.24))',
            }
      }
      transition={{ type: 'spring', stiffness: 260, damping: 22 }}
    >
      {children}
    </motion.span>
  );
}

export function RevealGradientText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <span className={cn('text-gradient', className)}>{text}</span>;
  }

  return (
    <motion.span
      aria-label={text}
      className={cn('inline-block leading-none', className)}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-80px' }}
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: 0.035 } },
      }}
    >
      {Array.from(text).map((char, index) => (
        <motion.span
          key={`${char}-${index}`}
          aria-hidden="true"
          className={cn('animated-text-gradient inline-block', char === ' ' && 'w-[0.28em]')}
          variants={{
            hidden: { opacity: 0, y: 18, filter: 'blur(6px)' },
            show: { opacity: 1, y: 0, filter: 'blur(0px)' },
          }}
          transition={{ duration: 0.52, ease: [0.22, 1, 0.36, 1] }}
        >
          {char === ' ' ? '\u00a0' : char}
        </motion.span>
      ))}
    </motion.span>
  );
}

export function RotatingPhraseText({
  phrases,
  prefix,
  className,
}: {
  phrases: readonly string[];
  prefix: string;
  className?: string;
}) {
  const prefersReducedMotion = useReducedMotion();
  const [activeIndex, setActiveIndex] = React.useState(0);
  const activePhrase = phrases[activeIndex] ?? phrases[0] ?? '';

  React.useEffect(() => {
    if (prefersReducedMotion || phrases.length <= 1) return;

    const timer = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % phrases.length);
    }, 2600);

    return () => window.clearInterval(timer);
  }, [phrases.length, prefersReducedMotion]);

  if (!activePhrase) return null;

  return (
    <span className={cn('inline-flex flex-wrap items-center gap-x-2 gap-y-1', className)}>
      <span className="text-muted-foreground">{prefix}</span>
      <span className="relative inline-grid overflow-hidden rounded-full border border-white/45 bg-white/35 px-3 py-1 text-xs font-semibold text-foreground/90 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-white/5 sm:text-sm">
        <span className="inline-block text-[hsl(var(--primary))] transition-opacity duration-300">
          {activePhrase}
        </span>
      </span>
    </span>
  );
}

export function MagneticLogoText({ children, className }: TextProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.span
      className={cn(
        'animated-logo-text display-headline inline-flex text-lg font-semibold tracking-tight',
        className,
      )}
      whileHover={prefersReducedMotion ? undefined : { letterSpacing: '0.015em', y: -1 }}
      transition={{ type: 'spring', stiffness: 320, damping: 24 }}
    >
      {children}
    </motion.span>
  );
}

export function HoverSplitText({ children, className }: TextProps) {
  return (
    <span
      className={cn(
        'animated-hover-title inline-block transition-transform duration-300 group-hover:-translate-y-0.5',
        className,
      )}
    >
      {children}
    </span>
  );
}
