export type GlobalSearchCategory =
  | "train"
  | "pnr"
  | "station"
  | "live"
  | "route"
  | "history"
  | "conversation";

export interface GlobalSearchResult {
  id: string;
  category: GlobalSearchCategory;
  title: string;
  subtitle: string;
  route: string;
  state?: LocationState;
  score: number;
}

export type LocationState = Record<string, unknown>;