import { onIdTokenChanged, User } from 'firebase/auth';
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from 'react';
import { api, setAuthTokenGetter } from '../api/client';
import { DEV_USER_ID } from '../config';
import {
  emailSignIn,
  emailSignUp,
  firebaseSignOut,
  getFirebaseAuth,
  isFirebaseMode,
} from './firebase';

interface AuthState {
  /** users.id phía backend (không phải firebase uid) */
  userId: string | null;
  displayName: string | null;
  initializing: boolean;
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string, displayName: string): Promise<void>;
  signOut(): Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<string | null>(
    isFirebaseMode() ? null : DEV_USER_ID,
  );
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(isFirebaseMode());

  useEffect(() => {
    if (!isFirebaseMode()) return;
    // Token luôn mới — firebase tự refresh, client chỉ hỏi tại thời điểm gọi API
    setAuthTokenGetter(async () => {
      const u = getFirebaseAuth().currentUser;
      return u ? u.getIdToken() : null;
    });
    const unsub = onIdTokenChanged(getFirebaseAuth(), async (u: User | null) => {
      if (u) {
        try {
          // /auth/me auto-provision user backend lần đầu
          const me = await api.me();
          setUserId(me.id);
          setDisplayName(me.displayName);
        } catch (e) {
          console.warn('auth/me lỗi:', e);
          setUserId(null);
        }
      } else {
        setUserId(null);
        setDisplayName(null);
      }
      setInitializing(false);
    });
    return unsub;
  }, []);

  const value: AuthState = {
    userId,
    displayName,
    initializing,
    async signIn(email, password) {
      await emailSignIn(email, password);
    },
    async signUp(email, password, name) {
      await emailSignUp(email, password, name);
    },
    async signOut() {
      if (isFirebaseMode()) await firebaseSignOut();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth phải nằm trong <AuthProvider>');
  return ctx;
}
