import api from "./api";
import type { AiLimitSummary } from "../types/Ai";
import type { PnrData, PnrAnalysis } from "../types/Pnr";

export interface AiChatRequest {
  message: string;
}

export interface AiChatResponse {
  response: string;
}

const aiService = {
  sendMessage(payload: AiChatRequest) {
    return api.post<AiChatResponse>("/ai/assistant/chat", payload);
  },

  getLimit() {
    return api.get<AiLimitSummary>("/ai/assistant/limit");
  },

  analyzeTrains(payload: unknown) {
    return api.post<unknown>("/ai/analyze-trains", payload);
  },

  analyzePnr(payload: PnrData) {
    return api.post<PnrAnalysis | { success: boolean; data: PnrAnalysis }>("/ai/analyze-pnr", payload);
  },
};

export default aiService;