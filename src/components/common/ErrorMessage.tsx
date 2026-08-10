interface ErrorMessageProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export default function ErrorMessage({ title = "Something went wrong", message, onRetry }: ErrorMessageProps) {
  return (
    <div className="enterprise-page">
      <div className="enterprise-card" role="alert" style={{ maxWidth: 560, display: "grid", gap: 10 }}>
        <h2>{title}</h2>
        <p className="muted-copy">{message ?? "Please try again in a moment."}</p>
        {onRetry ? (
          <button type="button" className="btn btn-primary" onClick={onRetry}>
            Try again
          </button>
        ) : null}
      </div>
    </div>
  );
}
