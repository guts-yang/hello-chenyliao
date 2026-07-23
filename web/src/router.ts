import { createRouter, createWebHistory } from 'vue-router';
import HomeView from '@/views/HomeView.vue';
import DetailView from '@/views/DetailView.vue';

const router = createRouter({
  history: createWebHistory(),
  scrollBehavior(to, from, saved) {
    if (saved) return saved;
    if (to.hash) return { el: to.hash, behavior: 'smooth' };
    if (to.path !== from.path) return { top: 0 };
  },
  routes: [
    { path: '/', redirect: '/zh' },
    { path: '/:locale(zh|en)', name: 'home', component: HomeView },
    { path: '/:locale(zh|en)/projects/:slug', name: 'project', component: DetailView, props: { kind: 'project' } },
    { path: '/:locale(zh|en)/experience/:slug', name: 'experience', component: DetailView, props: { kind: 'experience' } },
    { path: '/:pathMatch(.*)*', redirect: '/zh' },
  ],
});

function setMeta(name: string, content: string) {
  let element = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.name = name;
    document.head.append(element);
  }
  element.content = content;
}

router.afterEach((to) => {
  const locale = to.params.locale === 'en' ? 'en' : 'zh';
  const detail = typeof to.params.slug === 'string' ? ` · ${to.params.slug.replaceAll('-', ' ')}` : '';
  document.documentElement.lang = locale;
  document.title = locale === 'zh' ? `gutsyang${detail} · AI 算法工程师` : `gutsyang${detail} · AI Engineer`;
  setMeta('description', locale === 'zh' ? 'gutsyang 的项目、经历与 AI 研究。' : 'Projects, experience and AI research by gutsyang.');
});

export default router;
