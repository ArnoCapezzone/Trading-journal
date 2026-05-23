// Conversation persistence (localStorage)
import type { Message } from './mentorClient';

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

const STORAGE_KEY = 'tj_mentor_conversations';
const MAX_CONVERSATIONS = 50;

function readAll(): Conversation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function writeAll(convos: Conversation[]) {
  try {
    // Cap to MAX, keep most recent
    const sorted = [...convos].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX_CONVERSATIONS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sorted));
  } catch (e) {
    console.error('Failed to save conversations', e);
  }
}

export function listConversations(): Conversation[] {
  return readAll().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getConversation(id: string): Conversation | null {
  return readAll().find((c) => c.id === id) ?? null;
}

export function saveConversation(convo: Conversation) {
  const all = readAll();
  const idx = all.findIndex((c) => c.id === convo.id);
  if (idx >= 0) all[idx] = convo;
  else all.push(convo);
  writeAll(all);
}

export function deleteConversation(id: string) {
  writeAll(readAll().filter((c) => c.id !== id));
}

export function createConversation(): Conversation {
  return {
    id: crypto.randomUUID(),
    title: 'New chat',
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// Auto-derive title from first user message
export function deriveTitle(messages: Message[]): string {
  const firstUser = messages.find((m) => m.role === 'user');
  if (!firstUser) return 'New chat';
  const text = firstUser.content.trim().replace(/\s+/g, ' ');
  return text.length > 48 ? text.slice(0, 48) + '…' : text;
}
