import { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Icon } from './ui.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../lib/api.js';

const NAV = [
  { to: '/chat', icon: 'forum', label: 'AI Assistant' },
  { to: '/dashboard', icon: 'monitoring', label: 'Boshqaruv paneli' },
  { to: '/models', icon: 'network_intelligence', label: 'Model Studio' },
  { to: '/knowledge', icon: 'library_books', label: 'Bilimlar bazasi' },
  { to: '/security', icon: 'shield', label: 'Xavfsizlik monitori' },
  { to: '/agents', icon: 'hub', label: 'Agent to\u2018dasi' },
  { to: '/audit', icon: 'receipt_long', label: 'Audit jurnali' },
  { to: '/users', icon: 'group', label: 'Foydalanuvchilar', roles: ['super_admin', 'security_analyst'] },
  { to: '/settings', icon: 'settings', label: 'Sozlamalar' },
];

const ROLE_LABEL = {
  super_admin: 'Super administrator',
  ai_engineer: 'AI muhandis',
  security_analyst: 'Xavfsizlik tahlilchisi',
  member: 'Xodim',
};

export default function Shell({ children }) {
  const { theme, toggle } = useTheme();
  const { user, logout } = useAuth();
  const [drawer, setDrawer] = useState(false);
  const [menu, setMenu] = useState(false);
  const [health, setHealth] = useState(null);
  const nav = useNavigate();
  const loc = useLocation();

  useEffect(() => setDrawer(false), [loc.pathname]);

  useEffect(() => {
    const load = () => api.get('/health').then(setHealth).catch(() => {});
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, []);

  const items = NAV.filter((n) => !n.roles || n.roles.includes(user?.role));

  return (
    <div className="h-full flex bg-background">
      {/* Yon panel */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-sidebar shrink-0 flex flex-col
          bg-surface-container-low border-r border-outline-variant/60
          transition-transform duration-200 ${drawer ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        <div className="flex items-center gap-2.5 h-14 px-4 border-b border-outline-variant/60">
          <div className="w-8 h-8 rounded bg-primary/15 border border-primary/30 flex items-center justify-center">
            <Icon name="graph_3" size={18} className="text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-body-md font-semibold leading-tight truncate">NexusAI</p>
            <p className="text-label-sm text-on-surface-variant">Enterprise v4.2</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {items.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                `flex items-center gap-3 h-10 px-3 rounded text-body-md transition-colors ${
                  isActive
                    ? 'bg-primary/12 text-primary font-medium'
                    : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon name={n.icon} size={20} fill={isActive} />
                  <span className="truncate">{n.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="p-2 border-t border-outline-variant/60">
          <div className="flex items-center justify-between px-3 py-2 rounded bg-surface-container text-body-sm">
            <span className="flex items-center gap-2 text-on-surface-variant">
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: health ? 'rgb(var(--tertiary))' : 'rgb(var(--error))' }}
              />
              {health ? 'Tizim faol' : 'Server ulanmagan'}
            </span>
            {health && <span className="font-mono text-label-sm text-tertiary">{health.ai?.provider}</span>}
          </div>
        </div>
      </aside>

      {drawer && <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setDrawer(false)} />}

      {/* Asosiy ustun */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 shrink-0 flex items-center gap-2 px-3 lg:px-5 border-b border-outline-variant/60 bg-surface-container-low/80 backdrop-blur">
          <button className="btn-ghost btn-sm px-2 lg:hidden" onClick={() => setDrawer(true)} aria-label="Menyu">
            <Icon name="menu" size={20} />
          </button>

          <p className="text-body-md font-medium truncate">
            {items.find((n) => loc.pathname.startsWith(n.to))?.label ?? 'NexusAI'}
          </p>

          <div className="ml-auto flex items-center gap-1.5">
            <span className="hidden md:inline-flex chip-ok">
              <Icon name="lock" size={12} /> TLS 1.3
            </span>

            <button
              className="btn-ghost btn-sm px-2"
              onClick={toggle}
              aria-label={theme === 'dark' ? 'Yorug\u2018 rejimga o\u2018tish' : 'Qorong\u2018i rejimga o\u2018tish'}
              title={theme === 'dark' ? 'Yorug\u2018 rejim' : 'Qorong\u2018i rejim'}
            >
              <Icon name={theme === 'dark' ? 'light_mode' : 'dark_mode'} size={20} />
            </button>

            <div className="relative">
              <button
                className="flex items-center gap-2 h-9 pl-1.5 pr-2 rounded hover:bg-surface-container-high transition-colors"
                onClick={() => setMenu((m) => !m)}
              >
                <span className="w-7 h-7 rounded-full bg-primary/20 text-primary flex items-center justify-center text-label-sm font-semibold">
                  {(user?.name ?? '?').split(' ').map((w) => w[0]).slice(0, 2).join('')}
                </span>
                <span className="hidden sm:block text-left leading-tight">
                  <span className="block text-body-sm font-medium">{user?.name}</span>
                  <span className="block text-label-sm text-on-surface-variant">{ROLE_LABEL[user?.role]}</span>
                </span>
                <Icon name="expand_more" size={16} className="text-on-surface-variant" />
              </button>

              {menu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenu(false)} />
                  <div className="absolute right-0 top-11 z-50 w-60 card shadow-level3 p-1.5 animate-fade-up">
                    <div className="px-2.5 py-2 border-b border-outline-variant/60 mb-1">
                      <p className="text-body-sm font-medium truncate">{user?.email}</p>
                      <p className="meta text-label-sm mt-0.5">{user?.department || 'Bo\u2018lim ko\u2018rsatilmagan'}</p>
                    </div>
                    {user?.twofa_enabled ? (
                      <p className="px-2.5 py-1.5 text-label-sm text-tertiary flex items-center gap-1.5">
                        <Icon name="verified_user" size={14} /> 2FA yoqilgan ({user.twofa_method})
                      </p>
                    ) : (
                      <p className="px-2.5 py-1.5 text-label-sm text-warning flex items-center gap-1.5">
                        <Icon name="warning" size={14} /> 2FA yoqilmagan
                      </p>
                    )}
                    <button
                      className="w-full text-left px-2.5 py-2 rounded text-body-sm hover:bg-surface-container-high"
                      onClick={() => { setMenu(false); nav('/settings'); }}
                    >
                      Profil va sozlamalar
                    </button>
                    <button
                      className="w-full text-left px-2.5 py-2 rounded text-body-sm text-error hover:bg-error/10"
                      onClick={() => { logout(); nav('/login'); }}
                    >
                      Hisobdan chiqish
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 min-h-0 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
