'use client';

import * as React from 'react';
import { usePrefersReducedMotion } from './reduced-motion';

/**
 * Magnetic interaction: as the cursor approaches the element, the element
 * leans toward the cursor on a soft spring. Disabled on touch + reduced
 * motion devices.
 *
 * The wrapper renders a div, which keeps layout neutral. Inline elements
 * should wrap a single block-level child.
 */
export function Magnetic({
  children,
  strength = 0.2,
  radius = 120,
  className,
}: {
  children: React.ReactNode;
  strength?: number;
  radius?: number;
  className?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();
  const rafRef = React.useRef<number | null>(null);
  const targetRef = React.useRef({ x: 0, y: 0 });
  const currentRef = React.useRef({ x: 0, y: 0 });

  React.useEffect(() => {
    if (reduced) return;
    const el = ref.current;
    if (!el) return;
    if (typeof window === 'undefined' || matchMedia('(pointer: coarse)').matches) return;

    const animate = () => {
      const dx = targetRef.current.x - currentRef.current.x;
      const dy = targetRef.current.y - currentRef.current.y;
      currentRef.current.x += dx * 0.18;
      currentRef.current.y += dy * 0.18;
      el.style.transform = `translate3d(${currentRef.current.x.toFixed(2)}px, ${currentRef.current.y.toFixed(2)}px, 0)`;
      if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) {
        rafRef.current = window.requestAnimationFrame(animate);
      } else {
        rafRef.current = null;
      }
    };
    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const distance = Math.hypot(dx, dy);
      if (distance < radius) {
        targetRef.current = { x: dx * strength, y: dy * strength };
      } else {
        targetRef.current = { x: 0, y: 0 };
      }
      if (rafRef.current == null) {
        rafRef.current = window.requestAnimationFrame(animate);
      }
    };
    const onLeave = () => {
      targetRef.current = { x: 0, y: 0 };
      if (rafRef.current == null) {
        rafRef.current = window.requestAnimationFrame(animate);
      }
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseout', onLeave);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseout', onLeave);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [reduced, strength, radius]);

  return (
    <div
      ref={ref}
      className={className}
      style={{ transition: 'transform 220ms cubic-bezier(0.16,1,0.3,1)' }}
    >
      {children}
    </div>
  );
}
