import api from "./api";
import { HISTORY_STORAGE_KEY } from "../utils/constants";
import { getJson, setJson } from "../utils/storage";
import type { HistoryFilters, HistoryRecord, HistoryType } from "../types/History";

const MAX_HISTORY_ITEMS = 250;

class HistoryService {
  private inFlightPosts = new Set<string>();

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

    // Always persist locally first for instant UX
    const next = [entry, ...this.getAll()].slice(0, MAX_HISTORY_ITEMS);
    setJson(HISTORY_STORAGE_KEY, next);

    // Attempt to persist to backend (non-blocking). Deduplicate in-flight posts.
    try {
      const postKey = `${entry.searchType}:${JSON.stringify(entry.parameters)}`;
      if (this.inFlightPosts.has(postKey)) return entry;
      this.inFlightPosts.add(postKey);

      let endpoint: string | null = null;
      switch (entry.searchType) {
        case "AI":
          endpoint = "/ai/history";
          break;
        case "PNR":
          endpoint = "/pnr/history";
          break;
        case "TRAIN":
        case "LIVE":
        case "ROUTE":
          endpoint = "/trains/history";
          break;
        default:
          endpoint = null;
      }

      if (endpoint) {
        void api.post(endpoint, {
          id: entry.id,
          searchType: entry.searchType,
          parameters: entry.parameters,
          request: entry.request,
          response: entry.response,
          responseSummary: entry.responseSummary,
          timestamp: entry.timestamp,
        }).catch((err) => {
          // log but don't revert local write
          // eslint-disable-next-line no-console
          console.warn("Failed to POST history to backend:", err);
        }).finally(() => {
          try { this.inFlightPosts.delete(postKey); } catch {}
        });
      } else {
        // No endpoint mapped; remove key
        this.inFlightPosts.delete(postKey);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("History post scheduling failed:", err);
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