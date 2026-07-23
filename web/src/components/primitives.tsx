import type { SVGProps } from 'react';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export function LogoMark({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 256 256"
      fill="currentColor"
      className={cn('h-7 w-7 text-primary', className)}
      aria-hidden="true"
      {...props}
    >
      <path d="M 0 128 C 70.692 128 128 185.308 128 256 L 64 256 C 64 220.654 35.346 192 0 192 Z M 256 192 C 220.654 192 192 220.654 192 256 L 128 256 C 128 185.308 185.308 128 256 128 Z M 128 0 C 128 70.692 70.692 128 0 128 L 0 64 C 35.346 64 64 35.346 64 0 Z M 192 0 C 192 35.346 220.654 64 256 64 L 256 128 C 185.308 128 128 70.692 128 0 Z" />
    </svg>
  );
}

export function CreamButton({
  label,
  full = false,
  href,
  onClick,
  className,
}: {
  label: string;
  full?: boolean;
  href?: string;
  onClick?: () => void;
  className?: string;
}) {
  const classes = cn(
    'group inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-black transition-all hover:gap-3 sm:gap-2.5 sm:px-5 sm:py-3 sm:text-base',
    full && 'w-full justify-center',
    className,
  );

  const content = (
    <>
      <span>{label}</span>
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black transition-transform group-hover:scale-110 sm:h-10 sm:w-10">
        <ArrowRight className="h-4 w-4 text-primary" />
      </span>
    </>
  );

  if (href) {
    return (
      <a
        href={href}
        className={classes}
        target={href.startsWith('http') ? '_blank' : undefined}
        rel={href.startsWith('http') ? 'noreferrer' : undefined}
      >
        {content}
      </a>
    );
  }

  return (
    <button type="button" onClick={onClick} className={classes}>
      {content}
    </button>
  );
}

export function SectionEyebrow({
  label,
  tag,
}: {
  label: string;
  tag?: string;
}) {
  return (
    <div className="inline-flex items-center gap-2 text-[10px] text-primary sm:text-xs">
      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
      <span>{label}</span>
      {tag ? (
        <span className="rounded-full border border-primary/20 px-2 py-0.5 text-primary/60">{tag}</span>
      ) : null}
    </div>
  );
}
