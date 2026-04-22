import { useState, useEffect } from 'react';
import type { User } from 'firebase/auth';
import { signInWithPopup, signInWithRedirect, signOut, onAuthStateChanged } from 'firebase/auth';
import { auth, googleProvider } from '../firebase';

// 'loading'        — Firebase ainda a verificar
// 'unauthenticated' — sem user, ainda não escolheu guest
// 'guest'          — escolheu continuar sem conta
// 'user'           — autenticado com Google
export type AuthMode = 'loading' | 'unauthenticated' | 'guest' | 'user';

export const useAuth = () => {
  const [user, setUser]         = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>('loading');
  const [isAuthBusy, setIsAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

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
    if (isAuthBusy) return;
    try {
      setAuthError(null);
      setIsAuthBusy(true);
      // signInWithPopup dispara o onAuthStateChanged automaticamente
      await signInWithPopup(auth, googleProvider);
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };
      const code = err?.code;

      // Popup bloqueado/fechado/cancelado: tenta redirect (mais fiável)
      if (
        code === 'auth/popup-blocked' ||
        code === 'auth/popup-closed-by-user' ||
        code === 'auth/cancelled-popup-request'
      ) {
        try {
          await signInWithRedirect(auth, googleProvider);
          return;
        } catch (redirectError) {
          console.error('Erro no login por redirect:', redirectError);
          setAuthError('Não foi possível abrir o login. Verifica permissões do browser e tenta novamente.');
          return;
        }
      }

      if (code === 'auth/unauthorized-domain') {
        setAuthError('Domínio não autorizado no Firebase Auth. Tens de adicionar este domínio em Authentication → Settings → Authorized domains.');
      } else if (code === 'auth/network-request-failed') {
        setAuthError('Falha de rede ao iniciar sessão. Verifica a internet e tenta novamente.');
      } else {
        setAuthError('Falha ao iniciar sessão com Google. Tenta novamente.');
        console.error('Erro ao fazer login:', error);
      }
    } finally {
      setIsAuthBusy(false);
    }
  };

  const logout = async () => {
    if (isAuthBusy) return;
    try {
      setAuthError(null);
      setIsAuthBusy(true);
      await signOut(auth);
      // Após logout volta ao ecrã de login
      setAuthMode('unauthenticated');
    } catch (error) {
      console.error('Erro ao terminar sessão:', error);
    } finally {
      setIsAuthBusy(false);
    }
  };

  const continueAsGuest = () => {
    setAuthMode('guest');
  };

  return { user, authMode, isAuthBusy, authError, login, logout, continueAsGuest, clearAuthError: () => setAuthError(null) };
};
