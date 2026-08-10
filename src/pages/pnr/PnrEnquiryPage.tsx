import { useEffect, useState, type FormEvent } from "react";
import { useLocation } from "react-router-dom";

import {
  Search,
  Ticket,
  AlertTriangle,
  MapPin,
  IndianRupee,
  RefreshCw,
  Users,
  Clock3,
  Sparkles,
  TrainFront,
  CalendarDays,
  Route,
  CheckCircle2,
  Timer,
  ShieldCheck,
} from "lucide-react";

import pnrService from "../../services/pnrService";
import aiService from "../../services/aiService";
import { cacheService } from "../../services/cacheService";
import { historyService } from "../../services/historyService";
import { settingsService } from "../../services/settingsService";

import type { PnrAnalysis, PnrData } from "../../types/Pnr";

import { getApiErrorMessage } from "../../utils/helpers";
import { isValidPnr } from "../../utils/validators";

import "./PnrEnquiryPage.scss";


/* =========================================================
   STATUS HELPERS
========================================================= */

function statusPillClass(status: string): string {
  const value = status.toUpperCase();

  if (value.startsWith("CNF")) {
    return "green";
  }

  if (value.startsWith("RAC")) {
    return "yellow";
  }

  if (value.startsWith("WL") || value.includes("W/L")) {
    return "red";
  }

  return "gray";
}


/* =========================================================
   DATE HELPERS
========================================================= */

function parseJourneyDate(value?: string): Date | null {
  if (!value) return null;

  const parsed = new Date(value);

  if (!Number.isNaN(parsed.getTime())) {
    return parsed;
  }

  const parts = value.trim().split(/[-/]/);

  if (parts.length !== 3) {
    return null;
  }

  const [first, second, third] = parts;

  if (first.length === 4) {
    return new Date(`${first}-${second}-${third}`);
  }

  if (third.length === 4) {
    return new Date(`${third}-${first}-${second}`);
  }

  return null;
}


function isFutureJourneyDate(dateString?: string): boolean {
  const journeyDate = parseJourneyDate(dateString);

  if (!journeyDate) {
    return false;
  }

  const today = new Date();

  today.setHours(0, 0, 0, 0);
  journeyDate.setHours(0, 0, 0, 0);

  return journeyDate > today;
}


/* =========================================================
   COMPONENT
========================================================= */

export default function PnrEnquiryPage() {

  const location = useLocation();

  const initialState = location.state as {
    pnrNumber?: string;
  } | null;


  /* =======================================================
     INITIAL DATA
  ======================================================= */

  const cachedPnr = cacheService.getLatest<PnrData>("PNR");

  const requestedPnr =
    initialState?.pnrNumber ?? "";


  const initialPnrInput =
    requestedPnr && isValidPnr(requestedPnr)
      ? requestedPnr
      : String(
          cachedPnr?.request?.pnrNumber ?? ""
        );


  const initialPnrResult =
    requestedPnr && isValidPnr(requestedPnr)
      ? null
      : cachedPnr?.response ?? null;


  /* =======================================================
     STATE
  ======================================================= */

  const [pnrInput, setPnrInput] =
    useState(initialPnrInput);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [pnrResult, setPnrResult] =
    useState<PnrData | null>(
      initialPnrResult
    );


  /* AI STATE */

  const [aiAnalysis, setAiAnalysis] =
    useState<PnrAnalysis | null>(null);

  const [aiLoading, setAiLoading] =
    useState(false);

  const [aiError, setAiError] =
    useState<string | null>(null);


  /* =======================================================
     INITIAL PNR SEARCH
  ======================================================= */

  useEffect(() => {

    if (
      requestedPnr &&
      isValidPnr(requestedPnr)
    ) {
      void handleSearchByValue(requestedPnr);
    }

  }, [requestedPnr]);


  /* =======================================================
     AI ANALYSIS WHEN PNR CHANGES
  ======================================================= */

  useEffect(() => {

    if (pnrResult) {
      void fetchPnrAiAnalysis(pnrResult);
    }

  }, [pnrResult]);


  /* =======================================================
     PNR SEARCH
  ======================================================= */

  async function handleSearchByValue(
    pnrNumber: string,
    forceRefresh = false
  ) {

    setLoading(true);
    setError(null);


    const cached =
      cacheService.get<
        { pnrNumber: string },
        PnrData
      >(
        "PNR",
        { pnrNumber }
      );


    const useCache =
      !forceRefresh &&
      cached &&
      isFutureJourneyDate(
        cached.response.dateOfJourney
      );


    if (useCache) {

      setPnrResult(
        cached.response
      );

      setLoading(false);

      return;
    }


    try {

      const response =
        await pnrService.checkPnr(
          pnrNumber
        );


      if (response.data.success) {

        setPnrResult(
          response.data.data
        );


        const settings =
          settingsService.getSettings();


        if (settings.cache.enabled) {

          cacheService.set(
            "PNR",
            { pnrNumber },
            response.data.data,
            0
          );

        }


        if (settings.history.autoSave) {

          historyService.record(
            "PNR",
            { pnrNumber },
            response.data.data,
            `${response.data.data.trainName} (${response.data.data.trainNumber})`
          );

        }

      } else {

        setPnrResult(null);
        setAiAnalysis(null);

        setError(
          "Could not retrieve details for this PNR."
        );

      }

    } catch (err) {

      setPnrResult(null);
      setAiAnalysis(null);

      setError(
        getApiErrorMessage(
          err,
          "Invalid PNR or server error. Please try again."
        )
      );

    } finally {

      setLoading(false);

    }
  }


  /* =======================================================
     AI HELPERS
  ======================================================= */

  function isWrappedPnrAnalysis(
    value: unknown
  ): value is {
    success: boolean;
    data: PnrAnalysis;
  } {

    return (
      typeof value === "object" &&
      value !== null &&
      "success" in value &&
      "data" in value
    );

  }


  function getPnrAiCacheEntry(
    pnrData: PnrData
  ) {

    return cacheService.get<
      { pnrNumber: string },
      PnrAnalysis
    >(
      "AI",
      {
        pnrNumber:
          pnrData.pnrNumber
      }
    );

  }


  async function fetchPnrAiAnalysis(
    pnrData: PnrData,
    forceRefresh = false
  ) {

    setAiLoading(true);
    setAiError(null);


    const cacheEntry =
      getPnrAiCacheEntry(
        pnrData
      );


    if (
      !forceRefresh &&
      cacheEntry?.response
    ) {

      setAiAnalysis(
        cacheEntry.response
      );

      setAiLoading(false);

      return;
    }


    try {

      const response =
        await aiService.analyzePnr(
          pnrData
        );


      const payload =
        response.data;


      const analysis =
        isWrappedPnrAnalysis(payload)
          ? payload.data
          : payload;


      setAiAnalysis(
        analysis
      );


      const settings =
        settingsService.getSettings();


      if (settings.cache.enabled) {

        const ttlMs =
          settings.cache.ttlMinutes *
            60 *
            1000 ||
          0;


        cacheService.set(
          "AI",
          {
            pnrNumber:
              pnrData.pnrNumber
          },
          analysis,
          ttlMs
        );

      }

    } catch (err) {

      setAiAnalysis(null);

      setAiError(
        getApiErrorMessage(
          err,
          "AI analysis is unavailable right now."
        )
      );

    } finally {

      setAiLoading(false);

    }
  }


  /* =======================================================
     FORM SEARCH
  ======================================================= */

  async function handleSearch(
    event: FormEvent<HTMLFormElement>
  ) {

    event.preventDefault();

    setError(null);


    if (!isValidPnr(pnrInput)) {

      setError(
        "Please enter a valid 10-digit PNR number."
      );

      return;
    }


    await handleSearchByValue(
      pnrInput.trim()
    );

  }


  /* =======================================================
     DERIVED DATA
  ======================================================= */

  const passengerCoachPosition =
    pnrResult?.coachPosition ||
    pnrResult?.passengerList?.[0]
      ?.currentCoachId ||
    "—";


  const delayMinutes =
    typeof pnrResult?.delayMinutes ===
    "number"
      ? `${pnrResult.delayMinutes} min`
      : "—";


  const prediction =
    pnrResult?.prediction ||
    (
      pnrResult?.chartStatus
        ? `Chart status: ${pnrResult.chartStatus}`
        : "—"
    );


  const chartPrepared =
    pnrResult?.chartStatus
      ?.toLowerCase()
      .includes("prepared");


  const passengerCount =
    pnrResult?.passengerList?.length ?? 0;


  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="pnr-page">


      {/* =================================================
          PAGE HEADER
      ================================================= */}

      <header className="pnr-page-header">

        <div>

          <span className="page-eyebrow">
            PNR ENQUIRY
          </span>

          <h1>
            Check your journey status
          </h1>

          <p>
            View ticket status, coach position,
            chart preparation and passenger details
            in one place.
          </p>

        </div>


        <div className="data-status">

          <span className="data-status-dot" />

          Live railway data

        </div>

      </header>



      {/* =================================================
          SEARCH
      ================================================= */}

      <section className="pnr-search-card">

        <div className="search-card-heading">

          <div className="search-heading-icon">
            <Ticket size={20} />
          </div>

          <div>

            <h2>
              Check PNR status
            </h2>

            <p>
              Enter your 10-digit PNR number
            </p>

          </div>

        </div>


        <form
          className="pnr-form"
          onSubmit={handleSearch}
        >

          <div className="pnr-input-wrapper">

            <label htmlFor="pnr-number">
              PNR Number
            </label>

            <div className="pnr-input">

              <Search size={18} />

              <input
                id="pnr-number"
                type="text"
                inputMode="numeric"
                maxLength={10}
                placeholder="Enter 10-digit PNR"
                value={pnrInput}
                disabled={loading}
                onChange={(event) =>
                  setPnrInput(
                    event.target.value.replace(
                      /\D/g,
                      ""
                    )
                  )
                }
              />

              <span className="digit-count">
                {pnrInput.length}/10
              </span>

            </div>

          </div>


          <button
            type="submit"
            className="submit-btn"
            disabled={loading}
          >

            {loading ? (
              <span className="spinner" />
            ) : (
              <Search size={17} />
            )}

            {loading
              ? "Checking..."
              : "Check Status"}

          </button>


          <button
            type="button"
            className="swap-btn"
            title="Refresh PNR"
            disabled={
              loading ||
              !pnrInput
            }
            onClick={() =>
              pnrInput &&
              handleSearchByValue(
                pnrInput.trim(),
                true
              )
            }
          >

            <RefreshCw
              size={17}
              className={
                loading
                  ? "rotating"
                  : ""
              }
            />

          </button>

        </form>

      </section>



      {/* =================================================
          ERROR
      ================================================= */}

      {error && (

        <div className="form-error">

          <AlertTriangle size={17} />

          <span>
            {error}
          </span>

        </div>

      )}



      {/* =================================================
          EMPTY
      ================================================= */}

      {!pnrResult &&
        !error &&
        !loading && (

          <section className="empty-state-card">

            <div className="empty-icon">
              <Ticket size={30} />
            </div>

            <h2>
              Check your PNR status
            </h2>

            <p>
              Enter your 10-digit PNR number
              above to see your journey details.
            </p>

          </section>

        )}



      {/* =================================================
          RESULTS
      ================================================= */}

      {pnrResult && (

        <div className="pnr-layout">


          {/* =============================================
              LEFT CONTENT
          ============================================== */}

          <main className="pnr-main-content">


            {/* =========================================
                JOURNEY CARD
            ========================================== */}

            <section className="journey-card">

              <div className="journey-card-top">

                <div>

                  <span className="pnr-badge">
                    PNR {pnrResult.pnrNumber}
                  </span>

                  <div className="train-heading">

                    <div className="train-icon">
                      <TrainFront size={21} />
                    </div>

                    <div>

                      <h2>
                        {pnrResult.trainName}
                      </h2>

                      <span>
                        Train {pnrResult.trainNumber}
                      </span>

                    </div>

                  </div>

                </div>


                <span
                  className={`chart-tag ${
                    chartPrepared
                      ? "green"
                      : "yellow"
                  }`}
                >

                  <span />

                  {pnrResult.chartStatus}

                </span>

              </div>


              {/* ROUTE */}

              <div className="journey-route">

                <div className="station-block">

                  <span className="station-code">
                    {pnrResult.sourceStation}
                  </span>

                  <span>
                    Source station
                  </span>

                </div>


                <div className="route-visual">

                  <MapPin size={16} />

                  <div className="route-line">
                    <span />
                    <span />
                    <span />
                  </div>

                  <Route size={16} />

                </div>


                <div className="station-block destination">

                  <span className="station-code">
                    {pnrResult.destinationStation}
                  </span>

                  <span>
                    Destination
                  </span>

                </div>

              </div>


              {pnrResult.boardingPoint &&
                pnrResult.boardingPoint !==
                  pnrResult.sourceStation && (

                  <div className="boarding-note">

                    <MapPin size={14} />

                    Boarding at{" "}
                    <strong>
                      {pnrResult.boardingPoint}
                    </strong>

                  </div>

                )}


              {/* JOURNEY META */}

              <div className="journey-info-grid">


                <div className="journey-info">

                  <CalendarDays size={17} />

                  <div>
                    <span>
                      Journey date
                    </span>

                    <strong>
                      {pnrResult.dateOfJourney}
                    </strong>
                  </div>

                </div>


                <div className="journey-info">

                  <Ticket size={17} />

                  <div>
                    <span>
                      Class
                    </span>

                    <strong>
                      {pnrResult.journeyClass}
                    </strong>
                  </div>

                </div>


                <div className="journey-info">

                  <Route size={17} />

                  <div>
                    <span>
                      Distance
                    </span>

                    <strong>
                      {pnrResult.distance} km
                    </strong>
                  </div>

                </div>


                <div className="journey-info">

                  <IndianRupee size={17} />

                  <div>
                    <span>
                      Ticket fare
                    </span>

                    <strong>
                      ₹ {pnrResult.ticketFare}
                    </strong>
                  </div>

                </div>


                <div className="journey-info">

                  <IndianRupee size={17} />

                  <div>
                    <span>
                      Booking fare
                    </span>

                    <strong>
                      ₹ {pnrResult.bookingFare}
                    </strong>
                  </div>

                </div>

              </div>

            </section>



            {/* =========================================
                STATUS
            ========================================== */}

            <section className="status-section">

              <div className="section-title">

                <div>

                  <span>
                    JOURNEY OVERVIEW
                  </span>

                  <h2>
                    Travel status
                  </h2>

                </div>

              </div>


              <div className="status-grid">


                <div className="status-item">

                  <div className="status-icon blue">
                    <CheckCircle2 size={19} />
                  </div>

                  <div>

                    <span>
                      Prediction
                    </span>

                    <strong>
                      {prediction}
                    </strong>

                  </div>

                </div>


                <div className="status-item">

                  <div className="status-icon orange">
                    <Timer size={19} />
                  </div>

                  <div>

                    <span>
                      Delay
                    </span>

                    <strong>
                      {delayMinutes}
                    </strong>

                  </div>

                </div>


                <div className="status-item">

                  <div className="status-icon purple">
                    <TrainFront size={19} />
                  </div>

                  <div>

                    <span>
                      Coach
                    </span>

                    <strong>
                      {passengerCoachPosition}
                    </strong>

                  </div>

                </div>


                <div className="status-item">

                  <div className="status-icon green">
                    <Users size={19} />
                  </div>

                  <div>

                    <span>
                      Passengers
                    </span>

                    <strong>
                      {passengerCount}
                    </strong>

                  </div>

                </div>

              </div>

            </section>



            {/* =========================================
                PASSENGERS
            ========================================== */}

            <section className="passenger-card">

              <div className="passenger-header">

                <div>

                  <span className="section-label">
                    PASSENGER DETAILS
                  </span>

                  <h2>
                    Passenger status
                  </h2>

                </div>


                <div className="passenger-count">

                  <Users size={15} />

                  {passengerCount}

                </div>

              </div>


              <div className="chart-info">

                <Clock3 size={14} />

                {pnrResult.chartStatus}

              </div>


              <div className="table-wrapper">

                <table className="passenger-table">

                  <thead>

                    <tr>

                      <th>
                        Passenger
                      </th>

                      <th>
                        Booking status
                      </th>

                      <th>
                        Current status
                      </th>

                      <th>
                        Coach
                      </th>

                      <th>
                        Berth
                      </th>

                    </tr>

                  </thead>


                  <tbody>

                    {pnrResult.passengerList.map(
                      (passenger) => (

                        <tr
                          key={
                            passenger.passengerSerialNumber
                          }
                        >

                          <td>

                            <div className="passenger-name">

                              <span>
                                {String(
                                  passenger.passengerSerialNumber
                                ).padStart(
                                  2,
                                  "0"
                                )}
                              </span>

                              <strong>
                                Passenger{" "}
                                {
                                  passenger.passengerSerialNumber
                                }
                              </strong>

                            </div>

                          </td>


                          <td>

                            <span className="status-pill gray">
                              {
                                passenger.bookingStatusDetails
                              }
                            </span>

                          </td>


                          <td>

                            <span
                              className={`status-pill ${statusPillClass(
                                passenger.currentStatus
                              )}`}
                            >
                              {
                                passenger.currentStatusDetails
                              }
                            </span>

                          </td>


                          <td>

                            <strong>
                              {
                                passenger.currentCoachId ||
                                "—"
                              }
                            </strong>

                          </td>


                          <td>

                            <strong>
                              {
                                passenger.currentBerthNo ||
                                "—"
                              }
                            </strong>

                          </td>

                        </tr>

                      )
                    )}

                  </tbody>

                </table>

              </div>

            </section>

          </main>



          {/* =============================================
              AI SIDEBAR
          ============================================== */}

          <aside className="ai-sidebar">

            <div className="ai-sidebar-top">

              <div>

                <span className="ai-eyebrow">
                  RAILTRACK AI
                </span>

                <h2>
                  Ticket prediction
                </h2>

                <p>
                  AI-powered insight for your
                  current journey.
                </p>

              </div>


              <div
                className={`ai-status ${
                  aiLoading
                    ? "loading"
                    : aiError
                    ? "error"
                    : "ready"
                }`}
              >

                <span />

                {aiLoading
                  ? "Analyzing"
                  : aiError
                  ? "Unavailable"
                  : "Ready"}

              </div>

            </div>



            {/* AI RECOMMENDATION */}

            <div className="ai-recommendation">

              <div className="ai-sparkle">
                <Sparkles size={19} />
              </div>

              <div>

                <span>
                  Smart recommendation
                </span>

                <p>

                  {aiLoading
                    ? "Analyzing your PNR and preparing a recommendation..."

                    : aiError
                    ? aiError

                    : aiAnalysis?.aiRecommendation ??
                      "AI recommendation will appear here once the analysis is complete."}

                </p>

              </div>

            </div>



            {/* AI METRICS */}

            <div className="ai-metrics">


              <div className="ai-metric">

                <span>
                  Current status
                </span>

                <strong>
                  {aiAnalysis?.currentStatus ??
                    "—"}
                </strong>

              </div>


              <div className="ai-metric">

                <span>
                  Confirmation chance
                </span>

                <strong>
                  {aiAnalysis
                    ? `${aiAnalysis.confirmationChance.toFixed(
                        0
                      )}%`
                    : "—"}
                </strong>

              </div>


              <div className="ai-metric">

                <span>
                  Alternative
                </span>

                <strong>
                  {aiAnalysis
                    ? aiAnalysis.alternativeSuggested
                      ? "Recommended"
                      : "Not needed"
                    : "—"}
                </strong>

              </div>

            </div>



            {/* AI FOOTER */}

            <div className="ai-footer">

              <div className="ai-trust">

                <ShieldCheck size={15} />

                <span>
                  AI insight based on available
                  journey data
                </span>

              </div>


              <button
                type="button"
                className="ai-refresh"
                onClick={() =>
                  pnrResult &&
                  void fetchPnrAiAnalysis(
                    pnrResult,
                    true
                  )
                }
                disabled={aiLoading}
              >

                <RefreshCw
                  size={15}
                  className={ aiLoading ? "rotating": "" }
                />

                {aiLoading
                  ? "Analyzing..."
                  : "Refresh analysis"}

              </button>

            </div>

          </aside>

        </div>

      )}

    </div>
  );
}