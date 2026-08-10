import { CACHE_STORAGE_PREFIX } from "../utils/constants";
import { getJson, setJson, removeItem } from "../utils/storage";

export type CachedSearchType = "PNR" | "TRAIN" | "STATION" | "LIVE" | "AI" | "ROUTE";

export interface CacheEntry<TRequest = Record<string, string>, TResponse = unknown> {
  searchType: CachedSearchType;
  request: TRequest;
  response: TResponse;
  timestamp: number;
  ttlMs: number;
}

function cacheKey(searchType: CachedSearchType, request: TRequestLike): string {
  return `${CACHE_STORAGE_PREFIX}:${searchType}:${JSON.stringify(request)}`;
}

type TRequestLike = Record<string, unknown>;

class CacheService {
  set<TRequest extends TRequestLike, TResponse>(
    searchType: CachedSearchType,
    request: TRequest,
    response: TResponse,
    ttlMs = 0,
  ): void {
    const entry: CacheEntry<TRequest, TResponse> = {
      searchType,
      request,
      response,
      timestamp: Date.now(),
      ttlMs,
    };

    setJson(cacheKey(searchType, request), entry);
  }

  get<TRequest extends TRequestLike, TResponse>(
    searchType: CachedSearchType,
    request: TRequest,
  ): CacheEntry<TRequest, TResponse> | null {
    const entry = getJson<CacheEntry<TRequest, TResponse> | null>(cacheKey(searchType, request), null);

    if (!entry) return null;

    const isExpired = entry.ttlMs > 0 && Date.now() - entry.timestamp > entry.ttlMs;
    if (isExpired) {
      removeItem(cacheKey(searchType, request));
      return null;
    }

    return entry;
  }

  getLatest<TResponse>(searchType: CachedSearchType): CacheEntry<Record<string, unknown>, TResponse> | null {
    const prefix = `${CACHE_STORAGE_PREFIX}:${searchType}:`;
    const keys = Object.keys(localStorage).filter((key) => key.startsWith(prefix));

    const entries = keys
      .map((key) => getJson<CacheEntry<Record<string, unknown>, TResponse> | null>(key, null))
      .filter((entry): entry is CacheEntry<Record<string, unknown>, TResponse> => !!entry)
      .filter((entry) => entry.ttlMs <= 0 || Date.now() - entry.timestamp <= entry.ttlMs)
      .sort((left, right) => right.timestamp - left.timestamp);

    return entries[0] ?? null;
  }

  clearType(searchType: CachedSearchType): void {
    const prefix = `${CACHE_STORAGE_PREFIX}:${searchType}:`;
    Object.keys(localStorage)
      .filter((key) => key.startsWith(prefix))
      .forEach((key) => removeItem(key));
  }

  clearAll(): void {
    Object.keys(localStorage)
      .filter((key) => key.startsWith(CACHE_STORAGE_PREFIX))
      .forEach((key) => removeItem(key));
  }
}

export const cacheService = new CacheService();