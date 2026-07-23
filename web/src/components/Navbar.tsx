import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu, Moon, Sun, X } from 'lucide-react';
import { CreamButton, LogoMark } from '@/components/primitives';
import { copy } from '@/copy';
import { useChat } from '@/hooks/useChat';
import { usePreferences } from '@/hooks/usePreferences';
import type { AppRoute } from '@/hooks/useRouter';
import { apiUrl } from '@/lib/api';

const navItems = [
  { key: 'projects', href: '#projects' },
  { key: 'experience', href: '#experience' },
  { key: 'honors', href: '#honors' },
  { key: 'timeline', href: '#timeline' },
] as const;

export function Navbar({ route, navigate }: { route: AppRoute; navigate: (to: string) => void }) {
  const { dark, toggleTheme } = usePreferences();
  const chat = useChat();
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => setMenuOpen(false), [route.path]);
  const go = (hash: string) => {
    navigate(`/${hash}`);
    setMenuOpen(false);
  };

  return (
    <motion.header initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="pointer-events-none absolute inset-x-0 top-0 z-30 flex justify-center">
      <div className="pointer-events-auto flex flex-col items-center px-4">
        <div className="rounded-b-2xl bg-black px-4 py-2 md:rounded-b-3xl md:px-8">
          <div className="flex items-center gap-3 sm:gap-6 md:gap-8 lg:gap-10">
            <button type="button" aria-label="廖晨扬首页" onClick={() => navigate('/')}>
              <LogoMark className="h-5 w-5" />
            </button>
            <nav className="hidden items-center gap-3 sm:gap-6 md:flex md:gap-12 lg:gap-14">
              {navItems.map((item) => (
                <button key={item.key} type="button" className="text-[10px] text-primary/80 transition-colors hover:text-primary sm:text-xs md:text-sm" onClick={() => go(item.href)}>
                  {copy.nav[item.key]}
                </button>
              ))}
            </nav>
            <div className="hidden items-center gap-3 md:flex">
              <button type="button" aria-label={dark ? '切换浅色主题' : '切换深色主题'} onClick={toggleTheme} className="text-primary/80">
                {dark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
              </button>
              <button type="button" onClick={() => chat.setOpen(true)} className="text-xs text-primary/80">{copy.nav.chat}</button>
            </div>
            <button type="button" aria-label={copy.common.menu} className="text-primary/80 md:hidden" onClick={() => setMenuOpen((value) => !value)}>
              {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <AnimatePresence>
          {menuOpen ? (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="mt-3 w-[min(92vw,24rem)] rounded-2xl border border-primary/10 bg-[#101010] p-4 md:hidden">
              <div className="flex flex-col gap-2">
                {navItems.map((item) => <button key={item.key} type="button" className="rounded-lg px-3 py-2 text-left text-sm text-primary/80 hover:bg-white/5" onClick={() => go(item.href)}>{copy.nav[item.key]}</button>)}
              </div>
              <div className="mt-4 flex gap-2">
                <button type="button" onClick={toggleTheme} className="rounded-full border border-primary/15 px-3 py-2 text-xs text-primary/80">{dark ? '浅色主题' : '深色主题'}</button>
                <button type="button" onClick={() => { chat.setOpen(true); setMenuOpen(false); }} className="rounded-full border border-primary/15 px-3 py-2 text-xs text-primary/80">{copy.nav.chat}</button>
              </div>
              <div className="mt-4"><CreamButton full label={copy.nav.resume} href={apiUrl('/api/resume.pdf')} /></div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </motion.header>
  );
}

export function SiteFooter() {
  return <footer className="relative z-10 px-6 py-10 text-center text-xs text-gray-500">© {new Date().getFullYear()} 廖晨扬 · AI 算法工程师 · 基于 React 18 构建</footer>;
}
