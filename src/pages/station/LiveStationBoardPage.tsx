import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useLocation } from "react-router-dom";
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, useMap, Marker } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { AlertTriangle, MapPinned, Search, TrainFront } from "lucide-react";

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

// Superset used for both the map fallback AND the journey timeline —
// carries halt info + times, sourced from the full route (same data the
// route modal / route page use), not just coordinates.
type StationPoint = {
  lat: number;
  lng: number;
  code?: string;
  name?: string;
  haltMinutes?: number | null;
  arrival?: string;
  departure?: string;
};

type TimelineStop = {
  code?: string;
  name: string;
  time?: string;
  isOrigin: boolean;
  isDestination: boolean;
  isCurrent: boolean;
  isPast: boolean;
  isCompact: boolean; // rendered as a small unlabeled dot
};

const COMPACT_THRESHOLD = 6; // beyond this many stops, non-essential stops shrink to plain dots

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
  // Full route stations (with halt info + times), used for the map coordinate
  // fallback AND as the source of truth for the compact journey timeline.
  const [routeFallbackStations, setRouteFallbackStations] = useState<StationPoint[]>([]);

  const parseCoord = useCallback((value: unknown) => {
    if (typeof value === "number") return value;
    if (typeof value === "string" && value.trim() !== "") {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : undefined;
    }
    return undefined;
  }, []);

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

      // Always resolve the full route (halt minutes + arrival/departure) so the
      // compact timeline can apply the same "halted stations" logic as the
      // route modal/page. Reuse the ROUTE cache first — this is the same
      // cache bucket TrainRoutePage writes to, so we often avoid a fresh
      // RailRadar call entirely.
      const settings = settingsService.getSettings();
      try {
        let stations: any[] = [];

        if (settings.cache.enabled) {
          const cachedRoute = cacheService.get<{ trainNumber: string }, { stations?: any[] }>("ROUTE", {
            trainNumber: finalNumber,
          });
          if (cachedRoute?.response?.stations?.length) {
            stations = cachedRoute.response.stations;
          }
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
            const lat = parseCoord((s as any).latitude);
            const lng = parseCoord((s as any).longitude);
            const halt = parseCoord((s as any).haltMinutes ?? (s as any).halt ?? (s as any).halt_min);
            if (lat === undefined || lng === undefined) return null;
            return {
              lat,
              lng,
              code: (s as any).stationCode,
              name: (s as any).stationName,
              haltMinutes: halt ?? null,
              arrival: (s as any).arrival,
              departure: (s as any).departure,
            } as StationPoint;
          })
          .filter((s): s is StationPoint => s !== null);

        if (mapped.length > 0) setRouteFallbackStations(mapped);
      } catch (err) {
        // route fetch is optional context — don't block the live status view
        // eslint-disable-next-line no-console
        console.debug("Route fallback failed:", err);
      }

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

  const routePoints = useMemo(() => {
    const fromLive = (
      data?.routeCoordinates
        ?.map((point) => {
          const lat = parseCoord(point.latitude);
          const lng = parseCoord(point.longitude);
          return lat !== undefined && lng !== undefined ? [lat, lng] as [number, number] : undefined;
        })
        .filter((point): point is [number, number] => typeof point !== "undefined") ?? []
    );
    if (fromLive.length > 0) return fromLive;
    return routeFallbackStations.map((s) => [s.lat, s.lng] as [number, number]);
  }, [data, parseCoord, routeFallbackStations]);

  const currentLocationPoint = useMemo<[number, number] | null>(() => {
    const lat = parseCoord(data?.latitude);
    const lng = parseCoord(data?.longitude);
    return lat !== undefined && lng !== undefined ? [lat, lng] : null;
  }, [data, parseCoord]);

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
  const statusText = delayLabel
    ? `${runningStatusLabel} • ${delayLabel}`
    : runningStatusLabel;

  const originLabel = (() => {
    if (routeFallbackStations.length > 0) return routeFallbackStations[0].name ?? routeFallbackStations[0].code ?? "Unknown";
    if (data?.timeline && data.timeline.length > 0) {
      const first = data.timeline[0];
      return (first.name ?? (first as any).stationName ?? first.code) ?? "Unknown";
    }
    if (data?.routeCoordinates && data.routeCoordinates.length > 0) return data.routeCoordinates[0].name ?? data.routeCoordinates[0].code ?? "Unknown";
    return "Unknown";
  })();

  const destinationLabel = (() => {
    if (routeFallbackStations.length > 0) return routeFallbackStations[routeFallbackStations.length - 1].name ?? routeFallbackStations[routeFallbackStations.length - 1].code ?? "Unknown";
    if (data?.timeline && data.timeline.length > 0) {
      const last = data.timeline[data.timeline.length - 1];
      return (last.name ?? (last as any).stationName ?? last.code) ?? "Unknown";
    }
    if (data?.routeCoordinates && data.routeCoordinates.length > 0) return data.routeCoordinates[data.routeCoordinates.length - 1].name ?? data.routeCoordinates[data.routeCoordinates.length - 1].code ?? "Unknown";
    return "Unknown";
  })();

  // Compact journey timeline: origin -> halted stations -> current -> destination.
  // Same filtering rule as the route modal (haltMinutes > 0, plus origin/destination),
  // with the current station forced in even if it isn't a halt point. Anything past
  // COMPACT_THRESHOLD collapses non-essential stops into small unlabeled dots.
  const journeyTimeline = useMemo<TimelineStop[]>(() => {
    // Prefer the full route (has haltMinutes) — fall back to whatever the live
    // payload provided if the route fetch didn't come back.
    const source: Array<LiveStationPoint & { haltMinutes?: number | null }> =
      routeFallbackStations.length > 0
        ? routeFallbackStations.map((s) => ({ code: s.code, name: s.name, arrival: s.arrival, departure: s.departure, haltMinutes: s.haltMinutes }))
        : data?.timeline && data.timeline.length > 0
        ? data.timeline
        : data?.upcomingStations && data.upcomingStations.length > 0
        ? data.upcomingStations
        : data?.routeCoordinates ?? [];

    if (!source || source.length === 0) return [];

    const currentLabel = (data?.currentStation ?? data?.currentLocation ?? "").toLowerCase().trim();

    let currentIdx = currentLabel
      ? source.findIndex((s) => {
          const name = (s.name ?? (s as any).stationName ?? "").toLowerCase();
          const code = (s.code ?? (s as any).stationCode ?? "").toLowerCase();
          return name === currentLabel || code === currentLabel;
        })
      : -1;

    if (currentIdx === -1 && currentLabel) {
      currentIdx = source.findIndex((s) => {
        const name = (s.name ?? (s as any).stationName ?? "").toLowerCase();
        return Boolean(name) && (currentLabel.includes(name) || name.includes(currentLabel));
      });
    }

    const lastIdx = source.length - 1;

    // Same rule as the route modal: keep origin, destination, halted stations —
    // plus always keep the current station even if it has no halt.
    const kept = source
      .map((s, idx) => ({ s, idx }))
      .filter(({ s, idx }) => (s.haltMinutes ?? 0) > 0 || idx === 0 || idx === lastIdx || idx === currentIdx);

    const total = kept.length;

    return kept.map(({ s, idx }) => {
      const isOrigin = idx === 0;
      const isDestination = idx === lastIdx;
      const isCurrent = idx === currentIdx;
      return {
        code: s.code ?? (s as any).stationCode,
        name: (s.name ?? (s as any).stationName ?? s.code ?? "Station") as string,
        time: s.departure || s.arrival,
        isOrigin,
        isDestination,
        isCurrent,
        isPast: currentIdx >= 0 ? idx < currentIdx : false,
        isCompact: total > COMPACT_THRESHOLD && !isOrigin && !isDestination && !isCurrent,
      };
    });
  }, [data, routeFallbackStations]);

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
                  <strong>{originLabel}</strong>
                  <p>Origin station</p>
                </div>
                <div>
                  <span className="hero-section-label">To</span>
                  <strong>{destinationLabel}</strong>
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

              {journeyTimeline.length > 0 ? (
                <div className="live-journey-timeline">
                  <div className={`ljt-track ${journeyTimeline.length > COMPACT_THRESHOLD ? "dense" : ""}`}>
                    {journeyTimeline.map((station, idx) => (
                      <div
                        key={`${station.code ?? station.name}-${idx}`}
                        title={station.isCompact ? `${station.name}${station.time ? ` — ${station.time}` : ""}` : undefined}
                        className={[
                          "ljt-stop",
                          station.isOrigin ? "origin" : "",
                          station.isDestination ? "destination" : "",
                          station.isCurrent ? "current" : "",
                          station.isPast ? "past" : "",
                          station.isCompact ? "compact" : "",
                        ].filter(Boolean).join(" ")}
                      >
                        {station.isCurrent && (
                          <div className="ljt-current-badge">
                            <span>Current Location</span>
                            <TrainFront size={16} />
                          </div>
                        )}

                        <span className="ljt-dot" />

                        {!station.isCompact && (
                          <div className="ljt-label">
                            <strong>{station.name}</strong>
                            {station.time && (
                              <span>{station.isDestination ? "Arr" : "Dep"} {station.time}</span>
                            )}
                          </div>
                        )}
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
                  <TileLayer
                    attribution='&copy; OpenStreetMap contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <FitBounds points={routePoints.length > 0 ? routePoints : mapPoints} />

                  {routePoints.length > 1 && (
                    <Polyline positions={routePoints} pathOptions={{ color: "#123B73", weight: 5, opacity: 0.95 }} />
                  )}

                  {( (data?.routeCoordinates && data.routeCoordinates.length > 0) || routeFallbackStations.length > 0) && (() => {
                    const stationsFromLive = (data?.routeCoordinates ?? [])
                      .map((p) => {
                        const lat = parseCoord(p.latitude);
                        const lng = parseCoord(p.longitude);
                        return lat !== undefined && lng !== undefined ? { lat, lng, code: p.code, name: p.name } : null;
                      })
                      .filter((s) => s !== null) as { lat: number; lng: number; code?: string; name?: string }[];

                    const stationsFromFallback = routeFallbackStations.map((p) => ({ lat: p.lat, lng: p.lng, code: p.code, name: p.name, haltMinutes: p.haltMinutes })) as StationPoint[];

                    const stations: StationPoint[] = stationsFromLive.length > 0 ? stationsFromLive : stationsFromFallback;

                    let currentIndex = -1;
                    if (currentLocationPoint) {
                      let best = Infinity;
                      stations.forEach((s, idx) => {
                        const d = distanceKm(currentLocationPoint as [number, number], [s.lat, s.lng]);
                        if (d < best) {
                          best = d;
                          currentIndex = idx;
                        }
                      });
                    } else if (data.currentStation) {
                      const found = stations.findIndex((s) => (s.name && data.currentStation && s.name.toLowerCase() === data.currentStation.toLowerCase()) || (s.code && data.currentStation && s.code.toLowerCase() === data.currentStation.toLowerCase()));
                      if (found >= 0) currentIndex = found;
                    }

                    const maxMarkers = 28;
                    const step = stations.length > maxMarkers ? Math.ceil(stations.length / maxMarkers) : 1;

                    return stations.map((s, idx) => {
                      const isOrigin = idx === 0;
                      const isDestination = idx === stations.length - 1;
                      const isCompleted = currentIndex >= 0 ? idx < currentIndex : false;
                      const shouldRender = isOrigin || isDestination || idx === currentIndex || idx === currentIndex + 1 || (idx % step === 0);
                      if (!shouldRender) return null;

                      const isHalt = typeof s.haltMinutes === "number" && s.haltMinutes > 0;
                      const darkBlue = "#123B73";
                      const color = isOrigin || isDestination || isHalt ? darkBlue : isCompleted ? "#10b981" : "#2563eb";

                      return (
                        <CircleMarker
                          key={`station-${s.code ?? s.name}-${idx}`}
                          center={[s.lat, s.lng]}
                          radius={isOrigin || isDestination ? 8 : 5}
                          pathOptions={{ color, fillColor: color, fillOpacity: 0.95 }}
                        >
                            <Popup>
                              <strong>{s.name ?? "Station"} {s.code ? `(${s.code})` : ""}</strong>
                              <br />
                              Seq {idx + 1}
                            </Popup>
                        </CircleMarker>
                      );
                    });
                  })()}

                  {currentLocationPoint && (() => {
                    const trainPos = currentLocationPoint as [number, number];

                    let nextPoint: [number, number] | null = null;
                    const stationCoords: [number, number][] = (data?.routeCoordinates ?? [])
                      .map((p) => {
                        const lat = parseCoord(p.latitude);
                        const lng = parseCoord(p.longitude);
                        return lat !== undefined && lng !== undefined ? [lat, lng] as [number, number] : null;
                      })
                      .filter((x): x is [number, number] => x !== null);

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

                    const brng = nextPoint ? bearingBetween(trainPos, nextPoint) : 0;

                    const iconHtml = `
                      <div style="transform: rotate(${brng}deg); display:flex; align-items:center; justify-content:center;">
                        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M12 2v4" stroke="#0f172a" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                          <rect x="3" y="6" width="18" height="11" rx="2" ry="2" fill="#0ea5e9" stroke="#0f172a" stroke-width="1.2" />
                          <circle cx="8" cy="18.5" r="1.4" fill="#0f172a" />
                          <circle cx="16" cy="18.5" r="1.4" fill="#0f172a" />
                        </svg>
                      </div>`;

                    const icon = typeof L.divIcon === "function" ? L.divIcon({ html: iconHtml, className: "train-div-icon", iconSize: [34, 34], iconAnchor: [17, 17] }) : undefined;

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

                  <div className="route-legend" style={{ position: "absolute", bottom: 10, left: 10, zIndex: 999, background: "rgba(255,255,255,0.95)", padding: '6px 8px', borderRadius: 6, fontSize: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 10, height: 10, background: '#10b981', borderRadius: 10, display: 'inline-block' }} /> <span>Completed</span>
                      <span style={{ width: 10 }} />
                      <span style={{ width: 10, height: 10, background: '#2563eb', borderRadius: 10, display: 'inline-block' }} /> <span>Upcoming</span>
                      <span style={{ width: 10 }} />
                      <span style={{ width: 14, height: 10, background: '#123B73', display: 'inline-block', marginRight: 6 }} /> <span>Route</span>
                      <span style={{ width: 10 }} />
                      <span style={{ transform: 'rotate(0deg)', display: 'inline-block' }}>🚆</span> <span>Current Train</span>
                    </div>
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