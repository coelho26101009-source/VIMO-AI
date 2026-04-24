import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy, Check } from 'lucide-react';

const CopyButton: React.FC<{ text: string }> = ({ text }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-md bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-all"
    >
      {copied
        ? <><Check size={12} className="text-green-400" /><span className="text-green-400">Copiado</span></>
        : <><Copy size={12} /><span>Copiar</span></>}
    </button>
  );
};

export const MarkdownMessage: React.FC<{ text: string }> = ({ text }) => (
  <ReactMarkdown
    components={{
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      code({ inline, className, children, ...props }: any) {
        const match = /language-(\w+)/.exec(className || '');
        const content = String(children).replace(/\n$/, '');
        return !inline && match ? (
          <div className="relative my-3 rounded-lg overflow-hidden border border-white/10 bg-[#0d0d0d]">
            <div className="flex items-center justify-between px-4 py-2 bg-[#1a1a1a] border-b border-white/5">
              <span className="text-xs text-purple-300 font-bold uppercase tracking-wider">{match[1]}</span>
              <CopyButton text={content} />
            </div>
            <SyntaxHighlighter
              style={vscDarkPlus}
              language={match[1]}
              PreTag="div"
              className="!bg-[#0d0d0d] !p-4 !m-0 text-sm !overflow-x-auto"
              {...props}
            >
              {content}
            </SyntaxHighlighter>
          </div>
        ) : (
          <code className="bg-black/30 px-1.5 py-0.5 rounded text-purple-300 text-xs border border-purple-500/10" {...props}>
            {children}
          </code>
        );
      },
      p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
      ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>,
      ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>,
      li: ({ children }) => <li className="leading-relaxed">{children}</li>,
      h1: ({ children }) => <h1 className="text-lg font-bold mb-2 text-purple-300">{children}</h1>,
      h2: ({ children }) => <h2 className="text-base font-bold mb-2 text-purple-300">{children}</h2>,
      h3: ({ children }) => <h3 className="text-sm font-bold mb-1 text-purple-200">{children}</h3>,
      strong: ({ children }) => <strong className="font-bold text-white">{children}</strong>,
    }}
  >
    {text}
  </ReactMarkdown>
);
