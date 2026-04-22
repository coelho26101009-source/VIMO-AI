import React, { useState, useEffect } from 'react';
interface VimoAvatarProps {
  size?: number;
  isSpeaking?: boolean;
  isConnected?: boolean;
}

export const VimoAvatar: React.FC<VimoAvatarProps> = ({
  size = 56,
  isSpeaking = false,
  isConnected = false,
}) => {
  const innerSize = size - 8;

  // 18 partículas com posições e animações únicas para "float" orgânico
  const particles = Array.from({ length: 18 }, (_, i) => {
    const angle = (i / 18) * 2 * Math.PI;
    const ring = i % 3; // 3 anéis
    const r = 8 + ring * 3.5;
    const x = 20 + r * Math.cos(angle);
    const y = 20 + r * Math.sin(angle);
    const dotR = 0.7 + (i % 2) * 0.7;
    const color = i % 3 === 0 ? '#e879f9' : i % 3 === 1 ? '#818cf8' : '#a78bfa';
    // Cada partícula tem a sua própria duração e delay para parecer viva
    const dur = 2.4 + (i * 0.31) % 2.2;
    const delay = -((i * 0.47) % dur); // negativo = começa já a meio
    const dx = (Math.cos(angle + 0.8) * 1.8).toFixed(2);
    const dy = (Math.sin(angle + 0.8) * 1.8).toFixed(2);
    return { x, y, dotR, color, dur, delay, dx, dy, i };
  });

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size, flexShrink: 0 }}
    >
      {/* Anel exterior girante */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: 'conic-gradient(from 0deg, #7c3aed, #a855f7, #ec4899, #6366f1, #7c3aed)',
          padding: 1.5,
          borderRadius: '50%',
          animation: isConnected ? 'vimo-spin 5s linear infinite' : 'none',
          opacity: isConnected ? 1 : 0.25,
        }}
      >
        <div className="w-full h-full rounded-full" style={{ background: '#13132b' }} />
      </div>

      {/* Anel de atividade ao falar (suave, sem ping) */}
      {isSpeaking && (
        <div
          className="absolute rounded-full"
          style={{
            inset: -4,
            border: '2px solid rgba(168,85,247,0.35)',
            animation: 'vimo-ring-breathe 1.6s ease-in-out infinite',
          }}
        />
      )}

      {/* Esfera interior */}
      <div
        className="relative z-10 rounded-full overflow-hidden flex items-center justify-center"
        style={{
          width: innerSize,
          height: innerSize,
          background: 'radial-gradient(circle at 35% 30%, #9333ea, #4f46e5 55%, #1e1b4b)',
          boxShadow: isConnected
            ? `0 0 ${isSpeaking ? 20 : 10}px rgba(168,85,247,${isSpeaking ? 0.5 : 0.3}), inset 0 0 10px rgba(255,255,255,0.06)`
            : '0 0 4px rgba(168,85,247,0.1)',
        }}
      >
        {/* Partículas SVG com float orgânico */}
        <svg
          viewBox="0 0 40 40"
          className="w-full h-full absolute inset-0"
          style={{ opacity: isConnected ? 1 : 0.15 }}
        >
          <defs>
            {particles.map(p => (
              <style key={`s${p.i}`}>{`
                @keyframes vf${p.i} {
                  0%   { transform: translate(0px, 0px) scale(1); opacity: ${(0.5 + (p.i % 4) * 0.12).toFixed(2)}; }
                  33%  { transform: translate(${p.dx}px, ${(parseFloat(p.dy) * 0.6).toFixed(2)}px) scale(1.25); opacity: 0.95; }
                  66%  { transform: translate(${(parseFloat(p.dx) * -0.5).toFixed(2)}px, ${p.dy}px) scale(0.85); opacity: ${(0.4 + (p.i % 3) * 0.15).toFixed(2)}; }
                  100% { transform: translate(0px, 0px) scale(1); opacity: ${(0.5 + (p.i % 4) * 0.12).toFixed(2)}; }
                }
              `}</style>
            ))}
          </defs>

          {particles.map(p => (
            <circle
              key={p.i}
              cx={p.x}
              cy={p.y}
              r={p.dotR}
              fill={p.color}
              style={{
                animation: isConnected
                  ? `vf${p.i} ${p.dur}s ease-in-out infinite ${p.delay}s`
                  : 'none',
                transformOrigin: `${p.x}px ${p.y}px`,
              }}
            />
          ))}

          {/* Ponto central fixo e brilhante */}
          <circle cx="20" cy="20" r="2.2" fill="white" opacity="0.75" />
          <circle cx="20" cy="20" r="1" fill="white" opacity="0.95" />
        </svg>
      </div>

      <style>{`
        @keyframes vimo-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes vimo-ring-breathe {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50%       { opacity: 0.7; transform: scale(1.05); }
        }
      `}</style>
    </div>
  );
};
