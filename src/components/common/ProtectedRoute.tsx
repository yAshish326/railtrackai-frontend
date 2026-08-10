import { Navigate, Outlet } from "react-router-dom";

import { useAuthStore } from "../../store/authStore";
import { ROUTES } from "../../utils/constants";

/**
 * Wraps routes that require the user to be logged in.
 * Renders the child route via <Outlet /> when authenticated,
 * otherwise redirects to the login page.
 */
export default function ProtectedRoute() {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} replace />;
  }

  return <Outlet />;
}
