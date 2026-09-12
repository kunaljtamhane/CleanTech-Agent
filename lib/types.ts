export interface Citation {
  source_type: string;
  title: string;
  url: string;
  date: string;
  domain: string;
}

export interface ChatSummary {
  id: string;
  title: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  chatId: string;
  role: "user" | "assistant";
  content: string;
  blocked: boolean;
  citations: Citation[] | null;
  createdAt: string;
}
