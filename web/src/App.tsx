import { ChatPanel } from '@/components/ChatPanel';
import { Navbar, SiteFooter } from '@/components/Navbar';
import { ChatProvider } from '@/hooks/useChat';
import { ContentProvider } from '@/hooks/useContent';
import { PreferencesProvider } from '@/hooks/usePreferences';
import { useRouter } from '@/hooks/useRouter';
import { DetailView } from '@/views/DetailView';
import { HomeView } from '@/views/HomeView';

function AppShell() {
  const { route, navigate, switchLocale } = useRouter();

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
                  kind={route.kind}
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

export default function App() {
  return <AppShell />;
}
