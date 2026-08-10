import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Clock3, Search, Trash2 } from "lucide-react";

import { historyService } from "../../services/historyService";
import { ROUTES } from "../../utils/constants";
import type { HistoryRecord, HistoryType } from "../../types/History";
import { formatDateTime, formatCompactTime } from "../../utils/helpers";

import "./HistoryPage.scss";

const HISTORY_TABS: Array<{ type: HistoryType; label: string }> = [
  { type: "PNR", label: "PNR" },
  { type: "TRAIN", label: "Train" },
  { type: "STATION", label: "Station" },
  { type: "LIVE", label: "Live" },
  { type: "AI", label: "AI" },
  { type: "ROUTE", label: "Route" },
];

function quickReopen(record: HistoryRecord, navigate: ReturnType<typeof useNavigate>) {
  switch (record.searchType) {
    case "PNR":
      navigate(ROUTES.PNR_ENQUIRY, { state: { pnrNumber: String(record.parameters.pnrNumber ?? "") } });
      return;
    case "TRAIN":
      navigate(ROUTES.SEARCH_TRAIN, {
        state: {
          fromStation: String(record.parameters.from ?? ""),
          toStation: String(record.parameters.to ?? ""),
          date: String(record.parameters.date ?? ""),
        },
      });
      return;
    case "STATION":
      navigate(ROUTES.STATION_BOARD, { state: { stationCode: String(record.parameters.stationCode ?? "") } });
      return;
    case "LIVE":
      navigate(ROUTES.LIVE_STATUS, { state: { trainNumber: String(record.parameters.trainNumber ?? "") } });
      return;
    case "ROUTE":
      navigate(ROUTES.TRAIN_ROUTE, { state: { trainNumber: String(record.parameters.trainNumber ?? "") } });
      return;
    case "AI":
      navigate(ROUTES.AI_ASSISTANT, { state: { conversationId: String(record.parameters.conversationId ?? "") } });
      return;
  }
}

interface HistoryPageProps {
  initialType?: HistoryType;
}

export default function HistoryPage({ initialType }: HistoryPageProps) {
  const navigate = useNavigate();
  const [activeType, setActiveType] = useState<HistoryType | "ALL">(initialType ?? "ALL");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [page, setPage] = useState(1);

  const records = useMemo(
    () => historyService.list({ query, sort, type: activeType === "ALL" ? undefined : activeType }),
    [activeType, query, sort],
  );

  const pageSize = 8;
  const totalPages = Math.max(1, Math.ceil(records.length / pageSize));
  const paginated = records.slice((page - 1) * pageSize, page * pageSize);

  function handleDelete(id: string) {
    historyService.remove(id);
    setPage(1);
    setQuery((current) => current);
  }

  function handleClearAll() {
    if (window.confirm("Clear all saved history?")) {
      historyService.clearAll();
      setPage(1);
    }
  }

  return (
    <div className="enterprise-page history-page">
      <header className="enterprise-header">
        <div>
          <span className="eyebrow">Audit trail</span>
          <h1>Search History</h1>
          <p>Filter, sort, reopen, or delete past searches from a single place.</p>
        </div>

        <button type="button" className="btn btn-secondary" onClick={handleClearAll}>
          <Trash2 size={16} /> Clear All
        </button>
      </header>

      <section className="enterprise-card history-toolbar">
        <div className="history-tabs">
          <button className={`history-tab ${activeType === "ALL" ? "active" : ""}`} onClick={() => setActiveType("ALL")} type="button">All</button>
          {HISTORY_TABS.map((tab) => (
            <button key={tab.type} className={`history-tab ${activeType === tab.type ? "active" : ""}`} onClick={() => setActiveType(tab.type)} type="button">
              {tab.label}
            </button>
          ))}
        </div>

        <div className="toolbar-grid history-controls">
          <label className="field">
            <span>Search</span>
            <input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder="Filter by keyword, parameter, or type" />
          </label>

          <label className="field">
            <span>Sort</span>
            <select value={sort} onChange={(e) => setSort(e.target.value as "newest" | "oldest")}> 
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
            </select>
          </label>
        </div>
      </section>

      <section className="enterprise-card history-list-panel">
        <div className="card-title-row space-between">
          <div className="card-title-row">
            <Clock3 size={18} />
            <h3>{records.length} result(s)</h3>
          </div>
          <span className="meta-chip">Page {page} of {totalPages}</span>
        </div>

        <div className="history-list">
          {paginated.length === 0 ? (
            <div className="empty-panel compact">
              <Search size={28} />
              <p>No history entries match your filter.</p>
            </div>
          ) : (
            paginated.map((record) => (
              <article key={record.id} className="history-item">
                <div className="history-item-head">
                  <div>
                    <strong>{record.searchType}</strong>
                    <p>{record.responseSummary}</p>
                  </div>
                  <span>{formatCompactTime(record.timestamp)}</span>
                </div>

                <div className="history-parameters">
                  {Object.entries(record.parameters).map(([key, value]) => (
                    <span key={key} className="meta-chip">
                      {key}: {String(value)}
                    </span>
                  ))}
                </div>

                <div className="history-item-footer">
                  <span>{formatDateTime(record.timestamp)}</span>
                  <div className="history-actions">
                    <button type="button" className="btn btn-secondary" onClick={() => quickReopen(record, navigate)}>
                      Reopen
                    </button>
                    <button type="button" className="icon-btn danger" onClick={() => handleDelete(record.id)}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>

        <div className="pagination-row">
          <button type="button" className="btn btn-secondary" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
            Previous
          </button>
          <button type="button" className="btn btn-secondary" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>
            Next
          </button>
        </div>
      </section>
    </div>
  );
}