import { useEffect, useState } from "react";
import { Clock3, Trash2 } from "lucide-react";

import aiService from "../../services/aiService";
import type { AiHistoryRecord } from "../../types/Ai";
import { getApiErrorMessage, formatDateTime } from "../../utils/helpers";

import "../history/HistoryPage.scss";

export default function AiHistoryPage() {
  const [records, setRecords] = useState<AiHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | number | null>(null);

  async function loadHistory() {
    setLoading(true);
    setError(null);
    try {
      const response = await aiService.getHistory();
      const payload = response.data as AiHistoryRecord[] | { data?: AiHistoryRecord[] };
      setRecords(Array.isArray(payload) ? payload : payload.data ?? []);
    } catch (err) {
      setError(getApiErrorMessage(err, "AI history is temporarily unavailable."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadHistory();
  }, []);

  async function deleteItem(historyId: string | number) {
    if (!window.confirm("Delete this AI history item?")) return;
    setDeletingId(historyId);
    try {
      await aiService.deleteHistoryItem(historyId);
      await loadHistory();
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not delete this history item."));
    } finally {
      setDeletingId(null);
    }
  }

  async function clearHistory() {
    if (!window.confirm("Clear all AI history?")) return;
    try {
      await aiService.clearHistory();
      await loadHistory();
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not clear AI history."));
    }
  }

  return (
    <div className="enterprise-page history-page">
      <header className="enterprise-header">
        <div>
          <span className="eyebrow">RailTrack AI</span>
          <h1>AI History</h1>
          <p>Review analyses saved by the AI service.</p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={() => void clearHistory()} disabled={loading || records.length === 0}>
          <Trash2 size={16} /> Clear All
        </button>
      </header>

      {error ? <div className="search-error">{error}</div> : null}

      <section className="enterprise-card history-list-panel">
        <div className="card-title-row">
          <Clock3 size={18} />
          <h3>{loading ? "Loading history..." : `${records.length} result(s)`}</h3>
        </div>

        <div className="history-list">
          {!loading && records.length === 0 ? (
            <div className="empty-panel compact"><p>No AI history entries yet.</p></div>
          ) : records.map((record) => (
            <article key={record.id} className="history-item">
              <div className="history-item-head">
                <div>
                  <strong>{record.searchType || "AI"}</strong>
                  <p>{record.responseSummary || "AI analysis"}</p>
                </div>
                <span>{formatDateTime(record.timestamp)}</span>
              </div>
              <div className="history-item-footer">
                <span>{record.id}</span>
                <button type="button" className="icon-btn danger" onClick={() => void deleteItem(record.id)} disabled={deletingId === record.id} aria-label="Delete history item">
                  <Trash2 size={16} />
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}