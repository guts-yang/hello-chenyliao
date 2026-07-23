import { Menu, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import type { AdminSection } from '@/hooks/useRouter';
import { cn } from '@/lib/utils';

const nav: Array<{ section: AdminSection; href: string; label: string }> = [
  { section: 'dashboard', href: '/admin', label: '仪表盘' },
  { section: 'profile', href: '/admin/profile', label: '个人资料' },
  { section: 'projects', href: '/admin/projects', label: '项目' },
  { section: 'experiences', href: '/admin/experiences', label: '经历' },
  { section: 'honors', href: '/admin/honors', label: '荣誉' },
  { section: 'education', href: '/admin/education', label: '教育' },
  { section: 'timeline', href: '/admin/timeline', label: '时间线' },
  { section: 'resume', href: '/admin/resume', label: '简历' },
  { section: 'media', href: '/admin/media', label: '媒体' },
  { section: 'settings', href: '/admin/settings', label: '账户设置' },
  { section: 'audit', href: '/admin/audit', label: '审计日志' },
];

export function AdminLayout({
  section,
  navigate,
  children,
}: {
  section: AdminSection;
  navigate: (to: string) => void;
  children: ReactNode;
}) {
  const { user, logout } = useAdminAuth();
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-black text-[#E1E0CC]">
      <div className="mx-auto flex min-h-screen max-w-7xl">
        <aside
          className={cn(
            'fixed inset-y-0 left-0 z-30 w-64 border-r border-primary/10 bg-[#101010] p-5 transition md:static md:translate-x-0',
            open ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          <div className="mb-8 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-primary">gutsyang Admin</div>
              <div className="mt-1 text-xs text-gray-500">{user?.email}</div>
            </div>
            <button type="button" className="md:hidden" onClick={() => setOpen(false)}>
              <X className="h-4 w-4" />
            </button>
          </div>
          <nav className="space-y-1">
            {nav.map((item) => (
              <button
                key={item.href}
                type="button"
                onClick={() => {
                  navigate(item.href);
                  setOpen(false);
                }}
                className={cn(
                  'block w-full rounded-xl px-3 py-2 text-left text-sm',
                  section === item.section
                    ? 'bg-[#212121] text-primary'
                    : 'text-gray-400 hover:bg-white/5 hover:text-primary',
                )}
              >
                {item.label}
              </button>
            ))}
          </nav>
          <div className="mt-8 space-y-2">
            <button
              type="button"
              onClick={() => navigate('/zh')}
              className="w-full rounded-xl border border-primary/15 px-3 py-2 text-left text-xs text-primary/80"
            >
              查看公开站
            </button>
            <button
              type="button"
              onClick={() => void logout()}
              className="w-full rounded-xl border border-rose-500/30 px-3 py-2 text-left text-xs text-rose-300"
            >
              退出登录
            </button>
          </div>
        </aside>

        <div className="flex-1">
          <header className="sticky top-0 z-20 flex items-center justify-between border-b border-primary/10 bg-black/80 px-4 py-4 backdrop-blur md:px-8">
            <button type="button" className="md:hidden" onClick={() => setOpen(true)}>
              <Menu className="h-5 w-5" />
            </button>
            <div className="text-sm text-gray-400">内容管理控制台</div>
          </header>
          <main className="px-4 py-6 md:px-8 md:py-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
