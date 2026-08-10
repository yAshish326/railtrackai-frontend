import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Menu, Moon, Sun, X } from "lucide-react";
import { settingsService } from "../../services/settingsService";
import { ROUTES } from "../../utils/constants";
import "./LandingNavbar.scss";

const navigation = [
  { label: "Features", href: "#features" },
  { label: "Search Trains", href: "#search-preview" },
  { label: "PNR Status", href: "#features" },
  { label: "Live Status", href: "#live-preview" },
  { label: "Station Board", href: "#live-preview" },
  { label: "AI Assistant", href: "#ai-assistant" },
];

export default function LandingNavbar() {
  const [darkMode, setDarkMode] = useState<boolean>(() => settingsService.getSettings().appearance.darkMode);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    function handleSettingsUpdate() {
      setDarkMode(settingsService.getSettings().appearance.darkMode);
    }

    window.addEventListener("settings:updated", handleSettingsUpdate);
    return () => window.removeEventListener("settings:updated", handleSettingsUpdate);
  }, []);

  function handleToggleTheme() {
    const current = settingsService.getSettings();
    const next = {
      ...current,
      appearance: {
        ...current.appearance,
        darkMode: !current.appearance.darkMode,
      },
    };

    settingsService.saveSettings(next);
    setDarkMode(next.appearance.darkMode);
  }

  return (
    <header className="landing-navbar">
      <div className="landing-navbar-inner">
        <Link to="/" className="brand-link" aria-label="RailTrack AI home">
          <span className="brand-mark">RT</span>
          <span className="brand-copy">RailTrack AI</span>
        </Link>

        <nav className={`landing-nav ${menuOpen ? "open" : ""}`} aria-label="Primary navigation">
          {navigation.map((item) => (
            <a key={item.label} href={item.href} onClick={() => setMenuOpen(false)}>
              {item.label}
            </a>
          ))}
        </nav>

        <div className="landing-actions">
          <button
            type="button"
            className="theme-toggle"
            onClick={handleToggleTheme}
            aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
            title={darkMode ? "Light mode" : "Dark mode"}
          >
            {darkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          <Link to={ROUTES.LOGIN} className="ghost-button">
            Sign In
          </Link>
          <Link to={ROUTES.REGISTER} className="primary-button">
            Get Started
          </Link>

          <button
            type="button"
            className="menu-toggle"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMenuOpen((current) => !current)}
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>
    </header>
  );
}
