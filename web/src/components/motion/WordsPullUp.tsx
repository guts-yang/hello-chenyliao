import { useMemo, useRef, type CSSProperties } from 'react';
import { motion, useInView } from 'framer-motion';
import { cn } from '@/lib/utils';

function splitUnits(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (/\s/.test(trimmed)) return trimmed.split(/\s+/);
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    try {
      const segmenter = new Intl.Segmenter(undefined, { granularity: 'word' });
      const parts = Array.from(segmenter.segment(trimmed))
        .filter((part) => part.isWordLike || part.segment.trim().length > 0)
        .map((part) => part.segment.trim())
        .filter(Boolean);
      if (parts.length > 1) return parts;
    } catch {
      // fall through
    }
  }
  return Array.from(trimmed);
}

export function WordsPullUp({
  text,
  className,
  showAsterisk = false,
  style,
}: {
  text: string;
  className?: string;
  showAsterisk?: boolean;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const words = useMemo(() => splitUnits(text), [text]);

  return (
    <span ref={ref} className={cn('inline-flex flex-wrap', className)} style={style}>
      {words.map((word, index) => {
        const isLast = index === words.length - 1;
        return (
          <span key={`${word}-${index}`} className="relative mr-[0.18em] inline-block overflow-hidden align-bottom">
            <motion.span
              className="inline-block"
              initial={{ y: 20, opacity: 0 }}
              animate={inView ? { y: 0, opacity: 1 } : { y: 20, opacity: 0 }}
              transition={{ duration: 0.55, delay: index * 0.08, ease: [0.16, 1, 0.3, 1] }}
            >
              {word}
              {showAsterisk && isLast && word.toLowerCase().endsWith('a') ? (
                <span className="absolute -right-[0.3em] top-[0.65em] text-[0.31em]">*</span>
              ) : null}
            </motion.span>
          </span>
        );
      })}
    </span>
  );
}
