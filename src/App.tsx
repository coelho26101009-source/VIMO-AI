import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronDown, Menu } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

import { useAuth } from './hooks/useAuth';
import { useChat } from './hooks/useChat';
import { useSpeech } from './hooks/useSpeech';

import { LoginScreen } from './components/LoginScreen';
import { Sidebar } from './components/Sidebar';
import { VimoAvatar } from './components/VimoAvatar';
import { InputBar } from './components/InputBar';
import type { Attachment } from './types';

// ── Esfera de boas-vindas (partículas CSS) ───────────────────
const VimoSphere: React.FC<{ isConnected: boolean; isSpeaking: boolean }> = ({
  isConnected, isSpeaking,
}) => {
  const dots = Array.from({ length: 80 });
  return (
    <div className="relative flex items-center justify-center" style={{ width: 220, height: 220 }}>
      {/* Orbit rings */}
      <div className="absolute inset-0 rounded-full border border-purple-500/10"
        style={{ animation: isConnected ? 'vimo-orbit 12s linear infinite' : 'none' }} />
      <div className="absolute rounded-full border border-indigo-400/8"
        style={{ inset: '10%', animation: isConnected ? 'vimo-orbit-r 8s linear infinite' : 'none' }} />

      {/* Dots sphere */}
      <div className="relative" style={{ width: 160, height: 160 }}>
        {dots.map((_, i) => {
          const phi = Math.acos(-1 + (2 * i) / dots.length);
          const theta = Math.sqrt(dots.length * Math.PI) * phi;
          const x = 80 + 65 * Math.sin(phi) * Math.cos(theta);
          const y = 80 + 65 * Math.sin(phi) * Math.sin(theta);
          const z = Math.cos(phi); // -1 to 1
          const opacity = (z + 1) / 2 * 0.85 + 0.1;
          const r = 1.2 + (z + 1) * 1.2;
          const color = i % 3 === 0 ? '#a855f7' : i % 3 === 1 ? '#818cf8' : '#ec4899';
          const twinkleDelay = `${(i * 0.07) % 3}s`;
          return (
            <div
              key={i}
              className="absolute rounded-full"
              style={{
                width: r * 2, height: r * 2,
                left: x - r, top: y - r,
                background: color,
                opacity,
                animation: isConnected
                  ? `vimo-twinkle ${1.5 + (i % 5) * 0.4}s ease-in-out infinite ${twinkleDelay}`
                  : 'none',
                boxShadow: z > 0.5 ? `0 0 ${r * 3}px ${color}` : 'none',
              }}
            />
          );
        })}

        {/* Central glow - Sem o pulse para um look mais orgânico */}
        <div
          className="absolute rounded-full transition-all duration-300"
          style={{
            width: isSpeaking ? 50 : 40, 
            height: isSpeaking ? 50 : 40,
            left: '50%', top: '50%',
            transform: 'translate(-50%,-50%)',
            background: 'radial-gradient(circle, rgba(168,85,247,0.6) 0%, transparent 70%)',
          }}
        />
      </div>

      {/* Ground glow */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2"
        style={{
          width: 120, height: 20,
          background: 'radial-gradient(ellipse, rgba(124,58,237,0.25) 0%, transparent 70%)',
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
  const [isConnected, setIsConnected] = useState(false);
  
  // Estado do Menu Hamburger
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const [currentTime, setCurrentTime] = useState('--:--:--');
  const [currentDate, setCurrentDate] = useState('--/--');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Sem addLog para evitar erros no Vercel
  const { logs, chatList, currentChatId, isLoading, sendMessage, newChat, loadChat, subscribeToChats } =
    useChat(user, speak);

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
    setIsConnected(false);
    const t = setTimeout(() => setIsConnected(true), 800);
    return () => clearTimeout(t);
  }, [authMode]);

  // Subscrever chats
  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToChats(user.uid);
    return () => unsub();
  }, [user, subscribeToChats]);

  const handleSend = useCallback((text: string, attachment: Attachment | null) => {
    const name = user?.displayName || 'Utilizador';
    sendMessage(text, attachment, name);
  }, [sendMessage, user]);

  const handleMicToggle = useCallback(() => {
    toggleMic((transcript) => {
      window.dispatchEvent(new CustomEvent('vimo-transcript', { detail: transcript }));
    });
  }, [toggleMic]);

  const handleLoadChat = useCallback((id: string) => {
    loadChat(id);
    setIsSidebarOpen(false); // Fecha o menu ao escolher conversa
  }, [loadChat]);

  const handleNewChat = useCallback(() => {
    newChat();
    setIsSidebarOpen(false); // Fecha o menu ao criar conversa
  }, [newChat]);

  if (authMode === 'loading') {
    return (
      <div className="flex items-center justify-center h-screen" style={{ background: '#0e0e18' }}>
        <div className="flex flex-col items-center gap-4">
          <VimoAvatar size={56} isConnected={false} />
          <p className="text-sm tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.25)' }}>
            A carregar...
          </p>
        </div>
      </div>
    );
  }

  if (authMode !== 'user' && authMode !== 'guest') {
    return <LoginScreen onLogin={login} onGuest={continueAsGuest} />;
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#0b0b1a' }}>

      {/* ── Overlay Mobile ── */}
      {isSidebarOpen && (
        <div 
          className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar com Deslize ── */}
      <div className={`
        fixed md:static inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0 flex shrink-0
      `}>
        <Sidebar
          user={user}
          isGuest={authMode === 'guest'}
          chatList={chatList}
          currentChatId={currentChatId}
          isConnected={isConnected}
          isSpeaking={isSpeaking}
          isListening={isListening}
          onNewChat={handleNewChat}
          onLoadChat={handleLoadChat}
          onLogout={logout}
          onLogin={login}
          onToggleMic={handleMicToggle}
        />
      </div>

      {/* ── Painel Principal ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">

        {/* Header Limpo */}
        <header
          className="h-[60px] flex items-center justify-between px-4 sm:px-6 shrink-0"
          style={{
            background: 'rgba(11,11,26,0.8)',
            backdropFilter: 'blur(12px)',
            borderBottom: '1px solid rgba(139,92,246,0.1)',
          }}
        >
          {/* Esquerda: Hamburger + Vimo Chip */}
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="md:hidden p-2 -ml-2 rounded-xl text-white/50 hover:text-white hover:bg-white/5 transition-colors"
            >
              <Menu size={22} />
            </button>

            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs cursor-default select-none"
              style={{
                background: 'rgba(124,58,237,0.1)',
                border: '1px solid rgba(139,92,246,0.2)',
                color: 'rgba(255,255,255,0.5)',
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#4ade80', boxShadow: '0 0 6px #4ade80' }} />
              <span className="font-medium tracking-wide">VIMO V1.0</span>
              <ChevronDown size={11} style={{ color: 'rgba(255,255,255,0.25)' }} />
            </div>
          </div>

          {/* Direita: Relógio + Perfil (Sem botão do terminal) */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-3 px-4 py-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="text-center">
                <p className="font-mono text-xs font-semibold leading-none" style={{ color: '#a78bfa' }}>{currentTime}</p>
                <p className="text-[9px] uppercase tracking-wider mt-0.5" style={{ color: 'rgba(255,255,255,0.2)' }}>HORA</p>
              </div>
              <div className="w-px h-6" style={{ background: 'rgba(255,255,255,0.06)' }} />
              <div className="text-center">
                <p className="font-mono text-xs font-semibold leading-none" style={{ color: '#a78bfa' }}>{currentDate}</p>
                <p className="text-[9px] uppercase tracking-wider mt-0.5" style={{ color: 'rgba(255,255,255,0.2)' }}>HOJE</p>
              </div>
            </div>

            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold overflow-hidden cursor-pointer transition-all"
              style={{
                background: 'linear-gradient(135deg,rgba(124,58,237,0.3),rgba(99,102,241,0.3))',
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

        {/* Content */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <div className="flex-1 overflow-y-auto vimo-scroll" style={{ padding: '24px 0' }}>
              {!hasMessages ? (
                <div className="h-full flex flex-col items-center justify-center gap-6 px-6">
                  <VimoSphere isConnected={isConnected} isSpeaking={isSpeaking} />
                  <div className="text-center">
                    <h2 className="text-2xl font-bold text-white mb-1">
                      Olá, eu sou o <span style={{ color: '#a855f7' }}>VIMO.</span>
                    </h2>
                    <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>Em que posso ajudar?</p>
                  </div>
                </div>
              ) : (
                <div className="max-w-3xl mx-auto w-full px-4 sm:px-6 space-y-5">
                  {logs.map(log => {
                    if (log.source === 'SYSTEM') {
                      return <p key={log.id} className="text-center text-xs py-1" style={{ color: 'rgba(255,255,255,0.18)', fontFamily: 'monospace' }}>{log.text}</p>;
                    }
                    const isUser = log.source === 'USER';
                    const isErr = log.source === 'ERROR';

                    return (
                      <div key={log.id} className="flex gap-3 animate-fade-up" style={{ flexDirection: isUser ? 'row-reverse' : 'row' }}>
                        {!isUser && (
                          <div className="shrink-0 mt-1">
                            <VimoAvatar size={36} isConnected={isConnected} isSpeaking={isSpeaking && log === logs[logs.length - 1]} />
                          </div>
                        )}
                        {isUser && (
                          <div className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold mt-1 overflow-hidden" style={{ background: 'linear-gradient(135deg,rgba(124,58,237,0.4),rgba(99,102,241,0.4))', border: '1px solid rgba(139,92,246,0.4)', color: '#c4b5fd' }}>
                            {user?.photoURL ? <img src={user.photoURL} alt="" className="w-full h-full object-cover" /> : (user?.displayName?.charAt(0).toUpperCase() || '?')}
                          </div>
                        )}
                        <div style={{ maxWidth: '85%', display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start', gap: 4 }}>
                          <span className="text-[10px] px-1" style={{ color: 'rgba(255,255,255,0.2)', fontFamily: 'monospace' }}>
                            {log.timestamp} {!isUser && <span style={{ color: '#7c3aed' }}> · Vimo</span>} {isUser && log.source === 'USER' && <span style={{ color: 'rgba(99,102,241,0.6)', marginLeft: 4 }}>✓✓</span>}
                          </span>
                          <div className="px-4 py-3 text-sm leading-relaxed" style={{ borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px', background: isUser ? 'linear-gradient(135deg, rgba(99,102,241,0.25), rgba(124,58,237,0.2))' : isErr ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.05)', border: isUser ? '1px solid rgba(139,92,246,0.3)' : isErr ? '1px solid rgba(239,68,68,0.2)' : '1px solid rgba(255,255,255,0.08)', color: isErr ? '#fca5a5' : '#e2e0f0', backdropFilter: 'blur(8px)' }}>
                            {isUser ? <span style={{ color: 'white' }}>{log.text}</span> : (
                              <ReactMarkdown
                                components={{
                                  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                                  strong: ({ children }) => <strong style={{ color: '#c4b5fd', fontWeight: 600 }}>{children}</strong>,
                                  code: ({ children, className }) => {
                                    const isBlock = className?.includes('language-');
                                    return isBlock ? <pre className="my-2 p-3 rounded-xl overflow-x-auto text-xs" style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(139,92,246,0.2)', color: '#a78bfa' }}><code>{children}</code></pre> : <code className="px-1.5 py-0.5 rounded text-xs" style={{ background: 'rgba(124,58,237,0.15)', color: '#c4b5fd', border: '1px solid rgba(139,92,246,0.2)' }}>{children}</code>;
                                  },
                                  ul: ({ children }) => <ul className="list-disc pl-4 space-y-1 mb-2">{children}</ul>,
                                  ol: ({ children }) => <ol className="list-decimal pl-4 space-y-1 mb-2">{children}</ol>,
                                  li: ({ children }) => <li>{children}</li>,
                                  h1: ({ children }) => <h1 className="text-lg font-bold mb-2" style={{ color: '#c4b5fd' }}>{children}</h1>,
                                  h2: ({ children }) => <h2 className="text-base font-bold mb-2" style={{ color: '#a78bfa' }}>{children}</h2>,
                                  h3: ({ children }) => <h3 className="text-sm font-semibold mb-1" style={{ color: '#8b5cf6' }}>{children}</h3>,
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
                  {isLoading && (
                    <div className="flex gap-3 animate-fade-up">
                      <VimoAvatar size={36} isConnected={isConnected} isSpeaking />
                      <div className="flex items-center gap-2 px-5 py-4 rounded-[18px]" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        {[0, 0.2, 0.4].map((d, i) => <span key={i} className="w-2 h-2 rounded-full" style={{ background: '#7c3aed', animation: `vimo-bounce 1.2s ease-in-out infinite ${d}s` }} />)}
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>
            <InputBar onSend={handleSend} isLoading={isLoading} isConnected={isConnected} />
          </div>
        </div>
      </div>

      <style>{`
        @keyframes vimo-orbit { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes vimo-orbit-r { from { transform: rotate(360deg); } to { transform: rotate(0deg); } }
        @keyframes vimo-twinkle { 0%, 100% { opacity: var(--op, 0.5); transform: scale(1); } 50% { opacity: 1; transform: scale(1.6); } }
        @keyframes vimo-bounce { 0%, 80%, 100% { transform: translateY(0); opacity: 0.4; } 40% { transform: translateY(-6px); opacity: 1; } }
        @keyframes fade-up { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-up { animation: fade-up 0.25s ease forwards; }
        .vimo-scroll { scrollbar-width: thin; scrollbar-color: rgba(124,58,237,0.2) transparent; }
        .vimo-scroll::-webkit-scrollbar { width: 4px; }
        .vimo-scroll::-webkit-scrollbar-thumb { background: rgba(124,58,237,0.2); border-radius: 4px; }
        textarea::placeholder { color: rgba(255,255,255,0.2) !important; }
      `}</style>
    </div>
  );
};

export default App;
