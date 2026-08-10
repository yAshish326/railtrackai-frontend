import { Link } from "react-router-dom";

import { ROUTES } from "../../utils/constants";

export default function NotFoundPage() {
  return (
    <div className="enterprise-page">
      <div className="enterprise-card" style={{ maxWidth: 560, textAlign: "center" }}>
        <h1>404</h1>
        <h2>Page not found</h2>
        <p>The page you requested is unavailable or has moved.</p>
        <Link to={ROUTES.DASHBOARD} className="btn btn-primary">
          Return to dashboard
        </Link>
      </div>
    </div>
  );
}
