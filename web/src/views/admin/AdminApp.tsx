import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Field, LocalizedField, emptyLocalized, inputClass } from '@/components/admin/forms';
import { AdminAuthProvider, useAdminAuth } from '@/hooks/useAdminAuth';
import type { AdminSection, AppRoute } from '@/hooks/useRouter';
import { adminFetch, uploadFile } from '@/lib/adminApi';
import type {
  AdminAuditItem,
  AdminSessionItem,
  AdminStats,
  Education,
  Experience,
  Honor,
  Localized,
  Profile,
  Project,
  ResumeSettings,
  TimelineEvent,
} from '@/types';

function LoginView({ navigate }: { navigate: (to: string) => void }) {
  const { login, error, user, loading } = useAdminAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate('/admin');
  }, [loading, navigate, user]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await login(email, password);
      navigate('/admin');
    } catch {
      // error shown via context
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-4 text-[#E1E0CC]">
      <form onSubmit={onSubmit} className="w-full max-w-md rounded-3xl bg-[#101010] p-8">
        <h1 className="text-2xl font-normal text-primary">管理员登录</h1>
        <p className="mt-2 text-sm text-gray-500">登录后可自行修改个人站全部内容。</p>
        <div className="mt-6 space-y-4">
          <Field label="邮箱">
            <input className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
          </Field>
          <Field label="密码">
            <input className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} type="password" required />
          </Field>
        </div>
        {error ? <p className="mt-4 text-xs text-rose-400">{error}</p> : null}
        <button
          type="submit"
          disabled={busy}
          className="mt-6 w-full rounded-full bg-primary px-4 py-3 text-sm font-medium text-black disabled:opacity-50"
        >
          {busy ? '登录中…' : '登录'}
        </button>
      </form>
    </div>
  );
}

function DashboardView() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [audit, setAudit] = useState<AdminAuditItem[]>([]);

  useEffect(() => {
    void adminFetch<AdminStats>('/api/admin/stats').then(setStats);
    void adminFetch<AdminAuditItem[]>('/api/admin/audit').then((items) => setAudit(items.slice(0, 8)));
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl text-primary">仪表盘</h1>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Object.entries(stats || {}).map(([key, value]) => (
          <div key={key} className="rounded-2xl bg-[#212121] p-5">
            <div className="text-xs uppercase tracking-wide text-gray-500">{key}</div>
            <div className="mt-2 text-3xl text-[#E1E0CC]">{value}</div>
          </div>
        ))}
      </div>
      <section className="rounded-2xl bg-[#101010] p-5">
        <h2 className="text-lg text-primary">最近审计</h2>
        <div className="mt-4 space-y-2">
          {audit.map((item) => (
            <div key={item.id} className="rounded-xl bg-[#212121] px-4 py-3 text-sm">
              <div className="text-[#E1E0CC]">{item.action}</div>
              <div className="text-xs text-gray-500">
                {item.target || '—'} · {new Date(item.createdAt).toLocaleString()}
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
      const next = await adminFetch<Profile>('/api/admin/profile', {
        method: 'PUT',
        body: JSON.stringify(profile),
      }, true);
      setProfile(next);
      setMessage('已保存');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function onAvatar(file: File | null) {
    if (!file || !profile) return;
    const url = await uploadFile(file, 'avatars');
    setProfile({ ...profile, avatarUrl: url });
  }

  if (!profile) return <div className="text-sm text-gray-500">加载中…</div>;

  return (
    <div className="space-y-5">
      <h1 className="text-3xl text-primary">个人资料</h1>
      <div className="grid gap-4 rounded-2xl bg-[#101010] p-5 md:grid-cols-2">
        <Field label="中文名">
          <input className={inputClass} value={profile.nameZh} onChange={(e) => setProfile({ ...profile, nameZh: e.target.value })} />
        </Field>
        <Field label="英文名">
          <input className={inputClass} value={profile.nameEn} onChange={(e) => setProfile({ ...profile, nameEn: e.target.value })} />
        </Field>
        <Field label="Handle">
          <input className={inputClass} value={profile.handle} onChange={(e) => setProfile({ ...profile, handle: e.target.value })} />
        </Field>
        <Field label="头像 URL / 上传">
          <input type="file" accept="image/*" onChange={(e) => void onAvatar(e.target.files?.[0] || null)} />
          <input className={`${inputClass} mt-2`} value={profile.avatarUrl || ''} onChange={(e) => setProfile({ ...profile, avatarUrl: e.target.value })} />
        </Field>
      </div>
      <div className="space-y-4 rounded-2xl bg-[#101010] p-5">
        <LocalizedField label="角色" value={profile.role} onChange={(role) => setProfile({ ...profile, role })} />
        <LocalizedField label="Slogan" value={profile.slogan} onChange={(slogan) => setProfile({ ...profile, slogan })} />
        <LocalizedField label="简介" value={profile.bio} rows={4} onChange={(bio) => setProfile({ ...profile, bio })} />
        <Field label="GitHub href">
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
      <button type="button" onClick={() => void save()} className="rounded-full bg-primary px-5 py-3 text-sm font-medium text-black">
        保存资料
      </button>
    </div>
  );
}

function EntityListPage<T extends { id?: string }>({
  title,
  path,
  navigate,
  section,
  renderItem,
}: {
  title: string;
  path: string;
  navigate: (to: string) => void;
  section: AdminSection;
  renderItem: (item: T) => string;
}) {
  const [items, setItems] = useState<T[]>([]);
  useEffect(() => {
    void adminFetch<T[]>(path).then(setItems);
  }, [path]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl text-primary">{title}</h1>
        <button
          type="button"
          onClick={() => navigate(`/admin/${section}/new`)}
          className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-black"
        >
          新建
        </button>
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => navigate(`/admin/${section}/${item.id}`)}
            className="block w-full rounded-2xl bg-[#212121] px-4 py-4 text-left hover:bg-[#272727]"
          >
            <div className="text-sm text-[#E1E0CC]">{renderItem(item)}</div>
            <div className="mt-1 text-xs text-gray-500">{item.id}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function ProjectEditor({ id, navigate }: { id?: string; navigate: (to: string) => void }) {
  const isNew = !id || id === 'new';
  const [item, setItem] = useState<Project>({
    slug: '',
    kind: 'engineering',
    title: emptyLocalized(),
    tagline: emptyLocalized(),
    summary: emptyLocalized(),
    tags: [],
    highlights: [],
    startedAt: '',
    displayOrder: 0,
    isPublished: true,
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isNew && id) void adminFetch<Project>(`/api/admin/projects/${id}`).then(setItem);
  }, [id, isNew]);

  async function save() {
    setError('');
    try {
      const saved = await adminFetch<Project>(
        isNew ? '/api/admin/projects' : `/api/admin/projects/${id}`,
        { method: isNew ? 'POST' : 'PUT', body: JSON.stringify(item) },
        true,
      );
      setMessage('已保存');
      if (isNew && saved.id) navigate(`/admin/projects/${saved.id}`);
      else setItem(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function remove() {
    if (isNew || !id || !window.confirm('确认删除该项目？')) return;
    await adminFetch(`/api/admin/projects/${id}`, { method: 'DELETE' }, true);
    navigate('/admin/projects');
  }

  return (
    <EditorShell title={isNew ? '新建项目' : '编辑项目'} message={message} error={error} onSave={save} onDelete={isNew ? undefined : remove} onBack={() => navigate('/admin/projects')}>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Slug"><input className={inputClass} value={item.slug} onChange={(e) => setItem({ ...item, slug: e.target.value })} /></Field>
        <Field label="Kind">
          <select className={inputClass} value={item.kind || 'engineering'} onChange={(e) => setItem({ ...item, kind: e.target.value })}>
            <option value="academic">academic</option>
            <option value="engineering">engineering</option>
          </select>
        </Field>
        <Field label="StartedAt"><input className={inputClass} value={item.startedAt} onChange={(e) => setItem({ ...item, startedAt: e.target.value })} placeholder="YYYY-MM" /></Field>
        <Field label="EndedAt"><input className={inputClass} value={item.endedAt || ''} onChange={(e) => setItem({ ...item, endedAt: e.target.value })} placeholder="YYYY-MM" /></Field>
        <Field label="DisplayOrder"><input className={inputClass} type="number" value={item.displayOrder || 0} onChange={(e) => setItem({ ...item, displayOrder: Number(e.target.value) })} /></Field>
        <Field label="Published">
          <input type="checkbox" checked={!!item.isPublished} onChange={(e) => setItem({ ...item, isPublished: e.target.checked })} />
        </Field>
      </div>
      <LocalizedField label="Title" value={item.title} onChange={(title) => setItem({ ...item, title })} />
      <LocalizedField label="Tagline" value={item.tagline} onChange={(tagline) => setItem({ ...item, tagline })} />
      <LocalizedField label="Summary" rows={4} value={item.summary} onChange={(summary) => setItem({ ...item, summary })} />
      <Field label="Tags（逗号分隔）">
        <input className={inputClass} value={item.tags.join(', ')} onChange={(e) => setItem({ ...item, tags: e.target.value.split(',').map((v) => v.trim()).filter(Boolean) })} />
      </Field>
      <LocalizedList
        label="Highlights"
        items={item.highlights}
        onChange={(highlights) => setItem({ ...item, highlights })}
      />
      <Field label="Cover URL / 上传">
        <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && void uploadFile(e.target.files[0], 'projects').then((url) => setItem({ ...item, coverUrl: url }))} />
        <input className={`${inputClass} mt-2`} value={item.coverUrl || ''} onChange={(e) => setItem({ ...item, coverUrl: e.target.value })} />
      </Field>
    </EditorShell>
  );
}

function ExperienceEditor({ id, navigate }: { id?: string; navigate: (to: string) => void }) {
  const isNew = !id || id === 'new';
  const [item, setItem] = useState<Experience>({
    slug: '',
    org: emptyLocalized(),
    role: emptyLocalized(),
    summary: emptyLocalized(),
    metrics: [],
    startedAt: '',
    displayOrder: 0,
    isPublished: true,
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isNew && id) void adminFetch<Experience>(`/api/admin/experiences/${id}`).then(setItem);
  }, [id, isNew]);

  async function save() {
    try {
      const saved = await adminFetch<Experience>(
        isNew ? '/api/admin/experiences' : `/api/admin/experiences/${id}`,
        { method: isNew ? 'POST' : 'PUT', body: JSON.stringify(item) },
        true,
      );
      setMessage('已保存');
      if (isNew && saved.id) navigate(`/admin/experiences/${saved.id}`);
      else setItem(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function remove() {
    if (isNew || !id || !window.confirm('确认删除？')) return;
    await adminFetch(`/api/admin/experiences/${id}`, { method: 'DELETE' }, true);
    navigate('/admin/experiences');
  }

  return (
    <EditorShell title={isNew ? '新建经历' : '编辑经历'} message={message} error={error} onSave={save} onDelete={isNew ? undefined : remove} onBack={() => navigate('/admin/experiences')}>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Slug"><input className={inputClass} value={item.slug} onChange={(e) => setItem({ ...item, slug: e.target.value })} /></Field>
        <Field label="StartedAt"><input className={inputClass} value={item.startedAt} onChange={(e) => setItem({ ...item, startedAt: e.target.value })} /></Field>
        <Field label="EndedAt"><input className={inputClass} value={item.endedAt || ''} onChange={(e) => setItem({ ...item, endedAt: e.target.value })} /></Field>
        <Field label="DisplayOrder"><input className={inputClass} type="number" value={item.displayOrder || 0} onChange={(e) => setItem({ ...item, displayOrder: Number(e.target.value) })} /></Field>
        <Field label="Published"><input type="checkbox" checked={!!item.isPublished} onChange={(e) => setItem({ ...item, isPublished: e.target.checked })} /></Field>
      </div>
      <LocalizedField label="Org" value={item.org} onChange={(org) => setItem({ ...item, org })} />
      <LocalizedField label="Role" value={item.role} onChange={(role) => setItem({ ...item, role })} />
      <LocalizedField label="Summary" rows={4} value={item.summary} onChange={(summary) => setItem({ ...item, summary })} />
      <LocalizedList label="Metrics" items={item.metrics} onChange={(metrics) => setItem({ ...item, metrics })} />
    </EditorShell>
  );
}

function HonorEditor({ id, navigate }: { id?: string; navigate: (to: string) => void }) {
  const isNew = !id || id === 'new';
  const [item, setItem] = useState<Honor>({
    pillar: 'wisdom',
    title: emptyLocalized(),
    story: emptyLocalized(),
    displayOrder: 0,
    isPublished: true,
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    if (!isNew && id) void adminFetch<Honor>(`/api/admin/honors/${id}`).then(setItem);
  }, [id, isNew]);

  async function save() {
    try {
      const saved = await adminFetch<Honor>(
        isNew ? '/api/admin/honors' : `/api/admin/honors/${id}`,
        { method: isNew ? 'POST' : 'PUT', body: JSON.stringify(item) },
        true,
      );
      setMessage('已保存');
      if (isNew && saved.id) navigate(`/admin/honors/${saved.id}`);
      else setItem(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function remove() {
    if (isNew || !id || !window.confirm('确认删除？')) return;
    await adminFetch(`/api/admin/honors/${id}`, { method: 'DELETE' }, true);
    navigate('/admin/honors');
  }

  return (
    <EditorShell title={isNew ? '新建荣誉' : '编辑荣誉'} message={message} error={error} onSave={save} onDelete={isNew ? undefined : remove} onBack={() => navigate('/admin/honors')}>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Pillar">
          <select className={inputClass} value={item.pillar} onChange={(e) => setItem({ ...item, pillar: e.target.value })}>
            <option value="morality">morality</option>
            <option value="wisdom">wisdom</option>
            <option value="athletics">athletics</option>
            <option value="labor">labor</option>
          </select>
        </Field>
        <Field label="DisplayOrder"><input className={inputClass} type="number" value={item.displayOrder || 0} onChange={(e) => setItem({ ...item, displayOrder: Number(e.target.value) })} /></Field>
        <Field label="Published"><input type="checkbox" checked={!!item.isPublished} onChange={(e) => setItem({ ...item, isPublished: e.target.checked })} /></Field>
      </div>
      <LocalizedField label="Title" value={item.title} onChange={(title) => setItem({ ...item, title })} />
      <LocalizedField label="Story" rows={4} value={item.story} onChange={(story) => setItem({ ...item, story })} />
    </EditorShell>
  );
}

function EducationEditor({ id, navigate }: { id?: string; navigate: (to: string) => void }) {
  const isNew = !id || id === 'new';
  const [item, setItem] = useState<Education>({
    school: emptyLocalized(),
    degree: emptyLocalized(),
    notes: emptyLocalized(),
    startedAt: '',
    displayOrder: 0,
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    if (!isNew && id) void adminFetch<Education>(`/api/admin/education/${id}`).then(setItem);
  }, [id, isNew]);

  async function save() {
    try {
      const saved = await adminFetch<Education>(
        isNew ? '/api/admin/education' : `/api/admin/education/${id}`,
        { method: isNew ? 'POST' : 'PUT', body: JSON.stringify(item) },
        true,
      );
      setMessage('已保存');
      if (isNew && saved.id) navigate(`/admin/education/${saved.id}`);
      else setItem(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function remove() {
    if (isNew || !id || !window.confirm('确认删除？')) return;
    await adminFetch(`/api/admin/education/${id}`, { method: 'DELETE' }, true);
    navigate('/admin/education');
  }

  return (
    <EditorShell title={isNew ? '新建教育' : '编辑教育'} message={message} error={error} onSave={save} onDelete={isNew ? undefined : remove} onBack={() => navigate('/admin/education')}>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="StartedAt"><input className={inputClass} value={item.startedAt} onChange={(e) => setItem({ ...item, startedAt: e.target.value })} /></Field>
        <Field label="EndedAt"><input className={inputClass} value={item.endedAt || ''} onChange={(e) => setItem({ ...item, endedAt: e.target.value })} /></Field>
        <Field label="DisplayOrder"><input className={inputClass} type="number" value={item.displayOrder || 0} onChange={(e) => setItem({ ...item, displayOrder: Number(e.target.value) })} /></Field>
      </div>
      <LocalizedField label="School" value={item.school} onChange={(school) => setItem({ ...item, school })} />
      <LocalizedField label="Degree" value={item.degree} onChange={(degree) => setItem({ ...item, degree })} />
      <LocalizedField label="Notes" rows={3} value={item.notes || emptyLocalized()} onChange={(notes) => setItem({ ...item, notes })} />
    </EditorShell>
  );
}

function TimelineEditor({ id, navigate }: { id?: string; navigate: (to: string) => void }) {
  const isNew = !id || id === 'new';
  const [item, setItem] = useState<TimelineEvent>({
    date: '',
    kind: 'project',
    title: emptyLocalized(),
    body: emptyLocalized(),
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    if (!isNew && id) void adminFetch<TimelineEvent>(`/api/admin/timeline/${id}`).then(setItem);
  }, [id, isNew]);

  async function save() {
    try {
      const saved = await adminFetch<TimelineEvent>(
        isNew ? '/api/admin/timeline' : `/api/admin/timeline/${id}`,
        { method: isNew ? 'POST' : 'PUT', body: JSON.stringify(item) },
        true,
      );
      setMessage('已保存');
      if (isNew && saved.id) navigate(`/admin/timeline/${saved.id}`);
      else setItem(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function remove() {
    if (isNew || !id || !window.confirm('确认删除？')) return;
    await adminFetch(`/api/admin/timeline/${id}`, { method: 'DELETE' }, true);
    navigate('/admin/timeline');
  }

  return (
    <EditorShell title={isNew ? '新建时间线' : '编辑时间线'} message={message} error={error} onSave={save} onDelete={isNew ? undefined : remove} onBack={() => navigate('/admin/timeline')}>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Date"><input className={inputClass} value={item.date} onChange={(e) => setItem({ ...item, date: e.target.value })} placeholder="YYYY-MM" /></Field>
        <Field label="Kind">
          <select className={inputClass} value={item.kind} onChange={(e) => setItem({ ...item, kind: e.target.value })}>
            <option value="edu">edu</option>
            <option value="work">work</option>
            <option value="project">project</option>
            <option value="honor">honor</option>
          </select>
        </Field>
      </div>
      <LocalizedField label="Title" value={item.title} onChange={(title) => setItem({ ...item, title })} />
      <LocalizedField label="Body" rows={3} value={item.body} onChange={(body) => setItem({ ...item, body })} />
    </EditorShell>
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
    try {
      const next = await adminFetch<ResumeSettings>('/api/admin/resume', {
        method: 'PUT',
        body: JSON.stringify({ url }),
      }, true);
      setResume(next);
      setMessage('简历已更新');
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function onUpload(file: File | null) {
    if (!file) return;
    if (file.type !== 'application/pdf') {
      setError('仅支持 PDF');
      return;
    }
    const url = await uploadFile(file, 'resume');
    await save(url);
  }

  return (
    <div className="space-y-5">
      <h1 className="text-3xl text-primary">简历</h1>
      <div className="rounded-2xl bg-[#101010] p-5">
        <div className="text-sm text-gray-400">当前状态：{resume?.available ? '已配置' : '未配置'}</div>
        <div className="mt-2 break-all text-sm text-[#E1E0CC]">{resume?.url || '—'}</div>
        <div className="mt-4 flex flex-wrap gap-3">
          <input type="file" accept="application/pdf" onChange={(e) => void onUpload(e.target.files?.[0] || null)} />
          <a href="/api/resume.pdf" target="_blank" rel="noreferrer" className="rounded-full border border-primary/20 px-4 py-2 text-sm text-primary">
            测试公开下载
          </a>
        </div>
        <Field label="或直接填写 URL">
          <input
            className={`${inputClass} mt-2`}
            value={resume?.url || ''}
            onChange={(e) => setResume({ ...(resume || { available: false, url: '' }), url: e.target.value })}
          />
        </Field>
        <button type="button" onClick={() => void save(resume?.url || '')} className="mt-4 rounded-full bg-primary px-4 py-2 text-sm font-medium text-black">
          保存简历 URL
        </button>
        {message ? <p className="mt-3 text-xs text-primary">{message}</p> : null}
        {error ? <p className="mt-3 text-xs text-rose-400">{error}</p> : null}
      </div>
    </div>
  );
}

function MediaView() {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  return (
    <div className="space-y-5">
      <h1 className="text-3xl text-primary">媒体上传</h1>
      <div className="rounded-2xl bg-[#101010] p-5">
        <input
          type="file"
          accept="image/*,application/pdf"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            void uploadFile(file, file.type === 'application/pdf' ? 'resume' : 'media')
              .then(setUrl)
              .catch((err) => setError(err instanceof Error ? err.message : String(err)));
          }}
        />
        {url ? <p className="mt-4 break-all text-sm text-primary">{url}</p> : null}
        {error ? <p className="mt-4 text-xs text-rose-400">{error}</p> : null}
      </div>
    </div>
  );
}

function SettingsView() {
  const [sessions, setSessions] = useState<AdminSessionItem[]>([]);
  const [password, setPassword] = useState({ currentPassword: '', newPassword: '' });
  const [email, setEmail] = useState({ currentPassword: '', newEmail: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function refreshSessions() {
    setSessions(await adminFetch<AdminSessionItem[]>('/api/admin/sessions'));
  }

  useEffect(() => {
    void refreshSessions();
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl text-primary">账户设置</h1>
      <section className="space-y-3 rounded-2xl bg-[#101010] p-5">
        <h2 className="text-lg text-primary">修改密码</h2>
        <Field label="当前密码"><input className={inputClass} type="password" value={password.currentPassword} onChange={(e) => setPassword({ ...password, currentPassword: e.target.value })} /></Field>
        <Field label="新密码"><input className={inputClass} type="password" value={password.newPassword} onChange={(e) => setPassword({ ...password, newPassword: e.target.value })} /></Field>
        <button
          type="button"
          className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-black"
          onClick={() => {
            void adminFetch('/api/admin/password', { method: 'POST', body: JSON.stringify(password) }, true)
              .then(() => setMessage('密码已更新'))
              .catch((err) => setError(err instanceof Error ? err.message : String(err)));
          }}
        >
          更新密码
        </button>
      </section>
      <section className="space-y-3 rounded-2xl bg-[#101010] p-5">
        <h2 className="text-lg text-primary">修改邮箱</h2>
        <Field label="当前密码"><input className={inputClass} type="password" value={email.currentPassword} onChange={(e) => setEmail({ ...email, currentPassword: e.target.value })} /></Field>
        <Field label="新邮箱"><input className={inputClass} type="email" value={email.newEmail} onChange={(e) => setEmail({ ...email, newEmail: e.target.value })} /></Field>
        <button
          type="button"
          className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-black"
          onClick={() => {
            void adminFetch('/api/admin/email', { method: 'PUT', body: JSON.stringify(email) }, true)
              .then(() => setMessage('邮箱已更新'))
              .catch((err) => setError(err instanceof Error ? err.message : String(err)));
          }}
        >
          更新邮箱
        </button>
      </section>
      <section className="space-y-3 rounded-2xl bg-[#101010] p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg text-primary">会话</h2>
          <button
            type="button"
            className="rounded-full border border-primary/20 px-3 py-1.5 text-xs text-primary"
            onClick={() => {
              void adminFetch('/api/admin/sessions/revoke-all', { method: 'POST' }, true).then(refreshSessions);
            }}
          >
            撤销其他会话
          </button>
        </div>
        {sessions.map((session) => (
          <div key={session.id} className="rounded-xl bg-[#212121] px-4 py-3 text-sm">
            <div className="text-[#E1E0CC]">{session.current ? '当前会话' : session.ip || 'session'}</div>
            <div className="text-xs text-gray-500">{session.userAgent}</div>
            {!session.current ? (
              <button
                type="button"
                className="mt-2 text-xs text-rose-300"
                onClick={() => {
                  void adminFetch(`/api/admin/sessions/${session.id}`, { method: 'DELETE' }, true).then(refreshSessions);
                }}
              >
                撤销
              </button>
            ) : null}
          </div>
        ))}
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
              {item.target || '—'} · {item.ip || '—'} · {new Date(item.createdAt).toLocaleString()}
            </div>
          </div>
        ))}
      </div>
      {items.length ? (
        <button
          type="button"
          className="rounded-full border border-primary/20 px-4 py-2 text-sm text-primary"
          onClick={() => void loadMore()}
        >
          加载更多
        </button>
      ) : null}
    </div>
  );
}

function LocalizedList({
  label,
  items,
  onChange,
}: {
  label: string;
  items: Localized[];
  onChange: (items: Localized[]) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs text-primary/70">{label}</div>
        <button type="button" className="text-xs text-primary" onClick={() => onChange([...items, emptyLocalized()])}>
          添加
        </button>
      </div>
      {items.map((item, index) => (
        <div key={index} className="rounded-xl border border-primary/10 p-3">
          <LocalizedField
            label={`#${index + 1}`}
            value={item}
            onChange={(next) => {
              const copy = [...items];
              copy[index] = next;
              onChange(copy);
            }}
          />
          <button type="button" className="mt-2 text-xs text-rose-300" onClick={() => onChange(items.filter((_, i) => i !== index))}>
            删除
          </button>
        </div>
      ))}
    </div>
  );
}

function EditorShell({
  title,
  children,
  message,
  error,
  onSave,
  onDelete,
  onBack,
}: {
  title: string;
  children: ReactNode;
  message: string;
  error: string;
  onSave: () => void;
  onDelete?: () => void;
  onBack: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl text-primary">{title}</h1>
        <div className="flex gap-2">
          <button type="button" onClick={onBack} className="rounded-full border border-primary/20 px-4 py-2 text-sm text-primary">
            返回
          </button>
          {onDelete ? (
            <button type="button" onClick={onDelete} className="rounded-full border border-rose-500/30 px-4 py-2 text-sm text-rose-300">
              删除
            </button>
          ) : null}
          <button type="button" onClick={onSave} className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-black">
            保存
          </button>
        </div>
      </div>
      <div className="space-y-4 rounded-2xl bg-[#101010] p-5">{children}</div>
      {message ? <p className="text-xs text-primary">{message}</p> : null}
      {error ? <p className="text-xs text-rose-400">{error}</p> : null}
    </div>
  );
}

function GuardedAdmin({
  route,
  navigate,
}: {
  route: AppRoute;
  navigate: (to: string) => void;
}) {
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
  const id = route.adminId;

  let body = <DashboardView />;
  if (section === 'profile') body = <ProfileView />;
  else if (section === 'projects' && !id) {
    body = (
      <EntityListPage<Project>
        title="项目"
        path="/api/admin/projects"
        section="projects"
        navigate={navigate}
        renderItem={(item) => item.title.zh || item.slug}
      />
    );
  } else if (section === 'projects') body = <ProjectEditor id={id} navigate={navigate} />;
  else if (section === 'experiences' && !id) {
    body = (
      <EntityListPage<Experience>
        title="经历"
        path="/api/admin/experiences"
        section="experiences"
        navigate={navigate}
        renderItem={(item) => item.org.zh || item.slug}
      />
    );
  } else if (section === 'experiences') body = <ExperienceEditor id={id} navigate={navigate} />;
  else if (section === 'honors' && !id) {
    body = (
      <EntityListPage<Honor>
        title="荣誉"
        path="/api/admin/honors"
        section="honors"
        navigate={navigate}
        renderItem={(item) => item.title.zh}
      />
    );
  } else if (section === 'honors') body = <HonorEditor id={id} navigate={navigate} />;
  else if (section === 'education' && !id) {
    body = (
      <EntityListPage<Education>
        title="教育"
        path="/api/admin/education"
        section="education"
        navigate={navigate}
        renderItem={(item) => item.school.zh}
      />
    );
  } else if (section === 'education') body = <EducationEditor id={id} navigate={navigate} />;
  else if (section === 'timeline' && !id) {
    body = (
      <EntityListPage<TimelineEvent>
        title="时间线"
        path="/api/admin/timeline"
        section="timeline"
        navigate={navigate}
        renderItem={(item) => `${item.date} · ${item.title.zh}`}
      />
    );
  } else if (section === 'timeline') body = <TimelineEditor id={id} navigate={navigate} />;
  else if (section === 'resume') body = <ResumeView />;
  else if (section === 'media') body = <MediaView />;
  else if (section === 'settings') body = <SettingsView />;
  else if (section === 'audit') body = <AuditView />;

  return (
    <AdminLayout section={section} navigate={navigate}>
      {body}
    </AdminLayout>
  );
}

export function AdminApp({
  route,
  navigate,
}: {
  route: AppRoute;
  navigate: (to: string) => void;
}) {
  const onUnauthorized = useMemo(() => () => navigate('/admin/login'), [navigate]);
  return (
    <AdminAuthProvider onUnauthorized={onUnauthorized}>
      <GuardedAdmin route={route} navigate={navigate} />
    </AdminAuthProvider>
  );
}
