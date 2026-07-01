import { Link, NavLink } from 'react-router-dom';
import { Activity, LogOut } from 'lucide-react';
import { useAuth } from '../lib/auth';

const navItems = [
  { to: '/', label: 'Dashboard' },
];

export function Navbar() {
  const { user, configured, logout } = useAuth();

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/90 backdrop-blur-md">
      <div className="container-page flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="orb-accent h-9 w-9">
            <Activity className="h-5 w-5" />
          </span>
          <span className="font-display text-lg font-bold tracking-[-0.03em] text-content">
            Emnex <span className="text-brand">AI Trader</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `focus-ring rounded-full px-4 py-2 text-sm font-semibold transition ${
                  isActive ? 'text-brand-dark' : 'text-content-muted hover:text-content'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <span className="hidden text-sm font-medium text-content-muted sm:inline">
                {user.email}
              </span>
              <button
                type="button"
                onClick={() => void logout()}
                className="focus-ring inline-flex items-center gap-1.5 rounded-full border border-line px-4 py-2 text-sm font-semibold text-content hover:border-brand hover:text-brand"
              >
                <LogOut className="h-4 w-4" />
                Log out
              </button>
            </>
          ) : (
            <Link
              to="/login"
              className="focus-ring rounded-full bg-ink px-5 py-2 text-sm font-semibold text-white hover:bg-black"
            >
              {configured ? 'Log in' : 'Sign in'}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
