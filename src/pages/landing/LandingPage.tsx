import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, CalendarDays, MapPin, Radio, Route, Search, Sparkles, Ticket, TrainFront } from "lucide-react";
import LandingNavbar from "../../components/landing/LandingNavbar";
import FeatureAuthModal from "../../components/auth/FeatureAuthModal";
import { useAuthStore } from "../../store/authStore";
import stationsData from "../../data/stations.json";
import { getSuggestions, normalizeStationLabel, todayIso } from "../../features/train/utils/trainUtils";
import { ROUTES } from "../../utils/constants";
import "./LandingPage.scss";

const featureCards = [
  {
    title: "Search Trains",
    description: "Find trains between stations with schedules, fares and journey information.",
    icon: <Search size={20} />, 
    action: ROUTES.SEARCH_TRAIN,
    label: "Search Trains",
  },
  {
    title: "PNR Enquiry",
    description: "Check your PNR status, ticket details and journey information.",
    icon: <Ticket size={20} />,
    action: ROUTES.PNR_ENQUIRY,
    label: "Check PNR",
  },
  {
    title: "Live Train Status",
    description: "Track train movement, delays, current location and upcoming stations.",
    icon: <Radio size={20} />,
    action: ROUTES.LIVE_STATUS,
    label: "Track Train",
  },
  {
    title: "Station Board",
    description: "View live arrivals, departures, platforms and operational status.",
    icon: <MapPin size={20} />,
    action: ROUTES.STATION_BOARD,
    label: "View Board",
  },
  {
    title: "Train Route",
    description: "Explore complete train routes, stops, distances and journey details.",
    icon: <Route size={20} />,
    action: ROUTES.TRAIN_ROUTE,
    label: "View Route",
  },
  {
    title: "AI Assistant",
    description: "Ask RailTrack AI about trains, routes, fares, railway rules and travel planning.",
    icon: <Sparkles size={20} />,
    action: ROUTES.AI_ASSISTANT,
    label: "Ask AI",
  },
];

const stats = [
  { value: "Fast", label: "Search" },
  { value: "Live", label: "Information" },
  { value: "AI", label: "Powered" },
  { value: "Secure", label: "Access" },
];

const STATIONS = stationsData.data ?? [];

type LandingSearchState = {
  fromStation?: string;
  toStation?: string;
  date?: string;
};

const aiMessages = [
  "Which train is best for a late night journey?",
  "Explain RAC and WL in simple terms.",
  "What should I check before booking a ticket?",
  "Show me the route of train 12002.",
];

const livePreviews = [
  {
    title: "Live Train Status",
    items: [
      { label: "Train", value: "Rajdhani Express" },
      { label: "Number", value: "12413" },
      { label: "Status", value: "On time" },
      { label: "Delay", value: "0 min" },
      { label: "Next", value: "New Delhi" },
    ],
  },
  {
    title: "PNR Status",
    items: [
      { label: "PNR", value: "4321587654" },
      { label: "Booking", value: "Confirmed" },
      { label: "Chart", value: "Prepared" },
      { label: "Coach", value: "A1" },
      { label: "Seat", value: "12" },
    ],
  },
  {
    title: "Station Board",
    items: [
      { label: "Station", value: "Mumbai Central" },
      { label: "Train", value: "12002" },
      { label: "Departs", value: "08:15" },
      { label: "Platform", value: "5" },
      { label: "Status", value: "On time" },
    ],
  },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [requestedFeatureRoute, setRequestedFeatureRoute] = useState<string>("");
  const [requestedFeatureLabel, setRequestedFeatureLabel] = useState<string>("this feature");
  const [pendingSearchState, setPendingSearchState] = useState<LandingSearchState | null>(null);
  const [fromQuery, setFromQuery] = useState("");
  const [showFromSuggestions, setShowFromSuggestions] = useState(false);
  const [toQuery, setToQuery] = useState("");
  const [showToSuggestions, setShowToSuggestions] = useState(false);
  const [journeyDate, setJourneyDate] = useState(todayIso());
  const fromRef = useRef<HTMLDivElement | null>(null);
  const toRef = useRef<HTMLDivElement | null>(null);

  const statsList = useMemo(() => stats, []);
  const fromSuggestions = useMemo(() => getSuggestions(fromQuery, STATIONS), [fromQuery]);
  const toSuggestions = useMemo(() => getSuggestions(toQuery, STATIONS), [toQuery]);

  const normalizeStationInput = useCallback((value: string) => {
    const trimmed = value.trim();
    return /^[A-Za-z]{2,5}$/.test(trimmed) ? trimmed.toUpperCase() : trimmed;
  }, []);

  const resolveStationValue = useCallback(
    (value: string) => {
      const normalizedValue = normalizeStationInput(value);
      const candidate = STATIONS.find(
        (station) =>
          station.code.toLowerCase() === normalizedValue.toLowerCase() ||
          station.name.toLowerCase() === normalizedValue.toLowerCase() ||
          normalizeStationLabel(station).toLowerCase() === normalizedValue.toLowerCase(),
      );

      if (candidate) {
        return {
          displayValue: normalizeStationLabel(candidate),
          code: candidate.code,
        };
      }

      return {
        displayValue: normalizedValue,
        code: /^[A-Za-z]{2,5}$/.test(normalizedValue) ? normalizedValue.toUpperCase() : "",
      };
    },
    [normalizeStationInput],
  );

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (fromRef.current && !fromRef.current.contains(event.target as Node)) {
        setShowFromSuggestions(false);
      }
      if (toRef.current && !toRef.current.contains(event.target as Node)) {
        setShowToSuggestions(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleFeatureClick(route: string, label: string) {
    if (isAuthenticated) {
      navigate(route);
      return;
    }

    setRequestedFeatureRoute(route);
    setRequestedFeatureLabel(label || "this feature");
    setPendingSearchState(null);
    setModalOpen(true);
  }

  function handleSearchNow() {
    const fromStation = fromQuery.trim();
    const toStation = toQuery.trim();

    if (!fromStation || !toStation) {
      setShowFromSuggestions(true);
      setShowToSuggestions(true);
      return;
    }

    const searchState: LandingSearchState = {
      fromStation,
      toStation,
      date: journeyDate,
    };

    if (isAuthenticated) {
      navigate(ROUTES.SEARCH_TRAIN, { state: searchState });
      return;
    }

    setRequestedFeatureRoute(ROUTES.SEARCH_TRAIN);
    setRequestedFeatureLabel("Search Trains");
    setPendingSearchState(searchState);
    setModalOpen(true);
  }

  function handleSignIn() {
    setModalOpen(false);
    navigate(ROUTES.LOGIN, { state: { redirectTo: requestedFeatureRoute || ROUTES.SEARCH_TRAIN, ...(pendingSearchState ?? {}) } });
  }

  function handleRegister() {
    setModalOpen(false);
    navigate(ROUTES.REGISTER, { state: { redirectTo: requestedFeatureRoute || ROUTES.SEARCH_TRAIN, ...(pendingSearchState ?? {}) } });
  }

  return (
    <div className="landing-page">
      <LandingNavbar />

      <main className="landing-hero-section">
        <section className="landing-hero-copy">
          <span className="eyebrow">RAILWAY INTELLIGENCE PLATFORM</span>
          <h1>Travel Smarter with RailTrack AI</h1>
          <p>
            Search trains, check PNR status, track live trains, explore station boards and get AI-powered railway assistance — all in one place.
          </p>
          <div className="hero-cta-group">
            <button type="button" className="btn btn-primary" onClick={() => handleFeatureClick(ROUTES.SEARCH_TRAIN, "Search Trains")}>
              Search Trains
            </button>
            <a href="#features" className="btn btn-secondary">
              Explore Features
            </a>
          </div>

          <div className="hero-stats-grid">
            {statsList.map((item) => (
              <article key={item.label} className="hero-stat-card">
                <strong>{item.value}</strong>
                <p>{item.label}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-hero-visual">
          <div className="hero-visual-card">
            <div className="hero-visual-top">
              <div>
                <span>Live rail intelligence</span>
              </div>
              <span className="visual-badge">RailTrack AI</span>
            </div>
            <div className="hero-visual-content">
              <div className="hero-visual-illustration" aria-hidden="true">
                <svg viewBox="0 0 900 560" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <linearGradient id="g1" x1="0" x2="1" y1="0" y2="1">
                      <stop offset="0%" stopColor="#1f57ff" stopOpacity="0.95" />
                      <stop offset="100%" stopColor="#3e8cff" stopOpacity="0.95" />
                    </linearGradient>
                    <linearGradient id="g2" x1="0" x2="1">
                      <stop offset="0%" stopColor="#0b2548" stopOpacity="0.7" />
                      <stop offset="100%" stopColor="#08203a" stopOpacity="0.35" />
                    </linearGradient>
                    <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
                      <feDropShadow dx="0" dy="10" stdDeviation="24" floodColor="#071a33" floodOpacity="0.18" />
                    </filter>
                  </defs>

                  {/* background rails and subtle gradients */}
                  <rect x="0" y="0" width="900" height="560" fill="url(#g2)" />

                  {/* distant gradient bands */}
                  <g opacity="0.08">
                    <ellipse cx="220" cy="120" rx="200" ry="50" fill="#2e76f1" />
                    <ellipse cx="680" cy="180" rx="160" ry="40" fill="#1f57ff" />
                  </g>

                  {/* tracks */}
                  <g transform="translate(0,260)" stroke="#0b2140" strokeWidth="6">
                    <path d="M40 40 L860 40" stroke="rgba(255,255,255,0.06)" />
                    <path d="M40 80 L860 80" stroke="rgba(255,255,255,0.04)" />
                    <g stroke="#0a1b33" strokeWidth="4">
                      <path d="M60 20 L60 100" />
                      <path d="M120 20 L120 100" />
                      <path d="M180 20 L180 100" />
                      <path d="M240 20 L240 100" />
                      <path d="M300 20 L300 100" />
                      <path d="M360 20 L360 100" />
                      <path d="M420 20 L420 100" />
                      <path d="M480 20 L480 100" />
                      <path d="M540 20 L540 100" />
                      <path d="M600 20 L600 100" />
                      <path d="M660 20 L660 100" />
                      <path d="M720 20 L720 100" />
                    </g>
                  </g>

                  {/* train body */}
                  <g transform="translate(80,200)" filter="url(#softShadow)">
                    <rect x="90" y="40" rx="18" ry="18" width="560" height="130" fill="url(#g1)" />
                    <rect x="120" y="20" rx="12" ry="12" width="120" height="40" fill="#0d1c33" opacity="0.12" />
                    {/* <!-- windows --> */}
                    <g fill="#ffffff" opacity="0.95">
                      <rect x="160" y="66" width="54" height="38" rx="6" />
                      <rect x="235" y="66" width="54" height="38" rx="6" />
                      <rect x="310" y="66" width="54" height="38" rx="6" />
                      <rect x="385" y="66" width="54" height="38" rx="6" />
                      <rect x="460" y="66" width="54" height="38" rx="6" />
                    </g>
                    {/* front light */}
                    <circle cx="640" cy="100" r="10" fill="#ffd466" opacity="0.95" />
                    {/* wheels */}
                    <g fill="#081427">
                      <circle cx="200" cy="190" r="18" />
                      <circle cx="330" cy="190" r="18" />
                      <circle cx="460" cy="190" r="18" />
                      <circle cx="590" cy="190" r="18" />
                    </g>
                  </g>

                  {/* small dashboard / cards on the left */}
                  <g transform="translate(36,56)">
                    <rect x="0" y="0" width="240" height="120" rx="12" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.06)" />
                    <rect x="12" y="14" width="64" height="18" rx="4" fill="#ffffff" opacity="0.9" />
                    <rect x="12" y="42" width="180" height="14" rx="6" fill="#ffffff" opacity="0.08" />
                    <rect x="12" y="62" width="110" height="10" rx="5" fill="#ffffff" opacity="0.06" />

                    <rect x="0" y="140" width="180" height="80" rx="12" fill="rgba(255,255,255,0.03)" />
                    <circle cx="40" cy="180" r="18" fill="#3e8cff" />
                    <rect x="72" y="160" width="90" height="14" rx="6" fill="#ffffff" opacity="0.9" />
                  </g>

                </svg>
              </div>
              <div className="hero-visual-overlay" />
            </div>
          </div>
        </section>
      </main>

      <section className="search-preview-section" id="search-preview">
        <div className="preview-card">
          <div>
            <p className="preview-eyebrow">Search Trains</p>
            <h2>Find trains between stations.</h2>
            <p>Start your journey planning with a quick train search preview. Sign in to access the full experience.</p>
          </div>

          <div className="preview-form-grid">
            <div className="station-field" ref={fromRef}>
              <label>
                From Station
                <input
                  type="text"
                  value={fromQuery}
                  placeholder="Enter station or code"
                  onChange={(e) => {
                    setFromQuery(e.target.value);
                    setShowFromSuggestions(true);
                  }}
                  onFocus={() => setShowFromSuggestions(true)}
                />
              </label>
              {showFromSuggestions && fromSuggestions.length > 0 && (
                <ul className="station-suggestion-list">
                  {fromSuggestions.map((station) => (
                    <li
                      key={station.code}
                      onClick={() => {
                        const resolved = resolveStationValue(station.name);
                        setFromQuery(resolved.displayValue);
                        setShowFromSuggestions(false);
                      }}
                    >
                      {normalizeStationLabel(station)}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <button type="button" className="swap-button" aria-label="Swap stations" onClick={() => {
              setFromQuery(toQuery);
              setToQuery(fromQuery);
            }}>
              <ArrowRight size={18} />
            </button>

            <div className="station-field" ref={toRef}>
              <label>
                To Station
                <input
                  type="text"
                  value={toQuery}
                  placeholder="Enter station or code"
                  onChange={(e) => {
                    setToQuery(e.target.value);
                    setShowToSuggestions(true);
                  }}
                  onFocus={() => setShowToSuggestions(true)}
                />
              </label>
              {showToSuggestions && toSuggestions.length > 0 && (
                <ul className="station-suggestion-list">
                  {toSuggestions.map((station) => (
                    <li
                      key={station.code}
                      onClick={() => {
                        const resolved = resolveStationValue(station.name);
                        setToQuery(resolved.displayValue);
                        setShowToSuggestions(false);
                      }}
                    >
                      {normalizeStationLabel(station)}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <label>
              Journey Date
              <div className="preview-date-field">
                <CalendarDays size={16} />
                <input
                  type="date"
                  value={journeyDate}
                  onChange={(e) => setJourneyDate(e.target.value)}
                  min={todayIso()}
                />
              </div>
            </label>
            <button type="button" className="btn btn-primary preview-submit" onClick={handleSearchNow}>
              Search Trains
            </button>
          </div>
        </div>
      </section>

      <section className="feature-section" id="features">
        <div className="section-header">
          <span>POWERFUL FEATURES</span>
          <h2>Everything you need for a smoother journey</h2>
          <p>Discover everything RailTrack AI can do for your railway travel.</p>
        </div>

        <div className="feature-grid">
          {featureCards.map((feature) => (
            <article key={feature.title} className="feature-card">
              <div className="feature-icon">{feature.icon}</div>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
              <button type="button" className="feature-button" onClick={() => handleFeatureClick(feature.action, feature.title)}>
                {feature.label}
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="ai-assistant-section" id="ai-assistant">
        <div className="ai-assistant-copy">
          <span className="eyebrow">AI ASSISTANT</span>
          <h2>Your intelligent railway travel companion</h2>
          <p>Ask questions about trains, routes, delays, PNR and railway travel in simple language.</p>
          <button type="button" className="btn btn-primary" onClick={() => handleFeatureClick(ROUTES.AI_ASSISTANT, "AI Assistant")}>
            Ask RailTrack AI
          </button>
        </div>

        <div className="ai-preview-card">
          <div className="chat-header">
            <span>AI Chat Preview</span>
            <TrainFront size={18} />
          </div>
          <div className="chat-messages">
            {aiMessages.map((item) => (
              <div key={item} className="chat-bubble">
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="live-preview-section" id="live-preview">
        <div className="section-header">
          <span>REAL-TIME RAILWAY INFORMATION</span>
          <h2>Railway information at your fingertips</h2>
        </div>
        <div className="live-preview-grid">
          {livePreviews.map((preview) => (
            <article key={preview.title} className="live-card">
              <div className="live-card-heading">
                <h3>{preview.title}</h3>
                <span className="live-chip">Preview</span>
              </div>
              <div className="live-card-body">
                {preview.items.map((item) => (
                  <div key={item.label} className="live-line">
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="final-cta-section">
        <div className="final-cta-copy">
          <h2>Ready to travel smarter?</h2>
          <p>Create your RailTrack AI account and unlock powerful railway tools in one place.</p>
        </div>
        <div className="final-cta-actions">
          <Link to={ROUTES.REGISTER} className="btn btn-primary">
            Get Started
          </Link>
          <Link to={ROUTES.LOGIN} className="btn btn-secondary">
            Sign In
          </Link>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="footer-grid">
          <div className="footer-column">
            <p className="footer-brand">RailTrack AI</p>
            <p>Smarter railway journeys, powered by AI.</p>
          </div>
          <div className="footer-column">
            <h3>Product</h3>
            <a href="#search-preview">Search Trains</a>
            <a href="#features">PNR Status</a>
            <a href="#live-preview">Live Status</a>
            <a href="#live-preview">Station Board</a>
            <a href="#features">Train Route</a>
            <a href="#ai-assistant">AI Assistant</a>
          </div>
          <div className="footer-column">
            <h3>Account</h3>
            <Link to={ROUTES.LOGIN}>Sign In</Link>
            <Link to={ROUTES.REGISTER}>Register</Link>
            {/* <a href="#">Profile</a>
            <a href="#">History</a> */}
          </div>
          {/* <div className="footer-column">
            <h3>Resources</h3>
            <a href="#">Help</a>
            <a href="#">FAQs</a>
            <a href="#">Railway Information</a>
            <a href="#">Contact</a>
          </div> */}
        </div>
        <div className="footer-bottom">© 2026 RailTrack AI</div>
      </footer>

      <FeatureAuthModal
        open={modalOpen}
        featureLabel={requestedFeatureLabel}
        onClose={() => setModalOpen(false)}
        onSignIn={handleSignIn}
        onRegister={handleRegister}
      />
    </div>
  );
}
