// Auth context: tracks the Firebase user and a fresh ID token for API calls.
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { onAuthStateChanged, signOut as fbSignOut, type User } from 'firebase/auth';
import { auth } from '../lib/firebase';

interface AuthState {
  user: User | null;
  loading: boolean;
  /** Returns a current ID token (refreshed by the SDK as needed). */
  getToken: () => Promise<string | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  const value: AuthState = {
    user,
    loading,
    getToken: async () => (auth.currentUser ? auth.currentUser.getIdToken() : null),
    signOut: () => fbSignOut(auth),
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
