import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { apiFetch } from '@/lib/api';
import type { Experience, HomeContent, Project } from '@/types';

const HERO_VIDEO = 'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260405_170732_8a9ccda6-5cff-4628-b164-059c500a2b41.mp4';
const FEATURE_VIDEO = 'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260406_133058_0504132a-0cf3-4450-a370-8ea3b05c95d4.mp4';
const ICON_STORYBOARD = 'https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260405_171918_4a5edc79-d78f-4637-ac8b-53c43c220606.png&w=1280&q=85';
const ICON_CRITIQUES = 'https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260405_171741_ed9845ab-f5b2-4018-8ce7-07cc01823522.png&w=1280&q=85';
const ICON_IMMERSION = 'https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260405_171809_f56666dc-c099-4778-ad82-9ad4f209567b.png&w=1280&q=85';

const fallback: HomeContent = {
  profile: {
    name: '廖晨扬', handle: 'gutsyang', role: 'AI 算法工程师 · 全栈开发者',
    slogan: '专注大模型机器遗忘学习与多智能体架构',
    bio: '华南理工大学计算机科学专业，研究大模型机器遗忘学习，并持续构建多智能体、量化与全栈系统。',
    socials: [{ type: 'github', href: 'https://github.com/guts-yang', label: '@guts-yang' }],
  },
  projects: [{ slug: 'llm-hessian-unlearning', kind: 'academic', startedAt: '2025-03', title: '基于 Hessian 矩阵的 LLM 机器遗忘学习', tagline: '让大模型精确遗忘指定知识，同时保住通用能力', summary: '提出基于二阶曲率信息的遗忘算子，兼顾遗忘效率与下游任务表现。', tags: ['LLM', 'Unlearning', 'PyTorch', 'Hessian'], highlights: ['相比 Gradient Ascent 基线提速 4-6 倍'], displayOrder: 50, isPublished: true }],
  experiences: [{ slug: 'tencent-platform-intern', startedAt: '2026-05', endedAt: '2026-10', org: '腾讯科技（深圳）· 基础平台中心', role: '软件开发实习生', summary: '参与配置中心与 AI Review 旁路模块建设。', metrics: ['服务亿级配置变更场景'], displayOrder: 60, isPublished: true }],
  honors: [{ id: 'honor-kaggle-silver', pillar: '创新', title: 'Kaggle Hull Tactical · 银奖', story: '2026 Kaggle Hull Tactical Market Prediction 竞赛获得银奖。', displayOrder: 80, isPublished: true }],
  education: [{ id: 'education-scut', school: '华南理工大学', degree: '计算机科学与技术 · 本科', notes: '2023 级计科 2 班班长；主修人工智能与系统软件。', startedAt: '2023-09', endedAt: '2027-07', displayOrder: 10 }],
  timeline: [{ id: 'timeline-2023-09', date: '2023-09', kind: '教育', title: '入学 · 华南理工大学', body: '开始系统训练算法、系统、AI 三条主线，并担任计科 2 班班长。' }],
  visuals: { heroVideoUrl: HERO_VIDEO, featureVideoUrl: FEATURE_VIDEO, featureIconProjects: ICON_STORYBOARD, featureIconExperience: ICON_CRITIQUES, featureIconEducation: ICON_IMMERSION },
};

interface ContentContextValue {
  data: HomeContent | null; loading: boolean; error: string;
  load: () => Promise<HomeContent>;
  project: (slug: string) => Promise<Project | undefined>;
  experience: (slug: string) => Promise<Experience | undefined>;
}
const ContentContext = createContext<ContentContextValue | null>(null);

export function ContentProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<HomeContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const cacheRef = useRef<HomeContent | null>(null);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const next = await apiFetch<HomeContent>('/api/public/home');
      cacheRef.current = next; setData(next); return next;
    } catch (err) {
      setError(err instanceof Error ? err.message : '内容加载失败');
      if (!cacheRef.current) { cacheRef.current = fallback; setData(fallback); }
      return cacheRef.current;
    } finally { setLoading(false); }
  }, []);
  const project = useCallback(async (slug: string) => {
    try { return await apiFetch<Project>(`/api/public/projects/${encodeURIComponent(slug)}`); }
    catch { return fallback.projects.find((item) => item.slug === slug); }
  }, []);
  const experience = useCallback(async (slug: string) => {
    try { return await apiFetch<Experience>(`/api/public/experiences/${encodeURIComponent(slug)}`); }
    catch { return fallback.experiences.find((item) => item.slug === slug); }
  }, []);
  const value = useMemo(() => ({ data, loading, error, load, project, experience }), [data, loading, error, load, project, experience]);
  return <ContentContext.Provider value={value}>{children}</ContentContext.Provider>;
}
export function useContent() {
  const ctx = useContext(ContentContext);
  if (!ctx) throw new Error('useContent must be used within ContentProvider');
  return ctx;
}
