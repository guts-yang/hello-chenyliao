'use client';

import * as React from 'react';

/**
 * Thin 1px progress line stuck to the top of the viewport. Updates via
 * requestAnimationFrame so we don't trigger layout on every wheel event.
 * Respects prefers-reduced-motion (still updates, just without the spring).
 */
export function ReadingProgress() {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const el = ref.current;
      if (!el) return;
      const scrollTop = window.scrollY;
      const doc = document.documentElement;
      const max = (doc.scrollHeight || 1) - window.innerHeight;
      const ratio = max > 0 ? Math.min(1, Math.max(0, scrollTop / max)) : 0;
      el.style.transform = `scaleX(${ratio})`;
    };
    const onScroll = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-40 h-[2px] bg-transparent"
    >
      <div
        ref={ref}
        style={{ transform: 'scaleX(0)', transformOrigin: '0 50%' }}
        className="h-full origin-left bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--aurora-2))] to-[hsl(var(--aurora-3))] transition-[transform] duration-150 ease-out"
      />
    </div>
  );
}
