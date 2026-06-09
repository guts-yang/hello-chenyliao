'use client';

import * as React from 'react';

/**
 * Tracks the user's `(prefers-reduced-motion: reduce)` setting and re-renders
 * when it flips. All motion components branch on this so we can degrade
 * gracefully without forking each implementation.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return reduced;
}
