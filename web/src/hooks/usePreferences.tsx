import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Locale } from '@/types';

interface PreferencesContextValue {
  locale: Locale;
  dark: boolean;
  setLocale: (locale: Locale) => void;
  toggleTheme: () => void;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  const [dark, setDark] = useState(() => localStorage.getItem('theme') !== 'light');

  const setLocale = useCallback((next: Locale) => {
    document.documentElement.lang = next;
  }, []);

  useEffect(() => {
    setLocale(locale);
  }, [locale, setLocale]);

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  }, [dark]);

  const toggleTheme = useCallback(() => {
    setDark((prev) => {
      const next = !prev;
      localStorage.setItem('theme', next ? 'dark' : 'light');
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ locale, dark, setLocale, toggleTheme }),
    [locale, dark, setLocale, toggleTheme],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences must be used within PreferencesProvider');
  return ctx;
}
