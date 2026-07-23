<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useContentStore } from '@/stores/content';
import type { Experience, Locale, Localized, Project } from '@/types';

const props = defineProps<{ kind: 'project' | 'experience' }>();
const route = useRoute();
const store = useContentStore();
const item = ref<Project | Experience>();
const loading = ref(true);
const locale = computed<Locale>(() => route.params.locale === 'en' ? 'en' : 'zh');
const text = (value: Localized | undefined) => value?.[locale.value] ?? value?.zh ?? '';
const isProject = computed((): boolean => props.kind === 'project');
const items = computed(() => isProject.value ? store.data?.projects ?? [] : store.data?.experiences ?? []);
const index = computed(() => items.value.findIndex((entry) => entry.slug === route.params.slug));
const previous = computed(() => items.value[index.value - 1]);
const next = computed(() => items.value[index.value + 1]);
const title = computed(() => item.value && ('title' in item.value ? text(item.value.title) : text(item.value.org)));
const sections = computed(() => isProject.value
  ? [{ id: 'overview', label: 'detail.overview' }, { id: 'highlights', label: 'detail.highlights' }, { id: 'stack', label: 'detail.stack' }]
  : [{ id: 'overview', label: 'detail.overview' }, { id: 'metrics', label: 'detail.metrics' }]);

async function load() {
  loading.value = true;
  const slug = String(route.params.slug);
  item.value = isProject.value ? await store.project(slug) : await store.experience(slug);
  loading.value = false;
  if (title.value) document.title = `${title.value} · gutsyang`;
}

const linkFor = (slug: string) => `/${locale.value}/${isProject.value ? 'projects' : 'experience'}/${slug}`;
onMounted(load);
watch(() => [route.params.slug, route.params.locale], load);
</script>

<template>
  <div v-if="loading" class="loading-state"><t-loading size="large" /> {{ $t('common.loading') }}</div>
  <div v-else-if="!item" class="loading-state"><h1>404</h1><p>{{ $t('common.notFound') }}</p><RouterLink :to="`/${locale}`">{{ $t('detail.back') }}</RouterLink></div>
  <div v-else class="page detail-page">
    <aside class="toc bento-card">
      <RouterLink :to="`/${locale}`">← {{ $t('detail.back') }}</RouterLink>
      <a v-for="section in sections" :key="section.id" :href="`#${section.id}`">{{ $t(section.label) }}</a>
    </aside>
    <article class="detail-content">
      <header class="detail-hero bento-card">
        <span class="pill">{{ isProject ? (item as Project).kind : 'experience' }}</span>
        <span class="date">{{ item.startedAt }} — {{ item.endedAt || $t('common.present') }}</span>
        <h1>{{ title }}</h1>
        <p class="hero-slogan">{{ isProject ? text((item as Project).tagline) : text((item as Experience).role) }}</p>
      </header>
      <section id="overview" class="detail-section bento-card">
        <div class="section-number">01</div><h2>{{ $t('detail.overview') }}</h2><p>{{ text(item.summary) }}</p>
      </section>
      <section v-if="isProject" id="highlights" class="detail-section bento-card">
        <div class="section-number">02</div><h2>{{ $t('detail.highlights') }}</h2>
        <ul><li v-for="highlight in (item as Project).highlights" :key="text(highlight)">{{ text(highlight) }}</li></ul>
      </section>
      <section v-if="isProject" id="stack" class="detail-section bento-card">
        <div class="section-number">03</div><h2>{{ $t('detail.stack') }}</h2>
        <div class="tags"><t-tag v-for="tag in (item as Project).tags" :key="tag" size="large">{{ tag }}</t-tag></div>
      </section>
      <section v-else id="metrics" class="detail-section bento-card">
        <div class="section-number">02</div><h2>{{ $t('detail.metrics') }}</h2>
        <div class="metric large" v-for="metric in (item as Experience).metrics" :key="text(metric)">{{ text(metric) }}</div>
      </section>
      <nav class="detail-pagination">
        <RouterLink v-if="previous" :to="linkFor(previous.slug)" class="bento-card"><small>← {{ $t('detail.previous') }}</small><strong>{{ 'title' in previous ? text(previous.title) : text(previous.org) }}</strong></RouterLink>
        <span v-else />
        <RouterLink v-if="next" :to="linkFor(next.slug)" class="bento-card next"><small>{{ $t('detail.next') }} →</small><strong>{{ 'title' in next ? text(next.title) : text(next.org) }}</strong></RouterLink>
      </nav>
    </article>
  </div>
</template>
