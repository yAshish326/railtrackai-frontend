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

export function normalizeStationRecord(raw: unknown): Station | null {
  if (!raw || typeof raw !== "object") return null;

  const candidate = raw as Record<string, unknown>;
  const name = [
    candidate.name,
    candidate.stationName,
    candidate.station_name,
    candidate.display,
    candidate.station,
  ].find((value): value is string => typeof value === "string" && value.trim().length > 0)?.trim();

  const code = [
    candidate.code,
    candidate.stationCode,
    candidate.station_code,
  ].find((value): value is string => typeof value === "string" && value.trim().length > 0)?.trim().toUpperCase();

  if (!name || !code) return null;

  return { name, code };
}

export function normalizeStationList(raw: unknown): Station[] {
  const source = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as { data?: unknown[] } | undefined)?.data)
      ? (raw as { data: unknown[] }).data
      : Array.isArray((raw as { stations?: unknown[] } | undefined)?.stations)
        ? (raw as { stations: unknown[] }).stations
        : [];

  return source
    .map((entry) => normalizeStationRecord(entry))
    .filter((entry): entry is Station => Boolean(entry))
    .filter((entry, index, items) => {
      const duplicateIndex = items.findIndex((item) => item.code === entry.code || item.name.toLowerCase() === entry.name.toLowerCase());
      return duplicateIndex === index;
    });
}

export function normalizeStationLabel(station: unknown): string {
  if (!station) return "";
  if (typeof station === "string") return station;
  if (typeof station === "object") {
    const candidate = station as Record<string, unknown>;
    const name = typeof candidate.name === "string"
      ? candidate.name
      : typeof candidate.stationName === "string"
        ? candidate.stationName
        : typeof candidate.station_name === "string"
          ? candidate.station_name
          : undefined;
    const code = typeof candidate.code === "string"
      ? candidate.code
      : typeof candidate.stationCode === "string"
        ? candidate.stationCode
        : typeof candidate.station_code === "string"
          ? candidate.station_code
          : undefined;
    if (name && code) return `${name} (${code})`;
    return name ?? code ?? "";
  }
  return String(station);
}

export function findStationByQuery(query: string, stations: Station[]): Station | null {
  const value = query.trim();
  if (!value) return null;

  const normalized = value.toLowerCase();

  return stations.find((station) => station.code.toLowerCase() === normalized)
    ?? stations.find((station) => station.name.toLowerCase() === normalized)
    ?? stations.find((station) => station.code.toLowerCase().includes(normalized))
    ?? stations.find((station) => station.name.toLowerCase().includes(normalized))
    ?? null;
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
    .filter((station) => {
      const haystack = `${station.name} ${station.code}`.toLowerCase();
      return station.name.toLowerCase().includes(q) || station.code.toLowerCase().includes(q) || haystack.includes(q);
    })
    .sort((left, right) => {
      const leftExact = left.code.toLowerCase() === q || left.name.toLowerCase() === q ? 1 : 0;
      const rightExact = right.code.toLowerCase() === q || right.name.toLowerCase() === q ? 1 : 0;
      return rightExact - leftExact || left.name.localeCompare(right.name);
    })
    .slice(0, 10);
}
