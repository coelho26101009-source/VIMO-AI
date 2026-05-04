import { useState, useCallback } from 'react';
import type { User } from 'firebase/auth';
import {
  collection, query, where, orderBy, onSnapshot,
  addDoc, updateDoc, doc, serverTimestamp, getDoc, getDocs, deleteDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { LogMessage, Chat, Attachment } from '../types';
import { CODE_MODEL, GEMINI_API_KEY, buildCodeSystemPrompt } from '../config/codeMode';

const TEXT_MODEL = 'llama-3.3-70b-versatile';
const VISION_MODEL = 'llama-3.2-11b-vision-preview';
const GROQ_API_KEY = (import.meta as any).env.VITE_GROQ_API_KEY;
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
      where('userId', '==', userId)
    );
    return onSnapshot(q, snapshot => {
      const chats = snapshot.docs.map(d => ({
        id: d.id,
        title: d.data().title as string,
        updatedAt: d.data().updatedAt?.seconds ?? 0,
      }));
      chats.sort((a, b) => b.updatedAt - a.updatedAt);
      setChatList(chats.map(c => ({ id: c.id, title: c.title })));
    });
  }, []);

  const loadChat = useCallback(async (id: string) => {
    setLogs([]);
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
      messages = msgsSnap.docs.map(d => normalizeMessage(d.data() as LogMessage));
      setIsLegacyChat(false);
    }

    setLogs(messages);
  }, []);

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
        ? buildCodeSystemPrompt(userName)
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

      const callGroq = async (msgs: typeof apiMessages, temp: number) => {
        const model = attachment ? VISION_MODEL : TEXT_MODEL;
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (GROQ_API_KEY) headers.Authorization = `Bearer ${GROQ_API_KEY}`;
        const res = await fetch(GROQ_API_URL, {
          method: 'POST',
          headers,
          body: JSON.stringify({ model, messages: msgs, temperature: temp }),
        });
        if (!res.ok) throw new Error(`Groq API ${res.status}: ${res.statusText}`);
        const d = await res.json();
        return (d.choices[0]?.message?.content as string) || 'Sem resposta.';
      };

      if (codeMode) {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${CODE_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
        const geminiContents = apiMessages
          .filter(m => m.role !== 'system')
          .map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content as string }],
          }));
        const geminiRes = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: systemPrompt }] },
            contents: geminiContents,
            generationConfig: { temperature: 0.3 },
          }),
        });

        if (geminiRes.status === 429 || !geminiRes.ok && geminiRes.status >= 500) {
          // Quota esgotada ou erro do servidor — fallback para Groq com o mesmo prompt de código
          console.warn(`Gemini ${geminiRes.status}, a usar Groq como fallback.`);
          replyText = await callGroq(apiMessages, 0.3);
        } else if (!geminiRes.ok) {
          throw new Error(`Gemini API ${geminiRes.status}: ${geminiRes.statusText}`);
        } else {
          const geminiData = await geminiRes.json();
          replyText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || 'Sem resposta.';
        }
      } else {
        replyText = await callGroq(apiMessages, 0.7);
      }
    } catch (e: unknown) {
      console.error(e);
      const msg = codeMode
        ? 'Erro ao contactar o Gemini. Verifica a chave da API ou tenta novamente.'
        : 'Falha na comunicação com o servidor. Tenta novamente.';
      addLog('ERROR', msg);
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
          userEmail: user.email ?? '',
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