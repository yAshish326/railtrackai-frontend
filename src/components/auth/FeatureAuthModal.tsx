import { useEffect } from "react";
import { createPortal } from "react-dom";
import { ShieldCheck, X } from "lucide-react";
import "./FeatureAuthModal.scss";

type FeatureAuthModalProps = {
  open: boolean;
  featureLabel?: string;
  onClose: () => void;
  onSignIn: () => void;
  onRegister: () => void;
};

export default function FeatureAuthModal({
  open,
  featureLabel = "this feature",
  onClose,
  onSignIn,
  onRegister,
}: FeatureAuthModalProps) {
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="feature-auth-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="feature-auth-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="feature-auth-modal">
        <button
          type="button"
          className="modal-close"
          aria-label="Close sign in modal"
          onClick={onClose}
        >
          <X size={20} />
        </button>

        <div className="modal-icon">
          <ShieldCheck size={28} />
        </div>

        <div className="modal-copy">
          <p className="modal-eyebrow">Secure access required</p>
          <h2 id="feature-auth-title">Sign in to continue</h2>
          <p>
            Create a free RailTrack AI account to use {featureLabel} and save your searches.
          </p>
        </div>

        <div className="modal-actions">
          <button type="button" className="modal-button primary" onClick={onSignIn}>
            Sign In
          </button>
          <button type="button" className="modal-button secondary" onClick={onRegister}>
            Register
          </button>
        </div>

        <button type="button" className="modal-ghost" onClick={onClose}>
          Continue exploring
        </button>
      </div>
    </div>,
    document.body,
  );
}
