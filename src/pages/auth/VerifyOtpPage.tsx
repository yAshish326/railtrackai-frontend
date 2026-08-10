import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import authService from "../../services/authService";
import { ROUTES } from "../../utils/constants";
import { getApiErrorMessage, getErrorMessage } from "../../utils/helpers";
import { isValidOtp } from "../../utils/validators";

import "./VerifyOtpPage.scss";

interface VerifyOtpLocationState {
  fullName: string;
  email: string;
  password: string;
}

export default function VerifyOtpPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as VerifyOtpLocationState | null;

  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  if (!state?.email || !state?.fullName || !state?.password) {
    return (
      <div className="verify-otp-page">
        <div className="verify-otp-card">
          <h1>Verify OTP</h1>
          <p className="form-error">
            We couldn&apos;t find your registration details. Please register again.
          </p>
          <Link to={ROUTES.REGISTER} className="back-link">
            Back to Register
          </Link>
        </div>
      </div>
    );
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (!isValidOtp(otp)) {
      setError("Please enter the OTP sent to your email.");
      return;
    }

    setLoading(true);

    try {
      await authService.verifyRegistrationOtp({
        fullName: state!.fullName,
        email: state!.email,
        otpCode: otp.trim(),
        password: state!.password,
      });

      navigate(ROUTES.LOGIN, {
        replace: true,
        state: { message: "Account created successfully. Please login." },
      });
    } catch (err) {
      setError(getErrorMessage(err, "Invalid or expired OTP. Please try again."));
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setError(null);
    setInfo(null);
    setResending(true);

    try {
      await authService.sendRegistrationOtp({
        email: state!.email,
      });
      setInfo("A new OTP has been sent to your email.");
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not resend OTP. Please try again."));
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="verify-otp-page">
      <div className="verify-otp-card">
        <h1>Verify OTP</h1>
        <p className="subtitle">
          Enter the code sent to <strong>{state.email}</strong>
        </p>

        <form onSubmit={handleSubmit} noValidate>
          {error && <div className="form-error">{error}</div>}
          {info && <div className="form-info">{info}</div>}

          <input
            type="text"
            inputMode="numeric"
            placeholder="Enter OTP"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            disabled={loading}
            maxLength={6}
          />

          <button type="submit" disabled={loading}>
            {loading ? "Verifying..." : "Verify & Create Account"}
          </button>

          <button
            type="button"
            className="resend-btn"
            onClick={handleResend}
            disabled={resending || loading}
          >
            {resending ? "Resending..." : "Resend OTP"}
          </button>
        </form>
      </div>
    </div>
  );
}
