import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy, Check, Terminal as TerminalIcon } from 'lucide-react';
import type { LogMessage } from '../types';

interface TerminalProps {
  logs: LogMessage[];
}

const CopyButton: React.FC<{ text: string }> = ({ text }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={handleCopy} className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-md bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-all">
      {copied
        ? <><Check size={12} className="text-green-400" /><span className="text-green-400">Copiado</span></>
        : <><Copy size={12} /><span>Copiar</span></>}
    </button>
  );
};

export const Terminal: React.FC<TerminalProps> = ({ logs }) => {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const sourceLabel: Record<LogMessage['source'], string> = {
    USER: 'TU',
    VIMO: 'Vimo AI',
    SYSTEM: 'SYS',
    ERROR: 'ERR',
  };

  const sourceColor: Record<LogMessage['source'], string> = {
    USER: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
    VIMO: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10',
    SYSTEM: 'text-slate-400 border-slate-500/20 bg-slate-500/5',
    ERROR: 'text-red-400 border-red-500/30 bg-red-500/10',
  };

  const bubbleColor: Record<LogMessage['source'], string> = {
    USER: 'bg-amber-500/10 border-amber-500/15 text-amber-50',
    VIMO: 'bg-[#1e2235] border-white/8 text-gray-100',
    SYSTEM: 'bg-transparent border-transparent text-slate-500 text-xs font-mono',
    ERROR: 'bg-red-900/10 border-red-500/15 text-red-200',
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#0f111a] font-mono text-sm">
      <div className="flex items-center justify-between px-4 py-3 bg-[#1a1d2e] border-b border-white/5 shrink-0">
        <div className="flex items-center gap-2 text-amber-500/70">
          <TerminalIcon size={14} />
          <span className="text-xs font-bold tracking-wider uppercase">Output Log</span>
        </div>
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500/20 border border-red-500/40" />
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500/20 border border-amber-500/40" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-500/20 border border-green-500/40" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5 scrollbar-thin scrollbar-thumb-amber-900/20">
        {logs.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-white/10 select-none">
            <TerminalIcon size={40} className="mb-3 opacity-20" />
            <p className="uppercase tracking-widest text-xs">A aguardar input...</p>
          </div>
        )}

        {logs.map(log => (
          <div key={log.id} className={`flex gap-3 ${log.source === 'USER' ? 'flex-row-reverse' : ''} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
            <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center border text-[9px] font-bold mt-1 ${sourceColor[log.source]}`}>
              {sourceLabel[log.source] === 'Vimo AI' ? 'IA' : sourceLabel[log.source]}
            </div>

            <div className={`flex flex-col max-w-[85%] ${log.source === 'USER' ? 'items-end' : 'items-start'}`}>
              <span className="text-[10px] text-white/25 mb-1 px-1">
                {log.timestamp} {log.source === 'VIMO' ? '· Vimo' : log.source === 'SYSTEM' ? '· Sistema' : ''}
              </span>
              <div className={`relative px-4 py-3 rounded-2xl border backdrop-blur-sm overflow-hidden ${bubbleColor[log.source]} ${log.source === 'USER' ? 'rounded-tr-sm' : 'rounded-tl-sm'}`}>
                {log.source === 'SYSTEM' ? (
                  <span>{'> '}{log.text}</span>
                ) : (
                  <ReactMarkdown
                    components={{
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      code({ inline, className, children, ...props }: any) {
                        const match = /language-(\w+)/.exec(className || '');
                        return !inline && match ? (
                          <div className="relative my-3 rounded-lg overflow-hidden border border-white/10 bg-[#0d0d0d]">
                            <div className="flex items-center justify-between px-4 py-2 bg-[#1a1a1a] border-b border-white/5">
                              <span className="text-xs text-amber-400 font-bold uppercase tracking-wider">{match[1]}</span>
                              <CopyButton text={String(children).replace(/\n$/, '')} />
                            </div>
                            <SyntaxHighlighter
                              style={vscDarkPlus}
                              language={match[1]}
                              PreTag="div"
                              className="!bg-[#0d0d0d] !p-4 !m-0 text-sm !overflow-x-auto"
                              {...props}
                            >
                              {String(children).replace(/\n$/, '')}
                            </SyntaxHighlighter>
                          </div>
                        ) : (
                          <code className="bg-black/30 px-1.5 py-0.5 rounded text-amber-300 text-xs border border-amber-500/10" {...props}>
                            {children}
                          </code>
                        );
                      },
                      p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
                      ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>,
                      li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                      h1: ({ children }) => <h1 className="text-lg font-bold mb-2 text-amber-400">{children}</h1>,
                      h2: ({ children }) => <h2 className="text-base font-bold mb-2 text-amber-300">{children}</h2>,
                      h3: ({ children }) => <h3 className="text-sm font-bold mb-1 text-amber-200">{children}</h3>,
                      strong: ({ children }) => <strong className="font-bold text-amber-200">{children}</strong>,
                    }}
                  >
                    {log.text}
                  </ReactMarkdown>
                )}
              </div>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
};