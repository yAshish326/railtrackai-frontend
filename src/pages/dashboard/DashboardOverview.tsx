import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bot, History, MapPinned, Radio, Search, Sparkles, TrainFront, Ticket, User, Send } from "lucide-react";
import type { ReactNode, FormEvent } from "react";

import dashboardService from "../../services/dashboardService";
import { historyService } from "../../services/historyService";
import { useAuthStore } from "../../store/authStore";
import { ROUTES } from "../../utils/constants";
import { safeValue } from "../../utils/helpers";

import "./DashboardOverview.scss";

interface BackendDashboardSummary {
  stats?: {
    trainSearchesCount?: number;
    pnrSearchesCount?: number;
    aiRequestsCount?: number;
    totalSavedSearches?: number;
    totalSearches?: number;
  };
  recentActivity?: Array<{
    searchType?: string;
    responseSummary?: string;
    timestamp?: string;
    parameters?: Record<string, unknown>;
  }>;
}

interface DashboardStatCard {
  label: string;
  value: number;
  description: string;
  icon: ReactNode;
  accentColor: string;
}

// Note: previously used as a fallback for saved-search counts. Removed usage
// in favor of backend-provided totals to avoid counting unrelated cache keys.

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function formatRelativeTime(value?: string): string {
  if (!value) return "Just now";
  const now = Date.now();
  const then = new Date(value).getTime();
  const diffSeconds = Math.floor((now - then) / 1000);

  if (diffSeconds < 60) return `${diffSeconds}s ago`;
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
  if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
  return `${Math.floor(diffSeconds / 86400)}d ago`;
}

function getSearchBadgeLabel(type?: string): string {
  return (type ?? "OTHER").toUpperCase();
}

function getSearchQuery(record: { searchType?: string; responseSummary?: string; parameters?: Record<string, unknown> }) {
  const params = record.parameters as Record<string, unknown> | undefined;
  if (record.searchType === "PNR") return safeValue(params?.pnrNumber) || record.responseSummary || "PNR Status";
  if (record.searchType === "TRAIN") return safeValue(params?.trainNumber) || record.responseSummary || "Train Route";
  if (record.searchType === "STATION") return safeValue(params?.stationCode) || record.responseSummary || "Station Schedule";
  if (record.searchType === "LIVE") return safeValue(params?.trainNumber) || record.responseSummary || "Live Status";
  if (record.searchType === "AI") return record.responseSummary || "AI Request";
  return record.responseSummary || "Search";
}

function getActivityColor(type?: string): string {
  switch (type) {
    case "PNR":
      return "#0f766e";
    case "TRAIN":
      return "#2563eb";
    case "STATION":
      return "#7c3aed";
    case "LIVE":
      return "#ea580c";
    case "AI":
      return "#8b5cf6";
    default:
      return "#64748b";
  }
}

export default function DashboardOverview() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [backendSummary, setBackendSummary] = useState<BackendDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiPrompt, setAiPrompt] = useState("");
  const historyRecords = useMemo(() => historyService.list({ sort: "newest" }), []);

  useEffect(() => {
    let active = true;
    setLoading(true);

    dashboardService
      .getSummary()
      .then((response) => {
        // Accept both API shapes:
        // 1) { success: true, data: { stats: ..., recentActivity: [...] } }
        // 2) { stats: ..., recentActivity: [...], user: ... }
        const raw = response.data as unknown;
        if (!active) return;

        try {
          const payload = raw as { success?: boolean; data?: BackendDashboardSummary } | BackendDashboardSummary;

          if ((payload as any).success && (payload as any).data) {
            setBackendSummary((payload as any).data as BackendDashboardSummary);
            return;
          }

          // If the response already looks like the summary object, use it directly
          const asSummary = payload as BackendDashboardSummary;
          if (asSummary && (asSummary.stats || asSummary.recentActivity)) {
            setBackendSummary(asSummary);
            return;
          }
        } catch {
          // fallthrough — leave backendSummary as null
        }
      })
      .catch(() => {
        if (active) setBackendSummary(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const recentActivity = useMemo(() => {
    if (backendSummary?.recentActivity?.length) {
      return backendSummary.recentActivity.slice(0, 5);
    }
    return historyRecords.slice(0, 5);
  }, [backendSummary, historyRecords]);

  const stats = useMemo(
    () => ({
      trainSearchesCount: backendSummary?.stats?.trainSearchesCount ?? historyRecords.filter((record) => record.searchType === "TRAIN").length,
      pnrSearchesCount: backendSummary?.stats?.pnrSearchesCount ?? historyRecords.filter((record) => record.searchType === "PNR").length,
      aiRequestsCount: backendSummary?.stats?.aiRequestsCount ?? historyRecords.filter((record) => record.searchType === "AI").length,
      totalSearches:
        backendSummary?.stats?.totalSearches ??
        backendSummary?.stats?.totalSavedSearches ??
        0,
    }),
    [backendSummary?.stats, historyRecords],
  );

  const statCards: DashboardStatCard[] = [
    {
      label: "Train Searches",
      value: stats.trainSearchesCount ?? 0,
      description: "Recent train lookups and route checks.",
      icon: <TrainFront size={18} />,
      accentColor: "#2563eb",
    },
    {
      label: "PNR Checks",
      value: stats.pnrSearchesCount ?? 0,
      description: "Ticket status checks from your history.",
      icon: <Ticket size={18} />,
      accentColor: "#0f766e",
    },
    {
      label: "AI Requests",
      value: stats.aiRequestsCount ?? 0,
      description: "Conversations with RailTrack AI.",
      icon: <Bot size={18} />,
      accentColor: "#7c3aed",
    },
    {
      label: "Total Searches",
      value: stats.totalSearches ?? 0,
      description: "Total searches from your dashboard summary.",
      icon: <Sparkles size={18} />,
      accentColor: "#ea580c",
    },
  ];

  const quickActions = [
    { label: "Search Train", route: ROUTES.SEARCH_TRAIN, icon: <TrainFront size={18} />, color: "#2563eb", subtitle: "Find trains between stations" },
    { label: "PNR Enquiry", route: ROUTES.PNR_ENQUIRY, icon: <Ticket size={18} />, color: "#0f766e", subtitle: "Check ticket status" },
    { label: "Live Train Status", route: ROUTES.LIVE_STATUS, icon: <Radio size={18} />, color: "#ea580c", subtitle: "Track a train" },
    { label: "Station Board", route: ROUTES.STATION_BOARD, icon: <MapPinned size={18} />, color: "#7c3aed", subtitle: "View board by station" },
    { label: "Station Code", route: ROUTES.STATION_BOARD, icon: <Search size={18} />, color: "#0ea5e9", subtitle: "Lookup station code" },
    { label: "AI Assistant", route: ROUTES.AI_ASSISTANT, icon: <Bot size={18} />, color: "#8b5cf6", subtitle: "Ask RailTrack AI" },
    { label: "History", route: ROUTES.HISTORY, icon: <History size={18} />, color: "#059669", subtitle: "View past activity" },
    { label: "Profile", route: ROUTES.PROFILE, icon: <User size={18} />, color: "#1d4ed8", subtitle: "Manage your profile" },
  ] as const;
  const userName = user?.fullName?.split(/\s+/)[0] ?? "Traveler";
  const currentDate = new Date().toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const handleAiSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!aiPrompt.trim()) {
      navigate(ROUTES.AI_ASSISTANT);
      return;
    }
    navigate(ROUTES.AI_ASSISTANT, { state: { initialPrompt: aiPrompt.trim() } });
  };

  return (
    <div className="dashboard-page">
    <section className="dashboard-hero-section">
      <article className="dashboard-card hero-card">
        <div className="hero-card-inner">

          <div className="hero-content">
            <div className="hero-eyebrow">
              <span className="hero-status-dot" />
              {getGreeting()}, {userName}
              <span className="hero-wave">👋</span>
            </div>

            <h1>
              Where are you 

              <span>travelling next?</span>
            </h1>

            <p className="hero-copy">
              Search trains, check your PNR, track live running status,
              or let RailTrack AI help plan your journey.
            </p>
          </div>

          <div className="hero-visual" aria-hidden="true">
            <div className="hero-glow hero-glow-one" />
            <div className="hero-glow hero-glow-two" />

            <div className="hero-route">
              <span className="route-station route-station-start" />
              <span className="route-line" />
              <span className="route-station route-station-end" />
            </div>

            <div className="hero-train">
              <TrainFront size={54} strokeWidth={1.5} />
            </div>

            <div className="hero-location hero-location-one">
              <span>From</span>
              <strong>Journey</strong>
            </div>

            <div className="hero-location hero-location-two">
              <span>To</span>
              <strong>Your destination</strong>
            </div>
          </div>

        </div>
      </article>
    </section>

      <section className="dashboard-card stats-card">
        <div className="section-header">
          <div>
            <h2>Dashboard stats</h2>
            <p>Track the latest activity across your RailTrack account.</p>
          </div>
        </div>

        <div className="stats-grid">
          {loading
            ? Array.from({ length: 4 }, (_, index) => (
                <div key={index} className="stat-card stat-skeleton">
                  <div className="skeleton-line short" />
                  <div className="skeleton-line medium" />
                </div>
              ))
            : statCards.map((card) => (
                <div key={card.label} className="stat-card">
                  <div>
                    <p className="stat-label">{card.label}</p>
                    <h2 className="stat-value">{card.value}</h2>
                    <p className="stat-detail">{card.description}</p>
                  </div>
                  <div className="stat-icon" style={{ color: card.accentColor, backgroundColor: `${card.accentColor}1a` }}>
                    {card.icon}
                  </div>
                </div>
              ))}
        </div>
      </section>

      <section className="dashboard-card action-section action-card">
        <div className="section-header">
          <div>
            <h2>Quick access</h2>
            <p>Open the tools you use most in one click.</p>
          </div>
        </div>

        <div className="quick-actions-grid">
          {loading
            ? Array.from({ length: 8 }, (_, index) => (
                <div key={index} className="quick-action quick-action-skeleton">
                  <div className="skeleton-circle" />
                  <div className="skeleton-line medium" />
                </div>
              ))
            : quickActions.map((action) => (
                <button key={action.label} type="button" className="quick-action" onClick={() => navigate(action.route)}>
                  <div className="quick-action-icon" style={{ color: action.color, backgroundColor: `${action.color}1a` }}>
                    {action.icon}
                  </div>
                  <div className="quick-action-copy">
                    <span>{action.label}</span>
                  </div>
                </button>
              ))}
        </div>
      </section>

      <section className="dashboard-main-grid">
        <article className="dashboard-card recent-activity-card">
          <div className="section-header space-between">
            <div>
              <h2>Recent Activity</h2>
              <p>Latest searches, live checks, and AI requests.</p>
            </div>
            <button type="button" className="btn-link" onClick={() => navigate(ROUTES.HISTORY)}>
              View all
            </button>
          </div>

          <div className="activity-list">
            {loading
              ? Array.from({ length: 4 }, (_, index) => (
                  <div key={index} className="activity-row activity-skeleton">
                    <div className="skeleton-circle" />
                    <div className="activity-info">
                      <div className="skeleton-line medium" />
                      <div className="skeleton-line short" />
                    </div>
                  </div>
                ))
              : recentActivity.length === 0 ? (
                  <div className="empty-state compact">
                    <History size={24} />
                    <p>No activity records found.</p>
                  </div>
                ) : (
                  recentActivity.map((record, idx) => (
                    <button
                      key={`${record.responseSummary ?? record.searchType}-${record.timestamp ?? idx}`}
                      type="button"
                      className="activity-row"
                      onClick={() => navigate(ROUTES.HISTORY)}
                    >
                      <div className="activity-summary">
                        <span className="activity-badge" style={{ backgroundColor: `${getActivityColor(record.searchType)}22`, color: getActivityColor(record.searchType) }}>
                          {getSearchBadgeLabel(record.searchType)}
                        </span>
                        <div>
                          <strong>{record.responseSummary ?? getSearchQuery(record)}</strong>
                          <p>{record.responseSummary ? record.responseSummary : getSearchQuery(record)}</p>
                        </div>
                      </div>
                      <span className="activity-time">{formatRelativeTime(record.timestamp)}</span>
                    </button>
                  )))}
          </div>
        </article>

        <article className="dashboard-card assistant-card">
          <div className="section-header space-between">
            <div>
              <h2>RailTrack AI Assistant</h2>
              <p>Quick access to AI help, without leaving the dashboard.</p>
            </div>
            <button type="button" className="btn-link" onClick={() => navigate(ROUTES.AI_ASSISTANT)}>
              Full Chat
            </button>
          </div>

          <div className="assistant-content">
            <div className="assistant-bubble">
              <div className="assistant-avatar">
                <Bot size={18} />
              </div>
              <div>
                <strong>How can I help you today?</strong>
                <p>Ask about seat availability, PNR status, station codes, or live train running status.</p>
              </div>
            </div>

            <div className="chip-list">
              {["Check PNR status", "Live train running status", "Station code lookup", "Search for trains"].map((text) => (
                <button
                  key={text}
                  type="button"
                  className="suggestion-chip"
                  onClick={() => navigate(ROUTES.AI_ASSISTANT, { state: { initialPrompt: text } })}
                >
                  {text}
                </button>
              ))}
            </div>

            <form onSubmit={handleAiSubmit} className="assistant-input-row">
              <input
                type="text"
                placeholder="Ask RailTrack AI..."
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                aria-label="RailTrack AI prompt"
              />
              <button type="submit" className="btn btn-primary btn-icon" aria-label="Send prompt">
                <Send size={16} />
              </button>
            </form>
          </div>
        </article>
      </section>
    </div>
  );
}
