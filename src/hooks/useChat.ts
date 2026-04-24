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

// Compatibilidade: mensagens antigas guardadas com source='HELIOS' ficam mapeadas para 'VIMO'.
const normalizeMessage = (m: any): LogMessage => ({
  ...m,
  source: m.source === 'HELIOS' ? 'VIMO' : m.source,
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

    try {
      const systemPrompt = codeMode
        ? `Tu és o Vimo em modo PROGRAMADOR, assistente técnico de código criado pelo Simão. Utilizador: ${userName}. Responde em PT-PT. Tom direto, zero preâmbulos. Nunca repitas o enunciado nem confirmes que entendeste. Código sempre completo e executável com linguagem indicada nos blocos. Comentários só onde o porquê não é óbvio. Aponta erros pela causa raiz. Pede esclarecimento se ambíguo.`
        : `Tu és o Vimo, assistente do VimoMind AI criado pelo Simão. Utilizador: ${userName}. Responde em PT-PT com tom amigável e direto. Não uses frases de enchimento como "Claro!", "Com certeza!" ou "Boa pergunta!". Não repitas o que o utilizador disse. Vai direto ao conteúdo. Código em blocos com linguagem indicada.`;

      const apiMessages: { role: string; content: unknown }[] = [
        { role: 'system', content: systemPrompt },
      ];

      // Janela deslizante — só envia as últimas N mensagens para preservar contexto sem estourar tokens.
      const recentLogs = logs.slice(-MAX_HISTORY_MESSAGES);
      recentLogs.forEach(l => {
        if (l.source === 'USER') apiMessages.push({ role: 'user', content: l.text });
        if (l.source === 'VIMO') apiMessages.push({ role: 'assistant', content: l.text });
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
      // Quando se usa um proxy, a chave fica do lado do servidor — não a enviamos do cliente.
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
      const replyText = (data.choices[0]?.message?.content as string) || 'Sem resposta.';

      const vimoMsg: LogMessage = {
        id: makeId(),
        source: 'VIMO',
        text: replyText,
        timestamp: makeTimestamp(),
      };

      const updatedLogs = [...currentLogs, vimoMsg];
      setLogs(updatedLogs);
      onReply(replyText);

      if (user) {
        if (!currentChatId) {
          // Chat novo — cria doc + subcoleção 'messages'.
          const chatRef = await addDoc(collection(db, 'chats'), {
            userId: user.uid,
            title: text.substring(0, 35) || 'Nova Conversa',
            updatedAt: serverTimestamp(),
          });
          await Promise.all([
            addDoc(collection(db, 'chats', chatRef.id, 'messages'), { ...userMsg, createdAt: serverTimestamp() }),
            addDoc(collection(db, 'chats', chatRef.id, 'messages'), { ...vimoMsg, createdAt: serverTimestamp() }),
          ]);
          setCurrentChatId(chatRef.id);
          setIsLegacyChat(false);
        } else if (isLegacyChat) {
          // Mantém compatibilidade com chats antigos que guardam tudo num array.
          await updateDoc(doc(db, 'chats', currentChatId), {
            updatedAt: serverTimestamp(),
            messages: updatedLogs,
          });
        } else {
          // Append incremental: só escreve as duas mensagens novas, não reescreve tudo.
          await Promise.all([
            addDoc(collection(db, 'chats', currentChatId, 'messages'), { ...userMsg, createdAt: serverTimestamp() }),
            addDoc(collection(db, 'chats', currentChatId, 'messages'), { ...vimoMsg, createdAt: serverTimestamp() }),
            updateDoc(doc(db, 'chats', currentChatId), { updatedAt: serverTimestamp() }),
          ]);
        }
      }
    } catch (e: unknown) {
      console.error(e);
      addLog('ERROR', 'Falha na comunicação com o servidor. Tenta novamente.');
    } finally {
      setIsLoading(false);
    }
  }, [logs, isLoading, currentChatId, isLegacyChat, user, onReply, addLog]);

  return {
    logs, chatList, currentChatId, isLoading,
    addLog, sendMessage, newChat, loadChat, deleteChat, subscribeToChats,
  };
};