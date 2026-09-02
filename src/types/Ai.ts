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

export interface AiChatRequest {
	message: string;
}

export interface AiChatResponse {
	reply: string;
}

export interface AiChatResponseEnvelope {
	reply?: string;
	message?: string;
	response?: string;
	data?: AiChatResponseEnvelope;
}

export interface AiTrainAnalysisItem {
	trainNumber: string;
	trainName: string;
	trainType: string;
	source: {
		code: string;
		name: string;
	};
	destination: {
		code: string;
		name: string;
	};
	departure: string;
	arrival: string;
	duration: string;
	distanceKm: number;
	runningDays: string[];
	availableClasses: string[];
}

export interface AiTrainAnalysisResponse {
	insightMessage: string;
	fastestTrain?: Record<string, unknown>;
	longestTrain?: Record<string, unknown>;
}

export interface AiHistoryRecord {
	id: string | number;
	searchType: string;
	parameters?: Record<string, unknown>;
	request?: unknown;
	response?: unknown;
	responseSummary?: string;
	timestamp: string;
}
