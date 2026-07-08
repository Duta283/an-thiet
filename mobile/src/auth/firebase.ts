import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp } from 'firebase/app';
import {
  Auth,
  createUserWithEmailAndPassword,
  initializeAuth,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  User,
  // @ts-ignore — export chỉ có trong bundle react-native của firebase/auth
  getReactNativePersistence,
} from 'firebase/auth';
import { AUTH_MODE, FIREBASE_CONFIG } from '../config';

/**
 * Firebase Auth (Sprint 4) — email/password trước;
 * thêm OTP số điện thoại / Google Sign-In sau, backend không đổi
 * (backend chỉ verify ID token, không quan tâm phương thức đăng nhập).
 */

let auth: Auth | null = null;

export function getFirebaseAuth(): Auth {
  if (!auth) {
    const app = initializeApp(FIREBASE_CONFIG);
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  }
  return auth;
}

export function isFirebaseMode(): boolean {
  return AUTH_MODE === 'firebase';
}

export async function emailSignIn(email: string, password: string): Promise<User> {
  const cred = await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
  return cred.user;
}

export async function emailSignUp(
  email: string,
  password: string,
  displayName: string,
): Promise<User> {
  const cred = await createUserWithEmailAndPassword(
    getFirebaseAuth(),
    email,
    password,
  );
  await updateProfile(cred.user, { displayName });
  return cred.user;
}

export function firebaseSignOut(): Promise<void> {
  return signOut(getFirebaseAuth());
}
