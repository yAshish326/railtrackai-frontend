export interface Station {
  name: string;
  code: string;
}

export type RunningDay = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export interface Train {
  trainNumber: string;
  trainName: string;
  trainType: string;
  source: string;
  destination: string;
  departure: string;
  arrival: string;
  /** Duration in minutes, returned by the backend as a string. */
  duration: string;
  distanceKm: number;
  runningDays: RunningDay[];
  availableClasses: string[];
  price?: number | string;
  fare?: number | string;
}

export interface SearchTrainResponse {
  source: string;
  destination: string;
  totalTrains: number;
  trains: Train[];
}

export interface SearchTrainParams {
  from: string;
  to: string;
  date: string;
}
