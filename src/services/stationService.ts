import api from "./api";
import type { StationBoardBackendResponse, StationBoardQuery, StationBoardResponse, StationBoardTrain } from "../types/Station";

function normalizeStatus(status?: string | null, fallback?: string | null): string | null {
  if (status && status.trim().length > 0) {
    return status;
  }
  return fallback ?? null;
}

function mergeDelayMinutes(left?: number | null, right?: number | null): number | null {
  const leftValue = typeof left === "number" ? left : null;
  const rightValue = typeof right === "number" ? right : null;

  if (leftValue != null && rightValue != null) {
    return Math.max(leftValue, rightValue);
  }
  return leftValue ?? rightValue;
}

function mergeTrainStatus(existing?: string | null, next?: string | null): string | null {
  const existingStatus = normalizeStatus(existing);
  const nextStatus = normalizeStatus(next);

  if (!existingStatus) {
    return nextStatus;
  }
  if (!nextStatus) {
    return existingStatus;
  }

  const existingLower = existingStatus.toLowerCase();
  const nextLower = nextStatus.toLowerCase();

  if (nextLower.includes("cancel")) {
    return nextStatus;
  }
  if (existingLower.includes("cancel")) {
    return existingStatus;
  }
  if (nextLower.includes("delay") && !existingLower.includes("delay")) {
    return nextStatus;
  }
  return existingStatus;
}

function mergeStationBoardTrain(existing: StationBoardTrain, next: StationBoardTrain): StationBoardTrain {
  return {
    ...existing,
    ...next,
    arrival: existing.arrival ?? next.arrival,
    departure: existing.departure ?? next.departure,
    expectedArrival: existing.expectedArrival ?? next.expectedArrival,
    expectedDeparture: existing.expectedDeparture ?? next.expectedDeparture,
    delayMinutes: mergeDelayMinutes(existing.delayMinutes, next.delayMinutes),
    delay: existing.delay ?? next.delay,
    platform: existing.platform ?? next.platform,
    status: mergeTrainStatus(existing.status, next.status),
    currentStatus: existing.currentStatus ?? next.currentStatus,
    sourceStation: existing.sourceStation ?? next.sourceStation,
    destinationStation: existing.destinationStation ?? next.destinationStation,
  };
}

function normalizeStationBoardResponse(response: StationBoardBackendResponse): StationBoardResponse {
  const trainsByNumber = new Map<string, StationBoardTrain>();
  const combinedTrains = [
    ...(response.arrivingTrains ?? []),
    ...(response.departingTrains ?? []),
    ...(response.delayedTrains ?? []),
    ...(response.cancelledTrains ?? []),
  ];

  combinedTrains.forEach((train) => {
    const key = train.trainNumber;
    if (!key) {
      return;
    }

    const existing = trainsByNumber.get(key);
    trainsByNumber.set(key, existing ? mergeStationBoardTrain(existing, train) : train);
  });

  const trains = Array.from(trainsByNumber.values());

  return {
    stationCode: response.stationCode,
    stationName: response.stationName,
    date: response.date ?? null,
    currentTime: response.currentTime ?? null,
    totalTrains: response.totalTrains ?? trains.length,
    trains,
  };
}

const stationService = {
  async getBoard(query: StationBoardQuery) {
    const response = await api.get<StationBoardBackendResponse>(
      `/train/live-board/${encodeURIComponent(query.stationCode)}`,
      {
        params: {
          ...(query.hours ? { hours: query.hours } : {}),
        },
      },
    );

    return {
      ...response,
      data: normalizeStationBoardResponse(response.data),
    } as typeof response & { data: StationBoardResponse };
  },

  getLiveStatus(trainNumber: string, date?: string) {
    return api.get<StationBoardResponse>(`/train/live-status/${trainNumber}`, {
      params: date ? { date } : undefined,
    });
  },
};

export default stationService;