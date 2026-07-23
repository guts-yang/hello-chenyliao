<script setup lang="ts">
import { computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import ChatPanel from '@/components/ChatPanel.vue';
import { useChatStore } from '@/stores/chat';
import { useLocaleStore, useThemeStore } from '@/stores/preferences';
import type { Locale } from '@/types';

const route = useRoute();
const router = useRouter();
const { locale } = useI18n();
const localeStore = useLocaleStore();
const theme = useThemeStore();
const chat = useChatStore();
const currentLocale = computed<Locale>(() => route.params.locale === 'en' ? 'en' : 'zh');

function syncLocale(value: Locale) {
  locale.value = value;
  localeStore.set(value);
}

function toggleLocale() {
  const next = currentLocale.value === 'zh' ? 'en' : 'zh';
  router.push(route.fullPath.replace(/^\/(zh|en)(?=\/|$)/, `/${next}`));
}

watch(currentLocale, syncLocale, { immediate: true });
onMounted(() => theme.apply());
</script>

<template>
  <div class="app-shell">
    <header class="site-header">
      <RouterLink :to="`/${currentLocale}`" class="brand">
        <span class="brand-mark">GY</span>
        <span>gutsyang</span>
      </RouterLink>
      <nav>
        <RouterLink :to="`/${currentLocale}`">{{ $t('nav.home') }}</RouterLink>
        <RouterLink :to="`/${currentLocale}#projects`">{{ $t('nav.projects') }}</RouterLink>
        <RouterLink :to="`/${currentLocale}#experience`">{{ $t('nav.experience') }}</RouterLink>
      </nav>
      <div class="header-actions">
        <t-button theme="default" variant="text" shape="circle" :aria-label="theme.dark ? 'Light mode' : 'Dark mode'" @click="theme.toggle">
          {{ theme.dark ? '☀' : '☾' }}
        </t-button>
        <t-button theme="default" variant="outline" size="small" @click="toggleLocale">
          {{ currentLocale === 'zh' ? 'EN' : '中' }}
        </t-button>
        <t-button theme="primary" size="small" @click="chat.open = true">{{ $t('nav.chat') }}</t-button>
      </div>
    </header>
    <main><RouterView /></main>
    <footer>© {{ new Date().getFullYear() }} gutsyang · Built with Vue 3</footer>
    <ChatPanel />
  </div>
</template>
