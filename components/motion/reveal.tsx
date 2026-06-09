'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { usePrefersReducedMotion } from './reduced-motion';

/**
 * Lightweight viewport-reveal wrapper. Adds an `is-visible` class once the
 * element enters the viewport, which triggers the `.reveal-up` CSS animation
 * defined in globals.css. Skipping framer-motion here keeps the bundle small
 * for what is essentially a fade + 14px translate.
 */
type RevealTag = 'div' | 'section' | 'span' | 'li' | 'article';

export function Reveal({
  children,
  delay = 0,
  className,
  as = 'div',
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  as?: RevealTag;
}) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const reduced = usePrefersReducedMotion();
  const [visible, setVisible] = React.useState(reduced);

  React.useEffect(() => {
    if (reduced) {
      setVisible(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.disconnect();
            break;
          }
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [reduced]);

  const sharedProps = {
    ref: ref as unknown as React.RefObject<HTMLElement>,
    className: cn('reveal-up', visible && 'is-visible', className),
    style: visible ? { animationDelay: `${delay}ms` } : undefined,
  };

  switch (as) {
    case 'section':
      return <section {...(sharedProps as React.HTMLAttributes<HTMLElement> & { ref: React.Ref<HTMLElement> })}>{children}</section>;
    case 'span':
      return <span {...(sharedProps as React.HTMLAttributes<HTMLSpanElement> & { ref: React.Ref<HTMLSpanElement> })}>{children}</span>;
    case 'li':
      return <li {...(sharedProps as React.HTMLAttributes<HTMLLIElement> & { ref: React.Ref<HTMLLIElement> })}>{children}</li>;
    case 'article':
      return <article {...(sharedProps as React.HTMLAttributes<HTMLElement> & { ref: React.Ref<HTMLElement> })}>{children}</article>;
    default:
      return <div {...(sharedProps as React.HTMLAttributes<HTMLDivElement> & { ref: React.Ref<HTMLDivElement> })}>{children}</div>;
  }
}
