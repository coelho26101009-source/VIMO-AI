import { useState, useCallback } from 'react';
import type { User } from 'firebase/auth';
import {
  collection, query, where, orderBy, onSnapshot,
  addDoc, updateDoc, doc, serverTimestamp, getDoc, deleteDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import type { LogMessage, Chat, Attachment } from '../types';

const TEXT_MODEL = 'llama-3.3-70b-versatile';
const VISION_MODEL = 'llama-3.2-11b-vision-preview';
const GROQ_API_KEY = (import.meta as any).env.VITE_GROQ_API_KEY;

export const useChat = (user: User | null, onReply: (text: string) => void) => {
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const [chatList, setChatList] = useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

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
    return onSnapshot(
      q,
      snapshot => {
        setChatError(null);
        setChatList(snapshot.docs.map(d => ({ id: d.id, title: d.data().title })));
      },
      (err) => {
        console.error('Firestore subscribe error:', err);
        setChatList([]);
        if ((err as { code?: string })?.code === 'permission-denied') {
          setChatError('Sem permissões no Firestore para ler as conversas (permission-denied).');
          addLog('ERROR', 'Sem permissões para carregar conversas. Verifica as regras do Firestore.');
        } else {
          setChatError('Erro ao carregar conversas.');
          addLog('ERROR', 'Erro ao carregar conversas.');
        }
      }
    );
  }, []);

  const loadChat = useCallback(async (id: string) => {
    try {
      setChatError(null);
      setCurrentChatId(id);
      const chatDoc = await getDoc(doc(db, 'chats', id));
      if (chatDoc.exists()) {
        setLogs(chatDoc.data().messages || []);
        addLog('SYSTEM', 'Histórico carregado.');
      }
    } catch (err) {
      console.error('Erro ao carregar chat:', err);
      if ((err as { code?: string })?.code === 'permission-denied') {
        setChatError('Sem permissões no Firestore para carregar esta conversa.');
        addLog('ERROR', 'Sem permissões para carregar esta conversa (Firestore).');
      } else {
        setChatError('Erro ao carregar conversa.');
        addLog('ERROR', 'Erro ao carregar conversa.');
      }
    }
  }, [addLog]);

  const newChat = useCallback(() => {
    setCurrentChatId(null);
    setLogs([]);
  }, []);

  const deleteChat = useCallback(async (id: string) => {
    if (!user) return;
    try {
      setChatError(null);
      await deleteDoc(doc(db, 'chats', id));
      if (currentChatId === id) {
        setCurrentChatId(null);
        setLogs([]);
      }
      addLog('SYSTEM', 'Conversa apagada.');
    } catch (err) {
      console.error('Erro ao apagar chat:', err);
      if ((err as { code?: string })?.code === 'permission-denied') {
        setChatError('Sem permissões no Firestore para apagar conversas.');
        addLog('ERROR', 'Sem permissões para apagar conversas (Firestore).');
      } else {
        setChatError('Erro ao apagar conversa.');
        addLog('ERROR', 'Erro ao apagar conversa.');
      }
    }
  }, [user, currentChatId, addLog]);

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
      const apiMessages: { role: string; content: unknown }[] = [
        {
          role: 'system',
          content: `Tu és o Vimo, o assistente inteligente do VimoMind AI, criado pelo Simão. Estás a falar com ${userName}. Responde sempre em Português de Portugal (PT-PT), com um tom profissional mas acessível. Quando apresentares código, usa blocos de código com a linguagem indicada.`,
        },
      ];

      logs.forEach(l => {
        if (l.source === 'USER') apiMessages.push({ role: 'user', content: l.text });
        if (l.source === 'HELIOS') apiMessages.push({ role: 'assistant', content: l.text });
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

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
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
        source: 'HELIOS',
        text: replyText,
        timestamp: makeTimestamp(),
      };

      const updatedLogs = [...currentLogs, vimoMsg];
      setLogs(updatedLogs);
      onReply(replyText);

      if (user) {
        if (!currentChatId) {
          try {
            const docRef = await addDoc(collection(db, 'chats'), {
              userId: user.uid,
              title: text.substring(0, 35) || 'Nova Conversa',
              updatedAt: serverTimestamp(),
              messages: updatedLogs,
            });
            setCurrentChatId(docRef.id);
          } catch (err) {
            console.error('Erro ao criar conversa no Firestore:', err);
            if ((err as { code?: string })?.code === 'permission-denied') {
              setChatError('Sem permissões no Firestore para criar conversas.');
              addLog('ERROR', 'Sem permissões para guardar conversas (Firestore).');
            }
          }
        } else {
          try {
            await updateDoc(doc(db, 'chats', currentChatId), {
              updatedAt: serverTimestamp(),
              messages: updatedLogs,
            });
          } catch (err) {
            console.error('Erro ao atualizar conversa no Firestore:', err);
            if ((err as { code?: string })?.code === 'permission-denied') {
              setChatError('Sem permissões no Firestore para atualizar conversas.');
              addLog('ERROR', 'Sem permissões para guardar conversas (Firestore).');
            }
          }
        }
      }
    } catch (e: unknown) {
      console.error(e);
      addLog('ERROR', 'Falha na comunicação com o servidor. Tenta novamente.');
    } finally {
      setIsLoading(false);
    }
  }, [logs, isLoading, currentChatId, user, onReply, addLog]);

  return {
    logs, chatList, currentChatId, isLoading,
    chatError,
    addLog, sendMessage, newChat, loadChat, deleteChat, subscribeToChats,
  };
};
