import { Navigate, Outlet } from "react-router-dom";

import { useAuthStore } from "../../store/authStore";
import { ROUTES } from "../../utils/constants";

/**
 * Wraps routes that should only be visible to guests
 * (login, register, forgot password, verify otp).
 * If the user is already logged in, redirect them to the dashboard.
 */
export default function PublicRoute() {
  const { isAuthenticated } = useAuthStore();

  if (isAuthenticated) {
    return <Navigate to={ROUTES.DASHBOARD} replace />;
  }

  return <Outlet />;
}
