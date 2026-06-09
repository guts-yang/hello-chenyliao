'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { usePrefersReducedMotion } from './reduced-motion';

/**
 * Subtle 3D tilt on hover. Wraps an element with a parent that captures
 * pointer position and rotates the child accordingly. Keep the maxTilt low
 * (2-4deg) for "premium" rather than "novelty".
 */
export function Tilt({
  children,
  maxTilt = 3,
  className,
}: {
  children: React.ReactNode;
  maxTilt?: number;
  className?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();

  if (reduced) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div
      ref={ref}
      className={cn('group [perspective:900px]', className)}
      onPointerMove={(e) => {
        const el = ref.current;
        if (!el || matchMedia('(pointer: coarse)').matches) return;
        const inner = el.firstElementChild as HTMLElement | null;
        if (!inner) return;
        const rect = el.getBoundingClientRect();
        const px = (e.clientX - rect.left) / rect.width - 0.5;
        const py = (e.clientY - rect.top) / rect.height - 0.5;
        inner.style.transform = `rotateY(${(px * maxTilt).toFixed(2)}deg) rotateX(${(
          -py * maxTilt
        ).toFixed(2)}deg) translateZ(0)`;
      }}
      onPointerLeave={() => {
        const inner = ref.current?.firstElementChild as HTMLElement | null;
        if (inner) inner.style.transform = 'rotateY(0deg) rotateX(0deg) translateZ(0)';
      }}
    >
      <div
        className="h-full w-full will-change-transform"
        style={{ transition: 'transform 280ms cubic-bezier(0.16,1,0.3,1)' }}
      >
        {children}
      </div>
    </div>
  );
}
