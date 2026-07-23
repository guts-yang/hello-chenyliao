import { useMemo, useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface StyleSegment {
  text: string;
  className?: string;
}

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

export function WordsPullUpMultiStyle({
  segments,
  className,
}: {
  segments: StyleSegment[];
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });

  const words = useMemo(
    () =>
      segments.flatMap((segment, segmentIndex) =>
        splitUnits(segment.text).map((word, wordIndex) => ({
          word,
          className: segment.className,
          key: `${segmentIndex}-${wordIndex}-${word}`,
        })),
      ),
    [segments],
  );

  return (
    <div ref={ref} className={cn('inline-flex flex-wrap justify-center', className)}>
      {words.map((item, index) => (
        <span key={item.key} className="mr-[0.22em] inline-block overflow-hidden align-bottom">
          <motion.span
            className={cn('inline-block', item.className)}
            initial={{ y: 20, opacity: 0 }}
            animate={inView ? { y: 0, opacity: 1 } : { y: 20, opacity: 0 }}
            transition={{ duration: 0.55, delay: index * 0.08, ease: [0.16, 1, 0.3, 1] }}
          >
            {item.word}
          </motion.span>
        </span>
      ))}
    </div>
  );
}
