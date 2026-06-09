'use client';

import * as React from 'react';
import { usePrefersReducedMotion } from '@/components/motion';

/**
 * Soft glow cursor that follows the pointer with a gentle delay and grows
 * over interactive elements. Disabled on touch + reduced-motion. Pure DOM /
 * rAF so the chrome doesn't compose an extra paint per frame.
 *
 * The cursor's CSS pointer is still rendered by the OS; this layer is just
 * a decorative companion.
 */
export function GlowCursor() {
  const reduced = usePrefersReducedMotion();
  const dotRef = React.useRef<HTMLDivElement>(null);
  const ringRef = React.useRef<HTMLDivElement>(null);
  const [enabled, setEnabled] = React.useState(false);

  React.useEffect(() => {
    if (reduced) return;
    if (typeof window === 'undefined') return;
    if (matchMedia('(pointer: coarse)').matches) return;
    setEnabled(true);
  }, [reduced]);

  React.useEffect(() => {
    if (!enabled) return;
    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return;
    let raf = 0;
    let x = window.innerWidth / 2;
    let y = window.innerHeight / 2;
    let rx = x;
    let ry = y;
    let active = false;
    let over = 1;

    const setOver = (factor: number) => {
      over += (factor - over) * 0.2;
      ring.style.transform = `translate3d(${rx - 16}px, ${ry - 16}px, 0) scale(${over.toFixed(3)})`;
    };

    const tick = () => {
      rx += (x - rx) * 0.25;
      ry += (y - ry) * 0.25;
      dot.style.transform = `translate3d(${x - 3}px, ${y - 3}px, 0)`;
      ring.style.transform = `translate3d(${rx - 16}px, ${ry - 16}px, 0) scale(${over.toFixed(3)})`;
      raf = requestAnimationFrame(tick);
    };

    const onMove = (e: PointerEvent) => {
      x = e.clientX;
      y = e.clientY;
      if (!active) {
        dot.style.opacity = '1';
        ring.style.opacity = '1';
        active = true;
      }
      const target = e.target as Element | null;
      const interactive = !!target?.closest(
        'a, button, input, textarea, [role="button"], [data-cursor="grow"]',
      );
      setOver(interactive ? 1.6 : 1);
    };
    const onLeave = () => {
      dot.style.opacity = '0';
      ring.style.opacity = '0';
      active = false;
    };

    raf = requestAnimationFrame(tick);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerleave', onLeave);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerleave', onLeave);
    };
  }, [enabled]);

  if (!enabled) return null;
  return (
    <>
      <div
        ref={ringRef}
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 z-[80] h-8 w-8 rounded-full border border-[hsl(var(--primary)/0.4)] opacity-0 mix-blend-difference transition-opacity duration-200"
        style={{ transform: 'translate3d(-100px,-100px,0)' }}
      />
      <div
        ref={dotRef}
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 z-[80] h-1.5 w-1.5 rounded-full bg-[hsl(var(--primary))] opacity-0 transition-opacity duration-150"
        style={{ transform: 'translate3d(-100px,-100px,0)' }}
      />
    </>
  );
}
