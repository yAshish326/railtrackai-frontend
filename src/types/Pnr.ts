export interface PnrPassenger {
  passengerSerialNumber: number;
  bookingStatus: string;
  bookingBerthNo: number;
  bookingStatusDetails: string;
  currentStatus: string;
  currentCoachId: string;
  currentBerthNo: number;
  currentStatusDetails: string;
}

export interface PnrData {
  pnrNumber: string;
  trainNumber: string;
  trainName: string;
  sourceStation: string;
  destinationStation: string;
  boardingPoint: string;
  journeyClass: string;
  dateOfJourney: string;
  chartStatus: string;
  bookingFare: number;
  ticketFare: number;
  distance: number;
  passengerList: PnrPassenger[];
  prediction?: string;
  delayMinutes?: number;
  coachPosition?: string;
}

export interface PnrAnalysis {
  currentStatus: string;
  confirmationChance: number;
  aiRecommendation: string;
  alternativeSuggested: boolean;
}

export interface PnrResponse {
  success: boolean;
  data: PnrData;
  generatedTimeStamp: number;
}
