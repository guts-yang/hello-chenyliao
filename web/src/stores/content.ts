import { defineStore } from 'pinia';
import { apiFetch } from '@/lib/api';
import type { Experience, HomeContent, Project } from '@/types';

const fallback: HomeContent = {
  profile: {
    nameZh: '廖晨扬',
    nameEn: 'Tony Liao',
    handle: 'gutsyang',
    role: { zh: 'AI 算法工程师 · 全栈开发者', en: 'AI Engineer · Full-stack Developer' },
    slogan: { zh: '专注大模型机器遗忘学习与多智能体架构', en: 'Focused on LLM unlearning & multi-agent systems' },
    bio: {
      zh: '华南理工大学计算机科学专业，研究大模型机器遗忘学习，也构建多智能体、量化与全栈应用。',
      en: 'CS undergrad at SCUT researching LLM unlearning, while building multi-agent, quant and full-stack systems.',
    },
    socials: [{ type: 'github', href: 'https://github.com/guts-yang', label: '@guts-yang' }],
  },
  projects: [
    {
      slug: 'llm-hessian-unlearning', kind: 'academic', startedAt: '2025-03',
      title: { zh: '基于 Hessian 的 LLM 机器遗忘', en: 'LLM Unlearning via Hessian Curvature' },
      tagline: { zh: '精确遗忘指定知识，保留通用能力', en: 'Erase target knowledge while retaining general ability' },
      summary: { zh: '利用二阶曲率信息加速影响函数近似，实现高效、可复现的大模型遗忘。', en: 'Second-order curvature accelerates influence approximations for efficient, reproducible LLM unlearning.' },
      tags: ['LLM', 'PyTorch', 'Hessian'], highlights: [{ zh: '较基线提速 4–6 倍', en: '4–6× faster than baseline' }],
    },
    {
      slug: 'langgraph-multi-agent', kind: 'engineering', startedAt: '2024-09',
      title: { zh: 'LangGraph 多智能体协同', en: 'LangGraph Multi-Agent Orchestration' },
      tagline: { zh: '可路由、可回滚的智能体图', en: 'Routable, recoverable agent graphs' },
      summary: { zh: '支持任务路由、子图回滚与流式输出的可插拔智能体框架。', en: 'A pluggable agent framework with routing, rollback and streaming.' },
      tags: ['LangGraph', 'Python', 'Multi-Agent'], highlights: [{ zh: '落地三个真实场景', en: 'Deployed in three real use cases' }],
    },
  ],
  experiences: [{
    slug: 'iflytek-ai-contest', startedAt: '2024-10',
    org: { zh: '科大讯飞 AI 开发者大赛', en: 'iFlytek AI Developer Contest' },
    role: { zh: '校园发起人 / 队长', en: 'Campus Lead / Team Captain' },
    summary: { zh: '负责校内招募、组织和赛队组建，并带队进入复赛。', en: 'Led campus recruiting, operations and team formation; advanced to semifinals.' },
    metrics: [{ zh: '招募 412 名参赛者', en: 'Recruited 412 participants' }],
  }],
  honors: [{ pillar: 'wisdom', title: { zh: '钻研力 · 跨学科实践', en: 'Curiosity · Cross-discipline Practice' }, story: { zh: '融合金融理论与机器学习，持续将研究落地。', en: 'Bridging financial theory and machine learning into working systems.' } }],
  education: [{ school: { zh: '华南理工大学', en: 'South China University of Technology' }, degree: { zh: '计算机科学与技术 · 本科', en: 'B.Eng. in Computer Science' }, startedAt: '2023-09' }],
  timeline: [{ date: '2025-03', kind: 'project', title: { zh: '启动 LLM 机器遗忘研究', en: 'Started LLM unlearning research' }, body: { zh: '探索 Hessian 曲率的二阶遗忘算子。', en: 'Exploring second-order operators using Hessian curvature.' } }],
};

export const useContentStore = defineStore('content', {
  state: () => ({ data: null as HomeContent | null, loading: false, error: '' }),
  actions: {
    async load() {
      if (this.data || this.loading) return;
      this.loading = true;
      try {
        this.data = await apiFetch<HomeContent>('/api/public/home');
      } catch (error) {
        this.data = fallback;
        this.error = error instanceof Error ? error.message : String(error);
      } finally {
        this.loading = false;
      }
    },
    async project(slug: string): Promise<Project | undefined> {
      await this.load();
      const local = this.data?.projects.find((item) => item.slug === slug);
      try { return await apiFetch<Project>(`/api/public/projects/${encodeURIComponent(slug)}`); }
      catch { return local; }
    },
    async experience(slug: string): Promise<Experience | undefined> {
      await this.load();
      const local = this.data?.experiences.find((item) => item.slug === slug);
      try { return await apiFetch<Experience>(`/api/public/experiences/${encodeURIComponent(slug)}`); }
      catch { return local; }
    },
  },
});
