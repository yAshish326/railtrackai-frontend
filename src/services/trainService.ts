import api from "./api";
import type { SearchTrainParams, SearchTrainResponse } from "../types/Train";
import type { TrainRouteResponse } from "../types/Route";

const trainService = {
  searchBetweenStations(params: SearchTrainParams) {
    return api.get<SearchTrainResponse>("/train/between-stations", {
      params: {
        from: params.from,
        to: params.to,
        date: params.date,
      },
    });
  },

  getRouteDetails(trainNumber: string) {
    return api.get<TrainRouteResponse>(`/train/route/${trainNumber}`);
  },

  getLiveStatus(trainNumber: string, date?: string) {
    return api.get<{ success: boolean; data: unknown }>(`/train/live/${trainNumber}`, {
      params: date ? { date } : undefined,
    });
  },
};

export default trainService;
