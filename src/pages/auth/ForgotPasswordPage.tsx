import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

import authService from "../../services/authService";
import { ROUTES } from "../../utils/constants";
import { getErrorMessage } from "../../utils/helpers";
import { isValidEmail, isValidOtp } from "../../utils/validators";

import loginBg from "../../assets/images/login-bg.png";
import "./LoginPage.scss";

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (!isValidEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (!otpSent) {
      setLoading(true);
      try {
        await authService.forgotPassword({ email: email.trim() });
        setOtpSent(true);
        setInfo("An OTP has been sent to your email. Enter it and choose a new password.");
      } catch (err) {
        setError(getErrorMessage(err, "Failed to send OTP. Please try again."));
      } finally {
        setLoading(false);
      }

      return;
    }

    if (!isValidOtp(otp)) {
      setError("Please enter the OTP sent to your email.");
      return;
    }

    if (!newPassword.trim() || newPassword.trim().length < 6) {
      setError("Please enter a valid new password with at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      await authService.verifyPasswordOtp({
        email: email.trim(),
        otpCode: otp.trim(),
      });

      await authService.resetPassword({
        email: email.trim(),
        otpCode: otp.trim(),
        newPassword: newPassword.trim(),
      });

      setInfo("Your password has been changed successfully.");
      setEmail("");
      setOtp("");
      setNewPassword("");
      setOtpSent(false);

      navigate(ROUTES.LOGIN, {
        replace: true,
        state: { message: "Password reset successful. Please login again." },
      });
    } catch (err) {
      setError(getErrorMessage(err, "Failed to reset your password. Please try again."));
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
        <h1>Forgot Password?</h1>
        <p className="subtitle">
          {otpSent ? "Verify the OTP and set a new password" : "Enter your email address to receive OTP"}
        </p>

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
              disabled={loading || otpSent}
            />
          </label>

          {otpSent && (
            <>
              <label className="field">
                <span>OTP Code</span>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="Enter OTP"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  disabled={loading}
                  maxLength={6}
                />
              </label>
              <label className="field">
                <span>New Password</span>
                <input
                  type="password"
                  placeholder="Create new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={loading}
                />
              </label>
            </>
          )}

          <button type="submit" disabled={loading}>
            {loading ? (otpSent ? "Resetting..." : "Sending...") : (otpSent ? "Reset Password" : "Send OTP")}
          </button>

          <p className="switch-auth">
            Remembered your password? <Link to={ROUTES.LOGIN}>Login</Link>
          </p>
        </form>
      </div>
    </div>
  );
}