import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";

import NotFoundPage from "../components/common/NotFoundPage";
import ProtectedRoute from "../components/common/ProtectedRoute";
import PublicRoute from "../components/common/PublicRoute";
import DashboardLayout from "../components/layout/DashboardLayout";
import { ROUTES } from "../utils/constants";

const ForgotPasswordPage = lazy(() => import("../pages/auth/ForgotPasswordPage"));
const AiAssistantPage = lazy(() => import("../pages/ai/AiAssistantPage"));
const AiHistoryPage = lazy(() => import("../pages/ai/AiHistoryPage"));
const LoginPage = lazy(() => import("../pages/auth/LoginPage"));
const RegisterPage = lazy(() => import("../pages/auth/RegisterPage"));
const VerifyOtpPage = lazy(() => import("../pages/auth/VerifyOtpPage"));
const LandingPage = lazy(() => import("../pages/landing/LandingPage"));
const DashboardPage = lazy(() => import("../pages/dashboard/DashboardPage"));
const HistoryPage = lazy(() => import("../pages/history/HistoryPage"));
const LiveStationBoardPage = lazy(() => import("../pages/station/LiveStationBoardPage"));
const ProfilePage = lazy(() => import("../pages/profile/ProfilePage"));
const PnrEnquiryPage = lazy(() => import("../pages/pnr/PnrEnquiryPage"));
const SettingsPage = lazy(() => import("../pages/settings/SettingsPage"));
const StationBoardPage = lazy(() => import("../pages/station/StationBoardPage"));
const SearchTrainPage = lazy(() => import("../pages/train/SearchTrainPage"));
const TrainRoutePage = lazy(() => import("../pages/train/TrainRoutePage"));

function RouteFallback() {
  return (
    <div className="app-loading-page">
      <div className="app-loading-content">
        <h1 className="app-loading-title">Railtrack-Ai</h1>
        <div className="app-loading-subtitle">Loading…</div>
        <div className="app-loading-dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>
  );
}

function AppRoutes() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<LandingPage />} />

        <Route element={<PublicRoute />}>
          <Route path={ROUTES.LOGIN} element={<LoginPage />} />
          <Route path={ROUTES.REGISTER} element={<RegisterPage />} />
          <Route path={ROUTES.VERIFY_OTP} element={<VerifyOtpPage />} />
          <Route path={ROUTES.FORGOT_PASSWORD} element={<ForgotPasswordPage />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route element={<DashboardLayout />}>
            <Route path={ROUTES.DASHBOARD} element={<DashboardPage />} />
            <Route path={ROUTES.SEARCH_TRAIN} element={<SearchTrainPage />} />
            <Route path={ROUTES.PNR_ENQUIRY} element={<PnrEnquiryPage />} />
            <Route path={ROUTES.LIVE_STATUS} element={<LiveStationBoardPage />} />
            <Route path={ROUTES.STATION_BOARD} element={<StationBoardPage />} />
            <Route path={ROUTES.TRAIN_ROUTE} element={<TrainRoutePage />} />
            <Route path={ROUTES.AI_ASSISTANT} element={<AiAssistantPage />} />
            <Route path={ROUTES.HISTORY} element={<HistoryPage />} />
            <Route path={ROUTES.PROFILE} element={<ProfilePage />} />
            <Route path={ROUTES.SETTINGS} element={<SettingsPage />} />
            <Route path="/ai-history" element={<AiHistoryPage />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}

export default AppRoutes;