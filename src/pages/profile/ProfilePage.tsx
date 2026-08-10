import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, KeyRound, LogOut, Mail, Save, UserRound } from "lucide-react";

import profileService from "../../services/profileService";
import { authStore, useAuthStore } from "../../store/authStore";
import { ROUTES } from "../../utils/constants";
import type { ProfileData } from "../../types/Profile";
import { getApiErrorMessage } from "../../utils/helpers";

import "./ProfilePage.scss";

function normalizeProfilePayload(payload: unknown): ProfileData | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const raw = payload as Record<string, unknown>;
  const candidate = raw.data ?? raw.profile ?? raw.user ?? raw.result ?? raw.payload ?? raw;

  if (!candidate || typeof candidate !== "object") {
    return null;
  }

  const profile = candidate as Partial<ProfileData>;

  if (!profile.fullName && typeof raw.fullName === "string") {
    profile.fullName = raw.fullName;
  }

  if (!profile.email && typeof raw.email === "string") {
    profile.email = raw.email;
  }

  if (!profile.role && typeof raw.role === "string") {
    profile.role = raw.role;
  }

  if (!profile.fullName || !profile.email) {
    return null;
  }

  return {
    id: profile.id,
    avatarUrl: profile.avatarUrl,
    fullName: String(profile.fullName),
    email: String(profile.email),
    phone: profile.phone,
    gender: profile.gender,
    dateOfBirth: profile.dateOfBirth,
    address: profile.address,
    role: String(profile.role ?? "USER"),
    memberSince: profile.memberSince,
    accountStatus: profile.accountStatus,
    lastLogin: profile.lastLogin,
    lastSearch: profile.lastSearch,
    lastAiConversation: profile.lastAiConversation,
    stats: profile.stats,
    recentActivity: profile.recentActivity,
  };
}

export default function ProfilePage() {
  const { user } = useAuthStore();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [fullName, setFullName] = useState(user?.fullName ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  useEffect(() => {
    async function loadProfile() {
      try {
        const response = await profileService.getProfile();
        const payload = normalizeProfilePayload(response.data);

        if (!payload) {
          throw new Error("Invalid profile payload");
        }

        setProfile(payload);
        setFullName(payload.fullName);
        setEmail(payload.email);
      } catch (err) {
        setError(getApiErrorMessage(err, "Unable to load your profile right now."));
      } finally {
        setLoading(false);
      }
    }

    void loadProfile();
  }, []);

  async function handleSaveProfile() {
    setSaving(true);
    setError(null);
    try {
      const response = await profileService.updateProfile({ fullName, email });
      const nextProfile = normalizeProfilePayload(response.data);

      if (!nextProfile) {
        throw new Error("Invalid profile payload");
      }

      setProfile(nextProfile);
      if (user) {
        authStore.updateUser({
          ...user,
          fullName: nextProfile.fullName,
          email: nextProfile.email,
          role: nextProfile.role,
        });
      }
    } catch (err) {
      setError(getApiErrorMessage(err, "Unable to update your profile."));
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword(): Promise<boolean> {
    setPasswordSaving(true);
    setError(null);
    try {
      await profileService.changePassword({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      return true;
    } catch (err) {
      setError(getApiErrorMessage(err, "Unable to change your password."));
      return false;
    } finally {
      setPasswordSaving(false);
    }
  }

  async function handleDeleteAccount() {
    if (!window.confirm("Delete your account? This cannot be undone.")) return;
    await profileService.deleteAccount().catch(() => undefined);
    authStore.logout();
    window.location.replace(ROUTES.LANDING);
  }

  const visibleProfile = useMemo<ProfileData>(() => {
    return profile ?? {
      id: user?.id,
      fullName: user?.fullName ?? "User",
      email: user?.email ?? "",
      role: user?.role ?? "USER",
    };
  }, [profile, user]);

  const initials = (visibleProfile.fullName ?? "User")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((value) => value[0]?.toUpperCase() ?? "")
    .join("");

  function handleProfileLogout() {
    authStore.logout();
    window.location.replace(ROUTES.LANDING);
  }

  return (
    <div className="enterprise-page profile-page">
      <header className="enterprise-header">
        <div>
          <span className="eyebrow">Account</span>
          <h1>Profile</h1>
          <p className="page-subtitle">Your account details and security settings</p>
        </div>

        <button type="button" className="btn btn-secondary" onClick={handleProfileLogout}>
          <LogOut size={16} /> Logout
        </button>
      </header>

      {error && (
        <section className="error-banner enterprise-card">
          <AlertTriangle size={18} />
          <div>
            <strong>Profile error</strong>
            <p>{error}</p>
          </div>
        </section>
      )}

      {loading && (
        <section className="enterprise-card skeleton-grid">
          {Array.from({ length: 3 }).map((_, index) => <div key={index} className="skeleton-card" />)}
        </section>
      )}

      <section className="profile-layout">
        <article className="enterprise-card profile-summary-panel">
          <div className="profile-summary-head">
            <div className="profile-avatar">
              <span>{initials || "RA"}</span>
            </div>
            <div className="profile-summary-copy">
              <div className="profile-name-row">
                <h2>{visibleProfile.fullName}</h2>
                <span className="status-pill status-live">Active</span>
              </div>
              <p className="email-copy">
                <Mail size={14} />
                <span>{visibleProfile.email}</span>
              </p>
              <div className="profile-role-row">
                <span className="meta-chip role-chip">{visibleProfile.role}</span>
              </div>
            </div>
          </div>

          <div className="profile-summary-divider" />

          <div className="profile-summary-stats">
            <div>
              <span className="stat-label">Member</span>
              <strong>RailTrack</strong>
            </div>
            <div>
              <span className="stat-label">Access</span>
              <strong>{visibleProfile.role}</strong>
            </div>
            <div>
              <span className="stat-label">Status</span>
              <strong>Verified</strong>
            </div>
          </div>

          <div className="profile-summary-actions">
            <button type="button" className="btn btn-secondary danger" onClick={handleDeleteAccount}>
              <AlertTriangle size={16} /> Delete Account
            </button>
          </div>
        </article>

        <article className="enterprise-card profile-details-panel">
          <div className="card-title-row profile-card-header">
            <div className="title-with-icon">
              <UserRound size={18} />
              <h3>Profile details</h3>
            </div>
            <span className="text-muted">Personal information</span>
          </div>
          <div className="profile-field-group">
            <label className="profile-field">
              <span>Full name</span>
              <input value={fullName} onChange={(event) => setFullName(event.target.value)} />
            </label>
            <label className="profile-field">
              <span>Email address</span>
              <input value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
          </div>
          <div className="profile-details-actions">
            <button type="button" className="btn btn-primary" onClick={handleSaveProfile} disabled={saving}>
              <Save size={16} /> {saving ? "Saving..." : "Save changes"}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setPasswordModalOpen(true)}>
              <KeyRound size={16} /> Change password
            </button>
          </div>
        </article>
      </section>

      {passwordModalOpen && (
        <div className="profile-modal-backdrop">
          <div className="profile-modal-card">
            <div className="profile-modal-top">
              <div>
                <span className="eyebrow">Security</span>
                <h2>Change password</h2>
              </div>
              <button type="button" className="icon-btn" onClick={() => setPasswordModalOpen(false)} aria-label="Close password modal">
                ×
              </button>
            </div>

            <div className="profile-field-group modal-form">
              <label className="profile-field">
                <span>Current password</span>
                <input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
              </label>
              <label className="profile-field">
                <span>New password</span>
                <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
              </label>
            </div>

            <div className="profile-modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setPasswordModalOpen(false)}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={async () => {
                const changed = await handleChangePassword();
                if (changed) {
                  setPasswordModalOpen(false);
                }
              }} disabled={passwordSaving}>
                <KeyRound size={16} /> {passwordSaving ? "Updating..." : "Update password"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}