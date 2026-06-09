'use client';

import * as React from 'react';
import { useTheme } from 'next-themes';
import { usePrefersReducedMotion } from '@/components/motion';

/**
 * Client-only overlay that lives behind every page and adds:
 *
 *   1. Pointer parallax: writes --pointer-x / --pointer-y CSS variables to
 *      <html>, which any pure-CSS layer can read for soft drift. Throttled to
 *      rAF, disabled on coarse pointers + reduced-motion.
 *   2. Star canvas (dark-only): ≤180 tiny points slowly twinkling. No
 *      Three.js — just a single 2D context.
 *
 * Mount once in the locale layout below the AuroraBackground server
 * component. The two pieces compose cleanly because this layer is
 * pointer-events: none and z-index < 0.
 */
export function AuroraEffects() {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const { resolvedTheme } = useTheme();
  const reduced = usePrefersReducedMotion();

  // Pointer parallax: write CSS vars on <html>, never trigger React renders.
  React.useEffect(() => {
    if (reduced || typeof window === 'undefined') return;
    if (matchMedia('(pointer: coarse)').matches) return;
    let raf = 0;
    let queued: { x: number; y: number } | null = null;
    const onMove = (e: PointerEvent) => {
      queued = {
        x: (e.clientX / window.innerWidth - 0.5) * 2,
        y: (e.clientY / window.innerHeight - 0.5) * 2,
      };
      if (!raf) raf = window.requestAnimationFrame(flush);
    };
    const flush = () => {
      raf = 0;
      if (!queued) return;
      const root = document.documentElement;
      root.style.setProperty('--pointer-x', queued.x.toFixed(3));
      root.style.setProperty('--pointer-y', queued.y.toFixed(3));
      queued = null;
    };
    window.addEventListener('pointermove', onMove);
    return () => {
      window.removeEventListener('pointermove', onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [reduced]);

  // Star canvas (dark mode only).
  React.useEffect(() => {
    if (resolvedTheme !== 'dark') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let stars: Array<{ x: number; y: number; r: number; t: number; speed: number }> = [];
    let raf = 0;
    let running = true;

    function size() {
      const c = canvas!;
      const c2 = ctx!;
      c.width = window.innerWidth * dpr;
      c.height = window.innerHeight * dpr;
      c.style.width = `${window.innerWidth}px`;
      c.style.height = `${window.innerHeight}px`;
      c2.scale(dpr, dpr);
      seed();
    }
    function seed() {
      const target = Math.min(180, Math.floor((window.innerWidth * window.innerHeight) / 14000));
      stars = Array.from({ length: target }, () => ({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        r: Math.random() * 0.9 + 0.3,
        t: Math.random() * Math.PI * 2,
        speed: 0.4 + Math.random() * 0.8,
      }));
    }
    function frame() {
      if (!running) return;
      const c2 = ctx!;
      c2.clearRect(0, 0, window.innerWidth, window.innerHeight);
      for (const s of stars) {
        s.t += 0.012 * s.speed;
        const alpha = reduced ? 0.5 : 0.4 + Math.sin(s.t) * 0.35;
        c2.beginPath();
        c2.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        c2.fillStyle = `rgba(186,212,255,${Math.max(0.05, alpha).toFixed(3)})`;
        c2.fill();
      }
      raf = window.requestAnimationFrame(frame);
    }
    size();
    if (!reduced) {
      frame();
    } else {
      // Single static paint for reduced motion users.
      const c2 = ctx!;
      c2.clearRect(0, 0, window.innerWidth, window.innerHeight);
      for (const s of stars) {
        c2.beginPath();
        c2.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        c2.fillStyle = 'rgba(186,212,255,0.45)';
        c2.fill();
      }
    }
    const onResize = () => size();
    window.addEventListener('resize', onResize);
    return () => {
      running = false;
      window.removeEventListener('resize', onResize);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [resolvedTheme, reduced]);

  return (
    <>
      {resolvedTheme === 'dark' && (
        <canvas
          ref={canvasRef}
          aria-hidden
          className="pointer-events-none fixed inset-0 -z-10 opacity-70"
        />
      )}
    </>
  );
}
