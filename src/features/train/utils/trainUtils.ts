import type { RunningDay, Train, Station } from "../../../types/Train";

export function formatDuration(durationStr: string): string {
  const mins = Number.parseInt(durationStr, 10);
  if (Number.isNaN(mins)) return durationStr;

  const hrs = Math.floor(mins / 60);
  const remaining = mins % 60;
  return `${hrs}h ${remaining}m`;
}

export function todayIso(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function normalizeStationLabel(station: unknown): string {
  if (!station) return "";
  if (typeof station === "string") return station;
  if (typeof station === "object") {
    const candidate = station as Record<string, unknown>;
    const name = typeof candidate.name === "string" ? candidate.name : undefined;
    const code = typeof candidate.code === "string" ? candidate.code : undefined;
    if (name && code) return `${name} (${code})`;
    return name ?? code ?? "";
  }
  return String(station);
}

export function normalizeTrain(train: Train): Train {
  return {
    ...train,
    source: normalizeStationLabel(train.source),
    destination: normalizeStationLabel(train.destination),
    availableClasses: Array.isArray(train.availableClasses)
      ? train.availableClasses.filter((item): item is string => typeof item === "string")
      : [],
    runningDays: Array.isArray(train.runningDays)
      ? (train.runningDays.filter((item): item is RunningDay => typeof item === "string" && ["mon", "tue", "wed", "thu", "fri", "sat", "sun"].includes(item)) as RunningDay[])
      : [],
    duration: train.duration != null ? String(train.duration) : "0",
  };
}

export function getSuggestions(query: string, stations: Station[]): Station[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  return stations
    .filter((station) => station.name.toLowerCase().includes(q) || station.code.toLowerCase().includes(q))
    .slice(0, 8);
}
