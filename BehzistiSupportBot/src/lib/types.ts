export type KnowledgeSource = "faq" | "circular" | "law";

export type KnowledgeDoc = {
  id: string;
  source: KnowledgeSource;
  title: string;
  text: string;
  tags: string[];
  /** Apps that can use this doc; empty / ["*"] = all apps */
  appIds?: string[];
  meta?: Record<string, string>;
};

export type RetrievedChunk = {
  doc: KnowledgeDoc;
  score: number;
};

export type ChatRole = "user" | "assistant" | "system" | "agent";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
  sources?: Array<{ id: string; title: string; source: KnowledgeSource; score: number }>;
  confidence?: number;
};

export type SessionStatus = "bot" | "waiting_agent" | "with_agent" | "closed";

export type ChatSession = {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: SessionStatus;
  messages: ChatMessage[];
  userLabel?: string;
  appId?: string;
  agentId?: string;
  agentName?: string;
};

export type ChatApiResponse = {
  sessionId: string;
  message: ChatMessage;
  status: SessionStatus;
  handoffSuggested: boolean;
};
