export const ROUTES = {
  LOGIN: "/login",
  REGISTER: "/register",
  VERIFY_OTP: "/verify-otp",
  FORGOT_PASSWORD: "/forgot-password",
  DASHBOARD: "/dashboard",
  SEARCH_TRAIN: "/search-train",
  PNR_ENQUIRY: "/pnr-enquiry",
  LIVE_STATUS: "/live-status",
  STATION_BOARD: "/station-board",
  TRAIN_ROUTE: "/train-route",
  AI_ASSISTANT: "/ai-assistant",
  HISTORY: "/history",
  PROFILE: "/profile",
  SETTINGS: "/settings",  LANDING: "/",} as const;

export const SEARCH_TTL_MS = 1000 * 60 * 60 * 24;
export const SETTINGS_STORAGE_KEY = "railtrack:settings";
export const HISTORY_STORAGE_KEY = "railtrack:history";
export const CACHE_STORAGE_PREFIX = "railtrack:cache";
export const AI_CONVERSATIONS_STORAGE_KEY = "railtrack:ai-conversations";
export const AI_ACTIVE_CONVERSATION_KEY = "railtrack:ai-active-conversation";

export const OTP_LENGTH = 6;