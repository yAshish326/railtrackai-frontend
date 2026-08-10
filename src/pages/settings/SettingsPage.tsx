import { useEffect, useState } from "react";
import { Bell,Palette } from "lucide-react";

import { settingsService } from "../../services/settingsService";
import type { AppSettings } from "../../types/Settings";

import "./SettingsPage.scss";

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings>(() => settingsService.getSettings());

  useEffect(() => {
    settingsService.saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    function handleSettingsUpdate() {
      setSettings(settingsService.getSettings());
    }

    window.addEventListener("settings:updated", handleSettingsUpdate);
    return () => window.removeEventListener("settings:updated", handleSettingsUpdate);
  }, []);

  function updateSection<K extends keyof AppSettings>(section: K, value: AppSettings[K]) {
    setSettings((previous) => ({ ...previous, [section]: value }));
  }

  return (
    <div className="enterprise-page settings-page">
      <header className="enterprise-header settings-header">
        <div>
          <span className="eyebrow">Preferences</span>
          <h1>Settings</h1>
          <p>Persisted locally for appearance, notifications, history, cache, and security controls.</p>
        </div>
      </header>

      {status && <section className="enterprise-card info-banner settings-status">{status}</section>}

      <section className="settings-grid">
        <article className="enterprise-card settings-card settings-card--appearance">
          <div className="settings-card__header">
            <span className="settings-card__icon settings-card__icon--appearance">
              <Palette size={18} />
            </span>
            <div>
              <span className="settings-card__eyebrow">Workspace</span>
              <h3>Appearance</h3>
            </div>
          </div>
          <div className="settings-card__body">
            <label className="settings-toggle">
              <span className="settings-toggle__meta">
                <span className="settings-toggle__title">Dark Mode</span>
                <span className="settings-toggle__description">Switch the application to a night-ready theme.</span>
              </span>
              <span className="settings-toggle__control">
                <input
                  type="checkbox"
                  checked={settings.appearance.darkMode}
                  onChange={(e) => updateSection("appearance", { ...settings.appearance, darkMode: e.target.checked })}
                />
                <span className="settings-switch" aria-hidden="true" />
              </span>
            </label>
          </div>
        </article>

        <article className="enterprise-card settings-card settings-card--notifications">
          <div className="settings-card__header">
            <span className="settings-card__icon settings-card__icon--notifications">
              <Bell size={18} />
            </span>
            <div>
              <span className="settings-card__eyebrow">Delivery</span>
              <h3>Notifications</h3>
            </div>
          </div>
          <div className="settings-card__body settings-card__body--stacked">
            <label className="settings-toggle">
              <span className="settings-toggle__meta">
                <span className="settings-toggle__title">Email Notifications</span>
                <span className="settings-toggle__description">Receive service updates and account alerts.</span>
              </span>
              <span className="settings-toggle__control">
                <input
                  type="checkbox"
                  checked={settings.notifications.email}
                  onChange={(e) => updateSection("notifications", { ...settings.notifications, email: e.target.checked })}
                />
                <span className="settings-switch" aria-hidden="true" />
              </span>
            </label>

            <label className="settings-toggle">
              <span className="settings-toggle__meta">
                <span className="settings-toggle__title">Push Notifications</span>
                <span className="settings-toggle__description">Keep live updates visible across sessions.</span>
              </span>
              <span className="settings-toggle__control">
                <input
                  type="checkbox"
                  checked={settings.notifications.push}
                  onChange={(e) => updateSection("notifications", { ...settings.notifications, push: e.target.checked })}
                />
                <span className="settings-switch" aria-hidden="true" />
              </span>
            </label>
          </div>
        </article>
      </section>
    </div>
  );
}