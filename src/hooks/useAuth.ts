import { useState, useEffect } from 'react';
import type { User } from 'firebase/auth';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { auth, googleProvider } from '../firebase';

// 'loading'        — Firebase ainda a verificar
// 'unauthenticated' — sem user, ainda não escolheu guest
// 'guest'          — escolheu continuar sem conta
// 'user'           — autenticado com Google
export type AuthMode = 'loading' | 'unauthenticated' | 'guest' | 'user';

export const useAuth = () => {
  const [user, setUser]         = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>('loading');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, currentUser => {
      if (currentUser) {
        // Utilizador autenticado com Google
        setUser(currentUser);
        setAuthMode('user');
      } else {
        // Sem sessão — mostra o ecrã de login (não vai direto a 'guest')
        setUser(null);
        setAuthMode(prev => {
          // Se já escolheu guest, mantém. Caso contrário, pede login.
          if (prev === 'guest') return 'guest';
          return 'unauthenticated';
        });
      }
    });
    return () => unsub();
  }, []);

  const login = async () => {
    try {
      // signInWithPopup dispara o onAuthStateChanged automaticamente
      await signInWithPopup(auth, googleProvider);
    } catch (error: unknown) {
      // Erros comuns: popup fechado (code: auth/popup-closed-by-user) — ignorar silenciosamente
      const code = (error as { code?: string })?.code;
      if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
        console.error('Erro ao fazer login:', error);
      }
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      // Após logout volta ao ecrã de login
      setAuthMode('unauthenticated');
    } catch (error) {
      console.error('Erro ao terminar sessão:', error);
    }
  };

  const continueAsGuest = () => {
    setAuthMode('guest');
  };

  return { user, authMode, login, logout, continueAsGuest };
};
