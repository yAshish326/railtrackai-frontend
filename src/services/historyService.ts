import api from "./api";
import { HISTORY_STORAGE_KEY } from "../utils/constants";
import { getJson, setJson } from "../utils/storage";
import type { HistoryFilters, HistoryRecord, HistoryType } from "../types/History";

const MAX_HISTORY_ITEMS = 250;

class HistoryService {
  getAll(): HistoryRecord[] {
    return getJson<HistoryRecord[]>(HISTORY_STORAGE_KEY, []);
  }

  list(filters?: Partial<HistoryFilters>): HistoryRecord[] {
    const query = (filters?.query ?? "").trim().toLowerCase();
    const type = filters?.type;
    const sort = filters?.sort ?? "newest";

    return this.getAll()
      .filter((record) => (type ? record.searchType === type : true))
      .filter((record) => {
        if (!query) return true;
        return [record.searchType, record.responseSummary, JSON.stringify(record.parameters)]
          .join(" ")
          .toLowerCase()
          .includes(query);
      })
      .sort((left, right) => (sort === "newest" ? right.timestamp.localeCompare(left.timestamp) : left.timestamp.localeCompare(right.timestamp)));
  }

  async record<TRequest, TResponse>(
    searchType: HistoryType,
    parameters: TRequest,
    response: TResponse,
    responseSummary: string,
  ): Promise<HistoryRecord<TRequest, TResponse>> {
    const entry: HistoryRecord<TRequest, TResponse> = {
      id: crypto.randomUUID(),
      searchType,
      parameters,
      request: parameters,
      response,
      responseSummary,
      timestamp: new Date().toISOString(),
    };

    const next = [entry, ...this.getAll()].slice(0, MAX_HISTORY_ITEMS);
    setJson(HISTORY_STORAGE_KEY, next);

    try {
      await api.post("/history", {
        id: entry.id,
        searchType: entry.searchType,
        parameters: entry.parameters,
        request: entry.request,
        response: entry.response,
        responseSummary: entry.responseSummary,
        timestamp: entry.timestamp,
      });
    } catch (error) {
      console.warn("Failed to persist history to backend:", error);
    }

    return entry;
  }

  remove(id: string): void {
    const next = this.getAll().filter((record) => record.id !== id);
    setJson(HISTORY_STORAGE_KEY, next);
  }

  clearByType(type: HistoryType): void {
    const next = this.getAll().filter((record) => record.searchType !== type);
    setJson(HISTORY_STORAGE_KEY, next);
  }

  clearAll(): void {
    setJson(HISTORY_STORAGE_KEY, []);
  }
}

export const historyService = new HistoryService();