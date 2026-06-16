// Auth context: tracks the Firebase user and a fresh ID token for API calls.
// Platform specifics live in lib/firebase (web) / firebase.native (iOS/Android).
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { getIdToken, signOutUser, subscribeAuth, type AppUser } from '../lib/firebase';

interface AuthState {
  user: AppUser | null;
  loading: boolean;
  /** Returns a current ID token (refreshed by the SDK as needed). */
  getToken: () => Promise<string | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return subscribeAuth((u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  const value: AuthState = {
    user,
    loading,
    getToken: getIdToken,
    signOut: signOutUser,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
