import { useState, useCallback, useRef } from 'react';
import type { User } from 'firebase/auth';
import {
  collection, query, orderBy, onSnapshot,
  addDoc, updateDoc, setDoc, doc, serverTimestamp, getDocs, deleteDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { LogMessage, Chat, Attachment } from '../types';
import { CODE_MODEL, GEMINI_API_KEY, buildCodeSystemPrompt } from '../config/codeMode';

// ── Firestore paths ───────────────────────────────────────────────────────────
// Structure: users/{uid}/chats/{chatId}/messages/{msgId}
const userDoc    = (uid: string)              => doc(db, 'users', uid);
const chatsCol   = (uid: string)              => collection(db, 'users', uid, 'chats');
const chatDoc    = (uid: string, cid: string) => doc(db, 'users', uid, 'chats', cid);
const msgsCol    = (uid: string, cid: string) => collection(db, 'users', uid, 'chats', cid, 'messages');

// ── AI config ─────────────────────────────────────────────────────────────────
const TEXT_MODEL   = 'llama-3.3-70b-versatile';
const VISION_MODEL = 'llama-3.2-11b-vision-preview';
const GROQ_API_KEY = (import.meta as any).env.VITE_GROQ_API_KEY as string;
const GROQ_API_URL = (import.meta as any).env.VITE_GROQ_API_URL || 'https://api.groq.com/openai/v1/chat/completions';
const MAX_HISTORY  = 30;

const normalizeSource = (s: string): LogMessage['source'] =>
  (s === 'HELIOS' || s === 'VIMO') ? 'VUXIO' : s as LogMessage['source'];

const normalizeMsg = (data: Record<string, unknown>): LogMessage => ({
  id:        (data.id        as string) ?? '',
  source:    normalizeSource(data.source as string ?? ''),
  text:      (data.text      as string) ?? '',
  timestamp: (data.timestamp as string) ?? '',
});

// ─────────────────────────────────────────────────────────────────────────────

export const useChat = (user: User | null, onReply: (text: string) => void, codeMode = false) => {
  const [logs,          setLogs]          = useState<LogMessage[]>([]);
  const [chatList,      setChatList]      = useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [isLoading,     setIsLoading]     = useState(false);

  // Ref so callbacks always see the latest user without re-creating
  const userRef = useRef(user);
  userRef.current = user;

  const makeId        = () => Math.random().toString(36).substring(2, 9);
  const makeTimestamp = () => new Date().toLocaleTimeString('pt-PT', { hour12: false });
  const makeMsg       = (source: LogMessage['source'], text: string): LogMessage =>
    ({ id: makeId(), source, text, timestamp: makeTimestamp() });

  // ── Subscribe: loads chat list in real-time ───────────────────────────────
  const subscribeToChats = useCallback((uid: string) => {
    // Create/update user profile document so the Firebase console shows the email
    setDoc(userDoc(uid), {
      email:       userRef.current?.email       ?? '',
      displayName: userRef.current?.displayName ?? '',
      lastSeen:    serverTimestamp(),
    }, { merge: true });

    const q = query(chatsCol(uid), orderBy('updatedAt', 'desc'));
    return onSnapshot(q, snapshot => {
      setChatList(snapshot.docs.map(d => ({
        id:         d.id,
        title:      (d.data().title      as string)  ?? 'Sem título',
        isCodeMode: (d.data().isCodeMode as boolean) ?? false,
      })));
    });
  }, []);

  // ── Load a specific chat ──────────────────────────────────────────────────
  const loadChat = useCallback(async (chatId: string) => {
    const uid = userRef.current?.uid;
    if (!uid) return;

    setLogs([]);
    setCurrentChatId(chatId);

    const snap = await getDocs(query(msgsCol(uid, chatId), orderBy('createdAt', 'asc')));
    setLogs(snap.docs.map(d => normalizeMsg(d.data() as Record<string, unknown>)));
  }, []);

  // ── New blank chat ────────────────────────────────────────────────────────
  const newChat = useCallback(() => {
    setCurrentChatId(null);
    setLogs([]);
  }, []);

  // ── Delete a chat and all its messages ───────────────────────────────────
  const deleteChat = useCallback(async (chatId: string) => {
    const uid = userRef.current?.uid;
    if (!uid) return;

    const msgs = await getDocs(msgsCol(uid, chatId));
    await Promise.all(msgs.docs.map(d => deleteDoc(d.ref)));
    await deleteDoc(chatDoc(uid, chatId));

    if (currentChatId === chatId) {
      setCurrentChatId(null);
      setLogs([]);
    }
  }, [currentChatId]);

  // ── Send message ─────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (
    text: string,
    attachment: Attachment | null,
    userName: string,
  ) => {
    if (isLoading) return;
    const uid = userRef.current?.uid ?? null;

    const userMsg    = makeMsg('USER', text || `📎 ${attachment?.file.name}`);
    const logsWithMe = [...logs, userMsg];
    setLogs(logsWithMe);
    setIsLoading(true);

    // ── 1. Call AI ──────────────────────────────────────────────────────────
    let replyText = '';
    try {
      const systemPrompt = codeMode
        ? buildCodeSystemPrompt(userName)
        : `Tu és o VUXIO, assistente simpático e amigo criado pelo Simão. Utilizador: ${userName}. Responde sempre em PT-PT com tom caloroso, natural e direto — como um amigo que sabe muito. Regras: (1) Só escreves código se pedido explicitamente. (2) Máximo 5-6 linhas salvo pedido de texto longo. (3) Sem frases de enchimento. (4) Não repitas o que o utilizador disse. (5) Se não souberes, admite.`;

      const history = logs.slice(-MAX_HISTORY);
      const apiMsgs: { role: string; content: unknown }[] = [
        { role: 'system', content: systemPrompt },
        ...history.flatMap(l => {
          if (l.source === 'USER')  return [{ role: 'user',      content: l.text }];
          if (l.source === 'VUXIO') return [{ role: 'assistant', content: l.text }];
          return [];
        }),
      ];

      if (attachment) {
        apiMsgs.push({ role: 'user', content: [
          { type: 'text',      text: text || 'Analisa este ficheiro.' },
          { type: 'image_url', image_url: { url: `data:${attachment.file.type};base64,${attachment.base64}` } },
        ]});
      } else {
        apiMsgs.push({ role: 'user', content: text });
      }

      const callGroq = async (msgs: typeof apiMsgs, temp: number) => {
        const model = attachment ? VISION_MODEL : TEXT_MODEL;
        const res = await fetch(GROQ_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_API_KEY}` },
          body: JSON.stringify({ model, messages: msgs, temperature: temp }),
        });
        if (!res.ok) throw new Error(`Groq ${res.status}: ${res.statusText}`);
        return ((await res.json()).choices[0]?.message?.content as string) || 'Sem resposta.';
      };

      if (codeMode) {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${CODE_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
        const geminiRes = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: systemPrompt }] },
            contents: apiMsgs.filter(m => m.role !== 'system').map(m => ({
              role: m.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: m.content as string }],
            })),
            generationConfig: { temperature: 0.3 },
          }),
        });
        if (geminiRes.status === 429 || (!geminiRes.ok && geminiRes.status >= 500)) {
          console.warn(`Gemini ${geminiRes.status} — usando Groq como fallback.`);
          replyText = await callGroq(apiMsgs, 0.3);
        } else if (!geminiRes.ok) {
          throw new Error(`Gemini ${geminiRes.status}: ${geminiRes.statusText}`);
        } else {
          replyText = (await geminiRes.json()).candidates?.[0]?.content?.parts?.[0]?.text || 'Sem resposta.';
        }
      } else {
        replyText = await callGroq(apiMsgs, 0.7);
      }
    } catch (err) {
      console.error('[VUXIO]', err);
      const errMsg = makeMsg('ERROR',
        codeMode ? 'Erro ao contactar o Gemini. Verifica a chave da API.' : 'Falha na comunicação. Tenta novamente.'
      );
      setLogs([...logsWithMe, errMsg]);
      setIsLoading(false);
      return;
    }

    // ── 2. Show reply ───────────────────────────────────────────────────────
    const vuxioMsg    = makeMsg('VUXIO', replyText);
    const finalLogs   = [...logsWithMe, vuxioMsg];
    setLogs(finalLogs);
    setIsLoading(false);
    onReply(replyText);

    // ── 3. Save to Firestore ────────────────────────────────────────────────
    if (!uid) return;
    try {
      let cid = currentChatId;

      if (!cid) {
        // New chat: create document then save both messages
        const ref = await addDoc(chatsCol(uid), {
          title:      text.substring(0, 45) || 'Nova conversa',
          isCodeMode: codeMode,
          createdAt:  serverTimestamp(),
          updatedAt:  serverTimestamp(),
        });
        cid = ref.id;
        setCurrentChatId(cid);
      } else {
        // Existing chat: bump updatedAt
        await updateDoc(chatDoc(uid, cid), { updatedAt: serverTimestamp() });
      }

      await Promise.all([
        addDoc(msgsCol(uid, cid), { ...userMsg,  createdAt: serverTimestamp() }),
        addDoc(msgsCol(uid, cid), { ...vuxioMsg, createdAt: serverTimestamp() }),
      ]);
    } catch (err) {
      console.error('[Firebase]', err);
    }
  }, [logs, isLoading, currentChatId, onReply, codeMode]);

  return { logs, chatList, currentChatId, isLoading, sendMessage, newChat, loadChat, deleteChat, subscribeToChats };
};
