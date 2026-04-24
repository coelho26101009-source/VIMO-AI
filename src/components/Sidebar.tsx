import React, { useState } from 'react';
import { Plus, MessageSquare, LogOut, LogIn, Mic, MicOff, Trash2 } from 'lucide-react';
import type { User } from 'firebase/auth';
import type { Chat } from '../types';
import { VimoAvatar } from './VimoAvatar';

const ChatItem: React.FC<{
  chat: Chat;
  isActive: boolean;
  isCodeMode?: boolean;
  onLoad: () => void;
  onDelete: () => void;
}> = ({ chat, isActive, isCodeMode = false, onLoad, onDelete }) => {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirmDelete) {
      onDelete();
    } else {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 2500);
    }
  };

  return (
    <div
      className="group relative flex items-center gap-2 px-3 py-2.5 rounded-xl transition-all duration-150 cursor-pointer"
      style={{
        background: isActive
          ? isCodeMode
            ? 'linear-gradient(135deg,rgba(34,197,94,0.15),rgba(22,163,74,0.1))'
            : 'linear-gradient(135deg,rgba(124,58,237,0.2),rgba(99,102,241,0.15))'
          : undefined,
        border: isActive
          ? isCodeMode ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(139,92,246,0.3)'
          : '1px solid transparent',
      }}
      onClick={onLoad}
    >
      <MessageSquare size={12} className="shrink-0 opacity-30" />
      <span
        className="flex-1 text-sm truncate"
        style={{ color: isActive ? (isCodeMode ? '#86efac' : '#c4b5fd') : 'rgba(255,255,255,0.45)' }}
      >
        {chat.title}
      </span>
      <button
        onClick={handleDelete}
        className={`shrink-0 p-1 rounded-lg transition-all opacity-0 group-hover:opacity-100 ${
          confirmDelete
            ? 'text-red-400 bg-red-500/15 opacity-100'
            : 'text-white/20 hover:text-red-400 hover:bg-red-500/10'
        }`}
        title={confirmDelete ? 'Clica novamente para confirmar' : 'Apagar conversa'}
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
};

interface SidebarProps {
  user: User | null;
  isGuest: boolean;
  chatList: Chat[];
  currentChatId: string | null;
  isConnected: boolean;
  isSpeaking: boolean;
  isListening: boolean;
  isCodeMode?: boolean;
  onNewChat: () => void;
  onLoadChat: (id: string) => void;
  onDeleteChat: (id: string) => void;
  onLogout: () => void;
  onLogin: () => void;
  onToggleMic: () => void;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  user, isGuest, chatList, currentChatId,
  isConnected, isSpeaking, isListening, isCodeMode = false,
  onNewChat, onLoadChat, onDeleteChat, onLogout, onLogin, onToggleMic,
}) => {
  const c = isCodeMode ? {
    bg:         'linear-gradient(180deg, #0a1a0e 0%, #080f08 100%)',
    border:     'rgba(34,197,94,0.12)',
    divider:    'rgba(34,197,94,0.10)',
    btnPrimary: 'linear-gradient(135deg, #16a34a, #15803d)',
    btnShadow:  'rgba(34,197,94,0.3)',
    btnShadowH: 'rgba(34,197,94,0.5)',
    btnHoverBg: 'rgba(34,197,94,0.12)',
    guestCard:  'rgba(34,197,94,0.07)',
    guestBorder:'rgba(34,197,94,0.12)',
    loginBg:    'rgba(34,197,94,0.15)',
    loginBorder:'rgba(34,197,94,0.3)',
    loginColor: '#86efac',
    micActive:  '#16a34a',
    micOff:     'text-green-400/60',
    versionColor:'text-green-400/60',
  } : {
    bg:         'linear-gradient(180deg, #13132b 0%, #0e0e1e 100%)',
    border:     'rgba(139,92,246,0.12)',
    divider:    'rgba(139,92,246,0.08)',
    btnPrimary: 'linear-gradient(135deg, #7c3aed, #6366f1)',
    btnShadow:  'rgba(124,58,237,0.3)',
    btnShadowH: 'rgba(124,58,237,0.5)',
    btnHoverBg: 'rgba(124,58,237,0.12)',
    guestCard:  'rgba(124,58,237,0.07)',
    guestBorder:'rgba(139,92,246,0.12)',
    loginBg:    'rgba(124,58,237,0.2)',
    loginBorder:'rgba(139,92,246,0.3)',
    loginColor: '#c4b5fd',
    micActive:  '#7c3aed',
    micOff:     'text-purple-400/60',
    versionColor:'text-purple-400/60',
  };

  return (
    <aside
      className="w-[280px] shrink-0 h-full flex flex-col border-r"
      style={{ background: c.bg, borderColor: c.border }}
    >
      {/* ── Avatar + nome ── */}
      <div className="flex flex-col items-center gap-3 pt-8 pb-6 px-5">
        <VimoAvatar size={64} isConnected={isConnected} isSpeaking={isSpeaking} isCodeMode={isCodeMode} />
        <div className="text-center">
          <p className="text-white font-bold text-base tracking-wide">VIMO</p>
          <p className={`text-[11px] tracking-widest uppercase font-mono ${c.versionColor}`}>
            {isCodeMode ? 'CODE MODE' : 'V1.0'}
          </p>
        </div>
      </div>

      <div className="h-px mx-5" style={{ background: c.divider }} />

      {/* ── Nova conversa ── */}
      <div className="px-4 pt-5">
        <button
          onClick={onNewChat}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-semibold text-sm text-white transition-all duration-200"
          style={{ background: c.btnPrimary, boxShadow: `0 4px 20px ${c.btnShadow}` }}
          onMouseEnter={e => (e.currentTarget.style.boxShadow = `0 6px 28px ${c.btnShadowH}`)}
          onMouseLeave={e => (e.currentTarget.style.boxShadow = `0 4px 20px ${c.btnShadow}`)}
        >
          <Plus size={16} />
          Nova conversa
        </button>
      </div>

      <div className="h-px mx-5 mt-4" style={{ background: c.divider }} />

      {/* ── Histórico ── */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1 vimo-scroll">
        {user && chatList.length > 0 && (
          <>
            <div className="flex items-center justify-between px-1 mb-2">
              <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.2)' }}>
                Histórico
              </span>
              <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.15)' }}>
                {chatList.length} conversa{chatList.length !== 1 ? 's' : ''}
              </span>
            </div>
            {chatList.map(chat => (
              <ChatItem
                key={chat.id}
                chat={chat}
                isActive={currentChatId === chat.id}
                isCodeMode={isCodeMode}
                onLoad={() => onLoadChat(chat.id)}
                onDelete={() => onDeleteChat(chat.id)}
              />
            ))}
          </>
        )}

        {isGuest && (
          <div className="mt-2 p-4 rounded-2xl text-center"
            style={{ background: c.guestCard, border: `1px solid ${c.guestBorder}` }}>
            <p className="text-xs text-white/30 mb-3 leading-relaxed">
              Entra com a tua conta para guardar o histórico de conversas.
            </p>
            <button
              onClick={onLogin}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold transition-all"
              style={{ background: c.loginBg, border: `1px solid ${c.loginBorder}`, color: c.loginColor }}
            >
              <LogIn size={13} />
              Entrar com Google
            </button>
          </div>
        )}

        {user && chatList.length === 0 && (
          <p className="text-xs text-white/20 text-center py-6">Sem histórico ainda.</p>
        )}
      </div>

      <div className="h-px mx-5" style={{ background: c.divider }} />

      {/* ── Microfone + logout ── */}
      <div className="p-4 space-y-2">
        <div className="flex items-center justify-between px-4 py-3 rounded-2xl"
          style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${c.border}` }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: isListening ? 'rgba(239,68,68,0.15)' : (isCodeMode ? 'rgba(34,197,94,0.12)' : 'rgba(124,58,237,0.12)') }}>
              {isListening
                ? <Mic size={14} className="text-red-400" />
                : <MicOff size={14} className={c.micOff} />}
            </div>
            <div>
              <p className="text-xs font-semibold text-white/70">Microfone</p>
              <p className="text-[10px] text-white/30">{isListening ? 'Ativo' : 'Desligado'}</p>
            </div>
          </div>
          <button
            onClick={onToggleMic}
            className="relative w-10 h-5 rounded-full transition-all duration-300 shrink-0"
            style={{ background: isListening ? c.micActive : 'rgba(255,255,255,0.1)' }}
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
            onMouseEnter={e => { e.currentTarget.style.color = '#f87171'; e.currentTarget.style.background = 'rgba(239,68,68,0.06)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.15)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'rgba(239,68,68,0.5)'; e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; }}
          >
            <LogOut size={14} />
            Terminar sessão
          </button>
        )}
      </div>
    </aside>
  );
};
