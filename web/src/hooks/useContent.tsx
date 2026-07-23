import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { apiFetch } from '@/lib/api';
import type { Experience, HomeContent, Project } from '@/types';

const fallback: HomeContent = {
  profile: {
    nameZh: '廖晨扬',
    nameEn: 'Tony Liao',
    handle: 'gutsyang',
    role: { zh: 'AI 算法工程师 · 全栈开发者', en: 'AI Engineer · Full-stack Developer' },
    slogan: {
      zh: '专注大模型机器遗忘学习与多智能体架构',
      en: 'Focused on LLM machine unlearning & multi-agent architectures',
    },
    bio: {
      zh: '华南理工大学计算机科学专业，研究大模型机器遗忘学习，并持续构建多智能体、量化与全栈系统。同时兼任班长、国旗护卫队宣传与企业实习，把研究与真实场景工程连接起来。',
      en: 'CS undergrad at SCUT researching LLM unlearning while building multi-agent, quant and full-stack systems. Also a class monitor, Flag Guard propagandist and industry intern connecting research with real deployments.',
    },
    socials: [{ type: 'github', href: 'https://github.com/guts-yang', label: '@guts-yang' }],
  },
  projects: [
    {
      slug: 'llm-hessian-unlearning',
      kind: 'academic',
      startedAt: '2025-03',
      title: { zh: '基于 Hessian 矩阵的 LLM 机器遗忘学习', en: 'LLM Machine Unlearning via Hessian Curvature' },
      tagline: {
        zh: '让大模型「精确遗忘」指定知识，同时保住通用能力',
        en: 'Precisely erase target knowledge from LLMs without breaking general ability',
      },
      summary: {
        zh: '提出基于二阶曲率信息的遗忘算子，对参数局部线性近似下的影响函数做加速近似，达到数倍于现有方法的遗忘效率，同时保留下游任务表现。',
        en: 'Proposes a second-order influence-function approximation that erases targeted samples from a fine-tuned LLM with multiple-x speedup over baselines, while retaining downstream performance.',
      },
      tags: ['LLM', 'Unlearning', 'PyTorch', 'Hessian'],
      highlights: [{ zh: '相比 Gradient Ascent 基线提速 4-6 倍', en: '4-6x faster than gradient-ascent baseline' }],
      displayOrder: 50,
      isPublished: true,
    },
    {
      slug: 'langgraph-multi-agent',
      kind: 'engineering',
      startedAt: '2024-09',
      title: { zh: 'LangGraph 多智能体协同架构', en: 'LangGraph Multi-Agent Orchestration' },
      tagline: {
        zh: '把规划、检索、写作、评审拆成可路由的图节点',
        en: 'Plan / retrieve / write / review as routable graph nodes',
      },
      summary: {
        zh: '基于 LangGraph 设计可热插拔的智能体协同框架，支持任务路由、子图回滚、流式输出。',
        en: 'A pluggable multi-agent framework on LangGraph with task routing, subgraph rollback and streaming output.',
      },
      tags: ['LangGraph', 'Python', 'Multi-Agent'],
      highlights: [{ zh: '可热插拔的子图节点，新增能力 < 1 天', en: 'Hot-pluggable subgraph nodes; add a capability in < 1 day' }],
      displayOrder: 40,
      isPublished: true,
    },
    {
      slug: 'a-share-quant',
      kind: 'engineering',
      startedAt: '2024-04',
      title: { zh: 'A 股量化分析系统', en: 'A-Share Quantitative Analysis System' },
      tagline: { zh: 'SMC · 缠论 · 深度学习信号融合', en: 'SMC · Chan Theory · Deep Learning Signals' },
      summary: {
        zh: '融合 Smart Money Concepts、缠论结构识别与深度学习因子，构建可回测的 A 股量化研究管线。',
        en: 'Fuses Smart Money Concepts, Chan-theory structure detection and deep learning factors into a backtestable A-share research pipeline.',
      },
      tags: ['Quant', 'Python', 'Deep Learning'],
      highlights: [{ zh: '完整回测与信号可视化', en: 'Full backtests with signal visualization' }],
      displayOrder: 30,
      isPublished: true,
    },
  ],
  experiences: [
    {
      slug: 'tencent-platform-intern',
      startedAt: '2026-05',
      endedAt: '2026-10',
      org: { zh: '腾讯科技（深圳）· 基础平台中心', en: 'Tencent · Foundation Platform' },
      role: { zh: '软件开发实习生', en: 'Software Engineering Intern' },
      summary: {
        zh: '参与七彩石配置中心与 AI Review 旁路模块建设，服务超大规模配置变更与多仓库解耦评审。',
        en: 'Contributed to the Qicaishi config center and AI Review bypass module for large-scale config changes.',
      },
      metrics: [{ zh: '服务亿级配置变更场景', en: 'Supported hundred-million-scale config changes' }],
      displayOrder: 60,
      isPublished: true,
    },
    {
      slug: 'beuron-ai-intern',
      startedAt: '2026-03',
      endedAt: '2026-05',
      org: { zh: '贝朗（中国）卫浴 · AI 效率组', en: 'Beuron China · AI Efficiency Team' },
      role: { zh: 'AI 效率实习生', en: 'AI Efficiency Intern' },
      summary: {
        zh: '独立推进采购推单自动化与智能标书组装系统。',
        en: 'Independently built procurement push-order automation and intelligent bid-assembly systems.',
      },
      metrics: [{ zh: '年节省成本 100+ 万元', en: 'Saved RMB 1M+ annually' }],
      displayOrder: 50,
      isPublished: true,
    },
    {
      slug: 'weishi-multi-agent-intern',
      startedAt: '2025-12',
      endedAt: '2026-02',
      org: { zh: '广州唯实智能', en: 'Guangzhou Weishi Intelligence' },
      role: { zh: '多智能体系统实习生', en: 'Multi-Agent Systems Intern' },
      summary: {
        zh: '设计并落地乡村多智能体决策系统，用 Supervisor 调度多个专业子智能体。',
        en: 'Designed and shipped a rural multi-agent decision system with a supervisor orchestrating specialists.',
      },
      metrics: [{ zh: '1 Supervisor 调度 8 子智能体', en: '1 supervisor orchestrating 8 agents' }],
      displayOrder: 40,
      isPublished: true,
    },
    {
      slug: 'iflytek-spark-campus',
      startedAt: '2025-06',
      endedAt: '2026-05',
      org: { zh: '科大讯飞 · 星火校园', en: 'iFlytek · Spark Campus' },
      role: { zh: '星火校园实习生 / 校园发起人', en: 'Spark Campus Intern / Campus Lead' },
      summary: {
        zh: '负责华南理工大学星火校园招募、传播与赛队组织，超额完成招募目标。',
        en: 'Owned Spark Campus recruiting, outreach and team formation at SCUT, exceeding targets.',
      },
      metrics: [{ zh: '招募 412 / 目标 300（超额 37.3%）', en: 'Recruited 412 vs 300 target (+37.3%)' }],
      displayOrder: 30,
      isPublished: true,
    },
  ],
  honors: [
    {
      id: 'honor-kaggle-silver',
      pillar: 'wisdom',
      title: { zh: 'Kaggle Hull Tactical · 银奖', en: 'Kaggle Hull Tactical · Silver' },
      story: {
        zh: '2026 Kaggle Hull Tactical Market Prediction 竞赛获得银奖。',
        en: 'Earned silver in the 2026 Kaggle Hull Tactical Market Prediction competition.',
      },
      displayOrder: 80,
      isPublished: true,
    },
    {
      id: 'honor-career-planning',
      pillar: 'wisdom',
      title: { zh: '全国大学生职业规划大赛 · 省铜 / 校一', en: 'National Career Planning Contest · Provincial Bronze / Campus First' },
      story: {
        zh: '第三届全国大学生职业规划大赛获得广东省铜奖与校赛一等奖。',
        en: 'Won provincial bronze and campus first prize in the 3rd National Career Planning Contest.',
      },
      displayOrder: 70,
      isPublished: true,
    },
    {
      id: 'honor-zhengda',
      pillar: 'wisdom',
      title: { zh: '正大杯市调大赛 · 国三 / 省一', en: 'Zhengda Cup · National Third / Provincial First' },
      story: {
        zh: '正大杯市场调查与分析大赛获得国家级三等奖与省级一等奖。',
        en: 'Won national third and provincial first prizes in the Zhengda Cup market research contest.',
      },
      displayOrder: 60,
      isPublished: true,
    },
  ],
  education: [
    {
      id: 'education-scut',
      school: { zh: '华南理工大学', en: 'South China University of Technology' },
      degree: { zh: '计算机科学与技术 · 本科', en: 'B.Eng. in Computer Science' },
      notes: {
        zh: '2023 级计科 2 班班长；主修人工智能与系统软件。',
        en: 'Class monitor of CS Class 2 (2023 cohort); focus on AI and systems software.',
      },
      startedAt: '2023-09',
      endedAt: '2027-07',
      displayOrder: 10,
    },
  ],
  timeline: [
    {
      id: 'timeline-2023-09',
      date: '2023-09',
      kind: 'edu',
      title: { zh: '入学 · 华南理工大学 CS / 班长', en: 'Enrolled · SCUT CS / Class Monitor' },
      body: {
        zh: '开始系统训练算法、系统、AI 三条主线，并担任计科 2 班班长。',
        en: 'Started a structured journey across algorithms, systems and AI while serving as class monitor.',
      },
    },
    {
      id: 'timeline-2024-09',
      date: '2024-09',
      kind: 'project',
      title: { zh: '启动 · LangGraph 多智能体', en: 'Kickoff · LangGraph Multi-Agent' },
      body: {
        zh: '搭建可热插拔的智能体协同框架。',
        en: 'Built a hot-pluggable multi-agent framework.',
      },
    },
    {
      id: 'timeline-2025-03',
      date: '2025-03',
      kind: 'project',
      title: { zh: '启动 · LLM 机器遗忘研究', en: 'Kickoff · LLM Unlearning Research' },
      body: {
        zh: '探索 Hessian 曲率的二阶遗忘算子。',
        en: 'Exploring second-order operators using Hessian curvature.',
      },
    },
    {
      id: 'timeline-2026-05',
      date: '2026-05',
      kind: 'work',
      title: { zh: '加入腾讯基础平台', en: 'Joined Tencent Foundation Platform' },
      body: {
        zh: '参与配置中心与 AI Review 旁路建设。',
        en: 'Contributed to config center and AI Review bypass systems.',
      },
    },
  ],
};

interface ContentContextValue {
  data: HomeContent | null;
  loading: boolean;
  error: string;
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
    setLoading(true);
    setError('');
    try {
      const next = await apiFetch<HomeContent>('/api/public/home');
      cacheRef.current = next;
      setData(next);
      return next;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load content';
      setError(message);
      if (!cacheRef.current) {
        cacheRef.current = fallback;
        setData(fallback);
      }
      return cacheRef.current;
    } finally {
      setLoading(false);
    }
  }, []);

  const project = useCallback(async (slug: string) => {
    try {
      return await apiFetch<Project>(`/api/public/projects/${encodeURIComponent(slug)}`);
    } catch {
      return fallback.projects.find((item) => item.slug === slug);
    }
  }, []);

  const experience = useCallback(async (slug: string) => {
    try {
      return await apiFetch<Experience>(`/api/public/experiences/${encodeURIComponent(slug)}`);
    } catch {
      return fallback.experiences.find((item) => item.slug === slug);
    }
  }, []);

  const value = useMemo(
    () => ({ data, loading, error, load, project, experience }),
    [data, loading, error, load, project, experience],
  );

  return <ContentContext.Provider value={value}>{children}</ContentContext.Provider>;
}

export function useContent() {
  const ctx = useContext(ContentContext);
  if (!ctx) throw new Error('useContent must be used within ContentProvider');
  return ctx;
}
