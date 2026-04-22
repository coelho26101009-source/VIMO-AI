import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Menu, X, ChevronDown } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

import { useAuth } from './hooks/useAuth';
import { useChat } from './hooks/useChat';
import { useSpeech } from './hooks/useSpeech';

import { LoginScreen } from './components/LoginScreen';
import { Sidebar } from './components/Sidebar';
import { VimoAvatar } from './components/VimoAvatar';
import { InputBar } from './components/InputBar';
import type { Attachment } from './types';

// ── Esfera de boas-vindas ─────────────────────────────────────
const VimoSphere: React.FC<{ isConnected: boolean; isSpeaking: boolean }> = ({
  isConnected, isSpeaking,
}) => {
  const dots = Array.from({ length: 80 });
  return (
    <div className="relative flex items-center justify-center" style={{ width: 220, height: 220 }}>
      <div className="absolute inset-0 rounded-full border border-purple-500/10"
        style={{ animation: isConnected ? 'vimo-orbit 14s linear infinite' : 'none' }} />
      <div className="absolute rounded-full border border-indigo-400/8"
        style={{ inset: '10%', animation: isConnected ? 'vimo-orbit-r 9s linear infinite' : 'none' }} />

      <div className="relative" style={{ width: 160, height: 160 }}>
        {dots.map((_, i) => {
          const phi   = Math.acos(-1 + (2 * i) / dots.length);
          const theta = Math.sqrt(dots.length * Math.PI) * phi;
          const x     = 80 + 65 * Math.sin(phi) * Math.cos(theta);
          const y     = 80 + 65 * Math.sin(phi) * Math.sin(theta);
          const z     = Math.cos(phi);
          const op    = (z + 1) / 2 * 0.85 + 0.1;
          const r     = 1.2 + (z + 1) * 1.2;
          const color = i % 3 === 0 ? '#a855f7' : i % 3 === 1 ? '#818cf8' : '#ec4899';
          // Float orgânico — sem pulse, só movimento suave
          const dur   = (2.0 + (i * 0.13) % 2.5).toFixed(1);
          const delay = -((i * 0.41) % parseFloat(dur));
          const dx    = ((Math.sin(i) * 2.5)).toFixed(2);
          const dy    = ((Math.cos(i * 1.3) * 2.5)).toFixed(2);
          return (
            <div
              key={i}
              className="absolute rounded-full"
              style={{
                width: r * 2, height: r * 2,
                left: x - r, top: y - r,
                background: color,
                opacity: op,
                animation: isConnected
                  ? `sphere-float-${i % 6} ${dur}s ease-in-out infinite ${delay}s`
                  : 'none',
                boxShadow: z > 0.5 ? `0 0 ${r * 2.5}px ${color}` : 'none',
              }}
            />
          );
        })}

        <div className="absolute rounded-full"
          style={{
            width: 36, height: 36,
            left: '50%', top: '50%',
            transform: 'translate(-50%,-50%)',
            background: 'radial-gradient(circle, rgba(168,85,247,0.5) 0%, transparent 70%)',
            // Sem pulse — glow estático suave
          }}
        />
      </div>

      <div className="absolute bottom-0 left-1/2 -translate-x-1/2"
        style={{
          width: 120, height: 20,
          background: 'radial-gradient(ellipse, rgba(124,58,237,0.2) 0%, transparent 70%)',
          filter: 'blur(8px)',
        }}
      />
    </div>
  );
};

// ── App principal ─────────────────────────────────────────────
const App: React.FC = () => {
  const { user, authMode, login, logout, continueAsGuest } = useAuth();
  const { isSpeaking, isListening, speak, toggleMic } = useSpeech();

  const [isConnected,   setIsConnected]   = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentTime,   setCurrentTime]   = useState('--:--:--');
  const [currentDate,   setCurrentDate]   = useState('--/--');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    logs, chatList, currentChatId, isLoading,
    sendMessage, newChat, loadChat, subscribeToChats,
  } = useChat(user, speak);

  const hasMessages = logs.filter(l => l.source !== 'SYSTEM').length > 0;

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Relógio
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setCurrentDate(now.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' }));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Conectar
  useEffect(() => {
    if (authMode === 'loading') return;
    const t = setTimeout(() => setIsConnected(true), 800);
    return () => clearTimeout(t);
  }, [authMode]);

  // Firebase chats
  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToChats(user.uid);
    return () => unsub();
  }, [user, subscribeToChats]);

  const handleSend = useCallback((text: string, attachment: Attachment | null) => {
    sendMessage(text, attachment, user?.displayName || 'Utilizador');
  }, [sendMessage, user]);

  const handleMicToggle = useCallback(() => {
    toggleMic(transcript =>
      window.dispatchEvent(new CustomEvent('vimo-transcript', { detail: transcript }))
    );
  }, [toggleMic]);

  // ── Login ────────────────────────────────────────────────────
  if (authMode === 'loading' || authMode === 'unauthenticated') {
    if (authMode === 'loading') {
      return (
        <div className="flex items-center justify-center h-screen" style={{ background: '#0b0b1a' }}>
          <div className="flex flex-col items-center gap-4">
            <VimoAvatar size={60} isConnected={false} />
            <p className="text-xs tracking-[0.3em] uppercase" style={{ color: 'rgba(255,255,255,0.2)' }}>
              A carregar...
            </p>
          </div>
        </div>
      );
    }
    return <LoginScreen onLogin={login} onGuest={continueAsGuest} />;
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#0b0b1a' }}>

      {/* ── Overlay mobile (fecha sidebar ao clicar fora) ── */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-30 lg:hidden"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar retrátil ── */}
      <div
        className="fixed top-0 left-0 h-full z-40 transition-transform duration-300 ease-out"
        style={{
          width: 280,
          transform: isSidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
          willChange: 'transform',
        }}
      >
        <Sidebar
          user={user}
          isGuest={authMode === 'guest'}
          chatList={chatList}
          currentChatId={currentChatId}
          isConnected={isConnected}
          isSpeaking={isSpeaking}
          isListening={isListening}
          onNewChat={() => { newChat(); setIsSidebarOpen(false); }}
          onLoadChat={id => { loadChat(id); setIsSidebarOpen(false); }}
          onLogout={logout}
          onLogin={login}
          onToggleMic={handleMicToggle}
          onClose={() => setIsSidebarOpen(false)}
        />
      </div>

      {/* ── Main (ocupa 100% da largura sempre) ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden w-full">

        {/* Header minimalista */}
        <header
          className="h-[60px] flex items-center justify-between px-5 shrink-0"
          style={{
            background: 'rgba(11,11,26,0.85)',
            backdropFilter: 'blur(14px)',
            borderBottom: '1px solid rgba(139,92,246,0.1)',
          }}
        >
          {/* Esquerda: hamburger + chip */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(o => !o)}
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200"
              style={{
                background: isSidebarOpen ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${isSidebarOpen ? 'rgba(139,92,246,0.3)' : 'rgba(255,255,255,0.07)'}`,
                color: isSidebarOpen ? '#c4b5fd' : 'rgba(255,255,255,0.45)',
              }}
              aria-label="Abrir menu"
            >
              {isSidebarOpen ? <X size={17} /> : <Menu size={17} />}
            </button>

            {/* Model chip */}
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs cursor-default select-none"
              style={{
                background: 'rgba(124,58,237,0.08)',
                border: '1px solid rgba(139,92,246,0.18)',
                color: 'rgba(255,255,255,0.45)',
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full"
                style={{ background: '#4ade80', boxShadow: '0 0 5px #4ade80' }} />
              <span className="font-medium tracking-wide">VIMO V1.0</span>
              <ChevronDown size={11} style={{ color: 'rgba(255,255,255,0.2)' }} />
            </div>
          </div>

          {/* Direita: relógio + avatar */}
          <div className="flex items-center gap-3">
            {/* Relógio */}
            <div
              className="hidden sm:flex items-center gap-3 px-4 py-2 rounded-xl"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <div className="text-center">
                <p className="font-mono text-xs font-semibold leading-none" style={{ color: '#a78bfa' }}>{currentTime}</p>
                <p className="text-[9px] uppercase tracking-wider mt-0.5" style={{ color: 'rgba(255,255,255,0.18)' }}>HORA</p>
              </div>
              <div className="w-px h-5" style={{ background: 'rgba(255,255,255,0.06)' }} />
              <div className="text-center">
                <p className="font-mono text-xs font-semibold leading-none" style={{ color: '#a78bfa' }}>{currentDate}</p>
                <p className="text-[9px] uppercase tracking-wider mt-0.5" style={{ color: 'rgba(255,255,255,0.18)' }}>HOJE</p>
              </div>
            </div>

            {/* Avatar do utilizador */}
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold overflow-hidden cursor-pointer"
              style={{
                background: 'linear-gradient(135deg,rgba(124,58,237,0.35),rgba(99,102,241,0.35))',
                border: '1px solid rgba(139,92,246,0.3)',
                color: '#c4b5fd',
              }}
            >
              {user?.photoURL
                ? <img src={user.photoURL} alt="" className="w-full h-full object-cover" />
                : (user?.displayName?.charAt(0).toUpperCase() || '?')}
            </div>
          </div>
        </header>

        {/* Área de chat */}
        <div className="flex-1 overflow-y-auto vimo-scroll" style={{ padding: '24px 0' }}>
          {!hasMessages ? (
            /* ── Welcome ── */
            <div className="h-full flex flex-col items-center justify-center gap-6 px-6">
              <VimoSphere isConnected={isConnected} isSpeaking={isSpeaking} />
              <div className="text-center">
                <h2 className="text-2xl font-bold text-white mb-1">
                  Olá, eu sou o{' '}
                  <span style={{ color: '#a855f7' }}>VIMO.</span>
                </h2>
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.38)' }}>
                  Em que posso ajudar?
                </p>
              </div>
            </div>
          ) : (
            /* ── Mensagens ── */
            <div className="max-w-3xl mx-auto w-full px-5 space-y-5">
              {logs.map(log => {
                if (log.source === 'SYSTEM') {
                  return (
                    <p key={log.id} className="text-center text-xs py-1"
                      style={{ color: 'rgba(255,255,255,0.16)', fontFamily: 'monospace' }}>
                      {log.text}
                    </p>
                  );
                }

                const isUser = log.source === 'USER';
                const isErr  = log.source === 'ERROR';

                return (
                  <div
                    key={log.id}
                    className="flex gap-3 animate-fade-up"
                    style={{ flexDirection: isUser ? 'row-reverse' : 'row', alignItems: 'flex-end' }}
                  >
                    {/* Avatar Vimo */}
                    {!isUser && (
                      <div className="shrink-0 mb-1">
                        <VimoAvatar
                          size={34}
                          isConnected={isConnected}
                          isSpeaking={isSpeaking && log === logs[logs.length - 1]}
                        />
                      </div>
                    )}

                    {/* Avatar utilizador */}
                    {isUser && (
                      <div
                        className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold overflow-hidden mb-1"
                        style={{
                          background: 'linear-gradient(135deg,rgba(124,58,237,0.4),rgba(99,102,241,0.4))',
                          border: '1px solid rgba(139,92,246,0.4)',
                          color: '#c4b5fd',
                        }}
                      >
                        {user?.photoURL
                          ? <img src={user.photoURL} alt="" className="w-full h-full object-cover" />
                          : (user?.displayName?.charAt(0).toUpperCase() || '?')}
                      </div>
                    )}

                    {/* Balão */}
                    <div style={{
                      maxWidth: '74%',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: isUser ? 'flex-end' : 'flex-start',
                      gap: 3,
                    }}>
                      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.18)', fontFamily: 'monospace', paddingInline: 4 }}>
                        {log.timestamp}
                        {!isUser && <span style={{ color: '#7c3aed' }}> · Vimo</span>}
                        {isUser && <span style={{ color: 'rgba(99,102,241,0.55)', marginLeft: 4 }}>✓✓</span>}
                      </span>

                      <div
                        style={{
                          borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                          padding: '12px 16px',
                          fontSize: 14,
                          lineHeight: 1.65,
                          background: isUser
                            ? 'linear-gradient(135deg, rgba(99,102,241,0.28), rgba(124,58,237,0.22))'
                            : isErr ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.05)',
                          border: isUser
                            ? '1px solid rgba(139,92,246,0.32)'
                            : isErr ? '1px solid rgba(239,68,68,0.2)' : '1px solid rgba(255,255,255,0.08)',
                          color: isErr ? '#fca5a5' : '#e2e0f0',
                          backdropFilter: 'blur(10px)',
                        }}
                      >
                        {isUser ? (
                          <span style={{ color: 'white' }}>{log.text}</span>
                        ) : (
                          <ReactMarkdown
                            components={{
                              p:      ({ children }) => <p style={{ marginBottom: 6 }}>{children}</p>,
                              strong: ({ children }) => <strong style={{ color: '#c4b5fd', fontWeight: 600 }}>{children}</strong>,
                              code:   ({ children, className }) => {
                                const isBlock = className?.includes('language-');
                                return isBlock ? (
                                  <pre style={{ margin: '8px 0', padding: 12, borderRadius: 12, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(139,92,246,0.18)', color: '#a78bfa', fontSize: 12, overflowX: 'auto' }}>
                                    <code>{children}</code>
                                  </pre>
                                ) : (
                                  <code style={{ padding: '2px 7px', borderRadius: 6, background: 'rgba(124,58,237,0.15)', color: '#c4b5fd', border: '1px solid rgba(139,92,246,0.2)', fontSize: 12 }}>
                                    {children}
                                  </code>
                                );
                              },
                              ul: ({ children }) => <ul style={{ paddingLeft: 18, marginBottom: 6 }}>{children}</ul>,
                              ol: ({ children }) => <ol style={{ paddingLeft: 18, marginBottom: 6 }}>{children}</ol>,
                              li: ({ children }) => <li style={{ marginBottom: 2 }}>{children}</li>,
                              h1: ({ children }) => <h1 style={{ fontSize: 18, fontWeight: 700, color: '#c4b5fd', marginBottom: 8 }}>{children}</h1>,
                              h2: ({ children }) => <h2 style={{ fontSize: 15, fontWeight: 700, color: '#a78bfa', marginBottom: 6 }}>{children}</h2>,
                              h3: ({ children }) => <h3 style={{ fontSize: 13, fontWeight: 600, color: '#8b5cf6', marginBottom: 4 }}>{children}</h3>,
                            }}
                          >
                            {log.text}
                          </ReactMarkdown>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Typing indicator */}
              {isLoading && (
                <div className="flex gap-3 animate-fade-up" style={{ alignItems: 'flex-end' }}>
                  <VimoAvatar size={34} isConnected={isConnected} isSpeaking />
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '14px 18px', borderRadius: '18px 18px 18px 4px',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}>
                    {[0, 0.22, 0.44].map((d, i) => (
                      <span key={i} style={{
                        width: 7, height: 7, borderRadius: '50%',
                        background: '#7c3aed',
                        display: 'inline-block',
                        animation: `vimo-bounce 1.3s ease-in-out infinite ${d}s`,
                      }} />
                    ))}
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <InputBar onSend={handleSend} isLoading={isLoading} isConnected={isConnected} />
      </div>

      <style>{`
        @keyframes vimo-orbit   { from{transform:rotate(0deg)}   to{transform:rotate(360deg)} }
        @keyframes vimo-orbit-r { from{transform:rotate(360deg)} to{transform:rotate(0deg)}   }

        /* 6 variantes de float orgânico para a esfera */
        @keyframes sphere-float-0 { 0%,100%{transform:translate(0,0)}    50%{transform:translate(2px,-2.5px)}  }
        @keyframes sphere-float-1 { 0%,100%{transform:translate(0,0)}    50%{transform:translate(-2px,2px)}    }
        @keyframes sphere-float-2 { 0%,100%{transform:translate(0,0)}    50%{transform:translate(2.5px,1.5px)} }
        @keyframes sphere-float-3 { 0%,100%{transform:translate(0,0)}    50%{transform:translate(-1.5px,-2px)} }
        @keyframes sphere-float-4 { 0%,100%{transform:translate(0,0)}    50%{transform:translate(1px,2.5px)}   }
        @keyframes sphere-float-5 { 0%,100%{transform:translate(0,0)}    50%{transform:translate(-2.5px,1px)}  }

        @keyframes vimo-bounce {
          0%,80%,100%{ transform:translateY(0);   opacity:0.35; }
          40%        { transform:translateY(-7px); opacity:1;    }
        }
        @keyframes fade-up {
          from { opacity:0; transform:translateY(10px); }
          to   { opacity:1; transform:translateY(0);    }
        }
        .animate-fade-up { animation: fade-up 0.22s ease forwards; }
        .vimo-scroll { scrollbar-width: thin; scrollbar-color: rgba(124,58,237,0.18) transparent; }
        .vimo-scroll::-webkit-scrollbar       { width: 4px; }
        .vimo-scroll::-webkit-scrollbar-thumb { background: rgba(124,58,237,0.18); border-radius: 4px; }
        textarea::placeholder { color: rgba(255,255,255,0.2) !important; }
      `}</style>
    </div>
  );
};

export default App;
