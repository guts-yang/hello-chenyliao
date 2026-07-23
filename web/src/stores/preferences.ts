import { defineStore } from 'pinia';
import type { Locale } from '@/types';

export const useLocaleStore = defineStore('locale', {
  state: () => ({ locale: 'zh' as Locale }),
  actions: {
    set(locale: Locale) {
      this.locale = locale;
      document.documentElement.lang = locale;
    },
  },
});

export const useThemeStore = defineStore('theme', {
  state: () => ({
    dark: localStorage.getItem('theme') !== 'light',
  }),
  actions: {
    apply() {
      document.documentElement.dataset.theme = this.dark ? 'dark' : 'light';
    },
    toggle() {
      this.dark = !this.dark;
      localStorage.setItem('theme', this.dark ? 'dark' : 'light');
      this.apply();
    },
  },
});
