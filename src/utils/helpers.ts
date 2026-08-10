import axios from "axios";

/**
 * Extracts a human-readable error message from an unknown error,
 * preferring the backend's `message` field when available.
 */
export function getErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { message?: string } | undefined;
    return data?.message || fallback;
  }

  if (err instanceof Error) {
    return err.message || fallback;
  }

  return fallback;
}

/**
 * Same as getErrorMessage, but gives friendlier copy for common
 * upstream/network failure statuses (rate limiting, bad gateway, timeouts)
 * before falling back to the backend's message or the provided fallback.
 */
export function getApiErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const status = err.response?.status;

    if (status === 429) {
      return "Too many requests right now. Please wait a moment and try again.";
    }
    if (status === 502 || status === 503 || status === 504) {
      return "Our server is temporarily unavailable. Please try again shortly.";
    }
    if (err.code === "ECONNABORTED") {
      return "The request timed out. Please check your connection and try again.";
    }
    if (!err.response) {
      return "Could not reach the server. Please check your connection and try again.";
    }
  }

  return getErrorMessage(err, fallback);
}

export function formatDateTime(value: string | number | Date): string {
  const date = new Date(value);
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatCompactTime(value: string | number | Date): string {
  const date = new Date(value);
  return new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function safeValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map((item) => safeValue(item)).join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return "—";
}
