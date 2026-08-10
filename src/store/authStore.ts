import { useSyncExternalStore } from "react";

import type { AuthUser } from "../types/Auth";
import { clearAuth, getToken, getUser, setToken, setUser, removeItem } from "../utils/storage";
import { historyService } from "../services/historyService";
import { settingsService } from "../services/settingsService";
import { AI_ACTIVE_CONVERSATION_KEY, AI_CONVERSATIONS_STORAGE_KEY } from "../utils/constants";

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
}

type Listener = () => void;

let state: AuthState = {
  user: getUser(),
  token: getToken(),
  isAuthenticated: !!getToken(),
};

const listeners = new Set<Listener>();

function emitChange(): void {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): AuthState {
  return state;
}

/**
 * Non-hook API — safe to call from services / event handlers.
 */
export const authStore = {
  login(token: string, user: AuthUser): void {
    setToken(token);
    setUser(user);
    state = { user, token, isAuthenticated: true };
    emitChange();
  },
  updateUser(user: AuthUser): void {
    setUser(user);
    state = { ...state, user };
    emitChange();
  },
  logout(): void {
    historyService.clearAll();
    settingsService.reset();
    removeItem(AI_CONVERSATIONS_STORAGE_KEY);
    removeItem(AI_ACTIVE_CONVERSATION_KEY);
    clearAuth();
    state = { user: null, token: null, isAuthenticated: false };
    emitChange();
  },
  getState(): AuthState {
    return state;
  },
};

/**
 * Hook API — use inside React components to read + subscribe to auth state.
 */
export function useAuthStore(): AuthState {
  return useSyncExternalStore(subscribe, getSnapshot);
}
