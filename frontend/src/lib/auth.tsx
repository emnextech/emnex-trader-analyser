import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { account, ID, isAppwriteConfigured } from './appwrite';

interface AuthUser {
  $id: string;
  email: string;
  name: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  configured: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    if (!isAppwriteConfigured) {
      setLoading(false);
      return;
    }
    try {
      const u = (await account.get()) as unknown as AuthUser;
      setUser(u);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function login(email: string, password: string) {
    await account.createEmailPasswordSession(email, password);
    await refresh();
  }

  async function signup(email: string, password: string, name: string) {
    await account.create(ID.unique(), email, password, name);
    await login(email, password);
  }

  async function logout() {
    try {
      await account.deleteSession('current');
    } finally {
      setUser(null);
    }
  }

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, configured: isAppwriteConfigured, login, signup, logout }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
