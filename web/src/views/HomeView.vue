<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useContentStore } from '@/stores/content';
import type { Locale, Localized } from '@/types';

const route = useRoute();
const content = useContentStore();
const locale = computed<Locale>(() => route.params.locale === 'en' ? 'en' : 'zh');
const data = computed(() => content.data);
const text = (value: Localized | undefined) => value?.[locale.value] ?? value?.zh ?? '';
onMounted(() => content.load());
</script>

<template>
  <div v-if="content.loading && !data" class="loading-state"><t-loading size="large" /> {{ $t('common.loading') }}</div>
  <div v-else-if="data" class="page home-page">
    <section class="hero bento-card">
      <div class="eyebrow">PORTFOLIO · 2026</div>
      <h1>{{ locale === 'zh' ? data.profile.nameZh : data.profile.nameEn }}</h1>
      <p class="hero-role">{{ text(data.profile.role) }}</p>
      <p class="hero-slogan">{{ text(data.profile.slogan) }}</p>
      <p class="hero-bio">{{ text(data.profile.bio) }}</p>
      <div class="hero-actions">
        <t-button theme="primary" size="large" @click="$router.push(`/${locale}#projects`)">{{ $t('home.projects') }}</t-button>
        <t-link v-for="social in data.profile.socials" :key="social.type" :href="social.href" target="_blank">{{ social.label || social.type }}</t-link>
      </div>
      <div class="orb orb-one" /><div class="orb orb-two" />
    </section>

    <section id="projects" class="section">
      <header class="section-heading"><span>01</span><h2>{{ $t('home.projects') }}</h2></header>
      <div class="project-grid">
        <RouterLink v-for="(project, index) in data.projects" :key="project.slug" :to="`/${locale}/projects/${project.slug}`" class="bento-card project-card">
          <div class="card-index">0{{ index + 1 }}</div>
          <div><span class="pill">{{ project.kind }}</span><span class="date">{{ project.startedAt }}</span></div>
          <h3>{{ text(project.title) }}</h3>
          <p class="lead">{{ text(project.tagline) }}</p>
          <p>{{ text(project.summary) }}</p>
          <div class="tags"><t-tag v-for="tag in project.tags" :key="tag" variant="light">{{ tag }}</t-tag></div>
          <span class="card-link">{{ $t('common.open') }} →</span>
        </RouterLink>
      </div>
    </section>

    <section id="experience" class="section split-grid">
      <div>
        <header class="section-heading"><span>02</span><h2>{{ $t('home.experience') }}</h2></header>
        <RouterLink v-for="item in data.experiences" :key="item.slug" :to="`/${locale}/experience/${item.slug}`" class="bento-card experience-card">
          <span class="date">{{ item.startedAt }}</span><h3>{{ text(item.org) }}</h3><strong>{{ text(item.role) }}</strong><p>{{ text(item.summary) }}</p>
          <div class="metric" v-for="metric in item.metrics" :key="text(metric)">{{ text(metric) }}</div>
        </RouterLink>
      </div>
      <div>
        <header class="section-heading"><span>03</span><h2>{{ $t('home.education') }}</h2></header>
        <article v-for="item in data.education" :key="item.id || item.startedAt" class="bento-card education-card">
          <span class="date">{{ item.startedAt }} — {{ item.endedAt || $t('common.present') }}</span>
          <h3>{{ text(item.school) }}</h3><strong>{{ text(item.degree) }}</strong><p>{{ text(item.notes) }}</p>
        </article>
      </div>
    </section>

    <section class="section">
      <header class="section-heading"><span>04</span><h2>{{ $t('home.honors') }}</h2></header>
      <div class="honor-grid">
        <article v-for="honor in data.honors" :key="honor.id || honor.pillar" class="bento-card honor-card">
          <span class="pillar">{{ honor.pillar }}</span><h3>{{ text(honor.title) }}</h3><p>{{ text(honor.story) }}</p>
        </article>
      </div>
    </section>

    <section class="section">
      <header class="section-heading"><span>05</span><h2>{{ $t('home.timeline') }}</h2></header>
      <div class="timeline">
        <article v-for="event in data.timeline" :key="event.id || `${event.date}-${event.kind}`">
          <time>{{ event.date }}</time><div class="timeline-dot" /><div><span class="pill">{{ event.kind }}</span><h3>{{ text(event.title) }}</h3><p>{{ text(event.body) }}</p></div>
        </article>
      </div>
    </section>
  </div>
</template>
