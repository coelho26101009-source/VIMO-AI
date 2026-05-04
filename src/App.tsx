import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronDown, Menu, Volume2, VolumeX, User, Code2, Copy, Check, RefreshCw, Globe } from 'lucide-react';
import { MarkdownMessage } from './components/MarkdownMessage';

import { useAuth } from './hooks/useAuth';
import { useChat } from './hooks/useChat';
import { useSpeech } from './hooks/useSpeech';

import { LoginScreen } from './components/LoginScreen';
import { Sidebar } from './components/Sidebar';
import { VuxioAvatar } from './components/VuxioAvatar';
import { InputBar } from './components/InputBar';
import type { Attachment } from './types';

const CopyButton: React.FC<{ text: string; isCodeMode: boolean }> = ({ text, isCodeMode }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      title="Copiar mensagem"
      className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg transition-colors ${
        copied
          ? 'text-green-400 bg-green-500/15'
          : isCodeMode
            ? 'text-green-400/50 hover:text-green-400 hover:bg-green-500/10'
            : 'text-white/30 hover:text-white/70 hover:bg-white/5'
      }`}
    >
      {copied ? <Check size={11} /> : <Copy size={11} />}
      <span>{copied ? 'Copiado' : 'Copiar'}</span>
    </button>
  );
};

const VuxioSphere: React.FC<{ isConnected: boolean; isSpeaking: boolean; isCodeMode: boolean }> = ({
  isConnected, isSpeaking, isCodeMode,
}) => {
  const dots = Array.from({ length: 90 });
  const dotColors = isCodeMode
    ? ['#22c55e', '#4ade80', '#86efac']
    : ['#a855f7', '#818cf8', '#ec4899'];
  const glowColor = isCodeMode ? 'rgba(34,197,94,' : 'rgba(168,85,247,';

  return (
    <div className="relative flex items-center justify-center" style={{ width: 240, height: 240 }}>
      {/* Brilho exterior suave */}
      <div className="absolute inset-0 rounded-full blur-2xl opacity-15 transition-all duration-500"
        style={{ background: isCodeMode ? '#22c55e' : '#a855f7', transform: isSpeaking ? 'scale(1.15)' : 'scale(1)' }} />

      {/* Anel 1 — horizontal, lento */}
      <div className={`absolute inset-0 rounded-full border ${isCodeMode ? 'border-green-400/20' : 'border-purple-400/20'}`}
        style={{ animation: isConnected ? 'VUXIO-orbit 18s linear infinite' : 'none' }} />

      {/* Anel 2 — horizontal reverso, médio */}
      <div className={`absolute rounded-full border ${isCodeMode ? 'border-emerald-300/15' : 'border-indigo-400/15'}`}
        style={{ inset: '8%', animation: isConnected ? 'VUXIO-orbit-r 10s linear infinite' : 'none' }} />

      {/* Anel 3 — elíptico (simulação 3D) */}
      <div className={`absolute rounded-full border ${isCodeMode ? 'border-green-300/10' : 'border-violet-400/10'}`}
        style={{
          inset: '4%',
          transform: 'scaleY(0.28) rotate(20deg)',
          animation: isConnected ? 'VUXIO-orbit 14s linear infinite' : 'none',
        }} />

      {/* Anel 4 — elíptico oposto */}
      <div className={`absolute rounded-full border ${isCodeMode ? 'border-lime-400/8' : 'border-pink-400/8'}`}
        style={{
          inset: '12%',
          transform: 'scaleY(0.28) rotate(-20deg)',
          animation: isConnected ? 'VUXIO-orbit-r 22s linear infinite' : 'none',
        }} />

      {/* Esfera de pontos */}
      <div className="relative" style={{ width: 170, height: 170 }}>
        {dots.map((_, i) => {
          const phi = Math.acos(-1 + (2 * i) / dots.length);
          const theta = Math.sqrt(dots.length * Math.PI) * phi;
          const x = 85 + 70 * Math.sin(phi) * Math.cos(theta);
          const y = 85 + 70 * Math.sin(phi) * Math.sin(theta);
          const z = Math.cos(phi);
          const opacity = (z + 1) / 2 * 0.9 + 0.08;
          const r = 1.1 + (z + 1) * 1.3;
          const color = dotColors[i % 3];
          return (
            <div key={i} className="absolute rounded-full" style={{
              width: r * 2, height: r * 2, left: x - r, top: y - r,
              background: color, opacity,
              animation: isConnected
                ? `VUXIO-twinkle ${1.2 + (i % 7) * 0.35}s ease-in-out ${(i % 5) * 0.2}s infinite`
                : 'none',
              boxShadow: z > 0.4 ? `0 0 ${r * 4}px ${color}` : 'none',
            }} />
          );
        })}

        {/* Núcleo central com pulse */}
        <div className="absolute rounded-full transition-all duration-500" style={{
          width: isSpeaking ? 60 : 44, height: isSpeaking ? 60 : 44,
          left: '50%', top: '50%', transform: 'translate(-50%,-50%)',
          background: `radial-gradient(circle, ${glowColor}0.7) 0%, ${glowColor}0.2) 50%, transparent 75%)`,
          animation: isConnected ? 'VUXIO-core-pulse 2.5s ease-in-out infinite' : 'none',
        }} />
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const { user, authMode, login, logout, continueAsGuest } = useAuth();
  const { isSpeaking, isListening, speak, toggleMic } = useSpeech();
  const [isConnected, setIsConnected] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [isCodeMode, setIsCodeMode] = useState(false);
  const [isWebMode,  setIsWebMode]  = useState(false);
  const [currentTime, setCurrentTime] = useState('--:--:--');
  const [currentDate, setCurrentDate] = useState('--/--');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const toggleMute = () => {
    window.speechSynthesis?.cancel();
    setIsMuted(prev => !prev);
  };

  const { logs, chatList, currentChatId, isLoading, isStreaming, isSearching, sendMessage, regenerate, newChat, loadChat, deleteChat, subscribeToChats } =
    useChat(user, isMuted ? () => {} : speak, isCodeMode, isWebMode);

  const hasMessages = logs.filter(l => l.source !== 'SYSTEM').length > 0;

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [logs]);

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

  useEffect(() => {
    if (authMode === 'loading') return;
    setIsConnected(false);
    setTimeout(() => setIsConnected(true), 800);
  }, [authMode]);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToChats(user.uid);
    return () => unsub();
  }, [user, subscribeToChats]);

  const handleSend = useCallback((text: string, attachment: Attachment | null) => {
    sendMessage(text, attachment, user?.displayName || 'Utilizador');
  }, [sendMessage, user]);

  if (authMode === 'loading') return <div className="h-screen flex items-center justify-center bg-[#0e0e18] text-white/20 uppercase tracking-widest text-xs">A carregar...</div>;
  if (authMode !== 'user' && authMode !== 'guest') return <LoginScreen onLogin={login} onGuest={continueAsGuest} />;

  return (
    <div className={`flex h-screen overflow-hidden ${isCodeMode ? 'code-mode bg-[#080f0b]' : 'bg-[#0b0b1a]'}`}>
      {/* Overlay (mobile apenas) */}
      {isSidebarOpen && <div className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)} />}

      {/* Sidebar retrátil em todos os tamanhos */}
      <div className={`fixed md:relative inset-y-0 left-0 z-50 shrink-0 transform transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0 md:block' : '-translate-x-full md:hidden'}`}>
        <Sidebar user={user} isGuest={authMode === 'guest'} chatList={chatList} currentChatId={currentChatId} isConnected={isConnected} isSpeaking={isSpeaking} isListening={isListening} isCodeMode={isCodeMode} onNewChat={() => { newChat(); setIsSidebarOpen(false); }} onLoadChat={(id) => { loadChat(id); setIsSidebarOpen(false); }} onDeleteChat={deleteChat} onLogout={logout} onLogin={login} onToggleMic={() => toggleMic((t) => window.dispatchEvent(new CustomEvent('VUXIO-transcript', { detail: t })))} />
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <header className={`h-[60px] flex items-center justify-between px-4 sm:px-6 backdrop-blur-xl border-b ${isCodeMode ? 'bg-[#080f0b]/80 border-green-500/10' : 'bg-[#0b0b1a]/80 border-white/5'}`}>
          <div className="flex items-center gap-3">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 text-white/50 hover:text-white/80 transition-colors"><Menu size={22} /></button>
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-mono ${isCodeMode ? 'bg-green-500/10 border-green-500/20 text-green-400/80' : 'bg-purple-500/10 border-purple-500/20 text-white/50'}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-[#4ade80] shadow-[0_0_6px_#4ade80]" />
              <span className="font-medium">{isCodeMode ? 'VUXIO::CODE' : 'VUXIO V1.0'}</span>
              <ChevronDown size={11} />
            </div>
            <button onClick={toggleMute} title={isMuted ? 'Ativar voz' : 'Silenciar'} className="p-2 text-white/50 hover:text-white/80 transition-colors">
              {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
            </button>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setIsWebMode(prev => !prev); setIsCodeMode(false); }}
              title={isWebMode ? 'Desativar pesquisa web' : 'Ativar pesquisa web'}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all duration-200 ${
                isWebMode
                  ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.2)]'
                  : 'bg-white/5 border-white/10 text-white/40 hover:text-white/70 hover:bg-white/10'
              }`}
            >
              <Globe size={14} />
              <span className="hidden sm:inline">WEB</span>
            </button>
            <button
              onClick={() => { setIsCodeMode(prev => !prev); setIsWebMode(false); }}
              title={isCodeMode ? 'Mudar para modo normal' : 'Mudar para modo código'}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all duration-200 ${
                isCodeMode
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.2)]'
                  : 'bg-white/5 border-white/10 text-white/40 hover:text-white/70 hover:bg-white/10'
              }`}
            >
              <Code2 size={14} />
              <span className="hidden sm:inline">MOD CODE</span>
            </button>
            <div className={`hidden sm:flex gap-3 px-4 py-2 rounded-xl border text-center ${isCodeMode ? 'bg-green-900/10 border-green-500/15' : 'bg-white/5 border-white/10'}`}>
              <div><p className={`font-mono text-xs leading-none ${isCodeMode ? 'text-green-400' : 'text-purple-400'}`}>{currentTime}</p><p className="text-[9px] text-white/20 mt-0.5">HORA</p></div>
              <div className="w-px h-6 bg-white/10" />
              <div><p className={`font-mono text-xs leading-none ${isCodeMode ? 'text-green-400' : 'text-purple-400'}`}>{currentDate}</p><p className="text-[9px] text-white/20 mt-0.5">HOJE</p></div>
            </div>
            <a
              href="https://github.com/coelho26101009-source"
              target="_blank"
              rel="noopener noreferrer"
              title="GitHub do autor"
              className="p-1.5 text-white/30 hover:text-white/70 transition-colors"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
            </a>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold overflow-hidden ${
              isCodeMode
                ? 'bg-green-500/20 border border-green-500/30 text-green-300'
                : 'bg-purple-500/20 border border-purple-500/30 text-purple-300'
            }`}>
              {user?.photoURL
                ? <img src={user.photoURL} className="w-full h-full object-cover rounded-full" alt="avatar" />
                : user?.displayName?.charAt(0)
                  ? user.displayName.charAt(0)
                  : <User size={14} />}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto VUXIO-scroll p-4 sm:p-6">
          {!hasMessages ? (
            <div className="h-full flex flex-col items-center justify-center gap-6">
              <VuxioSphere isConnected={isConnected} isSpeaking={isSpeaking} isCodeMode={isCodeMode} />
              {isCodeMode ? (
                <div className="font-mono text-sm text-left space-y-1">
                  <p className="text-green-600/60">{'// VUXIO --mode=programmer --lang=pt-PT'}</p>
                  <p className="text-green-400/80">{'> Sistema inicializado.'}</p>
                  <p className="text-green-400/80">{'> Pronto para codificar.'}</p>
                  <p className="flex items-center gap-1 text-green-400">
                    <span>{'>'}</span>
                    <span className="w-2 h-4 bg-green-400 code-cursor inline-block" />
                  </p>
                </div>
              ) : (
                <div className="text-center"><h2 className="text-2xl font-bold text-white">Olá, eu sou o <span className="text-purple-500">VUXIO.</span></h2><p className="text-sm text-white/40">Em que posso ajudar?</p></div>
              )}
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-5">
              {logs.filter(l => l.source !== 'SYSTEM').map((log, idx, arr) => {
                const isLast      = idx === arr.length - 1;
                const isLastVuxio = isLast && log.source === 'VUXIO';
                const isVuxio     = log.source === 'VUXIO';
                return (
                  <div key={log.id} className={`flex gap-3 animate-fade-up ${log.source === 'USER' ? 'flex-row-reverse' : ''}`}>
                    {/* Avatar — stays aligned to top of bubble */}
                    {isVuxio && (
                      <div className="flex flex-col items-center gap-1 shrink-0">
                        <VuxioAvatar size={36} isConnected={isConnected} isSpeaking={isSpeaking && isLast} isCodeMode={isCodeMode} />
                      </div>
                    )}

                    {/* group wraps bubble + action bar so hover works on both */}
                    <div className={`group max-w-[85%] flex flex-col ${log.source === 'USER' ? 'items-end' : 'items-start'}`}>
                      <span className="text-[10px] text-white/20 mb-1">{log.timestamp}</span>

                      {/* Message bubble */}
                      <div className={`px-4 py-3 text-sm rounded-2xl ${
                        log.source === 'USER'
                          ? isCodeMode
                            ? 'bg-green-600/15 border border-green-500/25 text-white font-mono'
                            : 'bg-purple-600/20 border border-purple-500/30 text-white'
                          : isCodeMode
                            ? 'bg-green-900/10 border border-green-500/15 text-green-50'
                            : 'bg-white/5 border border-white/10 text-gray-200'
                      }`}>
                        <MarkdownMessage text={log.text} isCodeMode={isCodeMode} />
                        {isStreaming && isLastVuxio && (
                          <span className={`inline-block w-[2px] h-[1em] ml-0.5 align-middle ${isCodeMode ? 'bg-green-400' : 'bg-purple-400'}`}
                            style={{ animation: 'VUXIO-cursor 0.8s ease-in-out infinite' }} />
                        )}
                      </div>

                      {/* Action bar — below bubble, visible on hover */}
                      {isVuxio && log.text && (
                        <div className="flex items-center gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                          <CopyButton text={log.text} isCodeMode={isCodeMode} />
                          {isLastVuxio && !isLoading && !isStreaming && (
                            <button
                              onClick={() => regenerate(user?.displayName || 'Utilizador')}
                              className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg transition-colors ${
                                isCodeMode
                                  ? 'text-green-400/50 hover:text-green-400 hover:bg-green-500/10'
                                  : 'text-white/30 hover:text-white/70 hover:bg-white/5'
                              }`}
                            >
                              <RefreshCw size={11} />
                              Regenerar
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Waiting indicator (before first streaming token) */}
              {isLoading && !isStreaming && (
                <div className="flex gap-3 items-center animate-fade-up">
                  <VuxioAvatar size={36} isConnected={isConnected} isSpeaking={true} isCodeMode={isCodeMode} />
                  <div className={`px-4 py-3 rounded-2xl text-sm flex items-center gap-2 ${
                    isSearching
                      ? 'bg-cyan-900/10 border border-cyan-500/20 text-cyan-400/70'
                      : isCodeMode
                        ? 'bg-green-900/10 border border-green-500/15 font-mono text-green-400/70'
                        : 'bg-white/5 border border-white/10 text-white/40'
                  }`}>
                    {isSearching && <Globe size={13} className="shrink-0" />}
                    <span>{isSearching ? 'A pesquisar na web' : 'A pensar'}</span>
                    <span className="flex gap-1 items-center">
                      {[0, 1, 2].map(i => (
                        <span key={i} className={`w-1.5 h-1.5 rounded-full inline-block ${isSearching ? 'bg-cyan-400' : isCodeMode ? 'bg-green-400' : 'bg-white/40'}`}
                          style={{ animation: `VUXIO-twinkle 1.1s ease-in-out ${i * 0.22}s infinite` }} />
                      ))}
                    </span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </main>
        <div className="p-4 sm:p-6"><InputBar onSend={handleSend} isLoading={isLoading} isConnected={isConnected} isCodeMode={isCodeMode} /></div>
      </div>
      <style>{`
        @keyframes VUXIO-orbit { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes VUXIO-orbit-r { from { transform: rotate(360deg); } to { transform: rotate(0deg); } }
        @keyframes VUXIO-twinkle { 0%, 100% { opacity: 0.5; transform: scale(1); } 50% { opacity: 1; transform: scale(1.5); } }
        @keyframes VUXIO-core-pulse { 0%, 100% { transform: translate(-50%,-50%) scale(1); opacity: 0.7; } 50% { transform: translate(-50%,-50%) scale(1.35); opacity: 1; } }
        .VUXIO-scroll::-webkit-scrollbar { width: 4px; }
        .VUXIO-scroll::-webkit-scrollbar-thumb { background: rgba(124,58,237,0.2); border-radius: 4px; }
        .animate-fade-up { animation: fade-up 0.3s ease-out forwards; }
        @keyframes fade-up { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes VUXIO-cursor { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
      `}</style>
    </div>
  );
};

export default App;