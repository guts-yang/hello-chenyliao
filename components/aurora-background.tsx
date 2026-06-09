import { cn } from '@/lib/utils';

/**
 * Background stack:
 *   - base wash
 *   - two drifting aurora blobs wrapped in a parallax frame that reads
 *     --pointer-x / --pointer-y (written by AuroraEffects on client)
 *   - SVG fractal noise grain to kill banding
 *   - vignette for typographic readability
 *
 * Stays server-rendered so the static decoration paints with the first byte.
 * The parallax layer is purely CSS-driven — no JS required.
 */
export function AuroraBackground({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[hsl(var(--background))]',
        className,
      )}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-[hsl(var(--background))] via-transparent to-[hsl(var(--background))]" />

      <div
        className="absolute -inset-[14%] will-change-transform"
        style={{
          transform:
            'translate3d(calc(var(--pointer-x, 0) * 18px), calc(var(--pointer-y, 0) * 12px), 0)',
          transition: 'transform 1.2s cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        <div
          className="absolute left-[2%] top-[6%] h-[54vmax] w-[54vmax] rounded-full opacity-50 blur-[72px] md:blur-[96px] md:animate-aurora-drift"
          style={{
            background:
              'radial-gradient(circle at 30% 30%, hsl(var(--aurora-1) / 0.7), transparent 62%)',
            animationDelay: '0s',
          }}
        />
        <div
          className="absolute right-[-8%] top-[22%] h-[58vmax] w-[58vmax] rounded-full opacity-45 blur-[84px] md:blur-[110px] md:animate-aurora-drift"
          style={{
            background:
              'radial-gradient(circle at 70% 32%, hsl(var(--aurora-2) / 0.68), transparent 62%)',
            animationDelay: '-8s',
          }}
        />
        <div
          className="absolute left-[28%] top-[58%] h-[42vmax] w-[42vmax] rounded-full opacity-35 blur-[88px] md:animate-aurora-drift"
          style={{
            background:
              'radial-gradient(circle at 50% 50%, hsl(var(--aurora-3) / 0.55), transparent 60%)',
            animationDelay: '-14s',
          }}
        />
      </div>

      {/* SVG fractal noise — slightly more present than before. */}
      <div
        className="absolute inset-0 opacity-[0.06] mix-blend-overlay dark:opacity-[0.09] dark:mix-blend-screen"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.82' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.65'/%3E%3C/svg%3E\")",
        }}
      />

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,hsl(var(--background)/0.55)_85%)]" />
    </div>
  );
}
