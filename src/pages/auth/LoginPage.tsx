import { useState, type FormEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import authService from "../../services/authService";
import type { LoginResponse } from "../../types/Auth";
import { authStore } from "../../store/authStore";
import { ROUTES } from "../../utils/constants";
import { getErrorMessage } from "../../utils/helpers";
import { isValidEmail } from "../../utils/validators";

import loginBg from "../../assets/images/login-bg.png";
import "./LoginPage.scss";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as { redirectTo?: string; message?: string; fromStation?: string; toStation?: string; date?: string } | null;
  const redirectTo = locationState?.redirectTo ?? ROUTES.DASHBOARD;
  const successMessage = locationState?.message ?? null;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(successMessage ?? null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (!isValidEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (!password) {
      setError("Please enter your password.");
      return;
    }

    setLoading(true);

    try {
      const res = await authService.login({ email: email.trim(), password });
      const data = res.data as LoginResponse;

      authStore.login(data.token, data.user);
      const redirectState = redirectTo === ROUTES.SEARCH_TRAIN ? {
        fromStation: locationState?.fromStation,
        toStation: locationState?.toStation,
        date: locationState?.date,
      } : undefined;
      navigate(redirectTo, { replace: true, state: redirectState });
    } catch (err) {
      setError(getErrorMessage(err, "Invalid email or password. Please try again."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page" style={{ ["--bg-image" as string]: `url(${loginBg})` } as React.CSSProperties}>
      <div className="login-page-overlay" />

      <div className="login-brand">
        <span className="brand-tag">RailTrack AI</span>
        <h2>Track every journey, in real time.</h2>
        <p>Live status, PNR tracking, and AI-powered insights — all in one place.</p>
      </div>

      <div className="login-form-card">
        <h1>Welcome back</h1>
        <p className="subtitle">Login to continue to RailTrack AI</p>

        <form onSubmit={handleSubmit} noValidate>
          {info && <div className="form-info">{info}</div>}
          {error && <div className="form-error">{error}</div>}

          <label className="field">
            <span>Email</span>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              disabled={loading}
            />
          </label>

          <label className="field password-field">
            <span>Password</span>
            <div className="password-input">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                disabled={loading}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                disabled={loading}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>

          <div className="form-links">
            <Link to={ROUTES.FORGOT_PASSWORD}>Forgot password?</Link>
          </div>

          <button type="submit" className="submit-button" disabled={loading}>
            {loading ? "Logging in..." : "Login"}
          </button>

          <p className="switch-auth">
            Don&apos;t have an account? <Link to={ROUTES.REGISTER} state={{ redirectTo: redirectTo, fromStation: locationState?.fromStation, toStation: locationState?.toStation, date: locationState?.date }}>Register</Link>
          </p>
        </form>
      </div>
    </div>
  );
}