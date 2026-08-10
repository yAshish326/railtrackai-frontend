import stationsData from "../data/stations.json";
import { cacheService } from "./cacheService";
import { historyService } from "./historyService";
import { AI_CONVERSATIONS_STORAGE_KEY, ROUTES } from "../utils/constants";
import { getJson } from "../utils/storage";
import type { GlobalSearchCategory, GlobalSearchResult } from "../types/GlobalSearch";
import type { HistoryRecord } from "../types/History";
import type { Train } from "../types/Train";
import type { PnrData } from "../types/Pnr";
import type { StationBoardResponse } from "../types/Station";
import type { TrainRouteResponse } from "../types/Route";

interface ConversationMessage {
  content: string;
}

interface ConversationRecord {
  id: string;
  title: string;
  updatedAt: string;
  messages: ConversationMessage[];
}

interface SearchSource {
  query: string;
  limit?: number;
}

const STATIONS = stationsData.data ?? [];

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function scoreMatch(value: string, query: string, priority = 0): number {
  const normalizedValue = normalize(value);
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return priority;
  if (normalizedValue === normalizedQuery) return 100 + priority;
  if (normalizedValue.includes(normalizedQuery)) return 50 + priority;
  return 0;
}

function pushUnique(results: GlobalSearchResult[], next: GlobalSearchResult): void {
  if (results.some((result) => result.id === next.id)) return;
  results.push(next);
}

function stationResults(query: string): GlobalSearchResult[] {
  return STATIONS.filter(
    (station) =>
      station.name.toLowerCase().includes(query) || station.code.toLowerCase().includes(query),
  )
    .slice(0, 8)
    .map((station) => ({
      id: `station:${station.code}`,
      category: "station",
      title: `${station.name} (${station.code})`,
      subtitle: "Open station board",
      route: ROUTES.STATION_BOARD,
      state: { stationCode: station.code },
      score: scoreMatch(station.name, query, 20) + scoreMatch(station.code, query, 30),
    }));
}

function trainResultsFromHistory(records: HistoryRecord[], query: string): GlobalSearchResult[] {
  const results: GlobalSearchResult[] = [];

  records.forEach((record) => {
    if (record.searchType !== "TRAIN" && record.searchType !== "ROUTE" && record.searchType !== "LIVE") {
      return;
    }

    const requestText = JSON.stringify(record.parameters).toLowerCase();
    const responseText = JSON.stringify(record.response).toLowerCase();
    const summaryText = record.responseSummary.toLowerCase();
    if (!requestText.includes(query) && !responseText.includes(query) && !summaryText.includes(query)) {
      return;
    }

    if (record.searchType === "TRAIN") {
      const response = record.response as { trains?: Train[]; source?: string; destination?: string };
      const trainItems = response.trains ?? [];
      const matchedTrains = trainItems.filter(
        (train) =>
          train.trainNumber.toLowerCase().includes(query) || train.trainName.toLowerCase().includes(query),
      );

      if (matchedTrains.length > 0) {
        matchedTrains.slice(0, 5).forEach((train) => {
          pushUnique(results, {
            id: `train:${train.trainNumber}`,
            category: "train",
            title: `${train.trainName} (${train.trainNumber})`,
            subtitle: `${response.source ?? "Train search"} → ${response.destination ?? "Route details"}`,
            route: ROUTES.TRAIN_ROUTE,
            state: { trainNumber: train.trainNumber, trainName: train.trainName },
            score: scoreMatch(train.trainNumber, query, 40) + scoreMatch(train.trainName, query, 30),
          });
        });
        return;
      }

      pushUnique(results, {
        id: `train-search:${record.id}`,
        category: "history",
        title: `${response.source ?? "Train"} → ${response.destination ?? "Search"}`,
        subtitle: record.responseSummary,
        route: ROUTES.SEARCH_TRAIN,
        state: {
          fromStation: String(record.parameters.from ?? ""),
          toStation: String(record.parameters.to ?? ""),
          date: String(record.parameters.date ?? ""),
          autoSearch: true,
        },
        score: scoreMatch(record.responseSummary, query, 10),
      });
      return;
    }

    if (record.searchType === "ROUTE") {
      const trainNumber = String(record.parameters.trainNumber ?? "");
      pushUnique(results, {
        id: `route:${trainNumber || record.id}`,
        category: "route",
        title: record.responseSummary,
        subtitle: trainNumber,
        route: ROUTES.TRAIN_ROUTE,
        state: { trainNumber },
        score: scoreMatch(record.responseSummary, query, 25) + scoreMatch(trainNumber, query, 35),
      });
      return;
    }

    if (record.searchType === "LIVE") {
      const trainNumber = String(record.parameters.trainNumber ?? "");
      pushUnique(results, {
        id: `live:${trainNumber || record.id}`,
        category: "live",
        title: record.responseSummary,
        subtitle: trainNumber,
        route: ROUTES.LIVE_STATUS,
        state: { trainNumber },
        score: scoreMatch(record.responseSummary, query, 20) + scoreMatch(trainNumber, query, 35),
      });
    }
  });

  return results;
}

function pnrResults(records: HistoryRecord[], query: string): GlobalSearchResult[] {
  return records
    .filter((record) => record.searchType === "PNR")
    .filter((record) => JSON.stringify(record.parameters).toLowerCase().includes(query) || JSON.stringify(record.response).toLowerCase().includes(query))
    .flatMap((record) => {
      const response = record.response as PnrData;
      const pnrNumber = String(record.parameters.pnrNumber ?? response.pnrNumber ?? "");
      const base = {
        id: `pnr:${pnrNumber || record.id}`,
        category: "pnr" as const,
        title: `${response.trainName ?? "PNR"} (${pnrNumber})`,
        subtitle: `${response.sourceStation ?? ""} → ${response.destinationStation ?? ""}`,
        route: ROUTES.PNR_ENQUIRY,
        state: { pnrNumber },
        score: scoreMatch(pnrNumber, query, 40) + scoreMatch(response.trainName ?? "", query, 20),
      };
      return [base];
    });
}

function aiConversationResults(query: string): GlobalSearchResult[] {
  const conversations = getJson<ConversationRecord[]>(AI_CONVERSATIONS_STORAGE_KEY, []);

  return conversations
    .filter((conversation) => {
      const haystack = [conversation.title, conversation.messages.map((message) => message.content).join(" ")].join(" ").toLowerCase();
      return haystack.includes(query);
    })
    .slice(0, 6)
    .map((conversation) => ({
      id: `conversation:${conversation.id}`,
      category: "conversation",
      title: conversation.title,
      subtitle: `Conversation with ${conversation.messages.length} messages`,
      route: ROUTES.AI_ASSISTANT,
      state: { conversationId: conversation.id },
      score: scoreMatch(conversation.title, query, 30),
    }));
}

function cachedResults(query: string): GlobalSearchResult[] {
  const results: GlobalSearchResult[] = [];

  const stationCache = cacheService.getLatest<StationBoardResponse>("STATION");
  if (stationCache) {
    const haystack = JSON.stringify(stationCache).toLowerCase();
    if (haystack.includes(query)) {
      pushUnique(results, {
        id: `cached-station:${stationCache.request.stationCode}`,
        category: "station",
        title: `${stationCache.response.stationName} (${stationCache.response.stationCode})`,
        subtitle: "Cached station board",
        route: ROUTES.STATION_BOARD,
        state: { stationCode: stationCache.request.stationCode },
        score: 60,
      });
    }
  }

  const trainCache = cacheService.getLatest<{ trains?: Train[]; source?: string; destination?: string }>("TRAIN");
  if (trainCache) {
    const response = trainCache.response;
    const trains = response.trains ?? [];
    const matchedTrain = trains.find(
      (train) => train.trainNumber.toLowerCase().includes(query) || train.trainName.toLowerCase().includes(query),
    );

    if (matchedTrain) {
      pushUnique(results, {
        id: `cached-train:${matchedTrain.trainNumber}`,
        category: "train",
        title: `${matchedTrain.trainName} (${matchedTrain.trainNumber})`,
        subtitle: "Cached search result",
        route: ROUTES.TRAIN_ROUTE,
        state: { trainNumber: matchedTrain.trainNumber, trainName: matchedTrain.trainName },
        score: 55,
      });
    }
  }

  const pnrCache = cacheService.getLatest<PnrData>("PNR");
  if (pnrCache && JSON.stringify(pnrCache).toLowerCase().includes(query)) {
    pushUnique(results, {
      id: `cached-pnr:${pnrCache.request.pnrNumber}`,
      category: "pnr",
      title: `${pnrCache.response.trainName} (${pnrCache.request.pnrNumber})`,
      subtitle: "Cached PNR result",
      route: ROUTES.PNR_ENQUIRY,
      state: { pnrNumber: pnrCache.request.pnrNumber },
      score: 55,
    });
  }

  const routeCache = cacheService.getLatest<TrainRouteResponse>("ROUTE");
  if (routeCache && JSON.stringify(routeCache).toLowerCase().includes(query)) {
    pushUnique(results, {
      id: `cached-route:${routeCache.request.trainNumber}`,
      category: "route",
      title: `${routeCache.response.trainName} route`,
      subtitle: String(routeCache.request.trainNumber),
      route: ROUTES.TRAIN_ROUTE,
      state: { trainNumber: String(routeCache.request.trainNumber) },
      score: 55,
    });
  }

  return results;
}

export function searchGlobalCatalog({ query, limit = 10 }: SearchSource): GlobalSearchResult[] {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) {
    return [
      ...aiConversationResults(""),
      ...stationResults(""),
      ...historyService.list({ sort: "newest" }).slice(0, 5).map((record): GlobalSearchResult => {
        const category: GlobalSearchCategory = record.searchType === "PNR"
          ? "pnr"
          : record.searchType === "TRAIN"
            ? "train"
            : record.searchType === "STATION"
              ? "station"
              : record.searchType === "LIVE"
                ? "live"
                : record.searchType === "ROUTE"
                  ? "route"
                  : "history";

        const route = record.searchType === "PNR"
          ? ROUTES.PNR_ENQUIRY
          : record.searchType === "TRAIN"
            ? ROUTES.SEARCH_TRAIN
            : record.searchType === "STATION"
              ? ROUTES.STATION_BOARD
              : record.searchType === "LIVE"
                ? ROUTES.LIVE_STATUS
                : record.searchType === "ROUTE"
                  ? ROUTES.TRAIN_ROUTE
                  : ROUTES.HISTORY;

        const state = record.searchType === "PNR"
          ? { pnrNumber: String(record.parameters.pnrNumber ?? "") }
          : record.searchType === "TRAIN"
            ? { fromStation: String(record.parameters.from ?? ""), toStation: String(record.parameters.to ?? ""), date: String(record.parameters.date ?? ""), autoSearch: true }
            : record.searchType === "STATION"
              ? { stationCode: String(record.parameters.stationCode ?? "") }
              : record.searchType === "LIVE"
                ? { trainNumber: String(record.parameters.trainNumber ?? "") }
                : record.searchType === "ROUTE"
                  ? { trainNumber: String(record.parameters.trainNumber ?? "") }
                  : undefined;

        return {
          id: `recent:${record.id}`,
          category,
          title: record.responseSummary,
          subtitle: record.searchType,
          route,
          state,
          score: 20,
        };
      }),
    ].slice(0, limit);
  }

  const results: GlobalSearchResult[] = [];

  stationResults(normalizedQuery).forEach((result) => pushUnique(results, result));
  pnrResults(historyService.list({ sort: "newest" }), normalizedQuery).forEach((result) => pushUnique(results, result));
  trainResultsFromHistory(historyService.list({ sort: "newest" }), normalizedQuery).forEach((result) => pushUnique(results, result));
  aiConversationResults(normalizedQuery).forEach((result) => pushUnique(results, result));
  cachedResults(normalizedQuery).forEach((result) => pushUnique(results, result));

  return results.sort((left, right) => right.score - left.score).slice(0, limit);
}
