export type WidgetMessageRole = "user" | "assistant" | "system" | "agent";

export type WidgetMessage = {
  id: string;
  role: WidgetMessageRole;
  content: string;
  createdAt: string;
  confidence?: number;
  sources?: Array<{ id: string; title: string; source: string; score: number }>;
};

export type WidgetSessionStatus = "bot" | "waiting_agent" | "with_agent" | "closed";

export type SupportChatConfig = {
  /** Base URL of AI / knowledge API, e.g. http://localhost:3040 */
  apiBaseUrl: string;
  /**
   * App / knowledge scope id so each host app gets related answers
   * (e.g. "paydisk", "aiticket", "behzisti-portal")
   */
  appId: string;
  /** Optional display title in the panel header */
  title?: string;
  /** Optional subtitle */
  subtitle?: string;
  /** User label sent to backend */
  userLabel?: string;
  /** Primary brand color (default Behzisti teal) */
  primaryColor?: string;
  /** Start opened */
  defaultOpen?: boolean;
  /** Position of floating launcher */
  position?: "bottom-left" | "bottom-right";
  /** Extra headers for AI API (auth token, etc.) */
  headers?: Record<string, string>;
  /** Called when live-agent handoff is suggested/requested */
  onHandoff?: (sessionId: string) => void;
};

export type ChatSendResponse = {
  sessionId: string;
  message: WidgetMessage;
  status: WidgetSessionStatus;
  handoffSuggested: boolean;
};
