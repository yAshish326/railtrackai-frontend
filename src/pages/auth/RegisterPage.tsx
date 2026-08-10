import { useState, useEffect, type FormEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import authService from "../../services/authService";
import { ROUTES } from "../../utils/constants";
import { getApiErrorMessage, getErrorMessage } from "../../utils/helpers";
import { isValidEmail } from "../../utils/validators";

import loginBg from "../../assets/images/login-bg.png";
import "./LoginPage.scss";

export default function RegisterPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = (location.state as { redirectTo?: string } | null)?.redirectTo;

  // Form State
  const [step, setStep] = useState<"DETAILS" | "OTP">("DETAILS");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState("");

  // Resend Timer State
  const [resendTimer, setResendTimer] = useState(0);

  // Status State
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Countdown timer logic for Resend OTP
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  // Step 1: Send OTP (and used for Resend)
  async function handleSendOtp(e?: FormEvent<HTMLFormElement>) {
    if (e) e.preventDefault();
    setError(null);

    if (!fullName.trim()) {
      setError("Please enter your full name.");
      return;
    }

    if (!isValidEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    setLoading(true);

    try {
      await authService.sendRegistrationOtp({
        email: email.trim(),
      });
      setInfo(`An OTP has been sent to ${email}`);
      setStep("OTP");
      setResendTimer(30); // Start 30s cooldown timer
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to send OTP. Please try again."));
    } finally {
      setLoading(false);
    }
  }

  // Step 2: Verify OTP & Register
  async function handleVerifyOtp(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!otp.trim()) {
      setError("Please enter the OTP sent to your email.");
      return;
    }

    if (!password || password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    setLoading(true);

    try {
      // Matches backend body: { email, otpCode, fullName, password }
      await authService.verifyRegistrationOtp({
        email: email.trim(),
        otpCode: otp.trim(),
        fullName: fullName.trim(),
        password,
      });

      navigate(ROUTES.LOGIN, {
        state: {
          message: "Account created successfully! Please log in.",
          redirectTo,
        },
      });
    } catch (err) {
      setError(getErrorMessage(err, "Invalid OTP or registration failed."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="login-page"
      style={{ ["--bg-image" as string]: `url(${loginBg})` } as React.CSSProperties}
    >
      <div className="login-page-overlay" />

      <div className="login-brand">
        <span className="brand-tag">RailTrack AI</span>
        <h2>Track every journey, in real time.</h2>
        <p>Live status, PNR tracking, and AI-powered insights — all in one place.</p>
      </div>

      <div className="login-form-card">
        <h1>Create Account</h1>
        <p className="subtitle">
          {step === "DETAILS" ? "Join RailTrack AI today" : "Enter OTP and set your password"}
        </p>

        {info && <div className="form-info">{info}</div>}
        {error && <div className="form-error">{error}</div>}

        {step === "DETAILS" ? (
          <form onSubmit={handleSendOtp} noValidate>
            <label className="field">
              <span>Full Name</span>
              <input
                type="text"
                placeholder="John Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoComplete="name"
                disabled={loading}
              />
            </label>

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

            <button type="submit" disabled={loading}>
              {loading ? "Sending OTP..." : "Continue"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} noValidate>
            <label className="field">
              <span>OTP Code</span>
              <input
                type="text"
                placeholder="Enter OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                disabled={loading}
              />
            </label>

            <div className="form-links">
              {resendTimer > 0 ? (
                <span style={{ fontSize: "13px", color: "rgba(255, 255, 255, 0.7)" }}>
                  Resend OTP in {resendTimer}s
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => handleSendOtp()}
                  disabled={loading}
                  style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    color: "#fff",
                    textDecoration: "underline",
                    fontSize: "13px",
                    cursor: "pointer",
                    boxShadow: "none",
                    opacity: 0.9,
                    animation: "none",
                  }}
                >
                  Didn't receive OTP? Resend
                </button>
              )}
            </div>

            <label className="field password-field">
              <span>Set Password</span>
              <div className="password-input">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Create a strong password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
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

            <button type="submit" disabled={loading}>
              {loading ? "Verifying..." : "Verify & Complete Registration"}
            </button>
          </form>
        )}

        <p className="switch-auth">
          Already have an account? <Link to={ROUTES.LOGIN} state={{ redirectTo }}>Login</Link>
        </p>
      </div>
    </div>
  );
}