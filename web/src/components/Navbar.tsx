import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu, Moon, Sun, X } from 'lucide-react';
import { CreamButton, LogoMark } from '@/components/primitives';
import { useChat } from '@/hooks/useChat';
import { usePreferences } from '@/hooks/usePreferences';
import type { AppRoute } from '@/hooks/useRouter';
import { t } from '@/i18n';
import { apiUrl } from '@/lib/api';

const navItems = [
  { key: 'projects', href: '#projects' },
  { key: 'experience', href: '#experience' },
  { key: 'honors', href: '#honors' },
  { key: 'timeline', href: '#timeline' },
] as const;

export function Navbar({
  route,
  navigate,
  switchLocale,
}: {
  route: AppRoute;
  navigate: (to: string) => void;
  switchLocale: (locale: 'zh' | 'en') => void;
}) {
  const { locale, dark, toggleTheme } = usePreferences();
  const chat = useChat();
  const copy = t(locale);
  const [menuOpen, setMenuOpen] = useState(false);
  const homeBase = `/${locale}`;

  useEffect(() => {
    setMenuOpen(false);
  }, [route.path]);

  const go = (hash: string) => {
    navigate(`${homeBase}${hash}`);
    setMenuOpen(false);
  };

  const linkStyle = { color: 'rgba(225, 224, 204, 0.8)' };

  return (
    <motion.header
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="pointer-events-none absolute inset-x-0 top-0 z-30 flex justify-center"
    >
      <div className="pointer-events-auto flex flex-col items-center px-4">
        <div className="rounded-b-2xl bg-black px-4 py-2 md:rounded-b-3xl md:px-8">
          <div className="flex items-center gap-3 sm:gap-6 md:gap-8 lg:gap-10">
            <button type="button" aria-label="gutsyang home" onClick={() => navigate(homeBase)}>
              <LogoMark className="h-5 w-5" />
            </button>

            <nav className="hidden items-center gap-3 sm:gap-6 md:flex md:gap-12 lg:gap-14">
              {navItems.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className="text-[10px] transition-colors sm:text-xs md:text-sm"
                  style={linkStyle}
                  onMouseEnter={(event) => {
                    event.currentTarget.style.color = '#E1E0CC';
                  }}
                  onMouseLeave={(event) => {
                    event.currentTarget.style.color = 'rgba(225, 224, 204, 0.8)';
                  }}
                  onClick={() => go(item.href)}
                >
                  {copy.nav[item.key]}
                </button>
              ))}
            </nav>

            <div className="hidden items-center gap-2 md:flex">
              <button
                type="button"
                onClick={() => switchLocale(locale === 'zh' ? 'en' : 'zh')}
                className="text-[10px] sm:text-xs"
                style={linkStyle}
              >
                {locale === 'zh' ? 'EN' : '中'}
              </button>
              <button type="button" aria-label={dark ? 'Light mode' : 'Dark mode'} onClick={toggleTheme} style={linkStyle}>
                {dark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
              </button>
              <button type="button" onClick={() => chat.setOpen(true)} className="text-[10px] sm:text-xs" style={linkStyle}>
                {copy.nav.chat}
              </button>
            </div>

            <button
              type="button"
              aria-label={copy.common.menu}
              className="md:hidden"
              style={linkStyle}
              onClick={() => setMenuOpen((value) => !value)}
            >
              {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {menuOpen ? (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mt-3 w-[min(92vw,24rem)] rounded-2xl border border-primary/10 bg-[#101010] p-4 md:hidden"
            >
              <div className="flex flex-col gap-2">
                {navItems.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className="rounded-lg px-3 py-2 text-left text-sm text-primary/80 hover:bg-white/5 hover:text-primary"
                    onClick={() => go(item.href)}
                  >
                    {copy.nav[item.key]}
                  </button>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => switchLocale(locale === 'zh' ? 'en' : 'zh')}
                  className="rounded-full border border-primary/15 px-3 py-2 text-xs text-primary/80"
                >
                  {locale === 'zh' ? 'EN' : '中'}
                </button>
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="rounded-full border border-primary/15 px-3 py-2 text-xs text-primary/80"
                >
                  {dark ? 'Light' : 'Dark'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    chat.setOpen(true);
                    setMenuOpen(false);
                  }}
                  className="rounded-full border border-primary/15 px-3 py-2 text-xs text-primary/80"
                >
                  {copy.nav.chat}
                </button>
              </div>
              <div className="mt-4">
                <CreamButton full label={copy.nav.resume} href={apiUrl('/api/resume.pdf')} />
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </motion.header>
  );
}

export function SiteFooter({ locale }: { locale: 'zh' | 'en' }) {
  return (
    <footer className="relative z-10 px-6 py-10 text-center text-xs text-gray-500">
      © {new Date().getFullYear()} gutsyang · Built with React 18
      <span className="mx-2">·</span>
      {locale === 'zh' ? 'AI 算法工程师' : 'AI Engineer'}
    </footer>
  );
}
