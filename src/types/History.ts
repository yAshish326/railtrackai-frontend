export type HistoryType = "PNR" | "TRAIN" | "STATION" | "LIVE" | "AI" | "ROUTE";

export interface HistoryRecord<TRequest = Record<string, string>, TResponse = unknown> {
  id: string;
  searchType: HistoryType;
  parameters: TRequest;
  responseSummary: string;
  request: TRequest;
  response: TResponse;
  timestamp: string;
}

export interface HistoryFilters {
  query: string;
  sort: "newest" | "oldest";
  type?: HistoryType;
}