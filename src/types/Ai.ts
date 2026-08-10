export interface AiConversationMessage {
	id: string;
	role: "user" | "assistant";
	content: string;
	createdAt: string;
}

export interface AiConversation {
	id: string;
	title: string;
	createdAt: string;
	updatedAt: string;
	messages: AiConversationMessage[];
	pinned?: boolean;
}

export interface AiLimitSummary {
	limit: number;
	used: number;
	remaining: number;
	resetAt: string;
}
