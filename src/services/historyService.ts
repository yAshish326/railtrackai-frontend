import api from "./api";
import { HISTORY_STORAGE_KEY } from "../utils/constants";
import { getJson, setJson } from "../utils/storage";
import type { HistoryFilters, HistoryRecord, HistoryType } from "../types/History";

const MAX_HISTORY_ITEMS = 250;

function normalizeBackendHistoryRecord(record: unknown): HistoryRecord | null {
  if (!record || typeof record !== "object") return null;

  const raw = record as Record<string, unknown>;
  const timestamp = raw.timestamp ?? raw.createdAt ?? raw.createdDate ?? raw.time;
  const parsedTimestamp = timestamp ? new Date(String(timestamp)) : new Date(0);

  return {
    ...(raw as Partial<HistoryRecord>),
    id: String(raw.id ?? crypto.randomUUID()),
    searchType: String(raw.searchType ?? raw.type ?? "AI") as HistoryType,
    parameters: (raw.parameters ?? raw.request ?? {}) as Record<string, string>,
    request: (raw.request ?? raw.parameters ?? {}) as Record<string, string>,
    response: raw.response,
    responseSummary: String(raw.responseSummary ?? raw.summary ?? raw.message ?? "AI activity"),
    timestamp: Number.isNaN(parsedTimestamp.getTime()) ? new Date(0).toISOString() : parsedTimestamp.toISOString(),
  };
}

class HistoryService {
  private inFlightPosts = new Set<string>();

  async getBackendAll(): Promise<HistoryRecord[]> {
    const endpoints = ["/trains/history", "/pnr/history", "/ai/history"];
    const responses = await Promise.allSettled(endpoints.map((endpoint) => api.get(endpoint)));

    return responses.flatMap((result) => {
      if (result.status !== "fulfilled") return [];

      const raw = result.value.data as unknown;
      if (Array.isArray(raw)) return raw.map(normalizeBackendHistoryRecord).filter((record): record is HistoryRecord => record !== null);

      if (raw && typeof raw === "object") {
        const body = raw as { data?: unknown; content?: unknown; history?: unknown; records?: unknown };
        const records = body.data ?? body.content ?? body.history ?? body.records;
        return Array.isArray(records)
          ? records.map(normalizeBackendHistoryRecord).filter((record): record is HistoryRecord => record !== null)
          : [];
      }

      return [];
    });
  }

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