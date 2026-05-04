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
const userDoc  = (uid: string)              => doc(db, 'users', uid);
const chatsCol = (uid: string)              => collection(db, 'users', uid, 'chats');
const chatDoc  = (uid: string, cid: string) => doc(db, 'users', uid, 'chats', cid);
const msgsCol  = (uid: string, cid: string) => collection(db, 'users', uid, 'chats', cid, 'messages');

// ── AI config ─────────────────────────────────────────────────────────────────
const TEXT_MODEL   = 'llama-3.3-70b-versatile';
const VISION_MODEL = 'llama-3.2-11b-vision-preview';
const GROQ_API_KEY = (import.meta as any).env.VITE_GROQ_API_KEY as string;
const GROQ_API_URL = (import.meta as any).env.VITE_GROQ_API_URL || 'https://api.groq.com/openai/v1/chat/completions';
const MAX_HISTORY  = 30;

type ApiMsg = { role: string; content: unknown };

const normalizeSource = (s: string): LogMessage['source'] =>
  (s === 'HELIOS' || s === 'VIMO') ? 'VUXIO' : s as LogMessage['source'];

const normalizeMsg = (d: Record<string, unknown>): LogMessage => ({
  id:        (d.id        as string) ?? '',
  source:    normalizeSource((d.source as string) ?? ''),
  text:      (d.text      as string) ?? '',
  timestamp: (d.timestamp as string) ?? '',
});

// ── Groq streaming ────────────────────────────────────────────────────────────
const streamGroq = async (
  msgs: ApiMsg[],
  model: string,
  temp: number,
  onChunk: (partial: string) => void,
): Promise<string> => {
  const res = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_API_KEY}` },
    body: JSON.stringify({ model, messages: msgs, temperature: temp, stream: true }),
  });
  if (!res.ok) throw new Error(`Groq ${res.status}: ${res.statusText}`);

  const reader  = res.body!.getReader();
  const decoder = new TextDecoder();
  let full = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    for (const line of decoder.decode(value, { stream: true }).split('\n')) {
      if (!line.startsWith('data: ') || line.trim() === 'data: [DONE]') continue;
      try {
        const delta = (JSON.parse(line.slice(6)).choices?.[0]?.delta?.content as string) ?? '';
        if (delta) { full += delta; onChunk(full); }
      } catch { /* malformed chunk — skip */ }
    }
  }
  return full;
};

// ── Gemini streaming ──────────────────────────────────────────────────────────
const streamGemini = async (
  msgs: ApiMsg[],
  systemPrompt: string,
  onChunk: (partial: string) => void,
): Promise<string> => {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${CODE_MODEL}:streamGenerateContent?key=${GEMINI_API_KEY}&alt=sse`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: msgs.filter(m => m.role !== 'system').map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content as string }],
      })),
      generationConfig: { temperature: 0.3 },
    }),
  });

  if (res.status === 429 || (!res.ok && res.status >= 500)) {
    console.warn(`Gemini ${res.status} — fallback Groq`);
    return streamGroq(msgs, TEXT_MODEL, 0.3, onChunk);
  }
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${res.statusText}`);

  const reader  = res.body!.getReader();
  const decoder = new TextDecoder();
  let full = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    for (const line of decoder.decode(value, { stream: true }).split('\n')) {
      if (!line.startsWith('data: ')) continue;
      try {
        const text = JSON.parse(line.slice(6)).candidates?.[0]?.content?.parts?.[0]?.text as string ?? '';
        if (text) { full += text; onChunk(full); }
      } catch { /* skip */ }
    }
  }
  return full;
};

// ── Auto-generate chat title via AI ──────────────────────────────────────────
const generateTitle = async (firstMsg: string): Promise<string> => {
  try {
    const res = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_API_KEY}` },
      body: JSON.stringify({
        model: TEXT_MODEL,
        messages: [
          { role: 'system', content: 'Gera um título curtíssimo (máximo 4 palavras, sem pontuação nem aspas) para uma conversa que começa com esta mensagem. Responde APENAS com o título.' },
          { role: 'user',   content: firstMsg.slice(0, 200) },
        ],
        temperature: 0.4,
        max_tokens: 12,
      }),
    });
    if (!res.ok) return firstMsg.slice(0, 40);
    const title = ((await res.json()).choices?.[0]?.message?.content as string)?.trim();
    return title || firstMsg.slice(0, 40);
  } catch {
    return firstMsg.slice(0, 40);
  }
};

// ─────────────────────────────────────────────────────────────────────────────

export const useChat = (user: User | null, onReply: (text: string) => void, codeMode = false) => {
  const [logs,          setLogs]          = useState<LogMessage[]>([]);
  const [chatList,      setChatList]      = useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [isLoading,     setIsLoading]     = useState(false);
  const [isStreaming,   setIsStreaming]   = useState(false);

  // Refs — always current values without re-creating callbacks
  const userRef    = useRef(user);
  const logsRef    = useRef(logs);
  const chatIdRef  = useRef(currentChatId);
  const codeModeRef = useRef(codeMode);
  userRef.current   = user;
  logsRef.current   = logs;
  chatIdRef.current = currentChatId;
  codeModeRef.current = codeMode;

  const makeId        = () => Math.random().toString(36).substring(2, 9);
  const makeTimestamp = () => new Date().toLocaleTimeString('pt-PT', { hour12: false });
  const makeMsg       = (source: LogMessage['source'], text: string): LogMessage =>
    ({ id: makeId(), source, text, timestamp: makeTimestamp() });

  // ── Core AI call (shared by sendMessage + regenerate) ─────────────────────
  const callAI = useCallback(async (
    history: LogMessage[],
    userMsg: LogMessage,
    attachment: Attachment | null,
    userName: string,
    onChunk: (partial: string) => void,
  ): Promise<string> => {
    const cm = codeModeRef.current;
    const systemPrompt = cm
      ? buildCodeSystemPrompt(userName)
      : `Tu és o VUXIO, assistente simpático criado pelo Simão. Utilizador: ${userName}. Responde em PT-PT, tom caloroso e direto. Regras: (1) Código só se pedido explicitamente. (2) Máx 5-6 linhas salvo pedido de texto longo. (3) Sem frases de enchimento. (4) Não repitas o que o utilizador disse.`;

    const apiMsgs: ApiMsg[] = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-MAX_HISTORY).flatMap(l => {
        if (l.source === 'USER')  return [{ role: 'user',      content: l.text }];
        if (l.source === 'VUXIO') return [{ role: 'assistant', content: l.text }];
        return [];
      }),
    ];

    if (attachment) {
      apiMsgs.push({ role: 'user', content: [
        { type: 'text',      text: userMsg.text || 'Analisa este ficheiro.' },
        { type: 'image_url', image_url: { url: `data:${attachment.file.type};base64,${attachment.base64}` } },
      ]});
    } else {
      apiMsgs.push({ role: 'user', content: userMsg.text });
    }

    return cm
      ? streamGemini(apiMsgs, systemPrompt, onChunk)
      : streamGroq(apiMsgs, attachment ? VISION_MODEL : TEXT_MODEL, 0.7, onChunk);
  }, []);

  // ── Subscribe: real-time chat list ────────────────────────────────────────
  const subscribeToChats = useCallback((uid: string) => {
    setDoc(userDoc(uid), {
      email:       userRef.current?.email       ?? '',
      displayName: userRef.current?.displayName ?? '',
      lastSeen:    serverTimestamp(),
    }, { merge: true });

    const q = query(chatsCol(uid), orderBy('updatedAt', 'desc'));
    return onSnapshot(q, snap => {
      setChatList(snap.docs.map(d => ({
        id:         d.id,
        title:      (d.data().title      as string)  ?? 'Sem título',
        isCodeMode: (d.data().isCodeMode as boolean) ?? false,
      })));
    });
  }, []);

  // ── Load chat ─────────────────────────────────────────────────────────────
  const loadChat = useCallback(async (chatId: string) => {
    const uid = userRef.current?.uid;
    if (!uid) return;
    setLogs([]);
    setCurrentChatId(chatId);
    const snap = await getDocs(query(msgsCol(uid, chatId), orderBy('createdAt', 'asc')));
    setLogs(snap.docs.map(d => normalizeMsg(d.data() as Record<string, unknown>)));
  }, []);

  const newChat = useCallback(() => { setCurrentChatId(null); setLogs([]); }, []);

  // ── Delete chat + all messages ────────────────────────────────────────────
  const deleteChat = useCallback(async (chatId: string) => {
    const uid = userRef.current?.uid;
    if (!uid) return;
    const msgs = await getDocs(msgsCol(uid, chatId));
    await Promise.all(msgs.docs.map(d => deleteDoc(d.ref)));
    await deleteDoc(chatDoc(uid, chatId));
    if (chatIdRef.current === chatId) { setCurrentChatId(null); setLogs([]); }
  }, []);

  // ── Send message ──────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (
    text: string,
    attachment: Attachment | null,
    userName: string,
  ) => {
    if (isLoading) return;
    const uid     = userRef.current?.uid ?? null;
    const history = logsRef.current;

    const userMsg      = makeMsg('USER', text || `📎 ${attachment?.file.name}`);
    const logsWithUser = [...history, userMsg];

    // Stream placeholder
    const streamId  = makeId();
    const timestamp = makeTimestamp();
    const placeholder: LogMessage = { id: streamId, source: 'VUXIO', text: '', timestamp };

    setLogs([...logsWithUser, placeholder]);
    setIsLoading(true);
    setIsStreaming(true);

    let replyText = '';
    try {
      replyText = await callAI(history, userMsg, attachment, userName, partial => {
        setLogs(prev => prev.map(m => m.id === streamId ? { ...m, text: partial } : m));
      });
    } catch (err) {
      console.error('[VUXIO]', err);
      const cm = codeModeRef.current;
      setLogs([...logsWithUser, makeMsg('ERROR',
        cm ? 'Erro ao contactar o Gemini.' : 'Falha na comunicação. Tenta novamente.'
      )]);
      setIsLoading(false); setIsStreaming(false);
      return;
    }

    const vuxioMsg: LogMessage = { id: streamId, source: 'VUXIO', text: replyText, timestamp };
    setIsStreaming(false);
    setIsLoading(false);
    onReply(replyText);

    if (!uid) return;
    try {
      const cm  = codeModeRef.current;
      let   cid = chatIdRef.current;

      if (!cid) {
        const titlePromise = generateTitle(text);
        const ref = await addDoc(chatsCol(uid), {
          title:      text.slice(0, 45) || 'Nova conversa',
          isCodeMode: cm,
          createdAt:  serverTimestamp(),
          updatedAt:  serverTimestamp(),
        });
        cid = ref.id;
        setCurrentChatId(cid);
        titlePromise.then(title => updateDoc(chatDoc(uid, cid!), { title })).catch(() => {});
      } else {
        await updateDoc(chatDoc(uid, cid), { updatedAt: serverTimestamp() });
      }

      await Promise.all([
        addDoc(msgsCol(uid, cid), { ...userMsg,  createdAt: serverTimestamp() }),
        addDoc(msgsCol(uid, cid), { ...vuxioMsg, createdAt: serverTimestamp() }),
      ]);
    } catch (err) {
      console.error('[Firebase]', err);
    }
  }, [isLoading, callAI, onReply]);

  // ── Regenerate last response ──────────────────────────────────────────────
  const regenerate = useCallback(async (userName: string) => {
    if (isLoading) return;
    const current = logsRef.current;

    let lastUserIdx = -1;
    for (let i = current.length - 1; i >= 0; i--) {
      if (current[i].source === 'USER') { lastUserIdx = i; break; }
    }
    if (lastUserIdx === -1) return;

    const lastUserMsg = current[lastUserIdx];
    const history     = current.slice(0, lastUserIdx);
    const trimmed     = current.slice(0, lastUserIdx + 1);

    const streamId  = makeId();
    const timestamp = makeTimestamp();
    const placeholder: LogMessage = { id: streamId, source: 'VUXIO', text: '', timestamp };

    setLogs([...trimmed, placeholder]);
    setIsLoading(true);
    setIsStreaming(true);

    let replyText = '';
    try {
      replyText = await callAI(history, lastUserMsg, null, userName, partial => {
        setLogs(prev => prev.map(m => m.id === streamId ? { ...m, text: partial } : m));
      });
    } catch (err) {
      console.error('[VUXIO regenerate]', err);
      setLogs(trimmed);
      setIsLoading(false); setIsStreaming(false);
      return;
    }

    const vuxioMsg: LogMessage = { id: streamId, source: 'VUXIO', text: replyText, timestamp };
    setIsStreaming(false);
    setIsLoading(false);
    onReply(replyText);

    const uid = userRef.current?.uid;
    const cid = chatIdRef.current;
    if (uid && cid) {
      try {
        await Promise.all([
          addDoc(msgsCol(uid, cid), { ...vuxioMsg, createdAt: serverTimestamp() }),
          updateDoc(chatDoc(uid, cid), { updatedAt: serverTimestamp() }),
        ]);
      } catch (err) { console.error('[Firebase regenerate]', err); }
    }
  }, [isLoading, callAI, onReply]);

  return {
    logs, chatList, currentChatId, isLoading, isStreaming,
    sendMessage, regenerate, newChat, loadChat, deleteChat, subscribeToChats,
  };
};
