// Mohammad Shafay Joyo @ 2025

export interface Message {
  id: string;
  content: string;
  role: "user" | "assistant";
  createdAt: Date;
}

export interface Conversation {
  id: string;
  messages: Message[];
  status: "in_progress" | "completed" | "terminated";
  metadata?: {
    name?: string;
    position?: string;
    salary?: number;
    [key: string]: any;
  };
} 