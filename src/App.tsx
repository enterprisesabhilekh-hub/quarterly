import React, { useEffect, useState } from 'react';
import {
  Bell,
  Building2,
  ClipboardList,
  Globe,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Table2,
  X,
} from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { I18nProvider, useI18n } from './context/I18nContext.tsx';
import { LoginPage } from './components/LoginPage.tsx';
import { NvcLogo } from './components/NvcLogo.tsx';
import { DashboardView } from './components/DashboardView.tsx';
import { DataTablesView } from './components/DataTablesView.tsx';
import { OfficeDashboardView } from './components/OfficeDashboardView.tsx';
import { ReportingWizard } from './components/ReportingWizard.tsx';
import { SubmissionDetailView } from './components/SubmissionDetailView.tsx';
import { AdminConsoleView } from './components/AdminConsoleView.tsx';
import { NotificationsView } from './components/NotificationsView.tsx';
import { NotificationItem } from './types/index.ts';

type ViewMode =
  | { type: 'dashboard' }
  | { type: 'office_home' }
  | { type: 'tables' }
  | { type: 'admin' }
  | { type: 'notifications' }
  | { type: 'wizard'; submissionId: number }
  | { type: 'detail'; submissionId: number };

function MainShell() {
  const { user, logout, apiFetch } = useAuth();
  const { lang, toggleLang, t } = useI18n();

  const isOfficeUser = user?.role === 'office_user';
  const [view, setView] = useState<ViewMode>(isOfficeUser ? { type: 'office_home' } : { type: 'dashboard' });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    setView(user?.role === 'office_user' ? { type: 'office_home' } : { type: 'dashboard' });
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    apiFetch<{ notifications: NotificationItem[] }>('/api/notifications')
      .then((d) => setUnreadCount(d.notifications.filter((n) => !n.is_read).length))
      .catch(() => {});
  }, [user, view.type]);

  if (!user) return <LoginPage />;

  const navItems: Array<{
    id: ViewMode['type'];
    np: string;
    en: string;
    Icon: React.FC<{ className?: string }>;
    visible: boolean;
  }> = [
    {
      id: 'office_home',
      np: 'मेरो कार्यालय ड्यासबोर्ड',
      en: 'My Office Dashboard',
      Icon: Building2,
      visible: isOfficeUser,
    },
    {
      id: 'dashboard',
      np: 'राष्ट्रिय अनुगमन ड्यासबोर्ड',
      en: 'NVC Monitoring Dashboard',
      Icon: LayoutDashboard,
      visible: !isOfficeUser,
    },
    {
      id: 'tables',
      np: '१२ प्रतिवेदन तालिका र निर्यात',
      en: '12 Data Tables & Export',
      Icon: Table2,
      visible: !isOfficeUser,
    },
    {
      id: 'admin',
      np: 'प्रशासन र मास्टर डाटा',
      en: 'Admin & Master Data',
      Icon: Settings,
      visible: user.role === 'super_admin' || user.role === 'nvc_admin',
    },
    {
      id: 'notifications',
      np: 'सूचना तथा पासवर्ड',
      en: 'Notifications & Account',
      Icon: Bell,
      visible: true,
    },
  ];

  const navigate = (next: ViewMode) => {
    setView(next);
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#F4F6F9] flex flex-col lg:flex-row">
      {/* Sidebar */}
      <aside
        className={`no-print fixed lg:static inset-y-0 left-0 z-40 w-[264px] bg-[#0F294D] text-white flex flex-col shrink-0 transition-transform duration-200 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="p-4 border-b border-white/10 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <NvcLogo size={38} />
            <div className="min-w-0">
              <p className="text-[11px] text-slate-300 truncate">{t('नेपाल सरकार', 'Govt. of Nepal')}</p>
              <h1 className="text-sm font-bold text-white truncate">{t('राष्ट्रिय सतर्कता केन्द्र', 'National Vigilance Center')}</h1>
            </div>
          </div>
          <button type="button" onClick={() => setMobileMenuOpen(false)} className="lg:hidden p-1 text-slate-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-4 py-3 border-b border-white/10 bg-white/5">
          <p className="text-xs font-bold text-white truncate">{lang === 'ne' ? user.full_name_np : user.full_name_en}</p>
          <p className="text-[11px] text-slate-300 truncate">{lang === 'ne' ? user.role_name_np : user.role_name_en}</p>
          {user.offices[0] && (
            <p className="text-[11px] text-amber-200 truncate mt-0.5">{user.offices[0].office_name_np}</p>
          )}
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems
            .filter((item) => item.visible)
            .map((item) => {
              const active = view.type === item.id;
              const Icon = item.Icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigate({ type: item.id } as ViewMode)}
                  className={`w-full flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-md text-xs font-semibold transition-colors text-left ${
                    active ? 'bg-white text-[#0F294D]' : 'text-slate-200 hover:bg-white/10'
                  }`}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{lang === 'ne' ? item.np : item.en}</span>
                  </span>
                  {item.id === 'notifications' && unreadCount > 0 && (
                    <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-[#B91C1C] text-white tabular-nums">
                      {unreadCount}
                    </span>
                  )}
                </button>
              );
            })}

          {view.type === 'wizard' && (
            <div className="mt-4 px-3 py-2 rounded bg-white/10 text-[11px] text-slate-200 flex items-center gap-2">
              <ClipboardList className="w-4 h-4 shrink-0" />
              <span className="truncate">{t('त्रैमासिक प्रतिवेदन फारम सक्रिय', 'Reporting Form Active')}</span>
            </div>
          )}
        </nav>

        <div className="p-3 border-t border-white/10 space-y-2">
          <button
            type="button"
            onClick={toggleLang}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium bg-white/10 hover:bg-white/15 rounded-md text-white"
          >
            <Globe className="w-3.5 h-3.5" />
            {lang === 'ne' ? 'Switch to English' : 'नेपाली भाषामा हेर्नुहोस्'}
          </button>
          <button
            type="button"
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium border border-white/20 hover:bg-red-700/80 rounded-md text-white"
          >
            <LogOut className="w-3.5 h-3.5" />
            {t('बाहिर निस्कनुहोस् (Logout)', 'Sign Out')}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="no-print bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-1.5 rounded border border-slate-200 text-slate-700"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <p className="text-xs font-bold text-[#0F294D] truncate">
                {t(
                  'सरकारी कार्यालयमा प्रयोग हुने निवेदनको ढाँचा तथा सोको कार्यान्वयन मार्गदर्शन, २०८३',
                  'Application Format & Implementation Directive Monitoring System, 2083'
                )}
              </p>
              <p className="text-[11px] text-slate-500 truncate">
                {t('त्रैमासिक प्रगति प्रतिवेदन, अनुगमन तथा विश्लेषण प्रणाली', 'Quarterly Progress Reporting, Monitoring & Analytics Platform')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => navigate({ type: 'notifications' })}
              className="relative p-2 rounded-md border border-slate-200 hover:bg-slate-50 text-slate-700"
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 px-1 text-[10px] font-bold bg-[#B91C1C] text-white rounded">
                  {unreadCount}
                </span>
              )}
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 max-w-[1440px] w-full mx-auto">
          {view.type === 'dashboard' && (
            <DashboardView onOpenSubmission={(id) => navigate({ type: 'detail', submissionId: id })} />
          )}
          {view.type === 'office_home' && (
            <OfficeDashboardView
              onOpenWizard={(id) => navigate({ type: 'wizard', submissionId: id })}
              onViewDetail={(id) => navigate({ type: 'detail', submissionId: id })}
            />
          )}
          {view.type === 'tables' && (
            <DataTablesView onOpenSubmission={(id) => navigate({ type: 'detail', submissionId: id })} />
          )}
          {view.type === 'admin' && <AdminConsoleView />}
          {view.type === 'notifications' && (
            <NotificationsView onOpenSubmission={(id) => navigate({ type: 'detail', submissionId: id })} />
          )}
          {view.type === 'wizard' && (
            <ReportingWizard
              submissionId={view.submissionId}
              onBack={() => navigate(isOfficeUser ? { type: 'office_home' } : { type: 'dashboard' })}
              onSubmitted={(sub) => navigate({ type: 'detail', submissionId: sub.id })}
            />
          )}
          {view.type === 'detail' && (
            <SubmissionDetailView
              submissionId={view.submissionId}
              onBack={() => navigate(isOfficeUser ? { type: 'office_home' } : { type: 'dashboard' })}
              onEditForm={(id) => navigate({ type: 'wizard', submissionId: id })}
            />
          )}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <AuthProvider>
        <MainShell />
      </AuthProvider>
    </I18nProvider>
  );
}
