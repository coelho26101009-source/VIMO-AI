import React from 'react';
import { LogIn, UserCircle2 } from 'lucide-react';
import { VimoAvatar } from './VimoAvatar';

interface LoginScreenProps {
  onLogin: () => void;
  onGuest: () => void;
  isAuthBusy?: boolean;
  authError?: string | null;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin, onGuest, isAuthBusy = false, authError = null }) => {
  return (
    <div
      className="flex flex-col items-center justify-center h-screen w-full relative overflow-hidden"
      style={{ background: 'linear-gradient(160deg, #130d2e 0%, #0b0b1a 50%, #0e0b1f 100%)' }}
    >
      {/* Background glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 pointer-events-none"
        style={{ width: 600, height: 400, background: 'radial-gradient(ellipse, rgba(124,58,237,0.12) 0%, transparent 70%)', filter: 'blur(40px)' }} />
      <div className="absolute bottom-0 right-0 pointer-events-none"
        style={{ width: 400, height: 300, background: 'radial-gradient(ellipse, rgba(236,72,153,0.06) 0%, transparent 70%)', filter: 'blur(60px)' }} />

      <div className="relative z-10 flex flex-col items-center w-full max-w-sm px-6">
        {/* Avatar */}
        <div className="mb-6">
          <VimoAvatar size={72} isConnected={true} isSpeaking={false} />
        </div>

        {/* Title */}
        <h1
          className="text-4xl font-black tracking-widest mb-1"
          style={{
            background: 'linear-gradient(135deg, #a855f7, #818cf8, #ec4899)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            filter: 'drop-shadow(0 0 24px rgba(168,85,247,0.4))',
          }}
        >
          VimoMind AI
        </h1>
        <p className="text-xs uppercase tracking-[0.35em] mb-10"
          style={{ color: 'rgba(168,85,247,0.45)' }}>
          Inteligência Artificial Avançada
        </p>

        {/* Buttons */}
        <div className="w-full flex flex-col gap-3">
          <button
            onClick={onLogin}
            disabled={isAuthBusy}
            className="w-full flex items-center justify-center gap-3 py-3.5 px-6 rounded-2xl font-semibold text-sm text-white transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
            style={{
              background: 'linear-gradient(135deg, #7c3aed, #6366f1)',
              boxShadow: '0 4px 24px rgba(124,58,237,0.35)',
            }}
            onMouseEnter={e => { if (!isAuthBusy) { e.currentTarget.style.boxShadow = '0 6px 32px rgba(124,58,237,0.55)'; e.currentTarget.style.transform = 'translateY(-1px)'; } }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 4px 24px rgba(124,58,237,0.35)'; e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            <LogIn size={16} />
            {isAuthBusy ? 'A abrir login…' : 'Entrar com Google'}
          </button>

          {authError && (
            <div
              className="px-4 py-3 rounded-2xl text-xs leading-relaxed"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)', color: 'rgba(254,226,226,0.9)' }}
            >
              {authError}
            </div>
          )}

          <div className="flex items-center gap-3 my-1">
            <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>ou</span>
            <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
          </div>

          <button
            onClick={onGuest}
            disabled={isAuthBusy}
            className="w-full flex items-center justify-center gap-3 py-3.5 px-6 rounded-2xl font-medium text-sm transition-all duration-200"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: 'rgba(255,255,255,0.45)',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(124,58,237,0.08)'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; e.currentTarget.style.borderColor = 'rgba(139,92,246,0.2)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = 'rgba(255,255,255,0.45)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
          >
            <UserCircle2 size={16} />
            Continuar sem conta
          </button>
        </div>

        <p className="text-xs mt-6 text-center leading-relaxed" style={{ color: 'rgba(255,255,255,0.15)' }}>
          Sem conta, o histórico de conversas não é guardado.
        </p>
      </div>
    </div>
  );
};
