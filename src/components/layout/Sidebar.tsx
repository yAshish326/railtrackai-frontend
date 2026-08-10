  import { useLayoutEffect, useRef } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Search,
  Ticket,
  Radio,
  Bot,
  History,
  User,
  Settings,
  TrainTrack,
  LogOut,
  MapPinned,
} from "lucide-react";

import { authStore } from "../../store/authStore";
import { ROUTES } from "../../utils/constants";
import "./Sidebar.scss";

const NAV_ITEMS = [
  { to: ROUTES.DASHBOARD, label: "Dashboard", icon: LayoutDashboard },
  { to: ROUTES.SEARCH_TRAIN, label: "Search Train", icon: Search },
  { to: ROUTES.PNR_ENQUIRY, label: "PNR Enquiry", icon: Ticket },
  { to: ROUTES.LIVE_STATUS, label: "Live Train Status", icon: Radio },
  { to: ROUTES.STATION_BOARD, label: "Station Board", icon: MapPinned },
  { to: ROUTES.AI_ASSISTANT, label: "AI Assistant", icon: Bot },
  { to: ROUTES.HISTORY, label: "History", icon: History },
  { to: ROUTES.PROFILE, label: "Profile", icon: User },
  { to: ROUTES.SETTINGS, label: "Settings", icon: Settings },
];

export default function Sidebar() {
  const location = useLocation();
  const navRef = useRef<HTMLElement | null>(null);

  const handleLogout = () => {
    authStore.logout();
    window.location.replace(ROUTES.LANDING);
  };

  useLayoutEffect(() => {
    if (navRef.current) {
      navRef.current.scrollTop = 0;
    }
  }, [location.pathname]);

  return (
    <aside className="sidebar">
      <div className="sidebar-background" aria-hidden="true" />
      <div className="sidebar-brand">
        <div className="brand-logo">
          <TrainTrack size={22} color="#fff" />
        </div>
        <h2>RailTrack AI</h2>
      </div>

      <nav ref={navRef} className="sidebar-nav">
        <ul>
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
              >
                <Icon size={18} />
                <span>{label}</span>
              </NavLink>
            </li>
          ))}

          <li className="logout-item">
            <button
              type="button"
              className="logout-btn"
              onClick={handleLogout}
            >
              <LogOut size={18} />
              <span>Logout</span>
            </button>
          </li>
        </ul>
      </nav>

      <div className="sidebar-footer">
        <p>© {new Date().getFullYear()} RailTrack AI</p>
      </div>
    </aside>
  );
}