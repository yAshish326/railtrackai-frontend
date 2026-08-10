export type ThemeMode = "light" | "dark" | "system";
export type Language = "en" | "hi";

export interface AppSettings {
  appearance: {
    darkMode: boolean;
    theme: ThemeMode;
    language: Language;
  };
  notifications: {
    email: boolean;
    push: boolean;
  };
  privacy: {
    anonymizeSearchPreviews: boolean;
    shareUsageDiagnostics: boolean;
  };
  history: {
    autoSave: boolean;
    autoClearDays: number;
  };
  cache: {
    enabled: boolean;
    ttlMinutes: number;
  };
}

export const defaultSettings: AppSettings = {
  appearance: {
    darkMode: false,
    theme: "system",
    language: "en",
  },
  notifications: {
    email: true,
    push: false,
  },
  privacy: {
    anonymizeSearchPreviews: false,
    shareUsageDiagnostics: false,
  },
  history: {
    autoSave: true,
    autoClearDays: 30,
  },
  cache: {
    enabled: true,
    ttlMinutes: 1440,
  },
};