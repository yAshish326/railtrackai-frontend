import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useLocation } from "react-router-dom";
import { CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { AlertTriangle, MapPinned, Route, Search, TrainFront } from "lucide-react";

import trainService from "../../services/trainService";
import { cacheService } from "../../services/cacheService";
import { historyService } from "../../services/historyService";
import { settingsService } from "../../services/settingsService";
import type { TrainRouteResponse } from "../../types/Route";
import { getApiErrorMessage } from "../../utils/helpers";

import "./TrainRoutePage.scss";

// Custom Flag Icon for Destination Station
const flagIcon = L.divIcon({
  className: "custom-flag-marker",
  html: `<div style="display:flex;align-items:center;justify-content:center;color:#dc2626;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3));">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path>
            <line x1="4" y1="22" x2="4" y2="15"></line>
          </svg>
        </div>`,
  iconSize: [24, 24],
  iconAnchor: [4, 22],
});

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

export default function TrainRoutePage() {
  const location = useLocation();
  const initialRouteState = location.state as { trainNumber?: string; trainName?: string } | null;
  const cachedRoute = cacheService.getLatest<TrainRouteResponse>("ROUTE");
  const initialTrain = initialRouteState?.trainNumber ?? String(cachedRoute?.request.trainNumber ?? "");
  const initialRoute = initialRouteState?.trainNumber ? null : cachedRoute?.response ?? null;

  const [trainNumber, setTrainNumber] = useState(initialTrain);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [route, setRoute] = useState<TrainRouteResponse | null>(initialRoute);

  const loadRoute = useCallback(async (value?: string) => {
    const finalTrainNumber = (value ?? trainNumber).trim().toUpperCase();
    if (!finalTrainNumber) {
      setError("Enter a train number.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await trainService.getRouteDetails(finalTrainNumber);
      setRoute(response.data);

      const settings = settingsService.getSettings();
      if (settings.cache.enabled) {
        cacheService.set("ROUTE", { trainNumber: finalTrainNumber }, response.data, settings.cache.ttlMinutes * 60 * 1000);
      }
      if (settings.history.autoSave) {
        historyService.record("ROUTE", { trainNumber: finalTrainNumber }, response.data, `${response.data.trainName} route`);
      }
    } catch (err) {
      setRoute(null);
      setError(getApiErrorMessage(err, "Unable to load route details."));
    } finally {
      setLoading(false);
    }
  }, [trainNumber]);

  useEffect(() => {
    if (!initialRouteState?.trainNumber) {
      return;
    }

    const timerId = window.setTimeout(() => {
      void loadRoute(initialRouteState.trainNumber);
    }, 0);

    return () => window.clearTimeout(timerId);
  }, [initialRouteState?.trainNumber, loadRoute]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await loadRoute();
  }

  // Filter valid route coordinates for Polyline
  const mapPoints = useMemo(
    () =>
      route?.stations
        .filter((station) => typeof station.latitude === "number" && typeof station.longitude === "number")
        .map((station) => [station.latitude as number, station.longitude as number] as [number, number]) ?? [],
    [route],
  );

  // Identify Origin, Destination, and Current station objects
  const stationsWithCoords = useMemo(
    () => route?.stations.filter((s) => typeof s.latitude === "number" && typeof s.longitude === "number") ?? [],
    [route],
  );

  const originStation = stationsWithCoords[0];
  const destStation = stationsWithCoords[stationsWithCoords.length - 1];
  const currentStation = stationsWithCoords.find((s) => Boolean(s.currentStation));

  const center = mapPoints[0] ?? [20.5937, 78.9629];

  return (
    <div className="enterprise-page">
      <header className="enterprise-header">
        <div>
          <span className="eyebrow">Route intelligence</span>
          <h1>Train Route Details</h1>
          <p>Vertical timeline, current station highlighting, and map plotting when coordinates are available.</p>
        </div>
      </header>

      <section className="enterprise-card">
        <form className="toolbar-grid route-toolbar" onSubmit={onSubmit}>
          <label className="field">
            <span>Train Number</span>
            <input value={trainNumber} onChange={(e) => setTrainNumber(e.target.value.toUpperCase())} placeholder="Enter train number" />
          </label>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            <Search size={16} /> {loading ? "Loading..." : "Load Route"}
          </button>
        </form>
      </section>

      {error && (
        <section className="error-banner enterprise-card">
          <AlertTriangle size={18} />
          <div>
            <strong>Route unavailable</strong>
            <p>{error}</p>
          </div>
        </section>
      )}

      {loading && (
        <section className="enterprise-card skeleton-grid">
          {Array.from({ length: 4 }).map((_, index) => <div key={index} className="skeleton-card" />)}
        </section>
      )}

      {route && (
        <>
          <section className="enterprise-card route-summary-grid">
            <div>
              <span className="eyebrow">Train Number</span>
              <h2>{route.trainNumber}</h2>
            </div>
            <div>
              <span className="eyebrow">Train Name</span>
              <h2>{route.trainName}</h2>
            </div>
            <div>
              <span className="eyebrow">Running Days</span>
              <h2>{route.runningDays.join(", ")}</h2>
            </div>
            <div>
              <span className="eyebrow">Distance</span>
              <h2>{route.distance} km</h2>
            </div>
            <div>
              <span className="eyebrow">Journey Time</span>
              <h2>{route.journeyTime ?? "—"}</h2>
            </div>
          </section>

          <section className="route-layout">
            <article className="enterprise-card route-timeline">
              <div className="card-title-row">
                <Route size={18} />
                <h3>Station Timeline</h3>
              </div>

              <div className="timeline-list">
                {route.stations.map((station, index) => {
                  const isOrigin = index === 0;
                  const isDestination = index === route.stations.length - 1;
                  const isCurrent = Boolean(station.currentStation);

                  return (
                    <div key={`${station.stationCode}-${station.sequence}`} className={`timeline-item ${isCurrent ? "current" : ""}`}>
                      <div className="timeline-rail">
                        <span className={`timeline-dot ${isOrigin ? "origin" : ""} ${isDestination ? "destination" : ""} ${isCurrent ? "current" : ""}`} />
                        {index < route.stations.length - 1 && <span className="timeline-line" />}
                      </div>

                      <div className="timeline-content">
                        <div className="timeline-head">
                          <div>
                            <h4>
                              {station.stationName}
                              <span className="meta-chip">{station.stationCode}</span>
                            </h4>
                            <p>Sequence {station.sequence}</p>
                          </div>
                          <div className="status-stack">
                            {isOrigin && <span className="meta-chip">Origin</span>}
                            {isDestination && <span className="meta-chip">Destination</span>}
                            {isCurrent && <span className="meta-chip highlight">Current Station</span>}
                          </div>
                        </div>

                        <div className="station-metrics">
                          <span>Arrival {station.arrival || "—"}</span>
                          <span>Departure {station.departure || "—"}</span>
                          <span>Platform {station.platform || "—"}</span>
                          <span>Distance {station.distance} km</span>
                          <span>Day {station.dayNumber}</span>
                          <span>Halt {station.haltMinutes} min</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </article>

            <article className="enterprise-card map-card">
              <div className="card-title-row">
                <MapPinned size={18} />
                <h3>Route Map</h3>
              </div>

              {mapPoints.length > 0 ? (
                <div className="route-map-wrap">
                  <MapContainer center={center} zoom={5} scrollWheelZoom className="route-map">
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />

                    {/* 1. Continuous Blue Route Line */}
                    {mapPoints.length > 1 && <Polyline positions={mapPoints} pathOptions={{ color: "#2563eb", weight: 4, opacity: 0.85 }} />}
                    
                    <FitBounds points={mapPoints} />

                    {/* 2. Intermediate Station Dots */}
                    {stationsWithCoords.map((station) => {
                      const isOrigin = station.stationCode === originStation?.stationCode;
                      const isDest = station.stationCode === destStation?.stationCode;
                      const isLive = station.stationCode === currentStation?.stationCode;

                      // Skip specialized markers to avoid rendering duplicates
                      if (isDest || isLive) return null;

                      return (
                        <CircleMarker
                          key={`${station.stationCode}-${station.sequence}-marker`}
                          center={[station.latitude!, station.longitude!]}
                          radius={isOrigin ? 5 : 3.5}
                          pathOptions={{
                            color: isOrigin ? "#10b981" : "#475569",
                            fillColor: isOrigin ? "#10b981" : "#ffffff",
                            fillOpacity: 1,
                            weight: 1.5,
                          }}
                        >
                          <Popup>
                            <strong>{station.stationName} ({station.stationCode})</strong>
                            <br />
                            Seq {station.sequence} | {station.arrival || "—"} - {station.departure || "—"}
                          </Popup>
                        </CircleMarker>
                      );
                    })}

                    {/* 3. Destination Flag Marker */}
                    {destStation && (
                      <Marker position={[destStation.latitude!, destStation.longitude!]} icon={flagIcon}>
                        <Popup>
                          <strong>Destination: {destStation.stationName}</strong> ({destStation.stationCode})
                        </Popup>
                      </Marker>
                    )}

                    {/* 4. Live Train Location Red Pinpoint */}
                    {currentStation && (
                      <CircleMarker
                        center={[currentStation.latitude!, currentStation.longitude!]}
                        radius={5}
                        pathOptions={{ color: "#ffffff", fillColor: "#ef4444", fillOpacity: 1, weight: 2 }}
                      >
                        <Popup>
                          <strong>Current Location: {currentStation.stationName}</strong> ({currentStation.stationCode})
                        </Popup>
                      </CircleMarker>
                    )}
                  </MapContainer>
                </div>
              ) : (
                <div className="empty-panel compact">
                  <TrainFront size={28} />
                  <p>No coordinates were returned for this route, so the map cannot be plotted.</p>
                </div>
              )}
            </article>
          </section>
        </>
      )}
    </div>
  );
}