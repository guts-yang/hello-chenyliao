'use client';

import * as React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import dynamic from 'next/dynamic';
import { Sparkles, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useLocale, useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import type { Locale } from '@/i18n';

const MOBILE_QUERY = '(max-width: 767px)';
const ChatRoom = dynamic(() => import('./chat-room').then((mod) => mod.ChatRoom), {
  ssr: false,
  loading: () => (
    <div className="grid h-full place-items-center text-sm text-muted-foreground">Loading AI…</div>
  ),
});

/**
 * Globally available "Ask AI" plugin: triggered from the site header.
 * - Desktop (md+): light dropdown panel anchored under the trigger
 * - Mobile (<md):  full-width bottom sheet via Radix Dialog
 */
export function AiPlugin() {
  const t = useTranslations('ai');
  const locale = useLocale() as Locale;
  const [open, setOpen] = React.useState(false);
  const [isMobile, setIsMobile] = React.useState(false);
  const [defaultPrompt, setDefaultPrompt] = React.useState('');

  React.useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  // External opener: other surfaces (e.g. command palette) can fire
  // `ai-plugin:open` with an optional { prompt } detail to launch into a
  // pre-filled question.
  React.useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ prompt?: string }>).detail;
      if (detail?.prompt) setDefaultPrompt(detail.prompt);
      setOpen(true);
    };
    window.addEventListener('ai-plugin:open', handler);
    return () => window.removeEventListener('ai-plugin:open', handler);
  }, []);

  // Close panel on escape (desktop only; Dialog handles its own ESC on mobile).
  React.useEffect(() => {
    if (isMobile) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isMobile]);

  const Trigger = (
    <button
      type="button"
      onClick={() => setOpen((v) => !v)}
      aria-expanded={open}
      aria-haspopup="dialog"
      aria-label={t('trigger')}
      className={cn(
        'inline-flex h-9 items-center gap-1.5 rounded-full border border-white/60 dark:border-white/10 bg-gradient-to-br from-[hsl(var(--primary)/0.14)] via-white/70 to-[hsl(var(--accent)/0.16)] px-3 text-xs font-semibold text-foreground backdrop-blur-sm transition-transform transition-colors hover:-translate-y-0.5 hover:from-[hsl(var(--primary)/0.22)] hover:to-[hsl(var(--accent)/0.24)] dark:via-slate-950/70',
        open && 'from-[hsl(var(--primary)/0.28)] to-[hsl(var(--accent)/0.3)]',
      )}
    >
      <Sparkles className="h-3.5 w-3.5 text-[hsl(var(--accent))]" />
      <span className="hidden sm:inline">{t('trigger')}</span>
    </button>
  );

  if (isMobile) {
    return (
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Trigger asChild>{Trigger}</Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay
            className="fixed inset-0 z-50 bg-slate-950/28 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0"
          />
          <Dialog.Content
            aria-describedby={undefined}
            className="fixed inset-x-0 bottom-0 z-50 flex h-[85vh] flex-col rounded-t-3xl border-t border-white/50 dark:border-white/10 bg-white/92 dark:bg-slate-950/86 p-4 shadow-2xl backdrop-blur-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom"
            style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
          >
            <div className="mx-auto h-1 w-10 shrink-0 rounded-full bg-foreground/15" />
            <div className="mt-3 flex items-center justify-between border-b border-white/30 dark:border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-[hsl(var(--accent)/0.15)] text-[hsl(var(--accent))]">
                  <Sparkles className="h-4 w-4" />
                </span>
                <div>
                  <Dialog.Title className="text-sm font-semibold leading-none">
                    {t('panelTitle')}
                  </Dialog.Title>
                  <p className="mt-1 text-[11px] text-muted-foreground">{t('panelHint')}</p>
                </div>
              </div>
              <Dialog.Close
                aria-label={t('close')}
                className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-white/40 hover:text-foreground dark:hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </Dialog.Close>
            </div>
            <div className="min-h-0 flex-1">
              <ChatRoom
                locale={locale}
                variant="bare"
                className="h-full"
                defaultPrompt={defaultPrompt}
              />
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    );
  }

  // Desktop dropdown: anchored to trigger via relative wrapper.
  return (
    <DesktopPanel
      open={open}
      onOpenChange={setOpen}
      trigger={Trigger}
      panelTitle={t('panelTitle')}
      panelHint={t('panelHint')}
      closeLabel={t('close')}
      locale={locale}
      defaultPrompt={defaultPrompt}
    />
  );
}

function DesktopPanel({
  open,
  onOpenChange,
  trigger,
  panelTitle,
  panelHint,
  closeLabel,
  locale,
  defaultPrompt,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: React.ReactNode;
  panelTitle: string;
  panelHint: string;
  closeLabel: string;
  locale: Locale;
  defaultPrompt: string;
}) {
  const wrapRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) onOpenChange(false);
    };
    // Defer attach to avoid catching the click that opened it.
    const id = window.setTimeout(() => window.addEventListener('mousedown', handler), 0);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener('mousedown', handler);
    };
  }, [open, onOpenChange]);

  return (
    <div ref={wrapRef} className="relative">
      {trigger}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            role="dialog"
            aria-modal="false"
            aria-label={panelTitle}
            className="absolute right-0 top-full z-50 mt-3 flex w-[400px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-3xl border border-white/55 dark:border-white/10 bg-white/92 dark:bg-slate-950/84 p-4 shadow-[0_24px_72px_-26px_hsl(var(--primary)/0.34)] backdrop-blur-lg"
            style={{ height: 'min(520px, calc(100vh - 7.5rem))' }}
          >
            <div className="flex items-center justify-between border-b border-white/30 dark:border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-[hsl(var(--accent)/0.15)] text-[hsl(var(--accent))]">
                  <Sparkles className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold leading-none">{panelTitle}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{panelHint}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                aria-label={closeLabel}
                className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-white/40 hover:text-foreground dark:hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <ChatRoom
                locale={locale}
                variant="bare"
                className="h-full"
                defaultPrompt={defaultPrompt}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
