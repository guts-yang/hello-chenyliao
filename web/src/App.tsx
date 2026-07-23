import { ChatPanel } from '@/components/ChatPanel';
import { Navbar, SiteFooter } from '@/components/Navbar';
import { ChatProvider } from '@/hooks/useChat';
import { ContentProvider } from '@/hooks/useContent';
import { PreferencesProvider } from '@/hooks/usePreferences';
import { useRouter } from '@/hooks/useRouter';
import { AdminApp } from '@/views/admin/AdminApp';
import { DetailView } from '@/views/DetailView';
import { HomeView } from '@/views/HomeView';

export default function App() {
  const { route, navigate, switchLocale } = useRouter();

  if (route.kind.startsWith('admin')) {
    return <AdminApp route={route} navigate={navigate} />;
  }

  return (
    <PreferencesProvider locale={route.locale}>
      <ContentProvider>
        <ChatProvider>
          <div className="relative min-h-screen overflow-x-hidden bg-black text-[#E1E0CC]">
            <Navbar route={route} navigate={navigate} switchLocale={switchLocale} />
            <main>
              {route.kind === 'home' ? (
                <HomeView locale={route.locale} navigate={navigate} />
              ) : (
                <DetailView
                  locale={route.locale}
                  kind={route.kind === 'project' ? 'project' : 'experience'}
                  slug={route.slug || ''}
                  navigate={navigate}
                />
              )}
            </main>
            <SiteFooter locale={route.locale} />
            <ChatPanel locale={route.locale} />
          </div>
        </ChatProvider>
      </ContentProvider>
    </PreferencesProvider>
  );
}
