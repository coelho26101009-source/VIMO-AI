import { useState, useCallback } from 'react';
import type { User } from 'firebase/auth';
import {
  collection, query, where, orderBy, onSnapshot,
  addDoc, updateDoc, doc, serverTimestamp, getDoc, getDocs, deleteDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { LogMessage, Chat, Attachment } from '../types';

const TEXT_MODEL = 'llama-3.3-70b-versatile';
const VISION_MODEL = 'llama-3.2-11b-vision-preview';
const GROQ_API_KEY = (import.meta as any).env.VITE_GROQ_API_KEY;
// Permite redirecionar para um proxy (recomendado em produção para esconder a API key).
const GROQ_API_URL =
  (import.meta as any).env.VITE_GROQ_API_URL ||
  'https://api.groq.com/openai/v1/chat/completions';

// Janela deslizante: número de mensagens enviadas como contexto à API.
// Mantém memória da conversa sem estourar o limite de tokens da Groq.
const MAX_HISTORY_MESSAGES = 30;

// Compatibilidade: mensagens antigas no Firebase com source='HELIOS' ou 'VIMO' sao mapeadas para 'VUXIO'.
const normalizeMessage = (m: any): LogMessage => ({
  ...m,
  source: (m.source === 'HELIOS' || m.source === 'VIMO') ? 'VUXIO' : m.source,
});

export const useChat = (user: User | null, onReply: (text: string) => void, codeMode = false) => {
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const [chatList, setChatList] = useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  // Chats antigos (formato array no doc) continuam a usar esse formato; novos usam subcoleção.
  const [isLegacyChat, setIsLegacyChat] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const makeId = () => Math.random().toString(36).substring(2, 9);
  const makeTimestamp = () => new Date().toLocaleTimeString('pt-PT', { hour12: false });

  const addLog = useCallback((source: LogMessage['source'], text: string) => {
    const msg: LogMessage = { id: makeId(), source, text, timestamp: makeTimestamp() };
    setLogs(prev => [...prev, msg]);
    return msg;
  }, []);

  const subscribeToChats = useCallback((userId: string) => {
    const q = query(
      collection(db, 'chats'),
      where('userId', '==', userId),
      orderBy('updatedAt', 'desc')
    );
    return onSnapshot(q, snapshot => {
      setChatList(snapshot.docs.map(d => ({ id: d.id, title: d.data().title })));
    });
  }, []);

  const loadChat = useCallback(async (id: string) => {
    setCurrentChatId(id);
    const chatDoc = await getDoc(doc(db, 'chats', id));
    if (!chatDoc.exists()) return;

    const data = chatDoc.data();
    let messages: LogMessage[];

    if (Array.isArray(data.messages)) {
      messages = data.messages.map(normalizeMessage);
      setIsLegacyChat(true);
    } else {
      const msgsSnap = await getDocs(
        query(collection(db, 'chats', id, 'messages'), orderBy('createdAt', 'asc'))
      );
      messages = msgsSnap.docs.map(d => normalizeMessage(d.data()));
      setIsLegacyChat(false);
    }

    setLogs(messages);
    addLog('SYSTEM', 'Histórico carregado.');
  }, [addLog]);

  const newChat = useCallback(() => {
    setCurrentChatId(null);
    setIsLegacyChat(false);
    setLogs([]);
  }, []);

  const deleteChat = useCallback(async (id: string) => {
    await deleteDoc(doc(db, 'chats', id));
    if (currentChatId === id) {
      setCurrentChatId(null);
      setLogs([]);
    }
  }, [currentChatId]);

  const sendMessage = useCallback(async (
    text: string,
    attachment: Attachment | null,
    userName: string
  ) => {
    if (isLoading) return;

    const userMsg: LogMessage = {
      id: makeId(),
      source: 'USER',
      text: text || `📎 ${attachment?.file.name}`,
      timestamp: makeTimestamp(),
    };

    const currentLogs = [...logs, userMsg];
    setLogs(currentLogs);
    setIsLoading(true);

    // ── 1. Chamada à API do Groq ────────────────────────────────
    let replyText = '';
    try {
      const systemPrompt = codeMode
        ? `Tu és o VUXIO em modo PROGRAMADOR, assistente técnico criado pelo Simão. Utilizador: ${userName}. Responde em PT-PT. Tom direto e sem preâmbulos. Regras obrigatórias: (1) Só escreves código se o utilizador pedir explicitamente para criar, fazer, escrever ou corrigir código. (2) Se a pergunta for teórica ou conceptual, responde em texto, nunca em código. (3) Respostas curtas: máximo 5-6 linhas, exceto quando o utilizador pedir algo longo como um projeto completo, composição ou explicação detalhada. (4) Nunca repitas o enunciado. (5) Pede esclarecimento se a pergunta for ambígua.`
        : `Tu és o VUXIO, assistente simpático e amigo criado pelo Simão. Utilizador: ${userName}. Responde sempre em PT-PT com tom caloroso, natural e direto — como um amigo que sabe muito. Regras obrigatórias: (1) Só escreves código se o utilizador pedir explicitamente para criar, fazer, escrever ou corrigir código. Para perguntas normais, responde em texto simples. (2) Respostas curtas: máximo 5-6 linhas. Só escreves mais quando o utilizador pedir uma composição, texto longo, explicação detalhada ou lista extensa. (3) Não uses frases de enchimento como "Claro!", "Com certeza!" ou "Boa pergunta!". (4) Não repitas o que o utilizador disse. (5) Se não souberes algo, diz com honestidade.`;

      const apiMessages: { role: string; content: unknown }[] = [
        { role: 'system', content: systemPrompt },
      ];

      const recentLogs = logs.slice(-MAX_HISTORY_MESSAGES);
      recentLogs.forEach(l => {
        if (l.source === 'USER') apiMessages.push({ role: 'user', content: l.text });
        if (l.source === 'VUXIO') apiMessages.push({ role: 'assistant', content: l.text });
      });

      if (attachment) {
        apiMessages.push({
          role: 'user',
          content: [
            { type: 'text', text: text || 'Analisa este ficheiro detalhadamente.' },
            { type: 'image_url', image_url: { url: `data:${attachment.file.type};base64,${attachment.base64}` } },
          ],
        });
      } else {
        apiMessages.push({ role: 'user', content: text });
      }

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (GROQ_API_KEY) headers.Authorization = `Bearer ${GROQ_API_KEY}`;

      const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: attachment ? VISION_MODEL : TEXT_MODEL,
          messages: apiMessages,
          temperature: 0.7,
        }),
      });

      if (!response.ok) throw new Error(`Groq API: ${response.statusText}`);
      const data = await response.json();
      replyText = (data.choices[0]?.message?.content as string) || 'Sem resposta.';
    } catch (e: unknown) {
      console.error(e);
      addLog('ERROR', 'Falha na comunicação com o servidor. Tenta novamente.');
      setIsLoading(false);
      return;
    }

    // ── 2. Mostra a resposta na UI ───────────────────────────────
    const VUXIOMsg: LogMessage = {
      id: makeId(), source: 'VUXIO', text: replyText, timestamp: makeTimestamp(),
    };
    const updatedLogs = [...currentLogs, VUXIOMsg];
    setLogs(updatedLogs);
    setIsLoading(false);
    onReply(replyText);

    // ── 3. Guarda no Firebase (falha silenciosa — não afeta a conversa) ──
    if (!user) return;
    try {
      if (!currentChatId) {
        const chatRef = await addDoc(collection(db, 'chats'), {
          userId: user.uid,
          title: text.substring(0, 35) || 'Nova Conversa',
          updatedAt: serverTimestamp(),
        });
        // Define o ID antes de guardar mensagens para não perder referência em caso de erro parcial
        setCurrentChatId(chatRef.id);
        setIsLegacyChat(false);
        await Promise.all([
          addDoc(collection(db, 'chats', chatRef.id, 'messages'), { ...userMsg, createdAt: serverTimestamp() }),
          addDoc(collection(db, 'chats', chatRef.id, 'messages'), { ...VUXIOMsg, createdAt: serverTimestamp() }),
        ]);
      } else if (isLegacyChat) {
        await updateDoc(doc(db, 'chats', currentChatId), {
          updatedAt: serverTimestamp(),
          messages: updatedLogs,
        });
      } else {
        await Promise.all([
          addDoc(collection(db, 'chats', currentChatId, 'messages'), { ...userMsg, createdAt: serverTimestamp() }),
          addDoc(collection(db, 'chats', currentChatId, 'messages'), { ...VUXIOMsg, createdAt: serverTimestamp() }),
          updateDoc(doc(db, 'chats', currentChatId), { updatedAt: serverTimestamp() }),
        ]);
      }
    } catch (firebaseErr: unknown) {
      // Erro silencioso — a conversa continua na memória sem interromper o utilizador
      console.error('[Firebase]', firebaseErr);
    }
  }, [logs, isLoading, currentChatId, isLegacyChat, user, onReply, addLog]);

  return {
    logs, chatList, currentChatId, isLoading,
    addLog, sendMessage, newChat, loadChat, deleteChat, subscribeToChats,
  };
};