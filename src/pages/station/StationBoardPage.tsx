import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  Building2,
  CheckCircle,
  ChevronRight,
  Clock,
  Eye,
  MapPin,
  RefreshCw,
  Search,
  TrainFront,
  XCircle,
} from "lucide-react";

import stationsData from "../../data/stations.json";
import stationService from "../../services/stationService";
import { cacheService } from "../../services/cacheService";
import { historyService } from "../../services/historyService";
import { settingsService } from "../../services/settingsService";
import { getSuggestions } from "../../features/train/utils/trainUtils";
import type { StationBoardResponse, StationBoardTrain } from "../../types/Station";
import type { Station } from "../../types/Train";
import { getApiErrorMessage, formatCompactTime, formatDateTime } from "../../utils/helpers";
import { ROUTES } from "../../utils/constants";

import "./StationBoardPage.scss";

function normalizeStatus(value?: string | null): string | null {
  if (!value || !value.trim()) return null;
  return value.trim();
}

function getOperationalDeparture(train: StationBoardTrain): string | null {
  return train.expectedDeparture ?? train.departure ?? null;
}

function parseTrainTime(value?: string | null): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const utcDate = new Date(trimmed);
  if (!Number.isNaN(utcDate.getTime())) {
    return utcDate.getTime();
  }

  const timeMatch = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?(?:\s*(AM|PM|am|pm))?$/);
  if (!timeMatch) return null;

  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  const ampm = timeMatch[3]?.toUpperCase();
  let normalizedHour = hour;

  if (ampm === "PM" && hour < 12) normalizedHour += 12;
  if (ampm === "AM" && hour === 12) normalizedHour = 0;

  return new Date(1970, 0, 1, normalizedHour, minute).getTime();
}

function formatTrainTime(value?: string | null): string {
  const parsed = parseTrainTime(value);
  if (parsed !== null) {
    return new Intl.DateTimeFormat("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(parsed));
  }

  if (value?.trim()) {
    return value.trim();
  }

  return "—";
}

function resolveTrainStatus(train: StationBoardTrain): string {
  const status = normalizeStatus(train.currentStatus) ?? normalizeStatus(train.status);
  if (!status) {
    return "Unknown";
  }

  const normalized = status.toLowerCase();

  if (normalized.includes("cancel")) return "Cancelled";
  if (normalized.includes("delay")) return "Delayed";
  if (normalized.includes("boarding") || normalized.includes("board")) return "Boarding";
  if (normalized.includes("on time") || normalized === "on time") return "On Time";
  if (normalized.includes("depart")) return "Departed";
  if (normalized.includes("arriv")) return "Arrived";
  if (normalized.includes("upcoming")) return "Upcoming";

  return status.charAt(0).toUpperCase() + status.slice(1);
}

function getStatusClass(statusLabel: string): string {
  switch (statusLabel) {
    case "Cancelled":
      return "status-cancelled";
    case "Delayed":
      return "status-delayed";
    case "Boarding":
      return "status-boarding";
    case "Departed":
      return "status-departed";
    case "Arrived":
      return "status-arrived";
    case "Upcoming":
      return "status-upcoming";
    default:
      return "status-on-time";
  }
}

function isKnownStationCode(code: string, stations: Station[]): boolean {
  return stations.some((station) => station.code === code.trim().toUpperCase());
}

function formatDelayLabel(train: StationBoardTrain): string {
  if (typeof train.delayMinutes === "number") {
    if (train.delayMinutes === 0) {
      return "On time";
    }
    return `${train.delayMinutes} min`;
  }

  const delayText = train.delay?.trim() ?? "";
  if (!delayText) return "—";

  const digits = delayText.match(/\d+/);
  if (digits) {
    return delayText.toLowerCase().includes("min") ? delayText : `${digits[0]} min`;
  }

  return delayText;
}

export default function StationBoardPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const initialStationState = location.state as { stationCode?: string } | null;
  const cachedStationBoard = cacheService.getLatest<StationBoardResponse>("STATION");
  const initialCode = initialStationState?.stationCode ?? String(cachedStationBoard?.request?.stationCode ?? "");
  const initialBoard = initialStationState?.stationCode ? null : cachedStationBoard?.response ?? null;

  const [stationCode, setStationCode] = useState(initialCode);
  const [board, setBoard] = useState<StationBoardResponse | null>(initialBoard);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hours, setHours] = useState<number>(4);
  const [showStationSuggestions, setShowStationSuggestions] = useState(false);
  const [page, setPage] = useState(1);

  const STATIONS: Station[] = stationsData.data ?? [];
  const stationSuggestions = getSuggestions(stationCode, STATIONS);

  useEffect(() => {
    if (initialStationState?.stationCode) {
      void handleLoadBoard(initialStationState.stationCode);
    }
  }, [initialStationState?.stationCode]);

  useEffect(() => {
    setPage(1);
  }, [board]);

  async function handleLoadBoard(code: string) {
    const finalCode = code.trim().toUpperCase();
    if (!finalCode) {
      setError("Please enter a station code.");
      return;
    }
    if (!isKnownStationCode(finalCode, STATIONS)) {
      setError("Please select a valid station code from the suggestions.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await stationService.getBoard({ stationCode: finalCode, hours });
      const payload = response.data;
      setBoard(payload);

      const settings = settingsService.getSettings();
      if (settings.cache.enabled) {
        cacheService.set("STATION", { stationCode: finalCode, hours }, payload, settings.cache.ttlMinutes * 60 * 1000);
      }
      if (settings.history.autoSave) {
        historyService.record(
          "STATION",
          { stationCode: finalCode, hours },
          payload,
          `${payload.stationName} (${payload.stationCode}) · ${payload.trains.length} trains`,
        );
      }
    } catch (err) {
      setBoard(null);
      setError(getApiErrorMessage(err, "Unable to load station board right now."));
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await handleLoadBoard(stationCode);
  }

  const filteredTrains = useMemo(() => {
    const trains = board?.trains ?? [];
    return [...trains].sort((left, right) => {
      const leftTime = parseTrainTime(getOperationalDeparture(left));
      const rightTime = parseTrainTime(getOperationalDeparture(right));

      if (leftTime === null && rightTime === null) return 0;
      if (leftTime === null) return 1;
      if (rightTime === null) return -1;
      return leftTime - rightTime;
    });
  }, [board]);

  const pageSize = 8;
  const pageCount = Math.max(1, Math.ceil(filteredTrains.length / pageSize));
  const safePage = Math.min(Math.max(page, 1), pageCount);
  const paginatedTrains = filteredTrains.slice((safePage - 1) * pageSize, safePage * pageSize);

  const summaryCards = board
    ? [
        { label: "Station", value: board.stationCode, icon: MapPin, secondary: board.stationName },
        { label: "Total Trains", value: String(board.trains.length), icon: TrainFront, secondary: `${board.totalTrains ?? board.trains.length} scheduled` },
        { label: "On Time", value: String(board.trains.filter((train) => resolveTrainStatus(train) === "On Time" || resolveTrainStatus(train) === "Boarding").length), icon: CheckCircle, secondary: "Live status" },
        { label: "Delayed", value: String(board.trains.filter((train) => resolveTrainStatus(train) === "Delayed").length), icon: Clock, secondary: "Operational watch" },
        { label: "Cancelled", value: String(board.trains.filter((train) => resolveTrainStatus(train) === "Cancelled").length), icon: XCircle, secondary: "Service alerts" },
        { label: "Last Updated", value: board.currentTime ? formatCompactTime(board.currentTime) : board.date ?? "Today", icon: RefreshCw, secondary: board.currentTime ? formatDateTime(board.currentTime) : "Board date" },
      ]
    : [];

  return (
    <div className="enterprise-page station-board-page">
      <header className="enterprise-header station-board-header">
        <div>
          <span className="eyebrow">Operations</span>
          <h1>Station Board</h1>
          <p className="page-subtitle">Search real station boards, filter trains, and revisit previous searches instantly.</p>
        </div>

        <div className="header-actions-row">
          {board && board.currentTime && <span className="meta-chip">Updated {formatCompactTime(board.currentTime)}</span>}
          <button type="button" className="btn btn-secondary" onClick={() => handleLoadBoard(stationCode)} disabled={loading}>
            <RefreshCw size={16} /> Refresh
          </button>
        </div>
      </header>

      <section className="filters-panel enterprise-card">
        <form className="station-filter-grid" onSubmit={handleSubmit} aria-label="Station board filters">
          <label className="field station-field autocomplete-station-field">
            <span>Station Code</span>
            <div className="station-autocomplete">
              <input
                value={stationCode}
                onChange={(e) => {
                  setStationCode(e.target.value.toUpperCase());
                  setShowStationSuggestions(true);
                }}
                onFocus={() => setShowStationSuggestions(true)}
                placeholder="Enter station code"
                maxLength={10}
                disabled={loading}
                autoComplete="off"
              />
              {showStationSuggestions && stationCode.trim() && (
              <ul className="suggestions-dropdown" role="listbox" aria-label="Station suggestions">
                {stationSuggestions.length > 0 ? (
                  stationSuggestions.map((station) => (
                    <li
                      key={station.code}
                      role="option"
                      onMouseDown={() => {
                        setStationCode(station.code);
                        setShowStationSuggestions(false);
                      }}
                    >
                      <span className="station-name">{station.name}</span>
                      <span className="station-code-badge">{station.code}</span>
                    </li>
                  ))
                ) : (
                  <li className="no-results">No matching stations</li>
                )}
              </ul>
            )}
          </div>
        </label>

          <label className="field station-field">
            <span>Timing</span>
            <select value={hours} onChange={(e) => setHours(Number(e.target.value))}>
              <option value={2}>2 hrs</option>
              <option value={4}>4 hrs</option>
              <option value={6}>6 hrs</option>
              <option value={8}>8 hrs</option>
              <option value={12}>12 hrs</option>
            </select>
          </label>

          <div className="filter-button-row">
            <button type="submit" className="btn btn-primary" disabled={loading}>
              <Search size={16} /> Search
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-clear"
              onClick={() => {
                setHours(4);
                setStationCode("");
                setShowStationSuggestions(false);
                setBoard(null);
                setError(null);
              }}
              disabled={!board && !stationCode}
            >
              Clear
            </button>
          </div>
        </form>
      </section>

      {error && (
        <section className="error-banner enterprise-card">
          <AlertTriangle size={18} />
          <div>
            <strong>Station board unavailable</strong>
            <p>{error}</p>
          </div>
          <button type="button" className="btn btn-secondary" onClick={() => handleLoadBoard(stationCode)} disabled={loading}>
            Retry
          </button>
        </section>
      )}

      {!board && loading && (
        <section className="enterprise-card skeleton-grid">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="skeleton-card" />
          ))}
        </section>
      )}

      {!loading && board && filteredTrains.length === 0 && (
        <section className="enterprise-card empty-panel">
          <Building2 size={34} />
          <h3>No departures found</h3>
          <p>Try changing the filters or search another station code.</p>
        </section>
      )}

      {board && (
        <>
          <section className="station-summary-grid">
            {summaryCards.map((card) => {
              const Icon = card.icon;
              return (
                <article className="summary-card" key={card.label}>
                  <div className="summary-card-icon">
                    <Icon size={20} />
                  </div>
                  <div className="summary-content">
                    <span className="summary-label">{card.label}</span>
                    <span className="summary-value">{card.value}</span>
                    <span className="summary-subtitle">{card.secondary}</span>
                  </div>
                </article>
              );
            })}
          </section>

          <section className="station-board-table-section enterprise-card">
            <div className="table-topbar">
              <div>
                <span className="section-kicker">Live Station Board</span>
                <h2>{board.stationName}</h2>
              </div>
              <div className="table-actions">
                <span className="result-counter">{filteredTrains.length} of {board.trains.length} results</span>
              </div>
            </div>

            <div className="table-scroll">
              <table className="station-board-table">
                <thead>
                  <tr>
                    <th scope="col">Train</th>
                    <th scope="col">Train Number</th>
                    <th scope="col">Departure</th>
                    <th scope="col">Platform</th>
                    <th scope="col">Status</th>
                    <th scope="col">Delay</th>
                    <th scope="col">Destination</th>
                    <th scope="col" className="col-action">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedTrains.map((train, index) => {
                    const statusLabel = resolveTrainStatus(train);
                    const statusClass = getStatusClass(statusLabel);
                    const departureTime = formatTrainTime(getOperationalDeparture(train));
                    const delayLabel = formatDelayLabel(train);

                    return (
                      <tr key={`${train.trainNumber}-${train.departure ?? train.arrival ?? index}`}>
                        <td>
                          <div className="train-cell">
                            <span className="train-icon">
                              <TrainFront size={18} />
                            </span>
                            <div>
                              <span className="train-name">{train.trainName}</span>
                              <span className="train-subtitle">{train.sourceStation ?? "Source"} → {train.destinationStation ?? "Destination"}</span>
                            </div>
                          </div>
                        </td>
                        <td className="train-number">{train.trainNumber}</td>
                        <td className="departure-cell">{departureTime}</td>
                        <td>
                          <span className="platform-badge">{train.platform || "—"}</span>
                        </td>
                        <td>
                          <span className={`status-badge ${statusClass}`}>{statusLabel}</span>
                        </td>
                        <td className="delay-cell">{delayLabel}</td>
                        <td>{train.destinationStation ?? "—"}</td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-ghost table-action-button"
                            aria-label={`View ${train.trainName}`}
                            onClick={() => navigate(ROUTES.LIVE_STATUS, { state: { trainNumber: train.trainNumber, date: new Date().toISOString().slice(0, 10) } })}
                          >
                            <Eye size={15} /> View
                            <ChevronRight size={13} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="table-footer">
              <div className="pagination">
                <button type="button" className="btn btn-secondary btn-small" aria-label="Previous page" disabled={safePage <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</button>
                <span className="page-number">{safePage}</span>
                <button type="button" className="btn btn-secondary btn-small" aria-label="Next page" disabled={safePage >= pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))}>Next</button>
              </div>
              <span className="result-counter">Showing {paginatedTrains.length} of {filteredTrains.length}</span>
            </div>
          </section>
        </>
      )}
    </div>
  );
}