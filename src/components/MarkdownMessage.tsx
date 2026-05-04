import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy, Check, Download } from 'lucide-react';

const EXT_MAP: Record<string, string> = {
  typescript: 'ts', javascript: 'js', tsx: 'tsx', jsx: 'jsx',
  python: 'py', html: 'html', css: 'css', scss: 'scss',
  rust: 'rs', go: 'go', java: 'java', kotlin: 'kt',
  cpp: 'cpp', c: 'c', csharp: 'cs', php: 'php',
  ruby: 'rb', swift: 'swift', dart: 'dart', bash: 'sh',
  shell: 'sh', sh: 'sh', sql: 'sql', json: 'json',
  yaml: 'yaml', yml: 'yml', toml: 'toml', markdown: 'md',
  xml: 'xml', svg: 'svg', graphql: 'graphql',
};

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

const DownloadButton: React.FC<{ text: string; language: string }> = ({ text, language }) => {
  const ext = EXT_MAP[language.toLowerCase()] ?? 'txt';
  const handleDownload = () => {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `VUXIO_code.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  return (
    <button
      onClick={handleDownload}
      className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-md bg-green-500/10 hover:bg-green-500/20 text-green-400 hover:text-green-300 transition-all"
      title={`Descarregar como .${ext}`}
    >
      <Download size={12} />
      <span>.{ext}</span>
    </button>
  );
};

export const MarkdownMessage: React.FC<{ text: string; isCodeMode?: boolean }> = ({ text, isCodeMode = false }) => (
  <ReactMarkdown
    components={{
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      code({ inline, className, children, ...props }: any) {
        const match = /language-(\w+)/.exec(className || '');
        const content = String(children).replace(/\n$/, '');
        return !inline && match ? (
          <div className={`relative my-3 rounded-lg overflow-hidden border bg-[#0d0d0d] ${isCodeMode ? 'border-green-500/20' : 'border-white/10'}`}>
            <div className={`flex items-center justify-between px-4 py-2 border-b ${isCodeMode ? 'bg-[#0a130b] border-green-500/10' : 'bg-[#1a1a1a] border-white/5'}`}>
              <span className={`text-xs font-bold uppercase tracking-wider font-mono ${isCodeMode ? 'text-green-400' : 'text-purple-300'}`}>
                {isCodeMode ? `> ${match[1]}` : match[1]}
              </span>
              <div className="flex items-center gap-2">
                {isCodeMode && <DownloadButton text={content} language={match[1]} />}
                <CopyButton text={content} />
              </div>
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
          <code
            className={`px-1.5 py-0.5 rounded text-xs border font-mono ${
              isCodeMode
                ? 'bg-green-900/20 text-green-400 border-green-500/20'
                : 'bg-black/30 text-purple-300 border-purple-500/10'
            }`}
            {...props}
          >
            {children}
          </code>
        );
      },
      p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
      ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>,
      ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>,
      li: ({ children }) => <li className="leading-relaxed">{children}</li>,
      h1: ({ children }) => <h1 className={`text-lg font-bold mb-2 ${isCodeMode ? 'text-green-400 font-mono' : 'text-purple-300'}`}>{children}</h1>,
      h2: ({ children }) => <h2 className={`text-base font-bold mb-2 ${isCodeMode ? 'text-green-400 font-mono' : 'text-purple-300'}`}>{children}</h2>,
      h3: ({ children }) => <h3 className={`text-sm font-bold mb-1 ${isCodeMode ? 'text-green-300 font-mono' : 'text-purple-200'}`}>{children}</h3>,
      strong: ({ children }) => <strong className="font-bold text-white">{children}</strong>,
      a: ({ href, children }) => (
        <a href={href} target="_blank" rel="noopener noreferrer" className="text-purple-400 underline hover:text-purple-300 transition-colors">
          {children}
        </a>
      ),
    }}
  >
    {text}
  </ReactMarkdown>
);