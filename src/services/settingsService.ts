import { SETTINGS_STORAGE_KEY } from "../utils/constants";
import { defaultSettings, type AppSettings } from "../types/Settings";
import { getJson, setJson } from "../utils/storage";

class SettingsService {
  getSettings(): AppSettings {
    return getJson<AppSettings>(SETTINGS_STORAGE_KEY, defaultSettings);
  }

  applyTheme(settings: AppSettings = this.getSettings()): AppSettings {
    if (typeof document === "undefined") return settings;
    const root = document.documentElement;
    if (settings.appearance.darkMode) {
      root.classList.add("dark-mode");
    } else {
      root.classList.remove("dark-mode");
    }
    return settings;
  }

  saveSettings(settings: AppSettings): AppSettings {
    setJson<AppSettings>(SETTINGS_STORAGE_KEY, settings);
    this.applyTheme(settings);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("settings:updated"));
    }
    return settings;
  }

  updateSettings(partial: Partial<AppSettings>): AppSettings {
    const current = this.getSettings();
    const next: AppSettings = {
      appearance: { ...current.appearance, ...partial.appearance },
      notifications: { ...current.notifications, ...partial.notifications },
      privacy: { ...current.privacy, ...partial.privacy },
      history: { ...current.history, ...partial.history },
      cache: { ...current.cache, ...partial.cache },
    };

    return this.saveSettings(next);
  }

  reset(): AppSettings {
    return this.saveSettings(defaultSettings);
  }
}

export const settingsService = new SettingsService();