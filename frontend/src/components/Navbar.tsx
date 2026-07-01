import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Activity, LogOut, User, LogIn } from 'lucide-react';
import { useAuth } from '../lib/auth';

const navItems = [
  { to: '/', label: 'Dashboard' },
  { to: '/scanner', label: 'Scanner' },
  { to: '/backtest', label: 'Backtest' },
];

function ProfileMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const initial = user?.email?.[0]?.toUpperCase() ?? '';

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => (user ? setOpen((v) => !v) : navigate('/login'))}
        className="focus-ring grid h-9 w-9 place-items-center rounded-full bg-ink text-sm font-bold text-white transition hover:bg-black"
        aria-label={user ? 'Account menu' : 'Sign in'}
        title={user ? user.email : 'Sign in'}
      >
        {user ? initial : <User className="h-4 w-4" />}
      </button>

      {open && user && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute right-0 z-40 mt-2 w-60 animate-fade-up overflow-hidden rounded-2xl border border-line bg-white p-1.5 shadow-soft">
            <div className="flex items-center gap-2.5 px-2.5 py-2">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-brand text-sm font-bold text-white">
                {initial}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-content">
                  {user.name || 'Trader'}
                </span>
                <span className="block truncate text-xs text-content-subtle">{user.email}</span>
              </span>
            </div>
            <div className="my-1 h-px bg-line" />
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                void logout();
              }}
              className="focus-ring flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-sm font-semibold text-content transition hover:bg-surface-muted"
            >
              <LogOut className="h-4 w-4 text-content-muted" />
              Log out
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function Navbar() {
  const { user } = useAuth();

  return (
    <header className="z-40 border-b border-line bg-white/90 backdrop-blur-md">
      <div className="flex h-14 items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="orb-accent h-9 w-9">
            <Activity className="h-5 w-5" />
          </span>
          <span className="hidden font-display text-lg font-bold tracking-[-0.03em] text-content sm:inline">
            Emnex <span className="text-brand">AI Trader</span>
          </span>
        </Link>

        <nav className="flex items-center gap-0.5 sm:gap-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `focus-ring rounded-full px-3 py-2 text-sm font-semibold transition sm:px-4 ${
                  isActive ? 'text-brand-dark' : 'text-content-muted hover:text-content'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {!user && (
            <Link
              to="/login"
              className="focus-ring hidden items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-content-muted hover:text-content sm:inline-flex"
            >
              <LogIn className="h-4 w-4" />
              Log in
            </Link>
          )}
          <ProfileMenu />
        </div>
      </div>
    </header>
  );
}
