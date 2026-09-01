import { useState, useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  Smartphone,
  MessageSquare,
  Webhook,
  Key,
  FileText,
  ClipboardList,
  LogOut,
  Send,
  Server,
  Puzzle,
  Sun,
  Moon,
  Monitor,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  Users as UsersIcon,
  CreditCard,
} from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import { type UserRole } from '../hooks/useRole';
import { healthApi } from '../services/api';
import './Layout.css';

interface LayoutProps {
  onLogout: () => void;
  userRole: UserRole | null;
}

const allNavItems = [
  { to: '/', icon: LayoutDashboard, key: 'dashboard' as const, adminOnly: false },
  { to: '/sessions', icon: Smartphone, key: 'sessions' as const, adminOnly: false },
  { to: '/chats', icon: MessageSquare, key: 'chats' as const, adminOnly: false },
  { to: '/webhooks', icon: Webhook, key: 'webhooks' as const, adminOnly: false },
  { to: '/templates', icon: ClipboardList, key: 'templates' as const, adminOnly: false },
  { to: '/users', icon: UsersIcon, key: 'users' as const, defaultLabel: 'Users', adminOnly: true },
  { to: '/subscription', icon: CreditCard, key: 'subscription' as const, defaultLabel: 'Subscription', adminOnly: false },
  { to: '/api-keys', icon: Key, key: 'apiKeys' as const, defaultLabel: 'API Keys', adminOnly: false },
  { to: '/message-tester', icon: Send, key: 'messageTester' as const, adminOnly: false },
  { to: '/infrastructure', icon: Server, key: 'infrastructure' as const, adminOnly: true },
  { to: '/plugins', icon: Puzzle, key: 'plugins' as const, adminOnly: true },
  { to: '/logs', icon: FileText, key: 'logs' as const, adminOnly: false },
];

const themeIcons = { light: Sun, dark: Moon, system: Monitor };

export function Layout({ onLogout, userRole }: LayoutProps) {
  const { t } = useTranslation();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const ThemeIcon = themeIcons[theme];
  const themeLabel = t(`theme.${theme}`);

  const navItems = allNavItems.filter(item => !item.adminOnly || userRole === 'admin');

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  // Show the build-time version immediately, then replace it with the live running version from the
  // backend so a stale-built bundle can't display the wrong number. Falls back silently on error.
  const [version, setVersion] = useState(__APP_VERSION__);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) setIsMobileOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    let active = true;
    healthApi
      .check()
      .then(info => {
        if (active && info?.version) setVersion(info.version);
      })
      .catch(() => {
        /* keep the build-time fallback */
      });
    return () => {
      active = false;
    };
  }, []);

  const handleNavClick = () => {
    if (isMobile) setIsMobileOpen(false);
  };

  useEffect(() => {
    document.body.style.overflow = isMobileOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileOpen]);

  const toggleCollapse = () => setIsCollapsed(!isCollapsed);
  const toggleMobile = () => setIsMobileOpen(!isMobileOpen);

  return (
    <div className="layout">
      {isMobile && (
        <header className="mobile-header">
          <button className="mobile-menu-btn" onClick={toggleMobile} aria-label={t('common.expand')}>
            {isMobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
          <div className="mobile-brand">
            <img src="/openwa_logo.webp" alt="OpenWA" className="sidebar-logo" />
            <span className="brand-name">{t('common.appName')}</span>
          </div>
          <div style={{ width: 40 }} />
        </header>
      )}

      {isMobile && isMobileOpen && <div className="sidebar-overlay" onClick={() => setIsMobileOpen(false)} />}

      <aside
        className={`sidebar ${isCollapsed ? 'collapsed' : ''} ${isMobile ? 'mobile' : ''} ${isMobileOpen ? 'open' : ''}`}
      >
        <div className="sidebar-header">
          <img src="/openwa_logo.webp" alt="OpenWA" className="sidebar-logo" />
          {!isCollapsed && (
            <div className="sidebar-brand">
              <span className="brand-name">{t('common.appName')}</span>
              <span className="brand-version">v{version}</span>
            </div>
          )}
        </div>

        {!isMobile && (
          <button
            className="collapse-toggle"
            onClick={toggleCollapse}
            title={isCollapsed ? t('common.expand') : t('common.collapse')}
            aria-label={isCollapsed ? t('common.expand') : t('common.collapse')}
          >
            {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        )}

        <nav className="sidebar-nav">
          {navItems.map(({ to, icon: Icon, key }) => {
            const label = t(`nav.${key}`, key === 'users' ? 'Users' : key === 'subscription' ? 'Subscription' : key);
            return (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                end={to === '/'}
                onClick={handleNavClick}
                title={isCollapsed ? label : undefined}
              >
                <Icon size={20} />
                {!isCollapsed && <span>{label}</span>}
              </NavLink>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="appearance-menu">
            <button
              className="theme-toggle-btn"
              onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
              title={t('theme.toggleTo', { value: t(resolvedTheme === 'dark' ? 'theme.light' : 'theme.dark') })}
              aria-label={t('theme.toggleTo', { value: t(resolvedTheme === 'dark' ? 'theme.light' : 'theme.dark') })}
            >
              <span className="appearance-button-cue" aria-hidden="true">
                <ThemeIcon size={16} />
              </span>
              {!isCollapsed && <span>{themeLabel}</span>}
            </button>
          </div>
          <button className="logout-btn" onClick={onLogout} title={isCollapsed ? t('common.logout') : undefined}>
            <LogOut size={20} />
            {!isCollapsed && <span>{t('common.logout')}</span>}
          </button>
        </div>
      </aside>

      <main className={`main-content ${isCollapsed ? 'expanded' : ''} ${isMobile ? 'mobile' : ''}`}>
        <Outlet />
      </main>
    </div>
  );
}
