import React from 'react';
import { Plus, MessageSquare, LogOut, LogIn, Mic, MicOff } from 'lucide-react';
import type { User } from 'firebase/auth';
import type { Chat } from '../types';
import { VimoAvatar } from './VimoAvatar';

interface SidebarProps {
  user: User | null;
  isGuest: boolean;
  chatList: Chat[];
  currentChatId: string | null;
  isConnected: boolean;
  isSpeaking: boolean;
  isListening: boolean;
  onNewChat: () => void;
  onLoadChat: (id: string) => void;
  onLogout: () => void;
  onLogin: () => void;
  onToggleMic: () => void;
  onClose?: () => void;
  isAuthBusy?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  user, isGuest, chatList, currentChatId,
  isConnected, isSpeaking, isListening,
  onNewChat, onLoadChat, onLogout, onLogin, onToggleMic,
  isAuthBusy = false,
}) => {
  return (
    <aside
      className="w-[280px] shrink-0 h-full flex flex-col border-r"
      style={{
        background: 'linear-gradient(180deg, #13132b 0%, #0e0e1e 100%)',
        borderColor: 'rgba(139,92,246,0.12)',
      }}
    >
      {/* ── Avatar + nome ── */}
      <div className="flex flex-col items-center gap-3 pt-8 pb-6 px-5">
        <VimoAvatar size={64} isConnected={isConnected} isSpeaking={isSpeaking} />
        <div className="text-center">
          <p className="text-white font-bold text-base tracking-wide">VIMO</p>
          <p className="text-[11px] text-purple-400/60 tracking-widest uppercase">V1.0</p>
        </div>
      </div>

      <div className="h-px mx-5" style={{ background: 'rgba(139,92,246,0.12)' }} />

      {/* ── Nova conversa ── */}
      <div className="px-4 pt-5">
        <button
          onClick={onNewChat}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-semibold text-sm text-white transition-all duration-200"
          style={{
            background: 'linear-gradient(135deg, #7c3aed, #6366f1)',
            boxShadow: '0 4px 20px rgba(124,58,237,0.3)',
          }}
          onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 6px 28px rgba(124,58,237,0.5)')}
          onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 4px 20px rgba(124,58,237,0.3)')}
        >
          <MessageSquare size={16} />
          Conversas
        </button>
      </div>

      <div className="px-4 pt-2">
        <button
          onClick={onNewChat}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-semibold text-sm transition-all duration-200"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(139,92,246,0.15)',
            color: 'rgba(255,255,255,0.65)',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(124,58,237,0.12)';
            e.currentTarget.style.color = 'white';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
            e.currentTarget.style.color = 'rgba(255,255,255,0.65)';
          }}
        >
          <Plus size={16} />
          Nova conversa
        </button>
      </div>

      <div className="h-px mx-5 mt-4" style={{ background: 'rgba(139,92,246,0.08)' }} />

      {/* ── Histórico ── */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1 vimo-scroll">
        {user && chatList.length > 0 && chatList.map(chat => (
          <button
            key={chat.id}
            onClick={() => onLoadChat(chat.id)}
            className="w-full text-left px-3 py-2.5 rounded-xl text-sm transition-all duration-150"
            style={{
              background: currentChatId === chat.id
                ? 'linear-gradient(135deg,rgba(124,58,237,0.2),rgba(99,102,241,0.15))'
                : 'transparent',
              border: currentChatId === chat.id
                ? '1px solid rgba(139,92,246,0.3)'
                : '1px solid transparent',
              color: currentChatId === chat.id ? '#c4b5fd' : 'rgba(255,255,255,0.4)',
            }}
          >
            <span className="truncate block">{chat.title}</span>
          </button>
        ))}

        {isGuest && (
          <div className="mt-2 p-4 rounded-2xl text-center"
            style={{ background: 'rgba(124,58,237,0.07)', border: '1px solid rgba(139,92,246,0.12)' }}>
            <p className="text-xs text-white/30 mb-3 leading-relaxed">
              Entra com a tua conta para guardar o histórico de conversas.
            </p>
            <button
              onClick={onLogin}
              disabled={isAuthBusy}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ background: 'rgba(124,58,237,0.2)', border: '1px solid rgba(139,92,246,0.3)', color: '#c4b5fd' }}
            >
              <LogIn size={13} />
              {isAuthBusy ? 'A abrir login…' : 'Entrar com Google'}
            </button>
          </div>
        )}

        {user && chatList.length === 0 && (
          <p className="text-xs text-white/20 text-center py-6">Sem histórico ainda.</p>
        )}
      </div>

      <div className="h-px mx-5" style={{ background: 'rgba(139,92,246,0.08)' }} />

      {/* ── Microfone + logout ── */}
      <div className="p-4 space-y-2">
        <div className="flex items-center justify-between px-4 py-3 rounded-2xl"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(139,92,246,0.1)' }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: isListening ? 'rgba(239,68,68,0.15)' : 'rgba(124,58,237,0.12)' }}>
              {isListening
                ? <Mic size={14} className="text-red-400" />
                : <MicOff size={14} className="text-purple-400/60" />}
            </div>
            <div>
              <p className="text-xs font-semibold text-white/70">Microfone</p>
              <p className="text-[10px] text-white/30">{isListening ? 'Ativo' : 'Desligado'}</p>
            </div>
          </div>
          {/* Toggle switch */}
          <button
            onClick={onToggleMic}
            className="relative w-10 h-5 rounded-full transition-all duration-300 shrink-0"
            style={{ background: isListening ? '#7c3aed' : 'rgba(255,255,255,0.1)' }}
          >
            <span
              className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all duration-300"
              style={{ left: isListening ? '20px' : '2px' }}
            />
          </button>
        </div>

        {user && (
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-sm font-medium transition-all"
            style={{ color: 'rgba(239,68,68,0.5)', border: '1px solid transparent' }}
            onMouseEnter={e => {
              e.currentTarget.style.color = '#f87171';
              e.currentTarget.style.background = 'rgba(239,68,68,0.06)';
              e.currentTarget.style.borderColor = 'rgba(239,68,68,0.15)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = 'rgba(239,68,68,0.5)';
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.borderColor = 'transparent';
            }}
          >
            <LogOut size={14} />
            Terminar sessão
          </button>
        )}
      </div>
    </aside>
  );
};
