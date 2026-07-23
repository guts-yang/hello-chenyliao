import { createI18n } from 'vue-i18n';

export const i18n = createI18n({
  legacy: false,
  locale: 'zh',
  fallbackLocale: 'zh',
  messages: {
    zh: {
      nav: { home: '首页', projects: '项目', experience: '经历', chat: '问问 AI' },
      home: { projects: '精选项目', experience: '实践经历', honors: '荣誉与特质', education: '教育', timeline: '时间线' },
      detail: { overview: '概览', highlights: '亮点', metrics: '成果', stack: '技术栈', previous: '上一篇', next: '下一篇', back: '返回首页' },
      chat: { title: '问问 gutsyang', subtitle: '了解项目、经历与研究方向', placeholder: '输入你的问题…', send: '发送', history: '历史会话', fresh: '新会话', empty: '可以问我：他在研究什么？' },
      common: { loading: '加载中…', notFound: '没有找到内容', open: '查看详情', present: '至今' },
    },
    en: {
      nav: { home: 'Home', projects: 'Projects', experience: 'Experience', chat: 'Ask AI' },
      home: { projects: 'Selected Projects', experience: 'Experience', honors: 'Honors & Traits', education: 'Education', timeline: 'Timeline' },
      detail: { overview: 'Overview', highlights: 'Highlights', metrics: 'Impact', stack: 'Stack', previous: 'Previous', next: 'Next', back: 'Back home' },
      chat: { title: 'Ask about gutsyang', subtitle: 'Explore projects, experience and research', placeholder: 'Type your question…', send: 'Send', history: 'History', fresh: 'New chat', empty: 'Try asking: What is he researching?' },
      common: { loading: 'Loading…', notFound: 'Content not found', open: 'View details', present: 'Present' },
    },
  },
});
