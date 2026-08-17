import React, { Children, useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import {
  TrainTrack,
  Search,
  ArrowLeftRight,
  AlertTriangle,
  MapPin,
  Sparkles,
  ChevronRight,
  CalendarDays,
  Route,
} from "lucide-react";

import { formatDuration, getSuggestions, normalizeStationList, normalizeStationLabel, normalizeTrain, todayIso } from "../../features/train/utils/trainUtils";

import trainService from "../../services/trainService";
import aiService from "../../services/aiService";
import { cacheService } from "../../services/cacheService";
import { settingsService } from "../../services/settingsService";
import stationsData from "../../data/stations.json";
import type { SearchTrainResponse, Station } from "../../types/Train";
import type { TrainRouteResponse } from "../../types/Route";
import { getApiErrorMessage } from "../../utils/helpers";
import { ROUTES, SEARCH_TTL_MS } from "../../utils/constants";

import "./SearchTrainPage.scss";

const STATIONS: Station[] = normalizeStationList(stationsData);
const PAGE_SIZE = 6;

type SortKey = "departure" | "arrival" | "duration" | "trainNumber";

type AiInsight = {
  insightMessage: string;
  fastestTrain?: { number: string };
  longestTrain?: { number: string };
};

function useAnchoredPosition(anchorRef: React.RefObject<HTMLElement | null>, open: boolean) {
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);

  useEffect(() => {
    if (!open) return;

    function updateRect() {
      const el = anchorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setRect({ top: r.bottom + 8, left: r.left, width: r.width });
    }

    updateRect();
    window.addEventListener("scroll", updateRect, true);
    window.addEventListener("resize", updateRect);
    return () => {
      window.removeEventListener("scroll", updateRect, true);
      window.removeEventListener("resize", updateRect);
    };
  }, [anchorRef, open]);

  return rect;
}

function StationSuggestionsDropdown({
  anchorRef,
  listRef,
  open,
  children,
}: {
  anchorRef: React.RefObject<HTMLElement | null>;
  listRef?: React.RefObject<HTMLUListElement | null>;
  open: boolean;
  children: React.ReactNode;
}) {
  const rect = useAnchoredPosition(anchorRef, open);
  const visibleItemCount = Math.min(Children.count(children), 4);
  const maxDropdownHeight = visibleItemCount * 52 + 14;

  if (!open || !rect) return null;

  return createPortal(
    <ul
      ref={listRef as React.LegacyRef<HTMLUListElement>}
      className="station-suggestions"
      style={{
        position: "fixed",
        top: rect.top,
        left: rect.left,
        width: rect.width,
        right: "auto",
        maxHeight: `${maxDropdownHeight}px`,
      }}
    >
      {children}
    </ul>,
    document.body
  );
}

export default function SearchTrainPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const initialState = location.state as
    | { fromStation?: string; toStation?: string; date?: string; autoSearch?: boolean }
    | null;
  const cachedSearch = cacheService.getLatest<SearchTrainResponse>("TRAIN");
  const normalizeStationInput = useCallback((value: string) => {
    const trimmed = value.trim();
    return /^[A-Za-z]{2,5}$/.test(trimmed) ? trimmed.toUpperCase() : trimmed;
  }, []);

  const resolveStationValue = useCallback((value: string) => {
    const normalizedValue = normalizeStationInput(value);
    const candidate = STATIONS.find((station) =>
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
  }, [normalizeStationInput]);

  const initialFromSource = initialState?.fromStation ?? String(cachedSearch?.request?.from ?? "");
  const initialToSource = initialState?.toStation ?? String(cachedSearch?.request?.to ?? "");

  const { displayValue: initialFrom, code: initialFromCode } = resolveStationValue(initialFromSource);
  const { displayValue: initialTo, code: initialToCode } = resolveStationValue(initialToSource);
  const initialDate = initialState?.date ?? (typeof cachedSearch?.request?.date === "string" ? cachedSearch.request.date : todayIso());
  const initialResult = useMemo(() => {
    if (initialState?.fromStation && initialState?.toStation) {
      return null;
    }

    return cachedSearch?.response ? { ...cachedSearch.response, trains: cachedSearch.response.trains.map(normalizeTrain) } : null;
  }, [cachedSearch?.response, initialState?.fromStation, initialState?.toStation]);

  const [fromQuery, setFromQuery] = useState(initialFrom);
  const [fromCode, setFromCode] = useState(initialFromCode);
  const [showFromSuggestions, setShowFromSuggestions] = useState(false);

  const [toQuery, setToQuery] = useState(initialTo);
  const [toCode, setToCode] = useState(initialToCode);
  const [showToSuggestions, setShowToSuggestions] = useState(false);

  const [journeyDate, setJourneyDate] = useState(initialDate);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(Boolean(initialResult));
  const [result, setResult] = useState<SearchTrainResponse | null>(initialResult);
  const [sortKey] = useState<SortKey>("departure");
  const [classFilter] = useState("all");
  const [queryFilter] = useState("");
  const [page, setPage] = useState(1);

  // AI insight state
  const aiCacheRef = useRef<Record<string, AiInsight>>({});
  const [aiInsight, setAiInsight] = useState<AiInsight | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiRecommendedOnly, setAiRecommendedOnly] = useState(false);

  const fromRef = useRef<HTMLDivElement>(null);
  const toRef = useRef<HTMLDivElement>(null);
  const fromSuggestionsRef = useRef<HTMLUListElement>(null);
  const toSuggestionsRef = useRef<HTMLUListElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const emptyDateInputRef = useRef<HTMLInputElement>(null);

  function openDatePicker(ref: React.RefObject<HTMLInputElement | null> = dateInputRef) {
    const el = ref.current;
    if (!el) return;
    const pickerEl = el as HTMLInputElement & { showPicker?: () => void };
    if (typeof pickerEl.showPicker === "function") {
      pickerEl.showPicker();
    } else {
      el.focus();
      el.click();
    }
  }

  function handleDateFieldClick() {
    openDatePicker(dateInputRef);
  }

  const buildSearchKey = useCallback((from: string, to: string, date: string) => `${from}|${to}|${date}`, []);

  const formatPrice = useCallback((value?: number | string) => {
    if (value == null || value === "") return "";
    const amount = typeof value === "number" ? value : Number(value);
    if (Number.isNaN(amount)) return String(value);
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  }, []);

  const normalizeAiInsight = useCallback((data: unknown): AiInsight | null => {
    if (!data || typeof data !== "object") return null;

    const root = ((data as Record<string, unknown>).data && typeof (data as Record<string, unknown>).data === "object"
      ? ((data as Record<string, unknown>).data as Record<string, unknown>)
      : (data as Record<string, unknown>));

    const getTrainNumber = (value: unknown): string | undefined => {
      if (value == null) return undefined;
      if (typeof value === "string") {
        const clean = value.trim();
        return clean || undefined;
      }
      if (typeof value === "number") return String(value);
      if (typeof value === "object") {
        const candidate = value as Record<string, unknown>;
        const match = [candidate.number, candidate.trainNumber, candidate.trainNo, candidate.code, candidate.id]
          .find((entry) => entry != null && String(entry).trim() !== "");
        return match == null ? undefined : String(match).trim();
      }
      return undefined;
    };

    const extractTrainCandidate = (...keys: string[]) => {
      for (const key of keys) {
        const raw = root[key] ?? root[key.toLowerCase()] ?? root[key.charAt(0).toUpperCase() + key.slice(1)];
        if (raw == null) continue;

        if (Array.isArray(raw)) {
          const first = raw[0];
          const value = getTrainNumber(first);
          if (value) return { number: value };
        }

        if (typeof raw === "object") {
          const value = getTrainNumber(raw);
          if (value) return { number: value };
        }

        const value = getTrainNumber(raw);
        if (value) return { number: value };
      }

      return undefined;
    };

    const fastest = extractTrainCandidate("fastestTrain", "fastest", "fastestRoute", "bestTrain");
    const longest = extractTrainCandidate("longestTrain", "longest", "bestOvernight", "overnightTrain");
    const insightMessage = [
      root.insightMessage,
      root.message,
      root.summary,
      root.recommendation,
      root.aiRecommendation,
      root.analysis,
    ].find((value) => typeof value === "string" && value.trim() !== "");

    if (!insightMessage && !fastest?.number && !longest?.number) {
      return null;
    }

    return {
      insightMessage: typeof insightMessage === "string" && insightMessage.trim() ? insightMessage.trim() : "AI recommendations are ready for this route.",
      fastestTrain: fastest?.number ? { number: fastest.number } : undefined,
      longestTrain: longest?.number ? { number: longest.number } : undefined,
    };
  }, []);

  // NOTE: previously this also pushed aiInsight.insightMessage as a third
  // "Travel Optimization" card, which duplicated the exact same text already
  // shown in the "Smart recommendation" box (.ai-sidebar-message) above the
  // sidebar. Removed that block so insightMessage only renders once.
  const aiSections = useMemo(() => {
    if (!aiInsight) return [];

    const sections: Array<{ icon: string; title: string; content: string }> = [];
    if (aiInsight.fastestTrain?.number) {
      sections.push({
        icon: "🚀",
        title: "Fastest Route",
        content: `Train ${aiInsight.fastestTrain.number} is the quickest option on this route.`,
      });
    }

    if (aiInsight.longestTrain?.number) {
      sections.push({
        icon: "🌙",
        title: "Best Overnight Option",
        content: `Train ${aiInsight.longestTrain.number} is the best choice for a longer schedule with flexible timings.`,
      });
    }

    return sections;
  }, [aiInsight]);

  const createAiFallback = useCallback((trains: SearchTrainResponse["trains"]) => {
    const numericDuration = (train: SearchTrainResponse["trains"][number]) => {
      const value = Number(train.duration);
      return Number.isNaN(value) ? Infinity : value;
    };

    const fastest = [...trains].sort((a, b) => numericDuration(a) - numericDuration(b))[0];
    const longest = [...trains].sort((a, b) => numericDuration(b) - numericDuration(a))[0];

    return {
      insightMessage: "AI is unavailable. Showing fastest and longest available trains as a fallback.",
      fastestTrain: fastest ? { number: fastest.trainNumber } : undefined,
      longestTrain: longest ? { number: longest.trainNumber } : undefined,
    };
  }, []);

  const fetchAiInsight = useCallback(async (
    trains: SearchTrainResponse["trains"] | null | undefined,
    searchKey: string,
  ) => {
    if (!trains || trains.length === 0) return;
    setAiError(null);
    setAiLoading(true);
    try {
      // Helper: ensure station is an object { code, name }
      const ensureStationObj = (val: unknown) => {
        if (!val) return { code: "", name: "" };
        if (typeof val === "string") {
          // Expect formats like "NAME (CODE)" — parse accordingly
          const m = val.match(/^(.*) \(([^)]+)\)$/);
          if (m) {
            return { name: m[1].trim(), code: m[2].trim() };
          }
          return { name: val.trim(), code: "" };
        }

        if (typeof val === "object") {
          const obj = val as Record<string, unknown>;
          const code = String(obj.code ?? obj.stationCode ?? "");
          const name = String(obj.name ?? obj.stationName ?? obj.display ?? "");
          return { code, name };
        }

        return { code: "", name: String(val) };
      };

      const payload = trains.map((t) => ({
        trainNumber: t.trainNumber,
        trainName: t.trainName,
        trainType: t.trainType,
        source: ensureStationObj(t.source),
        destination: ensureStationObj(t.destination),
        departure: t.departure,
        arrival: t.arrival,
        duration: t.duration,
        distanceKm: t.distanceKm,
        runningDays: Array.isArray(t.runningDays) ? t.runningDays : [],
        availableClasses: Array.isArray(t.availableClasses) ? t.availableClasses : [],
      }));

      // Debug: log outgoing AI payload to help reproduce server errors
      // Remove these logs after root-cause is identified
      try {
        // eslint-disable-next-line no-console
        console.debug("AI payload:", payload);
      } catch {}

      const resp = await aiService.analyzeTrains(payload);

      // Debug: log AI response for troubleshooting
      try {
        // eslint-disable-next-line no-console
        console.debug("AI response:", resp && resp.data);
      } catch {}

      const insight = normalizeAiInsight(resp.data);
      if (!insight) {
        throw new Error("AI analysis returned an invalid response.");
      }

      aiCacheRef.current[searchKey] = insight;
      setAiInsight(insight);
      cacheService.set("AI", { searchKey }, insight, SEARCH_TTL_MS);
    } catch (error) {
      const fallback = createAiFallback(trains);
      aiCacheRef.current[searchKey] = fallback;
      setAiInsight(fallback);
      cacheService.set("AI", { searchKey }, fallback, SEARCH_TTL_MS);
      setAiError(getApiErrorMessage(error, "AI analysis failed. Showing fallback suggestions."));
    } finally {
      setAiLoading(false);
    }
  }, [createAiFallback, normalizeAiInsight]);

  // Debounce + dedupe scheduler to avoid firing many AI requests in quick succession
  const aiFetchTimerRef = useRef<number | null>(null);
  const lastAiKeyRef = useRef<string | null>(null);

  const scheduleFetchAiInsight = useCallback((
    trains: SearchTrainResponse["trains"] | null | undefined,
    searchKey: string,
  ) => {
    if (!trains || trains.length === 0 || !searchKey) return;

    if (aiCacheRef.current[searchKey]) {
      setAiInsight(aiCacheRef.current[searchKey]);
      setAiLoading(false);
      return;
    }

    // Dedupe identical analyze requests by combining the search key and train numbers.
    try {
      const key = JSON.stringify({ searchKey, trainNumbers: trains.map((t) => t.trainNumber) });
      if (lastAiKeyRef.current === key) return;
      lastAiKeyRef.current = key;
    } catch {
      // fallthrough — if stringify fails, still proceed but avoid infinite loops
    }

    if (aiFetchTimerRef.current) {
      window.clearTimeout(aiFetchTimerRef.current);
    }

    // debounce a little to batch rapid searches / UI updates
    aiFetchTimerRef.current = window.setTimeout(() => {
      void fetchAiInsight(trains, searchKey);
    }, 400);
  }, [fetchAiInsight]);

  const executeSearch = useCallback(async (
    finalFrom: string,
    finalTo: string,
    finalDate: string,
    searchKey: string,
  ) => {
    setLoading(true);
    setHasSearched(true);
    setPage(1);
    setAiError(null);

    if (aiCacheRef.current[searchKey]) {
      setAiInsight(aiCacheRef.current[searchKey]);
      setAiLoading(false);
    } else {
      setAiLoading(true);
    }

    try {
      const res = await trainService.searchBetweenStations({
        from: finalFrom,
        to: finalTo,
        date: finalDate,
      });

      setResult({ ...res.data, trains: res.data.trains.map(normalizeTrain) });
      // trigger AI analysis in background (debounced + deduped)
      scheduleFetchAiInsight(res.data.trains, searchKey);

      const settings = settingsService.getSettings();
      if (settings.cache.enabled) {
        cacheService.set("TRAIN", { from: finalFrom, to: finalTo, date: finalDate }, res.data, settings.cache.ttlMinutes * 60 * 1000 || SEARCH_TTL_MS);
      }
    } catch (error) {
      setResult(null);
      setError(getApiErrorMessage(error, "Failed to fetch train schedules. Please try again."));
    } finally {
      setLoading(false);
    }

    // AI analysis is handled in the try block after successful fetch
  }, [scheduleFetchAiInsight]);

  useEffect(() => {
    const fromStation = initialState?.fromStation ?? "";
    const toStation = initialState?.toStation ?? "";
    const initialDateValue = initialState?.date ?? initialDate;

    if (fromStation && toStation) {
      const timerId = window.setTimeout(() => {
        const autoSearchKey = buildSearchKey(fromStation, toStation, initialDateValue);
        void executeSearch(fromStation, toStation, initialDateValue, autoSearchKey);
      }, 0);
      return () => window.clearTimeout(timerId);
    }

    if (initialResult) {
      const initialSearchKey = buildSearchKey(initialFrom, initialTo, initialDate);
      if (aiCacheRef.current[initialSearchKey]) {
        setAiInsight(aiCacheRef.current[initialSearchKey]);
        setAiLoading(false);
      } else {
        const cachedAI = cacheService.get<{ searchKey: string }, AiInsight>(
          "AI",
          { searchKey: initialSearchKey }
        );

        if (cachedAI?.response) {
          aiCacheRef.current[initialSearchKey] = cachedAI.response;
          setAiInsight(cachedAI.response);
          setAiLoading(false);
        } else {
          scheduleFetchAiInsight(initialResult.trains, initialSearchKey);
        }
      }
      return;
    }
  }, [buildSearchKey, executeSearch, initialDate, initialFrom, initialResult, initialState?.date, initialState?.fromStation, initialState?.toStation, scheduleFetchAiInsight]);

  const filteredTrains = result
    ? [...result.trains]
        .filter((train) => {
          if (aiRecommendedOnly && aiInsight) {
            const picks = new Set<string>();
            if (aiInsight.fastestTrain?.number) picks.add(String(aiInsight.fastestTrain.number));
            if (aiInsight.longestTrain?.number) picks.add(String(aiInsight.longestTrain.number));
            if (picks.size > 0 && !picks.has(String(train.trainNumber))) return false;
          }
          const haystack = [train.trainNumber, train.trainName, train.source, train.destination, train.trainType].join(" ").toLowerCase();
          const matchesQuery = !queryFilter.trim() || haystack.includes(queryFilter.trim().toLowerCase());
          const availableClasses = train.availableClasses ?? [];
          const matchesClass = classFilter === "all" || availableClasses.some((availableClass) => availableClass.toLowerCase() === classFilter.toLowerCase());
          return matchesQuery && matchesClass;
        })
        .sort((left, right) => {
          if (sortKey === "arrival") return left.arrival.localeCompare(right.arrival);
          if (sortKey === "trainNumber") return left.trainNumber.localeCompare(right.trainNumber);
          if (sortKey === "duration") return parseInt(left.duration, 10) - parseInt(right.duration, 10);
          return left.departure.localeCompare(right.departure);
        })
    : [];

  const totalPages = Math.max(1, Math.ceil(filteredTrains.length / PAGE_SIZE));
  const effectivePage = Math.min(page, totalPages);
  const paginatedTrains = filteredTrains.slice((effectivePage - 1) * PAGE_SIZE, effectivePage * PAGE_SIZE);

  function handleSelectFrom(station: Station) {
    setFromQuery(normalizeStationLabel(station));
    setFromCode(station.code);
    setShowFromSuggestions(false);
  }

  function handleSelectTo(station: Station) {
    setToQuery(normalizeStationLabel(station));
    setToCode(station.code);
    setShowToSuggestions(false);
  }

  function handleSwap() {
    setFromQuery(toQuery);
    setFromCode(toCode);
    setToQuery(fromQuery);
    setToCode(fromCode);
  }

  async function handleSearch(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const resolvedFrom = resolveStationValue(fromQuery.trim());
    const resolvedTo = resolveStationValue(toQuery.trim());
    const finalFrom = fromCode || resolvedFrom.code;
    const finalTo = toCode || resolvedTo.code;

    if (!finalFrom || !finalTo) {
      setError("Please select both source and destination stations.");
      return;
    }
    if (finalFrom === finalTo) {
      setError("Source and destination stations cannot be the same.");
      return;
    }
    if (!journeyDate) {
      setError("Please select a journey date.");
      return;
    }

    setFromCode(finalFrom);
    setToCode(finalTo);
    setFromQuery(resolvedFrom.displayValue);
    setToQuery(resolvedTo.displayValue);

    const newSearchKey = buildSearchKey(finalFrom, finalTo, journeyDate);
    await executeSearch(finalFrom, finalTo, journeyDate, newSearchKey);
  }

  function handleShowAiDetails() {
    setAiRecommendedOnly(true);
    resultsRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  const fromSuggestions = getSuggestions(fromQuery, STATIONS);
  const toSuggestions = getSuggestions(toQuery, STATIONS);
  const shouldShowFromSuggestions = showFromSuggestions && Boolean(fromQuery.trim()) && fromSuggestions.length > 0;
  const shouldShowToSuggestions = showToSuggestions && Boolean(toQuery.trim()) && toSuggestions.length > 0;
  const [routeModalOpen, setRouteModalOpen] = useState(false);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [routeData, setRouteData] = useState<TrainRouteResponse | null>(null);

  // Always keep origin (first) and destination (last) stations, in addition
  // to any intermediate station that has a halt.
  const haltedStations = routeData
    ? routeData.stations.filter(
        (station, index) =>
          (station.haltMinutes ?? 0) > 0 ||
          index === 0 ||
          index === routeData.stations.length - 1
      )
    : [];

  useEffect(() => {
    if (routeModalOpen) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [routeModalOpen]);

  async function openRouteModal(trainNumber: string) {
    setRouteError(null);
    setRouteLoading(true);
    setRouteData(null);
    setRouteModalOpen(true);
    try {
      const res = await trainService.getRouteDetails(trainNumber);
      setRouteData(res.data);
    } catch (err) {
      setRouteError(getApiErrorMessage(err, "Failed to fetch train route. Please try again."));
    } finally {
      setRouteLoading(false);
    }
  }

  function closeRouteModal() {
    setRouteModalOpen(false);
    setRouteData(null);
    setRouteError(null);
    setRouteLoading(false);
  }

  // Render route modal into document.body to escape stacking contexts
  // and ensure it appears above the fixed sidebar.
  const routeModalPortal =
    routeModalOpen && typeof document !== "undefined"
      ? createPortal(
          <div className="route-modal-overlay" role="dialog" aria-modal="true">
            <div className="route-modal">
              <div className="route-modal-header">
                <div>
                  <span className="modal-eyebrow">TRAIN ROUTE</span>
                  <h3>
                    {routeData ? `${routeData.trainName} (${routeData.trainNumber})` : "Train Route"}
                  </h3>
                </div>

                <button className="close-route-button" onClick={closeRouteModal} aria-label="Close route modal">
                  ×
                </button>
              </div>

              <div className="route-modal-body">
                {routeLoading && (
                  <div className="route-loading">
                    <span className="search-spinner" />
                    Loading train route...
                  </div>
                )}

                {routeError && (
                  <div className="search-error">
                    <AlertTriangle size={16} />
                    {routeError}
                  </div>
                )}

                {routeData && (
                  <div className="route-content">
                    <div className="route-summary-grid">
                      <div className="route-summary-item">
                        <span>Distance</span>
                        <strong>{routeData.distance} km</strong>
                      </div>

                      <div className="route-summary-item">
                        <span>Running Days</span>
                        <strong>{routeData.runningDays.join(", ")}</strong>
                      </div>
                    </div>

                    {haltedStations.length === 0 ? (
                      <div className="route-empty">No halting stations on this route.</div>
                    ) : (
                      <div className="route-station-list">
                        {haltedStations.map((station) => {
                          const isOrigin = routeData
                            ? station.sequence === routeData.stations[0].sequence
                            : false;
                          const isDestination = routeData
                            ? station.sequence === routeData.stations[routeData.stations.length - 1].sequence
                            : false;

                          return (
                            <div key={`${station.sequence}-${station.stationCode}`} className="route-station">
                              <div className="route-sequence">{station.sequence}</div>

                              <div className="route-station-info">
                                <div className="route-station-name">
                                  {station.stationName}
                                  <span>{station.stationCode}</span>
                                </div>

                                <div className="route-station-times">
                                  Arr: {station.arrival}
                                  <span>•</span>
                                  Dep: {station.departure}
                                  <span>•</span>
                                  Day: {station.dayNumber}
                                  <span>•</span>
                                  {isOrigin
                                    ? "Origin"
                                    : isDestination
                                    ? "Destination"
                                    : `Halt: ${station.haltMinutes}m`}
                                </div>
                              </div>

                              {station.latitude != null && station.longitude != null && (
                                
                                  <a
                                    href={`https://www.google.com/maps/dir/?api=1&destination=${station.latitude},${station.longitude}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="route-map-button"
                                  >
                                    Map ↗
                                </a>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

return (
  <div className="search-train-page">

    {/* =====================================================
        PAGE HEADER
    ====================================================== */}

    <section className="search-page-header">

      <div className="search-page-heading">
        <div className="section-eyebrow">
          JOURNEY PLANNER
        </div>

        <h1>Search Trains</h1>

        <p>
          Find the best train connections across India
          with intelligent route insights from RailTrack AI.
        </p>
      </div>

      <div className="ai-powered-badge">
        <Sparkles size={15} />
        <span>AI Powered</span>
      </div>

    </section>


    {/* =====================================================
        SEARCH PANEL
    ====================================================== */}

    <section className="journey-search-card">

      <div className="journey-search-top">

        <div>
          <span className="section-eyebrow">
            PLAN YOUR JOURNEY
          </span>

          <h2>
            Where do you want to go?
          </h2>
        </div>

        <div className="station-code-hint">
          <MapPin size={15} />
          Use station codes for faster results
        </div>

      </div>


      <form
        className="journey-search-form"
        onSubmit={handleSearch}
      >

        {/* FROM */}

        <div
          className="station-field-wrapper"
          ref={fromRef}
        >
          <label>FROM</label>

          <div className="station-field">

            <div className="station-field-icon">
              <TrainTrack size={19} />
            </div>

            <div className="station-field-content">

              <input
                type="text"
                placeholder="Source station or code"
                value={fromQuery}
                onChange={(e) => {
                  setFromQuery(e.target.value);
                  setFromCode("");
                  setShowFromSuggestions(true);
                }}
                onFocus={() => setShowFromSuggestions(true)}
                autoComplete="off"
                disabled={loading}
              />

              <span>
                Departure station
              </span>

            </div>

          </div>

          <StationSuggestionsDropdown
            anchorRef={fromRef}
            listRef={fromSuggestionsRef}
            open={shouldShowFromSuggestions}
          >
            {fromSuggestions.map((station) => (
              <li
                key={station.code}
                onClick={() =>
                  handleSelectFrom(station)
                }
              >
                <div className="suggestion-station-icon">
                  <TrainTrack size={16} />
                </div>

                <div className="suggestion-info">
                  <strong>
                    {normalizeStationLabel(station)}
                  </strong>
                </div>

                <ChevronRight size={16} />
              </li>
            ))}
          </StationSuggestionsDropdown>
        </div>


        {/* SWAP */}

        <button
          type="button"
          className="station-swap-button"
          onClick={handleSwap}
          title="Swap stations"
          aria-label="Swap stations"
        >
          <ArrowLeftRight size={18} />
        </button>
        
        {/* TO */}

        <div
          className="station-field-wrapper"
          ref={toRef}
        >
          <label>TO</label>

          <div className="station-field">

            <div className="station-field-icon">
              <MapPin size={19} />
            </div>

            <div className="station-field-content">

              <input
                type="text"
                placeholder="Destination station or code"
                value={toQuery}
                onChange={(e) => {
                  setToQuery(e.target.value);
                  // setToCode("");
                  setShowToSuggestions(true);
                }}
                onFocus={() => setShowToSuggestions(true)}
                autoComplete="off"
                disabled={loading}
              />

              <span>
                Arrival station
              </span>

            </div>

          </div>

          <StationSuggestionsDropdown
            anchorRef={toRef}
            listRef={toSuggestionsRef}
            open={shouldShowToSuggestions}
          >
            {toSuggestions.map((station) => (
              <li
                key={station.code}
                onClick={() => handleSelectTo(station)}
              >
                <div className="suggestion-station-icon">
                  <MapPin size={16} />
                </div>

                <div className="suggestion-info">
                  <strong>
                    {normalizeStationLabel(station)}
                  </strong>
                </div>

                <ChevronRight size={16} />
              </li>
            ))}
          </StationSuggestionsDropdown>
        </div>


        {/* DATE */}

        <div className="journey-date-field">

          <label htmlFor="journey-date">JOURNEY DATE</label>

          <div className="date-field" onClick={handleDateFieldClick}>

            <CalendarDays size={19} />

            <input
              id="journey-date"
              ref={dateInputRef}
              type="date"
              value={journeyDate}
              min={todayIso()}
              onChange={(e) =>
                setJourneyDate(e.target.value)
              }
              disabled={loading}
            />

          </div>

        </div>


        {/* SEARCH */}

        <button
          type="submit"
          className="journey-search-button"
          disabled={loading}
        >
          {loading ? (
            <>
              <span className="search-spinner" />
              Searching
            </>
          ) : (
            <>
              <Search size={18} />
              Search trains
            </>
          )}
        </button>

      </form>

    </section>


    {/* =====================================================
        ERROR
    ====================================================== */}

    {error && (
      <div className="search-error">

        <AlertTriangle size={17} />

        <span>{error}</span>

      </div>
    )}


    {routeModalPortal}


    {/* =====================================================
        EMPTY SEARCH RESULT
    ====================================================== */}

    {!loading &&
      hasSearched &&
      !error &&
      result &&
      result.trains.length === 0 && (

        <section className="empty-result-card">

          <div className="empty-result-icon">
            <TrainTrack size={30} />
          </div>

          <h3>No trains found</h3>

          <p>
            No trains run between{" "}
            <strong>{result.source}</strong>{" "}
            and{" "}
            <strong>{result.destination}</strong>{" "}
            on the selected date.
          </p>

          <div className="journey-date-field">
            <label htmlFor="empty-journey-date">JOURNEY DATE</label>

            <div className="date-field" onClick={() => openDatePicker(emptyDateInputRef)}>
              <CalendarDays size={18} />

              <input
                id="empty-journey-date"
                ref={emptyDateInputRef}
                type="date"
                value={journeyDate}
                onChange={(e) => setJourneyDate(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
              />
            </div>
          </div>

        </section>
    )}


    {/* =====================================================
        RESULTS
    ====================================================== */}

  {result && result.trains.length > 0 && (
  <section
    className="train-results-section"
    ref={resultsRef}
  >

    {/* =================================================
        RESULTS HEADER
    ================================================== */}

    <div className="results-heading">
      <div>
        <span className="section-eyebrow">
          SEARCH RESULTS
        </span>

        <h2>
          {filteredTrains.length} trains  
        </h2>

        <p>
          {result.source}
          <span> → </span>
          {result.destination}
        </p>
      </div>
    </div>


    {/* =================================================
        RESULTS + AI LAYOUT
    ================================================== */}

    <div className="results-ai-layout">

      {/* =================================================
          LEFT — TRAIN RESULTS
      ================================================== */}

      <div className="train-results-column">

        {/* =================================================
            TRAIN LIST
        ================================================== */}

        <div className="modern-train-list">

          {paginatedTrains.map((train) => {

            const isFastest =
              aiInsight?.fastestTrain?.number &&
              String(
                aiInsight.fastestTrain.number
              ) === String(train.trainNumber);

            const isLongest =
              aiInsight?.longestTrain?.number &&
              String(
                aiInsight.longestTrain.number
              ) === String(train.trainNumber);

            const isAiPick = Boolean(isFastest || isLongest);
            const price = train.price ?? train.fare;

            return (
              <article
                key={train.trainNumber}
                className={`modern-train-card ${
                  isAiPick
                    ? "ai-selected-train"
                    : ""
                }`}
              >

                {/* CARD HEADER */}

                <div className="modern-train-header">

                  <div className="train-main-info">

                    <div className="train-logo">
                      <TrainTrack size={19} />
                    </div>

                    <div className="train-summary">

                      <div className="train-name-row">
                        <h3>{train.trainName}</h3>
                        <span className="train-number">{train.trainNumber}</span>
                      </div>

                      <div className="train-secondary-info">
                        <span>{train.trainType}</span>
                        <span>•</span>
                        <span>{train.distanceKm} km</span>
                      </div>

                    </div>

                  </div>

                  <div className="train-meta">
                    {price && (
                      <span className="train-price">
                        {formatPrice(price)}
                      </span>
                    )}

                    {isAiPick && (
                      <span className="ai-pick-badge">
                        <Sparkles size={12} />
                        AI PICK
                      </span>
                    )}

                    {train.runningDays.length > 0 && (
                      <span className="train-running-days">
                        {train.runningDays.join(", ")}
                      </span>
                    )}
                  </div>

                </div>


                {/* JOURNEY TIMELINE */}

                <div className="modern-journey">

                  <div className="journey-location">

                    <strong>
                      {train.departure}
                    </strong>

                    <span>
                      {train.source}
                    </span>

                  </div>


                  <div className="journey-middle">

                    <span className="journey-duration">
                      {formatDuration(
                        train.duration
                      )}
                    </span>

                    <div className="journey-track">

                      <span className="journey-dot" />

                      <div />

                      <ChevronRight size={15} />

                    </div>

                    <button
                      type="button"
                      className="route-button"
                      onClick={() =>
                        openRouteModal(
                          train.trainNumber
                        )
                      }
                    >
                      <Route size={14} />
                      Check route
                    </button>

                  </div>


                  <div className="journey-location arrival">

                    <strong>
                      {train.arrival}
                    </strong>

                    <span>
                      {train.destination}
                    </span>

                  </div>

                </div>


                {/* CARD FOOTER */}

                <div className="modern-train-footer">

                  <div className="class-list">

                    {(train.availableClasses ?? []).map(
                      (cls) => (
                        <span
                          key={cls}
                          className="class-chip"
                        >
                          {cls}
                        </span>
                      )
                    )}

                  </div>


                  <button
                    type="button"
                    className="live-status-link"
                    onClick={() =>
                      navigate(
                        ROUTES.LIVE_STATUS ??
                          "/live-status",
                        {
                          state: {
                            trainNumber:
                              train.trainNumber,
                          },
                        }
                      )
                    }
                  >
                    <span className="live-dot" />

                    Live running status

                    <ChevronRight size={15} />
                  </button>

                </div>

              </article>
            );
          })}

        </div>


        {/* =================================================
            PAGINATION
        ================================================== */}

        {totalPages > 1 && (
          <div className="modern-pagination">

            <span>
              Page{" "}
              <strong>{effectivePage}</strong>{" "}
              of{" "}
              <strong>{totalPages}</strong>
            </span>

            <div>

              <button
                type="button"
                disabled={effectivePage <= 1}
                onClick={() =>
                  setPage((prev) =>
                    Math.max(prev - 1, 1)
                  )
                }
              >
                Previous
              </button>

              <button
                type="button"
                disabled={
                  effectivePage >= totalPages
                }
                onClick={() =>
                  setPage((prev) =>
                    Math.min(
                      prev + 1,
                      totalPages
                    )
                  )
                }
              >
                Next
              </button>

            </div>

          </div>
        )}

      </div>


      {/* =================================================
          RIGHT — AI INSIGHTS
      ================================================== */}

      <aside className="ai-insights-sidebar">

        <div className="ai-sidebar-header">

          <div className="ai-title-wrapper">

            <div className="ai-sidebar-icon">
              <Sparkles size={18} />
            </div>

            <div>
              <span className="ai-sidebar-eyebrow">
                RAILTRACK AI
              </span>
            </div>

          </div>


          <span
            className={`ai-status ${
              aiLoading
                ? "analyzing"
                : aiError
                ? "error"
                : "ready"
            }`}
          >
            {aiLoading
              ? "Analyzing"
              : aiError
              ? "Unavailable"
              : "Ready"}
          </span>

        </div>


        {/* AI MESSAGE */}

        <div className="ai-sidebar-message">

          <div className="ai-message-icon">
            <Sparkles size={16} />
          </div>

          <div>

            <strong>
              Smart recommendation
            </strong>

            <p>
              {aiLoading
                ? "Analyzing available trains and finding the best options for your journey..."
                : aiError
                ? aiError
                : aiInsight?.insightMessage ??
                  "AI suggestions will appear here once the train analysis is complete."}
            </p>

          </div>

        </div>


        {/* AI SECTIONS */}

        <div className="ai-section-list">
          {aiSections.length > 0 ? (
            aiSections.map((section) => (
              <div key={section.title} className="ai-section-card">
                <div className="ai-section-icon">
                  {section.icon}
                </div>
                <div>
                  <strong>{section.title}</strong>
                  <p>{section.content}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="ai-section-card ai-section-empty">
              <strong>No AI highlights yet</strong>
              <p>
                Train recommendations and route insights will populate here after your search completes.
              </p>
            </div>
          )}
        </div>


        {/* AI ACTION */}

        <div className="ai-sidebar-action">

          <button
            type="button"
            className="ai-details-button"
            onClick={handleShowAiDetails}
          >
            <span>
              View AI recommendations
            </span>

            <ChevronRight size={16} />
          </button>


          <label className="ai-recommendation-toggle">

            <input
              type="checkbox"
              checked={aiRecommendedOnly}
              onChange={(e) =>
                setAiRecommendedOnly(
                  e.target.checked
                )
              }
            />

            <span>
              Show AI picks only
            </span>

          </label>

        </div>


        {/* AI FOOTER */}

        <div className="ai-sidebar-footer">

          <Sparkles size={14} />

          <span>
            Powered by RailTrack AI
          </span>

        </div>

      </aside>

    </div>

  </section>
)}

  </div>
);
}