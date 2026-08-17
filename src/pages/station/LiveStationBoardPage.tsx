import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useLocation } from "react-router-dom";
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, useMap, Marker } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { AlertTriangle, MapPinned, Search, TrainFront } from "lucide-react";

import trainService from "../../services/trainService";
import { cacheService } from "../../services/cacheService";
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
  // Used by the Route API to determine whether a train actually halts here.
  haltMinutes?: number | null;
  halt?: number | null;
  halt_min?: number | null;
}

type StationPoint = {
  lat: number;
  lng: number;
  code?: string;
  name?: string;
  haltMinutes?: number | null;
  arrival?: string;
  departure?: string;
};

type JourneyStation = {
  code?: string;
  name: string;
  time?: string;
  lat?: number;
  lng?: number;
  isOrigin: boolean;
  isDestination: boolean;
  isCurrent: boolean;
  isPast: boolean;
  // Kept for compatibility with the existing timeline implementation.
  // Currently we do not hide stations just because the list is large.
  isCompact: boolean;
};

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

// =========================================================
// LOCAL STORAGE — persists the last live search so a page
// refresh restores it without re-hitting the API.
// =========================================================

const LIVE_STATUS_STORAGE_KEY = "railtrack_live_status";

interface LocalLiveSearch {
  trainNumber: string;
  date: string;
  response: LiveTrainSnapshot;
  routeStations: StationPoint[];
  savedAt: number;
}

function getLocalLiveSearch(trainNumber?: string, date?: string): LocalLiveSearch | null {
  if (typeof window === "undefined" || !trainNumber || !date) return null;

  try {
    const raw = window.localStorage.getItem(LIVE_STATUS_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as LocalLiveSearch;
    if (!parsed || typeof parsed !== "object") return null;

    const normalizedTrainNumber = trainNumber.trim().toUpperCase();
    if (parsed.trainNumber !== normalizedTrainNumber || parsed.date !== date) return null;

    return parsed;
  } catch (error) {
    // localStorage must never break the live-status page.
    console.debug("Unable to read local live status:", error);
    return null;
  }
}

function saveLocalLiveSearch(trainNumber: string, date: string, response: LiveTrainSnapshot, routeStations: StationPoint[]) {
  if (typeof window === "undefined") return;

  try {
    const localData: LocalLiveSearch = {
      trainNumber: trainNumber.trim().toUpperCase(),
      date,
      response,
      routeStations,
      savedAt: Date.now(),
    };
    window.localStorage.setItem(LIVE_STATUS_STORAGE_KEY, JSON.stringify(localData));
  } catch (error) {
    // Do not let localStorage quota/security problems break the app.
    console.debug("Unable to save live status locally:", error);
  }
}

// =========================================================
// STATION NAME MATCHING
// =========================================================

function normalizeStationText(value?: string | null) {
  return (value ?? "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function matchesStation(value?: string | null, candidate?: string | null) {
  const left = normalizeStationText(value);
  const right = normalizeStationText(candidate);
  if (!left || !right) return false;
  return left === right || right.includes(left) || left.includes(right);
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
  const cachedTrainNumber = String(cached?.request?.trainNumber ?? "");
  const cachedDate = String(cached?.request?.date ?? "");

  const localCached = getLocalLiveSearch(
    initialSearchState?.trainNumber ?? cachedTrainNumber,
    initialSearchState?.date ?? cachedDate,
  );

  const initialTrain = initialSearchState?.trainNumber ?? localCached?.trainNumber ?? cachedTrainNumber;
  const initialDate =
    initialSearchState?.date ?? localCached?.date ?? cachedDate ?? new Date().toISOString().slice(0, 10);

  const [trainNumber, setTrainNumber] = useState(initialTrain);
  const [journeyDate, setJourneyDate] = useState(initialDate);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Restore from localStorage first; existing cache remains as fallback.
  const [data, setData] = useState<LiveTrainSnapshot | null>(localCached?.response ?? cached?.response ?? null);
  const [routeFallbackStations, setRouteFallbackStations] = useState<StationPoint[]>(localCached?.routeStations ?? []);

  const parseCoord = useCallback((value: unknown) => {
    if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
    if (typeof value === "string" && value.trim() !== "") {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : undefined;
    }
    return undefined;
  }, []);

  const handleSearch = useCallback(async (number?: string, date?: string) => {
    const finalNumber = (number ?? trainNumber).trim().toUpperCase();
    const finalDate = (date ?? journeyDate).trim();

    if (!finalNumber) return setError("Enter a train number.");
    if (!finalDate) return setError("Select a journey date.");

    setLoading(true);
    setError(null);

    try {
      const response = await trainService.getLiveStatus(finalNumber, finalDate);
      const payload = response.data as LiveTrainSnapshot;
      setData(payload);

      const settings = settingsService.getSettings();

      // Save immediately — even if the Route API fails below, the live
      // response is still restorable after a refresh.
      saveLocalLiveSearch(finalNumber, finalDate, payload, []);

      if (settings.cache.enabled) {
        cacheService.set("LIVE", { trainNumber: finalNumber, date: finalDate }, payload, settings.cache.ttlMinutes * 60 * 1000);
      }

      // Route data (halt minutes + arrival/departure) is supplementary —
      // live status must keep working even if this fails.
      try {
        let stations: any[] = [];

        if (settings.cache.enabled) {
          const cachedRoute = cacheService.get<{ trainNumber: string }, { stations?: any[] }>("ROUTE", {
            trainNumber: finalNumber,
          });
          if (cachedRoute?.response?.stations?.length) stations = cachedRoute.response.stations;
        }

        if (stations.length === 0) {
          const routeResp = await trainService.getRouteDetails(finalNumber);
          stations = routeResp.data?.stations ?? [];
          if (settings.cache.enabled && routeResp.data) {
            cacheService.set("ROUTE", { trainNumber: finalNumber }, routeResp.data, settings.cache.ttlMinutes * 60 * 1000);
          }
        }

        const mapped: StationPoint[] = stations
          .map((s) => {
            const lat = parseCoord(s.latitude);
            const lng = parseCoord(s.longitude);
            const halt = parseCoord(s.haltMinutes ?? s.halt ?? s.halt_min);
            if (lat === undefined || lng === undefined) return null;
            return {
              lat,
              lng,
              code: s.stationCode,
              name: s.stationName,
              haltMinutes: halt ?? null,
              arrival: s.arrival,
              departure: s.departure,
            } as StationPoint;
          })
          .filter((s): s is StationPoint => s !== null);

        if (mapped.length > 0) {
          setRouteFallbackStations(mapped);
          saveLocalLiveSearch(finalNumber, finalDate, payload, mapped);
        }
      } catch (routeError) {
        console.debug("Route fallback failed:", routeError);
      }

      // NOTE: historyService.record(...) is intentionally NOT called here —
      // this page must not generate a history API request.
    } catch (err) {
      setData(null);
      setError(getApiErrorMessage(err, "Unable to fetch live train status."));
    } finally {
      setLoading(false);
    }
  }, [journeyDate, trainNumber, parseCoord]);

  useEffect(() => {
    // Navigated in with a trainNumber/date -> run a normal search.
    // A plain refresh with a local result already restored needs no API call.
    if (!initialSearchState?.trainNumber) return;

    const timerId = window.setTimeout(() => {
      void handleSearch(initialSearchState.trainNumber, initialSearchState.date ?? initialDate);
    }, 0);

    return () => window.clearTimeout(timerId);
  }, [handleSearch, initialDate, initialSearchState?.date, initialSearchState?.trainNumber]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await handleSearch();
  }

  const routePoints = useMemo(() => {
    const fromLive = (
      data?.routeCoordinates
        ?.map((point) => {
          const lat = parseCoord(point.latitude);
          const lng = parseCoord(point.longitude);
          return lat !== undefined && lng !== undefined ? ([lat, lng] as [number, number]) : undefined;
        })
        .filter((point): point is [number, number] => typeof point !== "undefined") ?? []
    );
    if (fromLive.length > 0) return fromLive;
    return routeFallbackStations.map((s) => [s.lat, s.lng] as [number, number]);
  }, [data, parseCoord, routeFallbackStations]);

  const currentLocationPoint = useMemo<[number, number] | null>(() => {
    const lat = parseCoord(data?.latitude);
    const lng = parseCoord(data?.longitude);
    if (lat !== undefined && lng !== undefined) return [lat, lng];

    // Fall back to matching the current station name/code against the route.
    const stationLookup: Array<{ lat?: number; lng?: number; code?: string; name?: string }> =
      routeFallbackStations.length > 0
        ? routeFallbackStations
        : (data?.routeCoordinates ?? []).map((point) => ({
            lat: parseCoord(point.latitude),
            lng: parseCoord(point.longitude),
            code: point.code,
            name: point.name,
          }));

    const currentKey = data?.currentStation ?? data?.currentLocation ?? data?.nextStation;
    if (!currentKey) return null;

    const matched = stationLookup.find((s) => {
      if (typeof s.lat !== "number" || typeof s.lng !== "number") return false;
      return matchesStation(currentKey, s.code) || matchesStation(currentKey, s.name);
    });

    return matched && typeof matched.lat === "number" && typeof matched.lng === "number" ? [matched.lat, matched.lng] : null;
  }, [data, parseCoord, routeFallbackStations]);

  const mapPoints = currentLocationPoint ? [currentLocationPoint] : routePoints;
  const mapCenter = mapPoints[0] ?? [20.5937, 78.9629];

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
  const statusText = delayLabel ? `${runningStatusLabel} • ${delayLabel}` : runningStatusLabel;

  const originLabel = (() => {
    if (routeFallbackStations.length > 0) return routeFallbackStations[0].name ?? routeFallbackStations[0].code ?? "Unknown";
    if (data?.timeline && data.timeline.length > 0) {
      const first = data.timeline[0];
      return first.name ?? (first as any).stationName ?? first.code ?? "Unknown";
    }
    if (data?.routeCoordinates && data.routeCoordinates.length > 0) {
      return data.routeCoordinates[0].name ?? data.routeCoordinates[0].code ?? "Unknown";
    }
    return "Unknown";
  })();

  const destinationLabel = (() => {
    if (routeFallbackStations.length > 0) {
      const last = routeFallbackStations[routeFallbackStations.length - 1];
      return last.name ?? last.code ?? "Unknown";
    }
    if (data?.timeline && data.timeline.length > 0) {
      const last = data.timeline[data.timeline.length - 1];
      return last.name ?? (last as any).stationName ?? last.code ?? "Unknown";
    }
    if (data?.routeCoordinates && data.routeCoordinates.length > 0) {
      const last = data.routeCoordinates[data.routeCoordinates.length - 1];
      return last.name ?? last.code ?? "Unknown";
    }
    return "Unknown";
  })();

  // Prefer the full route (haltMinutes + lat/lng); keep origin, destination,
  // actual halts and the current station — drop plain pass-through points.
  const journeyStations = useMemo<JourneyStation[]>(() => {
    const source: Array<LiveStationPoint & { haltMinutes?: number | null }> =
      routeFallbackStations.length > 0
        ? routeFallbackStations.map((s) => ({
            code: s.code,
            name: s.name,
            arrival: s.arrival,
            departure: s.departure,
            haltMinutes: s.haltMinutes,
            latitude: s.lat,
            longitude: s.lng,
          }))
        : data?.timeline && data.timeline.length > 0
        ? data.timeline
        : data?.upcomingStations && data.upcomingStations.length > 0
        ? data.upcomingStations
        : data?.routeCoordinates ?? [];

    if (!source || source.length === 0) return [];

    const currentLabel = (data?.currentStation ?? data?.currentLocation ?? "").toLowerCase().trim();

    let currentIdx = currentLabel
      ? source.findIndex((s) => {
          const name = (s.name ?? (s as any).stationName ?? "").toLowerCase().trim();
          const code = (s.code ?? (s as any).stationCode ?? "").toLowerCase().trim();
          return name === currentLabel || code === currentLabel;
        })
      : -1;

    if (currentIdx === -1 && currentLabel) {
      currentIdx = source.findIndex((s) => {
        const name = (s.name ?? (s as any).stationName ?? "").toLowerCase().trim();
        return Boolean(name) && (currentLabel.includes(name) || name.includes(currentLabel));
      });
    }

    const lastIdx = source.length - 1;

    const kept = source
      .map((s, idx) => ({ s, idx }))
      .filter(({ s, idx }) => {
        const isHalt = Number(s.haltMinutes ?? s.halt ?? s.halt_min ?? 0) > 0;
        return isHalt || idx === 0 || idx === lastIdx || idx === currentIdx;
      });

    return kept.map(({ s, idx }) => {
      const isOrigin = idx === 0;
      const isDestination = idx === lastIdx;
      const isCurrent = idx === currentIdx;
      return {
        code: s.code ?? (s as any).stationCode,
        name: (s.name ?? (s as any).stationName ?? s.code ?? "Station") as string,
        time: s.departure ?? s.arrival,
        lat: parseCoord(s.latitude),
        lng: parseCoord(s.longitude),
        isOrigin,
        isDestination,
        isCurrent,
        isPast: currentIdx >= 0 ? idx < currentIdx : false,
        // We are not hiding important stations — all retained stops render normally.
        isCompact: false,
      };
    });
  }, [data, routeFallbackStations, parseCoord]);

  const mapStations = useMemo(
    () => journeyStations.filter((s): s is JourneyStation & { lat: number; lng: number } => s.lat !== undefined && s.lng !== undefined),
    [journeyStations],
  );

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
                  <span className="hero-section-label">From</span>
                  <strong className="hero-endpoint-label">{originLabel}</strong>
                  <p>Origin station</p>
                </div>
                <div>
                  <span className="hero-section-label">To</span>
                  <strong className="hero-endpoint-label">{destinationLabel}</strong>
                  <p>Destination station</p>
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

              {journeyStations.length > 0 ? (
                <div className="live-journey-timeline">
                  <div className="ljt-track">
                    {journeyStations.map((station, idx) => (
                      <div
                        key={`${station.code ?? station.name}-${idx}`}
                        className={[
                          "ljt-stop",
                          station.isOrigin ? "origin" : "",
                          station.isDestination ? "destination" : "",
                          station.isCurrent ? "current" : "",
                          station.isPast ? "past" : "",
                        ].filter(Boolean).join(" ")}
                      >
                        {station.isCurrent && (
                          <div className="ljt-current-badge">
                            <span>Current Location</span>
                            <TrainFront size={16} />
                          </div>
                        )}

                        <span className="ljt-dot" />

                        <div className="ljt-label">
                          <strong title={station.name}>{station.name}</strong>
                          {station.time && (
                            <span>{station.isDestination ? "Arr" : "Dep"} {station.time}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
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
              )}
            </div>
          </article>

          <article className="enterprise-card map-card live-route-map-card">
            <div className="card-title-row live-route-header">
              <MapPinned size={18} />
              <h3>Route Map</h3>
            </div>

            {mapPoints.length > 0 ? (
              <div className="route-map-wrap" style={{ marginTop: 14 }}>
                <MapContainer center={mapCenter} zoom={5} scrollWheelZoom className="route-map">
                  <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <FitBounds points={routePoints.length > 0 ? routePoints : mapPoints} />

                  {routePoints.length > 1 && (
                    <Polyline positions={routePoints} pathOptions={{ color: "#123B73", weight: 5, opacity: 0.95 }} />
                  )}

                  {mapStations.map((station, idx) => {
                    const darkBlue = "#123B73";
                    const green = "#16a34a";
                    const blue = "#2563eb";
                    const outline = "#94a3b8";

                    let color = outline;
                    let radius = 5.5;
                    let fillOpacity = 0.7;

                    if (station.isOrigin || station.isDestination) {
                      color = darkBlue; radius = 8; fillOpacity = 1;
                    } else if (station.isCurrent) {
                      color = blue; radius = 8; fillOpacity = 1;
                    } else if (station.isPast) {
                      color = green; radius = 5.5; fillOpacity = 0.95;
                    }

                    return (
                      <CircleMarker
                        key={`station-${station.code ?? station.name}-${idx}`}
                        center={[station.lat, station.lng]}
                        radius={radius}
                        pathOptions={{ color, fillColor: color, fillOpacity, weight: station.isCurrent ? 3 : 2 }}
                      >
                        <Popup>
                          <strong>{station.name} {station.code ? `(${station.code})` : ""}</strong>
                          <br />
                          {station.isOrigin ? "Origin" : station.isDestination ? "Destination" : station.isCurrent ? "Current / Next Halt" : station.isPast ? "Completed" : "Upcoming Halt"}
                          {station.time ? <><br />{station.isDestination ? "Arr" : "Dep"} {station.time}</> : null}
                        </Popup>
                      </CircleMarker>
                    );
                  })}

                  {currentLocationPoint && (() => {
                    const trainPos = currentLocationPoint as [number, number];

                    let nextPoint: [number, number] | null = null;
                    const stationCoords: [number, number][] = (data?.routeCoordinates ?? [])
                      .map((point) => {
                        const lat = parseCoord(point.latitude);
                        const lng = parseCoord(point.longitude);
                        return lat !== undefined && lng !== undefined ? ([lat, lng] as [number, number]) : null;
                      })
                      .filter((point): point is [number, number] => point !== null);

                    const coords = stationCoords.length > 0 ? stationCoords : routeFallbackStations.map((s) => [s.lat, s.lng] as [number, number]);

                    if (coords.length > 0) {
                      let best = Infinity;
                      let nearestIdx = 0;
                      coords.forEach((s, i) => {
                        const d = distanceKm(trainPos, s);
                        if (d < best) { best = d; nearestIdx = i; }
                      });
                      if (nearestIdx < coords.length - 1) nextPoint = coords[nearestIdx + 1];
                    }

                    const bearing = nextPoint ? bearingBetween(trainPos, nextPoint) : 0;

                    const iconHtml = `
                      <div style="transform: rotate(${bearing}deg); display:flex; align-items:center; justify-content:center;">
                        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M12 2v4" stroke="#0f172a" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                          <rect x="3" y="6" width="18" height="11" rx="2" ry="2" fill="#0ea5e9" stroke="#0f172a" stroke-width="1.2" />
                          <circle cx="8" cy="18.5" r="1.4" fill="#0f172a" />
                          <circle cx="16" cy="18.5" r="1.4" fill="#0f172a" />
                        </svg>
                      </div>`;

                    const icon = L.divIcon({ html: iconHtml, className: "train-div-icon", iconSize: [34, 34], iconAnchor: [17, 17] });

                    return (
                      <Marker position={trainPos} icon={icon as any}>
                        <Popup>
                          <strong>{data.trainNumber} - {data.trainName}</strong>
                          <br />
                          <em>Current Location:</em> {data.currentStation ?? data.currentLocation ?? "—"}
                          <br />
                          <em>Next stop:</em> {data.nextStation ?? "—"}
                          <br />
                          <em>Status:</em> {delayLabel ?? "—"}
                          <br />
                          <em>Direction:</em> {nextPoint ? `Towards ${data.nextStation ?? "next"}` : "—"}
                        </Popup>
                      </Marker>
                    );
                  })()}

                  <div className="route-legend">
                    <span className="legend-item"><span className="legend-dot completed" /> Completed</span>
                    <span className="legend-item"><span className="legend-dot current" /> Current/Next Halt</span>
                    <span className="legend-item"><span className="legend-dot upcoming" /> Upcoming Halt</span>
                  </div>
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

function toRadians(deg: number) {
  return (deg * Math.PI) / 180;
}

function toDegrees(rad: number) {
  return (rad * 180) / Math.PI;
}

function bearingBetween(p1: [number, number], p2: [number, number]) {
  const [lat1, lon1] = p1.map((v) => toRadians(v)) as [number, number];
  const [lat2, lon2] = p2.map((v) => toRadians(v)) as [number, number];
  const y = Math.sin(lon2 - lon1) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1);
  const brng = Math.atan2(y, x);
  return (toDegrees(brng) + 360) % 360;
}

function distanceKm(a: [number, number], b: [number, number]) {
  const R = 6371;
  const dLat = toRadians(b[0] - a[0]);
  const dLon = toRadians(b[1] - a[1]);
  const lat1 = toRadians(a[0]);
  const lat2 = toRadians(b[0]);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const aVal = sinDLat * sinDLat + sinDLon * sinDLon * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(aVal), Math.sqrt(1 - aVal));
  return R * c;
}