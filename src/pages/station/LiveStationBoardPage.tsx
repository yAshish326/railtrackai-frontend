import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useLocation } from "react-router-dom";
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { AlertTriangle, MapPinned, Search } from "lucide-react";

import trainService from "../../services/trainService";
import { cacheService } from "../../services/cacheService";
import { historyService } from "../../services/historyService";
import { settingsService } from "../../services/settingsService";
import { getApiErrorMessage } from "../../utils/helpers";

import "./LiveStationBoardPage.scss";
import "./LiveStationBoardPageDate.scss";

interface LiveStationPoint {
  code?: string;
  name?: string;
  arrival?: string;
  departure?: string;
  platform?: string;
  latitude?: number;
  longitude?: number;
}

interface LiveTrainSnapshot {
  trainNumber?: string;
  trainName?: string;
  speedKmph?: string | number | null;
  delay?: string | number;
  delayMinutes?: number | null;
  expectedArrival?: string;
  actualArrival?: string;
  platform?: string | null;
  runningStatus?: string;
  lastUpdatedAt?: string;
  latitude?: number | null;
  longitude?: number | null;
  currentStation?: string | null;
  previousStation?: string | null;
  nextStation?: string | null;
  currentLocation?: string | null;
  upcomingStations?: LiveStationPoint[];
  timeline?: LiveStationPoint[];
  routeCoordinates?: LiveStationPoint[];
}

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();

  useEffect(() => {
    if (points.length > 1) {
      map.fitBounds(points, { padding: [40, 40] });
    } else if (points.length === 1) {
      map.setView(points[0], 7);
    }
  }, [map, points]);

  return null;
}

export default function LiveStationBoardPage() {
  const location = useLocation();
  const initialSearchState = (location.state as { trainNumber?: string; date?: string } | null) ?? null;
  const cached = cacheService.getLatest<LiveTrainSnapshot>("LIVE");

  const initialTrain = initialSearchState?.trainNumber ?? String(cached?.request.trainNumber ?? "");
  const initialDate = initialSearchState?.date ?? new Date().toISOString().slice(0, 10);

  const [trainNumber, setTrainNumber] = useState(initialTrain);
  const [journeyDate, setJourneyDate] = useState(initialDate);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<LiveTrainSnapshot | null>(cached?.response ?? null);
  const handleSearch = useCallback(async (number?: string, date?: string) => {
    const finalNumber = (number ?? trainNumber).trim().toUpperCase();
    const finalDate = (date ?? journeyDate).trim();
    if (!finalNumber) {
      setError("Enter a train number.");
      return;
    }
    if (!finalDate) {
      setError("Select a journey date.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await trainService.getLiveStatus(finalNumber, finalDate);
      const payload = response.data as LiveTrainSnapshot;
      setData(payload);

      const settings = settingsService.getSettings();
      if (settings.cache.enabled) {
        cacheService.set("LIVE", { trainNumber: finalNumber, date: finalDate }, payload, settings.cache.ttlMinutes * 60 * 1000);
      }
      if (settings.history.autoSave) {
        historyService.record("LIVE", { trainNumber: finalNumber, date: finalDate }, payload, `Live status for ${finalNumber} on ${finalDate}`);
      }
    } catch (err) {
      setData(null);
      setError(getApiErrorMessage(err, "Unable to fetch live train status."));
    } finally {
      setLoading(false);
    }
  }, [journeyDate, trainNumber]);

  useEffect(() => {
    if (!initialSearchState?.trainNumber) {
      return;
    }

    const timerId = window.setTimeout(() => {
      void handleSearch(initialSearchState.trainNumber, initialSearchState.date ?? initialDate);
    }, 0);

    return () => window.clearTimeout(timerId);
  }, [handleSearch, initialDate, initialSearchState?.date, initialSearchState?.trainNumber]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await handleSearch();
  }

  const parseCoord = useCallback((value: unknown) => {
    if (typeof value === "number") return value;
    if (typeof value === "string" && value.trim() !== "") {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : undefined;
    }
    return undefined;
  }, []);

  const routePoints = useMemo(() => {
    return (
      data?.routeCoordinates
        ?.map((point) => {
          const lat = parseCoord(point.latitude);
          const lng = parseCoord(point.longitude);
          return lat !== undefined && lng !== undefined ? [lat, lng] as [number, number] : undefined;
        })
        .filter((point): point is [number, number] => typeof point !== "undefined") ?? []
    );
  }, [data, parseCoord]);

  const currentLocationPoint = useMemo<[number, number] | null>(() => {
    const lat = parseCoord(data?.latitude);
    const lng = parseCoord(data?.longitude);
    return lat !== undefined && lng !== undefined ? [lat, lng] : null;
  }, [data, parseCoord]);

  const mapPoints = currentLocationPoint ? [currentLocationPoint] : routePoints;
  const mapCenter = mapPoints[0] ?? [20.5937, 78.9629];
  const routeStartPoint = routePoints[0] ?? null;
  const routeEndPoint = routePoints.length > 1 ? routePoints[routePoints.length - 1] : null;

  const delayLabel = typeof data?.delayMinutes === "number"
    ? `${data.delayMinutes} min late`
    : typeof data?.delay === "string"
    ? data.delay
    : null;
  const lastUpdated = data?.lastUpdatedAt ? new Date(data.lastUpdatedAt).toLocaleString() : "—";
  const currentLocationLabel = data?.currentLocation ?? data?.currentStation ?? "Unknown";
  const previousStopLabel = data?.previousStation ?? "Not available";
  const nextStopLabel = data?.nextStation ?? "Not available";
  const runningStatusLabel = data?.runningStatus ? data.runningStatus.replace(/_/g, " ") : "Not started";
  const statusText = delayLabel
    ? `${runningStatusLabel} • ${delayLabel}`
    : runningStatusLabel;

  return (
    <div className="enterprise-page live-status-page">
      <header className="enterprise-header live-status-header">
        <div>
          <span className="eyebrow">Live operations</span>
          <h1>Live Train Status</h1>
          <p>Monitor live movement and status updates with persistent search restore.</p>
        </div>
      </header>

      <section className="enterprise-card live-status-search-card">
        <form className="toolbar-grid live-toolbar live-status-form" onSubmit={onSubmit}>
          <label className="field live-status-field">
            <span>Train Number</span>
            <input value={trainNumber} onChange={(e) => setTrainNumber(e.target.value.toUpperCase())} placeholder="Enter train number" />
          </label>

          <label className="field live-status-field journey-date-field">
            <span>Journey Date</span>
            <input type="date" value={journeyDate} onChange={(e) => setJourneyDate(e.target.value)} />
          </label>

          <button className="btn btn-primary live-status-button" type="submit" disabled={loading}>
            <Search size={16} /> {loading ? "Loading..." : "Check Live Status"}
          </button>
        </form>
      </section>

      {error && (
        <section className="error-banner enterprise-card live-status-error">
          <AlertTriangle size={18} />
          <div>
            <strong>Live status unavailable</strong>
            <p>{error}</p>
          </div>
        </section>
      )}

      {loading && !data && (
        <section className="enterprise-card skeleton-grid live-status-skeleton">
          {Array.from({ length: 3 }).map((_, index) => <div key={index} className="skeleton-card" />)}
        </section>
      )}

      {data && (
        <section className="route-layout live-status-result-layout">
          <article className="enterprise-card live-hero-card">
            <div className="live-hero-header">
              <div>
                <span className="eyebrow live-eyebrow">LIVE TRAIN STATUS</span>
                <h2>{data.trainNumber} - {data.trainName}</h2>
                <p className="hero-status-text">{statusText}</p>
              </div>

              <div className="hero-top-right">
                <span className={`status-chip ${data.runningStatus === "running" ? "running" : "delayed"}`}>
                  {data.runningStatus ? data.runningStatus.toUpperCase() : "LIVE"}
                </span>
                <span className="hero-update">Updated {lastUpdated}</span>
              </div>
            </div>

            <div className="live-hero-body">
              <div className="hero-panel-row hero-stat-row">
                <div>
                  <span className="hero-section-label">Departure</span>
                  <strong>{data.expectedArrival ?? "—"}</strong>
                  <p>{data.previousStation ? `From ${data.previousStation}` : "Departure station"}</p>
                </div>
                <div>
                  <span className="hero-section-label">Arrival</span>
                  <strong>{data.actualArrival ?? "—"}</strong>
                  <p>{data.currentStation ? `At ${data.currentStation}` : "Current station"}</p>
                </div>
                <div>
                  <span className="hero-section-label">Next stop</span>
                  <strong>{data.nextStation ?? "—"}</strong>
                  <p>{data.nextStation ? "Scheduled next stop" : "Next arrival"}</p>
                </div>
              </div>

              <div className="hero-status-alert">
                <span className={`status-pill ${delayLabel ? "delay" : "on-time"}`}>{delayLabel ?? "On time"}</span>
                <p className="hero-status-caption">{statusText}</p>
              </div>

              <div className="live-summary-grid">
                <div className="live-summary-card">
                  <span>Current location</span>
                  <strong>{currentLocationLabel}</strong>
                </div>
                <div className="live-summary-card">
                  <span>Previous stop</span>
                  <strong>{previousStopLabel}</strong>
                </div>
                <div className="live-summary-card">
                  <span>Next stop</span>
                  <strong>{nextStopLabel}</strong>
                </div>
                <div className="live-summary-card">
                  <span>Platform</span>
                  <strong>{data.platform ?? "—"}</strong>
                </div>
              </div>

              <div className="hero-detail-row">
                <div className="hero-detail-card">
                  <span>Speed</span>
                  <strong>{typeof data?.speedKmph === "number" || typeof data?.speedKmph === "string" ? `${data.speedKmph} km/h` : "—"}</strong>
                </div>
                <div className="hero-detail-card">
                  <span>Train status</span>
                  <strong>{runningStatusLabel}</strong>
                </div>
              </div>
            </div>
          </article>

          {/* <article className="enterprise-card">
            <div className="card-title-row">
              <Clock3 size={18} />
              <h3>Live Train Details</h3>
            </div>

            <div className="data-grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", marginTop: 14 }}>
              {liveDetails.map((item) => (
                <div key={item.label} className="data-cell">
                  <div className="card-title-row" style={{ justifyContent: "flex-start" }}>
                    <span>{item.label}</span>
                  </div>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
          </article> */}

          <article className="enterprise-card map-card live-route-map-card">
            <div className="card-title-row live-route-header">
              <MapPinned size={18} />
              <h3>Route Map</h3>
            </div>

            {mapPoints.length > 0 ? (
              <div className="route-map-wrap" style={{ marginTop: 14 }}>
                <MapContainer center={mapCenter} zoom={5} scrollWheelZoom className="route-map">
                  <TileLayer
                    attribution='&copy; OpenStreetMap contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <FitBounds points={routePoints.length > 0 ? routePoints : mapPoints} />
                    {routePoints.length > 1 && (
                      <Polyline positions={routePoints} pathOptions={{ color: "#1565c0", weight: 4, opacity: 0.95 }} />
                    )}
                  {routeStartPoint && (
                    <CircleMarker
                      center={routeStartPoint}
                      radius={10}
                      pathOptions={{ color: "#047857", fillColor: "#047857", fillOpacity: 0.95 }}
                    >
                      <Popup>
                        <strong>Start station</strong>
                      </Popup>
                    </CircleMarker>
                  )}
                  {routeEndPoint && (
                    <CircleMarker
                      center={routeEndPoint}
                      radius={10}
                      pathOptions={{ color: "#2563eb", fillColor: "#2563eb", fillOpacity: 0.95 }}
                    >
                      <Popup>
                        <strong>End station</strong>
                      </Popup>
                    </CircleMarker>
                  )}
                  {currentLocationPoint && (
                    <CircleMarker
                      center={currentLocationPoint}
                      radius={12}
                      pathOptions={{ color: "#ef4444", fillColor: "#ef4444", fillOpacity: 1 }}
                    >
                      <Popup>
                        <strong>Current location</strong>
                        <br />
                        {data.currentStation ?? data.currentLocation ?? "Current station"}
                      </Popup>
                    </CircleMarker>
                  )}
                </MapContainer>
              </div>
            ) : (
              <div className="empty-panel compact" style={{ marginTop: 14 }}>
                <MapPinned size={28} />
                <p>No coordinates were returned for this live status.</p>
              </div>
            )}
          </article>
        </section>
      )}
    </div>
  );
}