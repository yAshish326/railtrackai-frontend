export interface StationBoardQuery {
  stationCode: string;
  timestamp?: string;
  hours?: number;
}

export interface StationBoardTrain {
  trainNumber: string;
  trainName: string;
  arrival: string | null;
  departure: string | null;
  expectedArrival?: string | null;
  expectedDeparture?: string | null;
  delay?: string | null;
  delayMinutes?: number | null;
  platform?: string | null;
  status?: string | null;
  sourceStation?: string;
  destinationStation?: string;
  currentStatus?: string;
}

export interface StationBoardBackendResponse {
  stationCode: string;
  stationName: string;
  date?: string | null;
  currentTime?: string | null;
  totalTrains?: number;
  arrivingTrains?: StationBoardTrain[];
  departingTrains?: StationBoardTrain[];
  delayedTrains?: StationBoardTrain[];
  cancelledTrains?: StationBoardTrain[];
}

export interface StationBoardResponse {
  stationCode: string;
  stationName: string;
  date?: string | null;
  currentTime?: string | null;
  totalTrains?: number;
  trains: StationBoardTrain[];
}

export interface StationSuggestion {
  code: string;
  name: string;
}