'use client';

import * as React from 'react';
import { usePrefersReducedMotion } from './reduced-motion';

/**
 * Animated number rollup. The animation runs once when the element first
 * intersects the viewport. Reduced-motion users see the final value
 * immediately.
 *
 * Pass `format` for a custom formatter (defaults to .toLocaleString()).
 */
export function CountUp({
  value,
  duration = 1200,
  format,
  className,
  prefix,
  suffix,
}: {
  value: number;
  duration?: number;
  format?: (n: number) => string;
  className?: string;
  prefix?: string;
  suffix?: string;
}) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const reduced = usePrefersReducedMotion();
  const [display, setDisplay] = React.useState<number>(reduced ? value : 0);
  const startedRef = React.useRef(false);

  React.useEffect(() => {
    if (reduced) {
      setDisplay(value);
      return;
    }
    if (!ref.current || startedRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting || startedRef.current) return;
        startedRef.current = true;
        const start = performance.now();
        const tick = (now: number) => {
          const progress = Math.min(1, (now - start) / duration);
          const eased = 1 - Math.pow(1 - progress, 3);
          setDisplay(Math.round(value * eased));
          if (progress < 1) window.requestAnimationFrame(tick);
        };
        window.requestAnimationFrame(tick);
        observer.disconnect();
      },
      { threshold: 0.4 },
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [value, duration, reduced]);

  const formatted = format ? format(display) : display.toLocaleString();
  return (
    <span ref={ref} className={className}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}
