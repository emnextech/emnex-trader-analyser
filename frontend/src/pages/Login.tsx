import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity } from 'lucide-react';
import { useAuth } from '../lib/auth';

export function Login() {
  const { login, signup, configured, user } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'signup') {
        await signup(email, password, name || email.split('@')[0]);
      } else {
        await login(email, password);
      }
      navigate('/');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication failed';
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container-page grid min-h-[70vh] place-items-center py-10">
      <div className="w-full max-w-md panel-muted p-8 shadow-card">
        <div className="mb-6 flex items-center gap-2.5">
          <span className="orb-accent h-9 w-9">
            <Activity className="h-5 w-5" />
          </span>
          <span className="font-display text-lg font-bold tracking-[-0.03em]">
            Emnex <span className="text-brand">AI Trader</span>
          </span>
        </div>

        <h1 className="display mb-1 text-2xl">
          {mode === 'login' ? 'Welcome back' : 'Create your account'}
        </h1>
        <p className="mb-6 text-sm text-content-muted">
          {mode === 'login' ? 'Log in to your workspace.' : 'Sign up to save your analysis.'}
        </p>

        {!configured && (
          <div className="mb-5 rounded-2xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
            Appwrite isn’t configured yet. Set <code>VITE_APPWRITE_ENDPOINT</code> and{' '}
            <code>VITE_APPWRITE_PROJECT_ID</code> to enable login. Charts work without it —{' '}
            <button className="link-underline text-amber-900" onClick={() => navigate('/')}>
              back to dashboard
            </button>
            .
          </div>
        )}

        {user && (
          <p className="mb-5 text-sm text-brand-dark">You’re already signed in as {user.email}.</p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <Field label="Name">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="auth-input"
                placeholder="Jane Trader"
                autoComplete="name"
              />
            </Field>
          )}
          <Field label="Email">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="auth-input"
              placeholder="you@example.com"
              autoComplete="email"
            />
          </Field>
          <Field label="Password">
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="auth-input"
              placeholder="••••••••"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </Field>

          {error && <p className="text-sm text-bear">{error}</p>}

          <button
            type="submit"
            disabled={busy || !configured}
            className="btn-primary w-full disabled:opacity-60"
          >
            {busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Sign up'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-content-muted">
          {mode === 'login' ? "Don’t have an account? " : 'Already have an account? '}
          <button
            type="button"
            className="link-underline text-brand-dark"
            onClick={() => {
              setMode(mode === 'login' ? 'signup' : 'login');
              setError(null);
            }}
          >
            {mode === 'login' ? 'Sign up' : 'Log in'}
          </button>
        </p>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-content">{label}</span>
      {children}
    </label>
  );
}
