/**
 * Chat Memory — Session persistence for Dynatrace Intelligence conversations
 *
 * Uses localStorage for persistence (no additional API scopes required).
 * Supports multiple sessions with auto-pruning to stay within storage limits.
 */

import type { ChatMessage, FollowUpChip } from "../agent/types";

const STORAGE_KEY = "gcc-intelligence-sessions";
const SESSION_INDEX_KEY = "gcc-intelligence-session-index";
const MAX_SESSIONS = 20;
const MAX_MESSAGES_PER_SESSION = 100;

// ============================================
// Types
// ============================================

export interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

interface StoredMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  toolsUsed?: string[];
  selectionMethod?: "semantic" | "ai" | "keyword";
  followUps?: FollowUpChip[];
  // blocks are NOT stored (too large, re-run if needed)
}

// ============================================
// Session CRUD
// ============================================

function loadSessionIndex(): ChatSession[] {
  try {
    const raw = localStorage.getItem(SESSION_INDEX_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveSessionIndex(sessions: ChatSession[]): void {
  try {
    localStorage.setItem(SESSION_INDEX_KEY, JSON.stringify(sessions));
  } catch {
    // Storage full — prune oldest sessions
    pruneOldSessions(sessions, Math.floor(sessions.length / 2));
  }
}

function sessionStorageKey(sessionId: string): string {
  return `${STORAGE_KEY}-${sessionId}`;
}

/**
 * List all saved chat sessions (most recent first)
 */
export function listSessions(): ChatSession[] {
  return loadSessionIndex().sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

/**
 * Create a new chat session
 */
export function createSession(title = "New Investigation"): ChatSession {
  const sessions = loadSessionIndex();

  // Auto-prune if over limit
  if (sessions.length >= MAX_SESSIONS) {
    pruneOldSessions(sessions, MAX_SESSIONS - 1);
  }

  const session: ChatSession = {
    id: `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messageCount: 0,
  };

  sessions.push(session);
  saveSessionIndex(sessions);
  return session;
}

/**
 * Delete a session and its messages
 */
export function deleteSession(sessionId: string): void {
  const sessions = loadSessionIndex().filter(s => s.id !== sessionId);
  saveSessionIndex(sessions);
  try {
    localStorage.removeItem(sessionStorageKey(sessionId));
  } catch { /* ignore */ }
}

/**
 * Rename a session
 */
export function renameSession(sessionId: string, title: string): void {
  const sessions = loadSessionIndex();
  const session = sessions.find(s => s.id === sessionId);
  if (session) {
    session.title = title;
    saveSessionIndex(sessions);
  }
}

/**
 * Get or create the active (most recent) session
 */
export function getOrCreateActiveSession(): ChatSession {
  const sessions = listSessions();
  if (sessions.length > 0) return sessions[0];
  return createSession("New Investigation");
}

// ============================================
// Message CRUD
// ============================================

/**
 * Load all messages for a session
 */
export function loadMessages(sessionId: string): ChatMessage[] {
  try {
    const raw = localStorage.getItem(sessionStorageKey(sessionId));
    if (!raw) return [];
    const stored: StoredMessage[] = JSON.parse(raw);
    return stored.map(m => ({
      ...m,
      timestamp: new Date(m.timestamp),
    }));
  } catch {
    return [];
  }
}

/**
 * Save all messages for a session (overwrites existing)
 */
export function saveMessages(sessionId: string, messages: ChatMessage[]): void {
  const stored: StoredMessage[] = messages.slice(-MAX_MESSAGES_PER_SESSION).map(m => ({
    id: m.id,
    role: m.role,
    content: m.content,
    timestamp: m.timestamp.toISOString(),
    toolsUsed: m.toolsUsed,
    selectionMethod: m.selectionMethod,
    followUps: m.followUps,
  }));

  try {
    localStorage.setItem(sessionStorageKey(sessionId), JSON.stringify(stored));
  } catch {
    // Storage full — trim messages
    const trimmed = stored.slice(-Math.floor(MAX_MESSAGES_PER_SESSION / 2));
    try {
      localStorage.setItem(sessionStorageKey(sessionId), JSON.stringify(trimmed));
    } catch { /* give up silently */ }
  }

  // Update session index
  const sessions = loadSessionIndex();
  const session = sessions.find(s => s.id === sessionId);
  if (session) {
    session.updatedAt = new Date().toISOString();
    session.messageCount = stored.length;
    // Auto-title from first user message
    if (session.title === "New Investigation" && stored.length > 0) {
      const firstUserMsg = stored.find(m => m.role === "user");
      if (firstUserMsg) {
        session.title = firstUserMsg.content.slice(0, 50) + (firstUserMsg.content.length > 50 ? "..." : "");
      }
    }
    saveSessionIndex(sessions);
  }
}

/**
 * Append a single message to a session
 */
export function appendMessage(sessionId: string, message: ChatMessage): void {
  const messages = loadMessages(sessionId);
  messages.push(message);
  saveMessages(sessionId, messages);
}

/**
 * Get conversation history formatted for the AI tool selector
 */
export function getConversationHistory(
  sessionId: string,
  maxMessages = 10
): Array<{ role: string; content: string }> {
  const messages = loadMessages(sessionId);
  return messages
    .slice(-maxMessages)
    .map(m => ({ role: m.role, content: m.content }));
}

// ============================================
// Cleanup
// ============================================

function pruneOldSessions(sessions: ChatSession[], keepCount: number): void {
  // Sort by updatedAt ascending (oldest first)
  sessions.sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());
  const toRemove = sessions.splice(0, sessions.length - keepCount);
  for (const s of toRemove) {
    try {
      localStorage.removeItem(sessionStorageKey(s.id));
    } catch { /* ignore */ }
  }
  saveSessionIndex(sessions);
}

/**
 * Clear all sessions and messages
 */
export function clearAllSessions(): void {
  const sessions = loadSessionIndex();
  for (const s of sessions) {
    try {
      localStorage.removeItem(sessionStorageKey(s.id));
    } catch { /* ignore */ }
  }
  try {
    localStorage.removeItem(SESSION_INDEX_KEY);
  } catch { /* ignore */ }
}
