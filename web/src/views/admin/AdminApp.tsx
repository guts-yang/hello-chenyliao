import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Field, TextField, inputClass } from '@/components/admin/forms';
import { AdminAuthProvider, useAdminAuth } from '@/hooks/useAdminAuth';
import type { AdminSection, AppRoute } from '@/hooks/useRouter';
import { adminFetch, uploadFile } from '@/lib/adminApi';
import type {
  AdminAuditItem,
  AdminSessionItem,
  AdminStats,
  Profile,
  ResumeSettings,
  VisualSettings,
} from '@/types';

function LoginView({ navigate }: { navigate: (to: string) => void }) {
  const { login, error, user, loading } = useAdminAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate('/admin');
  }, [loading, navigate, user]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await login(email, password);
      navigate('/admin');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-4 text-[#E1E0CC]">
      <form onSubmit={submit} className="w-full max-w-md rounded-3xl bg-[#101010] p-8">
        <h1 className="text-2xl text-primary">管理员登录</h1>
        <p className="mt-2 text-sm text-gray-500">登录后可管理个人站全部中文内容与插图。</p>
        <div className="mt-6 space-y-4">
          <Field label="邮箱">
            <input className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
          </Field>
          <Field label="密码">
            <input className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} type="password" required />
          </Field>
        </div>
        {error ? <p className="mt-4 text-xs text-rose-400">{error}</p> : null}
        <button type="submit" disabled={busy} className="mt-6 w-full rounded-full bg-primary px-4 py-3 text-sm text-black disabled:opacity-50">
          {busy ? '登录中…' : '登录'}
        </button>
      </form>
    </div>
  );
}

function DashboardView({ navigate }: { navigate: (to: string) => void }) {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [audit, setAudit] = useState<AdminAuditItem[]>([]);

  useEffect(() => {
    void adminFetch<AdminStats>('/api/admin/stats').then(setStats);
    void adminFetch<AdminAuditItem[]>('/api/admin/audit').then((items) => setAudit(items.slice(0, 8)));
  }, []);

  const cards = [
    { label: '项目', value: stats?.projects ?? '—', href: '/admin/projects' },
    { label: '经历', value: stats?.experiences ?? '—', href: '/admin/experiences' },
    { label: '荣誉', value: stats?.honors ?? '—', href: '/admin/honors' },
    { label: '教育', value: stats?.education ?? '—', href: '/admin/education' },
    { label: '时间线', value: stats?.timeline ?? '—', href: '/admin/timeline' },
    { label: '简历', value: stats?.resume ? '已配置' : '未配置', href: '/admin/resume' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl text-primary">仪表盘</h1>
          <p className="mt-2 text-sm text-gray-500">管理内容、插图与账户安全。</p>
        </div>
        <button type="button" onClick={() => navigate('/')} className="rounded-full border border-primary/20 px-4 py-2 text-sm text-primary">
          打开公开站
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <button
            key={card.label}
            type="button"
            onClick={() => navigate(card.href)}
            className="rounded-2xl bg-[#212121] p-5 text-left transition hover:bg-[#2a2a2a]"
          >
            <div className="text-xs text-gray-500">{card.label}</div>
            <div className="mt-3 text-2xl text-[#E1E0CC]">{card.value}</div>
          </button>
        ))}
      </div>
      <section className="rounded-2xl bg-[#101010] p-5">
        <h2 className="text-lg text-primary">最近审计</h2>
        <div className="mt-4 space-y-2">
          {audit.length === 0 ? <p className="text-sm text-gray-500">暂无记录</p> : null}
          {audit.map((item) => (
            <div key={item.id} className="rounded-xl bg-[#212121] px-4 py-3 text-sm">
              <div className="text-[#E1E0CC]">{item.action}</div>
              <div className="mt-1 text-xs text-gray-500">
                {item.target || '—'} · {new Date(item.createdAt).toLocaleString('zh-CN')}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function ProfileView() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    void adminFetch<Profile>('/api/admin/profile').then(setProfile);
  }, []);

  async function save() {
    if (!profile) return;
    setError('');
    try {
      const next = await adminFetch<Profile>('/api/admin/profile', { method: 'PUT', body: JSON.stringify(profile) }, true);
      setProfile(next);
      setMessage('已保存');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  if (!profile) return <div className="text-sm text-gray-500">加载中…</div>;

  return (
    <div className="space-y-5">
      <h1 className="text-3xl text-primary">个人资料</h1>
      <div className="space-y-4 rounded-2xl bg-[#101010] p-5">
        <Field label="姓名">
          <input className={inputClass} value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
        </Field>
        <Field label="Handle">
          <input className={inputClass} value={profile.handle} onChange={(e) => setProfile({ ...profile, handle: e.target.value })} />
        </Field>
        <TextField label="角色" value={profile.role} onChange={(role) => setProfile({ ...profile, role })} />
        <TextField label="Slogan" value={profile.slogan} onChange={(slogan) => setProfile({ ...profile, slogan })} />
        <TextField label="简介" rows={4} value={profile.bio} onChange={(bio) => setProfile({ ...profile, bio })} />
        <Field label="头像">
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void uploadFile(file, 'avatars').then((avatarUrl) => setProfile({ ...profile, avatarUrl }));
            }}
          />
          <input
            className={`${inputClass} mt-2`}
            value={profile.avatarUrl || ''}
            onChange={(e) => setProfile({ ...profile, avatarUrl: e.target.value })}
          />
          {profile.avatarUrl ? <img src={profile.avatarUrl} alt="头像预览" className="mt-3 h-20 w-20 rounded-full object-cover" /> : null}
        </Field>
        <Field label="GitHub">
          <input
            className={inputClass}
            value={profile.socials?.[0]?.href || ''}
            onChange={(e) =>
              setProfile({
                ...profile,
                socials: [{ type: 'github', href: e.target.value, label: '@guts-yang' }],
              })
            }
          />
        </Field>
      </div>
      {message ? <p className="text-xs text-primary">{message}</p> : null}
      {error ? <p className="text-xs text-rose-400">{error}</p> : null}
      <button type="button" onClick={() => void save()} className="rounded-full bg-primary px-5 py-3 text-sm text-black">
        保存资料
      </button>
    </div>
  );
}

const visualFields: Array<{ key: keyof VisualSettings; label: string; accept: string; folder: string }> = [
  { key: 'heroVideoUrl', label: 'Hero 视频', accept: 'video/mp4,video/webm', folder: 'visuals' },
  { key: 'featureVideoUrl', label: '特色视频', accept: 'video/mp4,video/webm', folder: 'visuals' },
  { key: 'featureIconProjects', label: '项目图标', accept: 'image/*', folder: 'visuals' },
  { key: 'featureIconExperience', label: '经历图标', accept: 'image/*', folder: 'visuals' },
  { key: 'featureIconEducation', label: '教育图标', accept: 'image/*', folder: 'visuals' },
];

function VisualsView() {
  const [visuals, setVisuals] = useState<VisualSettings | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    void adminFetch<VisualSettings>('/api/admin/visuals')
      .then(setVisuals)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  if (!visuals) return <div className="text-sm text-gray-500">{error || '加载中…'}</div>;

  return (
    <div className="space-y-5">
      <h1 className="text-3xl text-primary">站点插图</h1>
      <p className="text-sm text-gray-400">管理首页 Hero、特色视频及三类功能图标。保存后公开站刷新即可看到。</p>
      <div className="space-y-4 rounded-2xl bg-[#101010] p-5">
        {visualFields.map(({ key, label, accept, folder }) => (
          <Field key={key} label={label}>
            <input
              type="file"
              accept={accept}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void uploadFile(file, folder).then((url) => setVisuals({ ...visuals, [key]: url }));
              }}
            />
            <input
              className={`${inputClass} mt-2`}
              value={visuals[key] || ''}
              onChange={(e) => setVisuals({ ...visuals, [key]: e.target.value })}
            />
            {accept.startsWith('video') ? (
              visuals[key] ? <video className="mt-3 max-h-40 rounded-lg" src={visuals[key]} controls /> : null
            ) : visuals[key] ? (
              <img className="mt-3 h-20 w-20 rounded-lg object-cover" src={visuals[key]} alt={`${label}预览`} />
            ) : null}
          </Field>
        ))}
      </div>
      <button
        type="button"
        className="rounded-full bg-primary px-5 py-3 text-sm text-black"
        onClick={() =>
          void adminFetch<VisualSettings>('/api/admin/visuals', { method: 'PUT', body: JSON.stringify(visuals) }, true)
            .then((next) => {
              setVisuals(next);
              setMessage('插图已保存');
              setError('');
            })
            .catch((err) => setError(err instanceof Error ? err.message : String(err)))
        }
      >
        保存插图
      </button>
      {message ? <p className="text-xs text-primary">{message}</p> : null}
      {error ? <p className="text-xs text-rose-400">{error}</p> : null}
    </div>
  );
}

function ResumeView() {
  const [resume, setResume] = useState<ResumeSettings | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    void adminFetch<ResumeSettings>('/api/admin/resume').then(setResume);
  }, []);

  async function save(url: string) {
    setError('');
    try {
      const next = await adminFetch<ResumeSettings>('/api/admin/resume', { method: 'PUT', body: JSON.stringify({ url }) }, true);
      setResume(next);
      setMessage('简历已更新');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  if (!resume) return <div className="text-sm text-gray-500">加载中…</div>;

  return (
    <div className="space-y-5">
      <h1 className="text-3xl text-primary">简历</h1>
      <div className="rounded-2xl bg-[#101010] p-5">
        <p className="text-sm text-gray-400">当前状态：{resume.available ? '已配置' : '未配置（公开站返回 404）'}</p>
        <Field label="PDF 上传">
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void uploadFile(file, 'resume').then((url) => void save(url));
            }}
          />
        </Field>
        <Field label="简历 URL">
          <input className={inputClass} value={resume.url || ''} onChange={(e) => setResume({ ...resume, url: e.target.value })} />
        </Field>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="rounded-full bg-primary px-4 py-2 text-sm text-black" onClick={() => void save(resume.url || '')}>
            保存
          </button>
          <a href="/api/resume.pdf" target="_blank" rel="noreferrer" className="rounded-full border border-primary/20 px-4 py-2 text-sm text-primary">
            测试公开下载
          </a>
        </div>
      </div>
      {message ? <p className="text-xs text-primary">{message}</p> : null}
      {error ? <p className="text-xs text-rose-400">{error}</p> : null}
    </div>
  );
}

function MediaView() {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');

  return (
    <div className="space-y-5">
      <h1 className="text-3xl text-primary">媒体上传</h1>
      <p className="text-sm text-gray-400">上传后复制 URL 到资料、项目封面或站点插图。</p>
      <div className="rounded-2xl bg-[#101010] p-5">
        <input
          type="file"
          accept="image/*,video/mp4,video/webm,application/pdf"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setError('');
            void uploadFile(file, 'media')
              .then(setUrl)
              .catch((err) => setError(err instanceof Error ? err.message : String(err)));
          }}
        />
        {url ? (
          <div className="mt-4 space-y-2">
            <input className={inputClass} value={url} readOnly />
            {url.match(/\.(mp4|webm)(\?|$)/i) ? (
              <video src={url} controls className="max-h-64 rounded-lg" />
            ) : url.match(/\.pdf(\?|$)/i) ? null : (
              <img src={url} alt="上传预览" className="max-h-64 rounded-lg object-contain" />
            )}
          </div>
        ) : null}
        {error ? <p className="mt-3 text-xs text-rose-400">{error}</p> : null}
      </div>
    </div>
  );
}

function SettingsView() {
  const [sessions, setSessions] = useState<AdminSessionItem[]>([]);
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadSessions = () => void adminFetch<AdminSessionItem[]>('/api/admin/sessions').then(setSessions);
  useEffect(loadSessions, []);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl text-primary">账户设置</h1>
      <section className="space-y-4 rounded-2xl bg-[#101010] p-5">
        <h2 className="text-lg text-primary">修改邮箱</h2>
        <Field label="新邮箱">
          <input className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="当前密码">
          <input className={inputClass} type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
        </Field>
        <button
          type="button"
          className="rounded-full bg-primary px-4 py-2 text-sm text-black"
          onClick={() =>
            void adminFetch('/api/admin/email', {
              method: 'PUT',
              body: JSON.stringify({ newEmail: email, currentPassword }),
            }, true)
              .then(() => setMessage('邮箱已更新'))
              .catch((err) => setError(err instanceof Error ? err.message : String(err)))
          }
        >
          更新邮箱
        </button>
      </section>
      <section className="space-y-4 rounded-2xl bg-[#101010] p-5">
        <h2 className="text-lg text-primary">修改密码</h2>
        <Field label="当前密码">
          <input className={inputClass} type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
        </Field>
        <Field label="新密码">
          <input className={inputClass} type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
        </Field>
        <button
          type="button"
          className="rounded-full bg-primary px-4 py-2 text-sm text-black"
          onClick={() =>
            void adminFetch('/api/admin/password', {
              method: 'POST',
              body: JSON.stringify({ currentPassword, newPassword }),
            }, true)
              .then(() => {
                setMessage('密码已更新');
                setNewPassword('');
              })
              .catch((err) => setError(err instanceof Error ? err.message : String(err)))
          }
        >
          更新密码
        </button>
      </section>
      <section className="space-y-4 rounded-2xl bg-[#101010] p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg text-primary">会话</h2>
          <button
            type="button"
            className="rounded-full border border-rose-500/30 px-3 py-1.5 text-xs text-rose-300"
            onClick={() => {
              if (!window.confirm('撤销全部其他会话？')) return;
              void adminFetch('/api/admin/sessions/revoke-all', { method: 'POST' }, true).then(loadSessions);
            }}
          >
            撤销全部其他
          </button>
        </div>
        <div className="space-y-2">
          {sessions.map((session) => (
            <div key={session.id} className="flex items-center justify-between rounded-xl bg-[#212121] px-4 py-3 text-sm">
              <div>
                <div className="text-[#E1E0CC]">{session.current ? '当前会话' : session.ip || '会话'}</div>
                <div className="text-xs text-gray-500">{new Date(session.lastSeenAt).toLocaleString('zh-CN')}</div>
              </div>
              {!session.current ? (
                <button
                  type="button"
                  className="text-xs text-rose-300"
                  onClick={() => void adminFetch(`/api/admin/sessions/${session.id}`, { method: 'DELETE' }, true).then(loadSessions)}
                >
                  撤销
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </section>
      {message ? <p className="text-xs text-primary">{message}</p> : null}
      {error ? <p className="text-xs text-rose-400">{error}</p> : null}
    </div>
  );
}

function AuditView() {
  const [items, setItems] = useState<AdminAuditItem[]>([]);
  const [action, setAction] = useState('');
  const [filter, setFilter] = useState('');

  useEffect(() => {
    const query = new URLSearchParams();
    if (filter) query.set('action', filter);
    void adminFetch<AdminAuditItem[]>(`/api/admin/audit?${query.toString()}`).then(setItems);
  }, [filter]);

  async function loadMore() {
    const query = new URLSearchParams();
    if (filter) query.set('action', filter);
    const last = items[items.length - 1];
    if (last?.createdAt) query.set('before', last.createdAt);
    const next = await adminFetch<AdminAuditItem[]>(`/api/admin/audit?${query.toString()}`);
    setItems((prev) => [...prev, ...next]);
  }

  return (
    <div className="space-y-5">
      <h1 className="text-3xl text-primary">审计日志</h1>
      <div className="flex gap-2">
        <input className={inputClass} placeholder="action filter" value={action} onChange={(e) => setAction(e.target.value)} />
        <button type="button" className="rounded-full bg-primary px-4 py-2 text-sm text-black" onClick={() => setFilter(action.trim())}>
          筛选
        </button>
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="rounded-2xl bg-[#212121] px-4 py-3 text-sm">
            <div className="text-[#E1E0CC]">{item.action}</div>
            <div className="text-xs text-gray-500">
              {item.target || '—'} · {item.ip || '—'} · {new Date(item.createdAt).toLocaleString('zh-CN')}
            </div>
          </div>
        ))}
      </div>
      {items.length ? (
        <button type="button" className="rounded-full border border-primary/20 px-4 py-2 text-sm text-primary" onClick={() => void loadMore()}>
          加载更多
        </button>
      ) : null}
    </div>
  );
}

const entityConfig = {
  projects: {
    title: '项目',
    path: 'projects',
    fields: ['slug', 'kind', 'title', 'tagline', 'summary', 'tags', 'highlights', 'startedAt', 'endedAt', 'displayOrder', 'coverUrl'],
  },
  experiences: {
    title: '经历',
    path: 'experiences',
    fields: ['slug', 'org', 'role', 'summary', 'metrics', 'startedAt', 'endedAt', 'displayOrder'],
  },
  honors: {
    title: '荣誉',
    path: 'honors',
    fields: ['pillar', 'title', 'story', 'displayOrder'],
  },
  education: {
    title: '教育',
    path: 'education',
    fields: ['school', 'degree', 'notes', 'startedAt', 'endedAt', 'displayOrder'],
  },
  timeline: {
    title: '时间线',
    path: 'timeline',
    fields: ['date', 'kind', 'title', 'body'],
  },
} as const;

type EntitySection = keyof typeof entityConfig;

function ContentManager({ section }: { section: EntitySection }) {
  const config = entityConfig[section];
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    void adminFetch<Array<Record<string, unknown>>>(`/api/admin/${config.path}`).then(setItems);
  }, [config.path]);

  const load = () => void adminFetch<Array<Record<string, unknown>>>(`/api/admin/${config.path}`).then(setItems);

  const setField = (key: string, value: string) =>
    setEditing((item) => ({
      ...(item || {}),
      [key]: ['tags', 'highlights', 'metrics'].includes(key)
        ? value.split(',').map((part) => part.trim()).filter(Boolean)
        : key === 'displayOrder'
          ? Number(value)
          : value,
    }));

  async function save() {
    if (!editing) return;
    const id = typeof editing.id === 'string' ? editing.id : undefined;
    const next = await adminFetch<Record<string, unknown>>(
      `/api/admin/${config.path}${id ? `/${id}` : ''}`,
      { method: id ? 'PUT' : 'POST', body: JSON.stringify(editing) },
      true,
    );
    setEditing(next);
    setMessage('已保存');
    load();
  }

  async function remove() {
    if (!editing?.id || !window.confirm('确认删除？')) return;
    await adminFetch(`/api/admin/${config.path}/${editing.id}`, { method: 'DELETE' }, true);
    setEditing(null);
    load();
  }

  if (editing) {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-3xl text-primary">{config.title}</h1>
          <div className="flex gap-2">
            <button type="button" className="rounded-full border border-primary/20 px-4 py-2 text-sm text-primary" onClick={() => setEditing(null)}>
              返回
            </button>
            {editing.id ? (
              <button type="button" className="rounded-full border border-rose-500/30 px-4 py-2 text-sm text-rose-300" onClick={() => void remove()}>
                删除
              </button>
            ) : null}
            <button type="button" className="rounded-full bg-primary px-4 py-2 text-sm text-black" onClick={() => void save()}>
              保存
            </button>
          </div>
        </div>
        <div className="space-y-4 rounded-2xl bg-[#101010] p-5">
          {config.fields.map((field) => (
            <TextField
              key={field}
              label={field}
              rows={['summary', 'story', 'body', 'notes', 'tagline'].includes(field) ? 4 : 2}
              value={Array.isArray(editing[field]) ? (editing[field] as string[]).join(', ') : String(editing[field] ?? '')}
              onChange={(value) => setField(field, value)}
            />
          ))}
          {section === 'projects' ? (
            <Field label="封面上传">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void uploadFile(file, 'projects').then((coverUrl) => setEditing({ ...editing, coverUrl }));
                }}
              />
              {typeof editing.coverUrl === 'string' && editing.coverUrl ? (
                <img className="mt-3 h-36 rounded-lg object-cover" src={editing.coverUrl} alt="封面预览" />
              ) : null}
            </Field>
          ) : null}
          {'isPublished' in editing || section === 'projects' || section === 'experiences' || section === 'honors' ? (
            <label className="flex items-center gap-2 text-sm text-primary/80">
              <input
                type="checkbox"
                checked={Boolean(editing.isPublished ?? true)}
                onChange={(e) => setEditing({ ...editing, isPublished: e.target.checked })}
              />
              已发布
            </label>
          ) : null}
        </div>
        {message ? <p className="text-xs text-primary">{message}</p> : null}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl text-primary">{config.title}</h1>
        <button type="button" className="rounded-full bg-primary px-4 py-2 text-sm text-black" onClick={() => setEditing({ isPublished: true, displayOrder: 0 })}>
          新建
        </button>
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <button
            key={String(item.id)}
            type="button"
            className="block w-full rounded-2xl bg-[#212121] px-4 py-4 text-left"
            onClick={() => setEditing(item)}
          >
            {String(item.title || item.org || item.school || item.date || item.slug || '未命名')}
          </button>
        ))}
      </div>
    </div>
  );
}

function GuardedAdmin({ route, navigate }: { route: AppRoute; navigate: (to: string) => void }) {
  const { user, loading } = useAdminAuth();

  useEffect(() => {
    if (!loading && !user && route.kind !== 'admin-login') navigate('/admin/login');
  }, [loading, navigate, route.kind, user]);

  if (route.kind === 'admin-login') return <LoginView navigate={navigate} />;
  if (loading) return <div className="flex min-h-screen items-center justify-center bg-black text-sm text-gray-500">加载中…</div>;
  if (!user) return null;
  if (route.kind === 'admin-404') {
    return (
      <AdminLayout section="dashboard" navigate={navigate}>
        <div className="text-primary">后台页面不存在</div>
      </AdminLayout>
    );
  }

  const section = (route.adminSection || 'dashboard') as AdminSection;
  let body = <DashboardView navigate={navigate} />;
  if (section === 'profile') body = <ProfileView />;
  else if (section === 'visuals') body = <VisualsView />;
  else if (section === 'resume') body = <ResumeView />;
  else if (section === 'media') body = <MediaView />;
  else if (section === 'settings') body = <SettingsView />;
  else if (section === 'audit') body = <AuditView />;
  else if (section in entityConfig) body = <ContentManager section={section as EntitySection} />;

  return (
    <AdminLayout section={section} navigate={navigate}>
      {body}
    </AdminLayout>
  );
}

export function AdminApp({ route, navigate }: { route: AppRoute; navigate: (to: string) => void }) {
  const onUnauthorized = useMemo(() => () => navigate('/admin/login'), [navigate]);
  return (
    <AdminAuthProvider onUnauthorized={onUnauthorized}>
      <GuardedAdmin route={route} navigate={navigate} />
    </AdminAuthProvider>
  );
}
