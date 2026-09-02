import api from "./api";
import type {
  AiChatRequest,
  AiChatResponseEnvelope,
  AiHistoryRecord,
  AiLimitSummary,
  AiTrainAnalysisItem,
  AiTrainAnalysisResponse,
} from "../types/Ai";
import type { PnrData, PnrAnalysis } from "../types/Pnr";

const aiService = {
  sendMessage(payload: AiChatRequest) {
    return api.post<AiChatResponseEnvelope>("/ai/assistant/chat", payload);
  },

  getLimit() {
    return api.get<AiLimitSummary>("/ai/assistant/limit");
  },

  analyzeTrains(payload: AiTrainAnalysisItem[]) {
    return api.post<AiTrainAnalysisResponse>("/ai/analyze-trains", payload);
  },

  analyzePnr(payload: PnrData) {
    return api.post<PnrAnalysis | { success: boolean; data: PnrAnalysis }>("/ai/analyze-pnr", payload);
  },

  getHistory() {
    return api.get<AiHistoryRecord[]>("/ai/history");
  },

  deleteHistoryItem(historyId: string | number) {
    return api.delete<void>(`/ai/history/${encodeURIComponent(historyId)}`);
  },

  clearHistory() {
    return api.delete<void>("/ai/history");
  },
};

export default aiService;