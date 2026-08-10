export interface RouteStation {
  sequence: number;
  stationCode: string;
  stationName: string;
  arrival: string;
  departure: string;
  platform: string;
  distance: number;
  latitude?: number | null;
  longitude?: number | null;
  dayNumber: number;
  haltMinutes: number;
  currentStation?: boolean;
}

export interface TrainRouteResponse {
  trainName: string;
  trainNumber: string;
  runningDays: string[];
  distance: number;
  journeyTime?: string;
  stations: RouteStation[];
}