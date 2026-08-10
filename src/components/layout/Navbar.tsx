import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, History, Moon, Search, Sparkles, Sun, TrainFront, Ticket, Building2, Radio, Route, X } from "lucide-react";

import { useAuthStore } from "../../store/authStore";
import { searchGlobalCatalog } from "../../services/globalSearchService";
import { settingsService } from "../../services/settingsService";
import type { GlobalSearchCategory, GlobalSearchResult } from "../../types/GlobalSearch";
import "./Navbar.scss";

function getInitials(name?: string): string {
  if (!name) return "U";
  return (
    name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "U"
  );
}

export default function Navbar() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [darkMode, setDarkMode] = useState<boolean>(() => settingsService.getSettings().appearance.darkMode);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
      if (actionsRef.current && !actionsRef.current.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }
    }

    function handleSettingsUpdate() {
      setDarkMode(settingsService.getSettings().appearance.darkMode);
    }

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("settings:updated", handleSettingsUpdate);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("settings:updated", handleSettingsUpdate);
    };
  }, []);

  const results = useMemo(() => searchGlobalCatalog({ query, limit: 8 }), [query]);

  function handleNavigate(result: GlobalSearchResult) {
    setQuery("");
    setOpen(false);
    navigate(result.route, { state: result.state });
  }

  function handleToggleTheme() {
    const currentSettings = settingsService.getSettings();
    const nextSettings = {
      ...currentSettings,
      appearance: {
        ...currentSettings.appearance,
        darkMode: !currentSettings.appearance.darkMode,
      },
    };

    const saved = settingsService.saveSettings(nextSettings);
    setDarkMode(saved.appearance.darkMode);
  }

  function handleToggleNotifications() {
    setNotificationsOpen((current) => !current);
  }

  function iconFor(category: GlobalSearchCategory) {
    switch (category) {
      case "train":
        return <TrainFront size={15} />;
      case "pnr":
        return <Ticket size={15} />;
      case "station":
        return <Building2 size={15} />;
      case "live":
        return <Radio size={15} />;
      case "route":
        return <Route size={15} />;
      case "conversation":
        return <Sparkles size={15} />;
      default:
        return <History size={15} />;
    }
  }

  return (
    <header className="top-header">
      <div className="search-bar" ref={wrapperRef}>
        <Search size={18} className="search-icon" />
        <input
          type="text"
          placeholder="Global search trains, stations, PNRs, history, AI..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOpen(false);
            }
            if (e.key === "Enter" && results[0]) {
              handleNavigate(results[0]);
            }
          }}
        />

        {query.trim() && open && (
          <div className="search-results-dropdown">
            {results.length === 0 ? (
              <div className="search-empty-state">
                <X size={14} />
                <span>No matching results</span>
              </div>
            ) : (
              results.map((result) => (
                <button
                  key={result.id}
                  type="button"
                  className="search-result-item"
                  onClick={() => handleNavigate(result)}
                >
                  <span className={`search-result-icon ${result.category}`}>{iconFor(result.category)}</span>
                  <span className="search-result-copy">
                    <strong>{result.title}</strong>
                    <small>{result.subtitle}</small>
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      <div className="header-actions" ref={actionsRef}>
        <button
          className="icon-btn"
          aria-label="Notifications"
          aria-expanded={notificationsOpen}
          onClick={handleToggleNotifications}
          title="Notifications"
        >
          <Bell size={18} />
        </button>
        <button
          className="icon-btn"
          aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
          onClick={handleToggleTheme}
          aria-pressed={darkMode}
          title={darkMode ? "Light mode" : "Dark mode"}
        >
          {darkMode ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {notificationsOpen && (
          <div className="notification-menu" role="region" aria-label="Notification center">
            <div className="panel-heading">
              <span>Notifications</span>
              <button type="button" aria-label="Close notifications" onClick={() => setNotificationsOpen(false)}>
                <X size={16} />
              </button>
            </div>
            <div className="notification-empty">No new alerts yet. Your dashboard is up to date.</div>
            <a className="notification-link" href="#" onClick={(event) => event.preventDefault()}>
              View settings
            </a>
          </div>
        )}

        <div className="user-profile">
          <div className="avatar">{getInitials(user?.fullName)}</div>
          <div className="user-info">
            <span className="name">{user?.fullName ?? "User"}</span>
            <span className="role">{user?.role ?? "USER"}</span>
          </div>
        </div>
      </div>
    </header>
  );
}