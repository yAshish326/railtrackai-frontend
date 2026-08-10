const DEFAULT_API_BASE_URL = "https://railtrack-ai.onrender.com/api/v1";

export const env = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? DEFAULT_API_BASE_URL,
};
