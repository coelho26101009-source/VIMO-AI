<div align="center">

<img src="public/vite.svg" width="72" alt="VIMO logo" />

# VIMO Mind AI

**Assistente de inteligência artificial conversacional com modo programador integrado**

[![Deploy](https://img.shields.io/badge/Vercel-Deployed-black?logo=vercel)](https://vercel.com)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript)](https://www.typescriptlang.org)
[![Firebase](https://img.shields.io/badge/Firebase-12-FFCA28?logo=firebase)](https://firebase.google.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-green)](./LICENSE)

</div>

---

## Sobre o Projeto

O **VIMO Mind AI** é uma aplicação web de chat com inteligência artificial, desenvolvida de raiz por **Simão**. Combina uma interface elegante e fluida com um backend de IA potente (LLaMA 3.3 70B via Groq API), autenticação com Google e persistência de conversas em tempo real.

Destaca-se pelo **Modo Programador** — um modo dedicado para developers, com tema visual verde, respostas técnicas e diretas, blocos de código com syntax highlighting, e opção de download dos ficheiros gerados.

---

## Funcionalidades

| Feature | Descrição |
|---|---|
| **Chat com IA** | Conversas com LLaMA 3.3 70B, rápido e preciso |
| **Modo Programador** | Tema verde, tom técnico, código completo e executável |
| **Download de código** | Descarrega os ficheiros gerados diretamente (.py, .html, .ts, …) |
| **Histórico de conversas** | Guardado em Firestore, acessível em qualquer dispositivo |
| **Autenticação Google** | Login seguro com Firebase Auth |
| **Modo convidado** | Usa sem conta — sem persistência |
| **Voz integrada** | Text-to-speech e reconhecimento de voz em PT-PT |
| **Upload de ficheiros** | Analisa imagens e PDFs via modelo de visão |
| **Avatar animado** | Esfera 3D com partículas e anéis orbitais |
| **Responsivo** | Sidebar retrátil, funciona em mobile e desktop |

---

## Stack Tecnológica

**Frontend**
- [React 19](https://react.dev) + [TypeScript 5.9](https://www.typescriptlang.org)
- [Vite 7](https://vitejs.dev) — bundler ultrarrápido
- [Tailwind CSS 3](https://tailwindcss.com) — utility-first styling
- [Framer Motion](https://www.framer.com/motion) — animações
- [Lucide React](https://lucide.dev) — ícones
- [React Syntax Highlighter](https://github.com/react-syntax-highlighter/react-syntax-highlighter) — blocos de código

**Backend / Serviços**
- [Groq API](https://groq.com) — inferência LLaMA 3.3 70B e LLaMA 3.2 Vision
- [Firebase Auth](https://firebase.google.com/products/auth) — autenticação Google
- [Firebase Firestore](https://firebase.google.com/products/firestore) — base de dados em tempo real
- [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API) — TTS + STT nativo do browser

---

## Começar

### Pré-requisitos

- **Node.js** ≥ 18
- Conta no [Groq](https://console.groq.com) para obter uma API key
- Projeto no [Firebase](https://console.firebase.google.com) com Auth e Firestore ativados

### Instalação

```bash
# 1. Clona o repositório
git clone https://github.com/coelho26101009-source/VIMO-AI.git
cd VIMO-AI

# 2. Instala dependências
npm install

# 3. Copia o ficheiro de variáveis de ambiente
cp .env.example .env
```

### Variáveis de Ambiente

Edita o ficheiro `.env` com as tuas credenciais:

```env
VITE_GROQ_API_KEY=gsk_...

VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

### Desenvolvimento

```bash
npm run dev
```

Abre [http://localhost:5173](http://localhost:5173) no browser.

### Build para produção

```bash
npm run build
```

---

## Regras Firestore (exemplo)

Para que a persistência de conversas funcione corretamente, define as seguintes regras no Firebase Console:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /chats/{chatId} {
      allow read, write: if request.auth != null
        && (resource == null || resource.data.userId == request.auth.uid)
        && (request.resource == null || request.resource.data.userId == request.auth.uid);

      match /messages/{msgId} {
        allow read, write: if request.auth != null;
      }
    }
  }
}
```

---

## Estrutura do Projeto

```
src/
├── components/
│   ├── InputBar.tsx          # Barra de input com anexos
│   ├── MarkdownMessage.tsx   # Renderer de markdown com syntax highlight e download
│   ├── Sidebar.tsx           # Painel lateral com histórico de conversas
│   ├── Terminal.tsx          # Componente alternativo de output
│   └── VimoAvatar.tsx        # Avatar animado (partículas + anéis)
├── hooks/
│   ├── useAuth.ts            # Firebase Auth — Google login + modo convidado
│   ├── useChat.ts            # Lógica de chat — Groq API + persistência Firebase
│   └── useSpeech.ts          # Web Speech API — TTS + STT em PT-PT
├── utils/
│   └── audioUtils.ts         # Conversão de áudio Base64/Uint8Array
├── App.tsx                   # Componente raiz — layout e estado global
├── firebase.ts               # Configuração Firebase
├── index.css                 # Estilos globais + Tailwind
├── main.tsx                  # Entry point React
└── types.ts                  # Tipos TypeScript partilhados
```

---

## Licença

Copyright © 2025 **Simão**. Todos os direitos reservados.

Este projeto está licenciado sob a [MIT License](./LICENSE).  
Podes usar, modificar e distribuir, desde que mantendo os créditos ao autor original.

---

<div align="center">
  <sub>Feito com ♥ por Simão · VIMO Mind AI v1.0</sub>
</div>