import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Paperclip, Send, X } from 'lucide-react';
import type { Attachment } from '../types';

interface InputBarProps {
  onSend: (text: string, attachment: Attachment | null) => void;
  isLoading: boolean;
  isConnected: boolean;
}

export const InputBar: React.FC<InputBarProps> = ({ onSend, isLoading, isConnected }) => {
  const [text, setText] = useState('');
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const canSend = (text.trim().length > 0 || attachment !== null) && !isLoading && isConnected;

  // Listen for mic transcript
  useEffect(() => {
    const handler = (e: Event) => {
      const transcript = (e as CustomEvent<string>).detail;
      setText(prev => prev ? `${prev} ${transcript}` : transcript);
      textareaRef.current?.focus();
    };
    window.addEventListener('VUXIO-transcript', handler);
    return () => window.removeEventListener('VUXIO-transcript', handler);
  }, []);

  const handleSend = useCallback(() => {
    if (!canSend) return;
    onSend(text.trim(), attachment);
    setText('');
    setAttachment(null);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }, [canSend, text, attachment, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('Ficheiro demasiado grande. Máximo: 5MB.');
      if (fileRef.current) fileRef.current.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = ev => {
      const base64 = (ev.target?.result as string).split(',')[1];
      setAttachment({ file, base64 });
    };
    reader.readAsDataURL(file);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="px-6 pb-6 pt-2 shrink-0">
      {/* Attachment pill */}
      {attachment && (
        <div className="flex items-center gap-2 mb-3 px-4 py-2 rounded-xl mx-auto max-w-2xl"
          style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(139,92,246,0.2)' }}>
          <Paperclip size={13} className="text-purple-400 shrink-0" />
          <span className="text-xs text-purple-300 truncate">{attachment.file.name}</span>
          <button onClick={() => setAttachment(null)} className="ml-auto text-white/30 hover:text-red-400 transition-colors">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Input wrapper */}
      <div
        className="flex items-end gap-3 px-4 py-3 rounded-2xl mx-auto max-w-2xl transition-all duration-200"
        style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(139,92,246,0.2)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
        }}
        onFocus={() => {}}
      >
        {/* Clip */}
        <button
          onClick={() => fileRef.current?.click()}
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all"
          style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.35)' }}
          onMouseEnter={e => { e.currentTarget.style.color = '#a78bfa'; e.currentTarget.style.background = 'rgba(124,58,237,0.15)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.35)'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
        >
          <Paperclip size={17} />
        </button>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={e => setText(e.target.value)}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={!isConnected || isLoading}
          placeholder={
            !isConnected ? 'A conectar...' :
            isLoading ? 'VUXIO está a pensar...' :
            'Escreve a tua mensagem...'
          }
          className="flex-1 bg-transparent border-none outline-none resize-none text-sm leading-relaxed"
          style={{
            color: '#ececec',
            minHeight: '22px',
            maxHeight: '120px',
            fontFamily: "'Sora', sans-serif",
          }}
        />

        {/* Send */}
        <button
          onClick={handleSend}
          disabled={!canSend}
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all duration-200"
          style={{
            background: canSend
              ? 'linear-gradient(135deg, #7c3aed, #6366f1)'
              : 'rgba(255,255,255,0.06)',
            boxShadow: canSend ? '0 4px 16px rgba(124,58,237,0.4)' : 'none',
            color: canSend ? 'white' : 'rgba(255,255,255,0.2)',
          }}
        >
          <Send size={16} />
        </button>
      </div>

      <p className="text-center text-xs mt-2.5" style={{ color: 'rgba(255,255,255,0.18)' }}>
        Enter para enviar · Shift+Enter para nova linha
      </p>

      <input ref={fileRef} type="file" accept="image/*,application/pdf" onChange={handleFile} className="hidden" />
    </div>
  );
};
