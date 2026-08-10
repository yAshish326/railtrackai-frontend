# RailTrack AI

RailTrack AI is a polished React + TypeScript frontend for modern Indian train travel planning. The app supports authenticated journeys, train search, live train / station status, PNR enquiry, AI assistance, and history tracking.

This README explains the main user flows, the backend API mapping, the data shape for each service, and how the app is organized.

## What the app does

RailTrack AI is built around three main user experiences:

1. **Authentication flow**
   - Login, registration, OTP verification, forgot password, and reset password.
2. **Railway tools**
   - Train search between stations, route details, live train status, station boards, and PNR enquiry.
3. **AI and history**
   - AI assistant chat, train analysis recommendations, and local search history.

## Project flow

### User journey

- A guest lands on `/login`, `/register`, `/forgot-password`, or `/verify-otp`.
- After login, they are routed into the protected dashboard layout.
- Inside the dashboard, they can quickly move to search trains, check PNR status, view live status, browse station boards, use the AI assistant, or inspect past history.
- Protected routes are guarded by `src/components/common/ProtectedRoute.tsx`.
- Public auth routes are guarded by `src/components/common/PublicRoute.tsx`.

### Routing

Main protected pages:

- `/dashboard` → Dashboard overview
- `/search-train` → Train search with AI insight panel
- `/pnr-enquiry` → PNR status lookup
- `/live-status` → Live train status
- `/station-board` → Station departure board
- `/train-route` → Train route detail view
- `/ai-assistant` → AI chat assistant
- `/history` → Search and AI history
- `/profile` → User profile management
- `/settings` → App settings

### Data flow

- The app uses a centralized Axios client in `src/services/api.ts`.
- `ApiService` handles auth headers, retry logic, error redirect on 401, and request caching for duplicate GETs.
- Most page components call a service method and render the returned response data.
- Search history is stored locally in the browser using `src/services/historyService.ts`.
- Settings and theme state are also saved locally via `src/services/settingsService.ts`.

## API mapping

The app connects to a backend API under a single base URL configured by `VITE_API_BASE_URL`.

### Auth APIs (`src/services/authService.ts`)

| Frontend method | Endpoint | Request payload | Notes |
|---|---|---|---|
| `login` | `POST /auth/login` | `{ email, password }` | Returns auth token and user info |
| `sendRegistrationOtp` | `POST /auth/register/send-otp` | `{ email, fullName? }` | Sends registration OTP |
| `verifyRegistrationOtp` | `POST /auth/register/verify` | `{ email, otpCode, fullName, password }` | Completes registration |
| `forgotPassword` | `POST /auth/password/forgot` | `{ email }` | Sends password reset OTP |
| `verifyPasswordOtp` | `POST /auth/password/verify` | `{ email, otpCode }` | Verifies password reset OTP |
| `resetPassword` | `POST /auth/password/reset` | `{ email, otpCode, newPassword }` | Updates user password |

### Train APIs (`src/services/trainService.ts`)

| Frontend method | Endpoint | Query params | Response model |
|---|---|---|---|
| `searchBetweenStations` | `GET /train/between-stations` | `from`, `to`, `date` | `SearchTrainResponse` |
| `getRouteDetails` | `GET /train/route/:trainNumber` | URL path | `TrainRouteResponse` |
| `getLiveStatus` | `GET /train/live/:trainNumber` | optional `date` | `{ success: boolean; data: unknown }` |

### PNR APIs (`src/services/pnrService.ts`)

| Frontend method | Endpoint | Response model |
|---|---|---|
| `checkPnr` | `GET /pnr/:pnrNumber` | `PnrResponse` |

### AI APIs (`src/services/aiService.ts`)

| Frontend method | Endpoint | Request payload | Response model |
|---|---|---|---|
| `sendMessage` | `POST /ai/assistant/chat` | `{ message }` | `AiChatResponse` |
| `getLimit` | `GET /ai/assistant/limit` | none | `AiLimitSummary` |
| `analyzeTrains` | `POST /ai/analyze-trains` | array of simplified train objects | backend analysis result |

### Dashboard API (`src/services/dashboardService.ts`)

| Frontend method | Endpoint | Response model |
|---|---|---|
| `getSummary` | `GET /user/dashboard-summary` | backend dashboard summary object |

### Profile APIs (`src/services/profileService.ts`)

| Frontend method | Endpoint | Payload | Response model |
|---|---|---|---|
| `getProfile` | `GET /users/profile` | none | `ProfileResponse` |
| `updateProfile` | `PUT /users/profile` | `{ fullName, email }` | `ProfileResponse` |
| `changePassword` | `PUT /users/password` | `{ currentPassword, newPassword }` | `{ message }` |
| `logoutAllDevices` | `POST /users/logout-all-devices` | none | `{ message }` |
| `deleteAccount` | `DELETE /users/account` | none | `{ message }` |

## Response data shapes

### Train search response (`src/types/Train.ts`)

- `source`, `destination`, `totalTrains`
- `trains` list with:
  - `trainNumber`, `trainName`, `trainType`
  - `source`, `destination`, `departure`, `arrival`
  - `duration`, `distanceKm`, `runningDays`, `availableClasses`

### Train route response (`src/types/Route.ts`)

- `trainName`, `trainNumber`, `runningDays`, `distance`
- `stations` array with each stop containing schedule details, platform, geo coordinates, day number, and halt duration

### PNR response (`src/types/Pnr.ts`)

- `pnrNumber`, `trainNumber`, `trainName`, `sourceStation`, `destinationStation`
- journey class, boarding point, date of journey, chart status, fare, distance
- `passengerList` with passenger booking and current status details

### AI data types (`src/types/Ai.ts`)

- AI conversations stored locally using `AiConversation`
- limit summary includes `limit`, `used`, `remaining`, `resetAt`

## Local browser storage

The app stores some state in browser storage instead of sending it to the backend:

- `historyService` stores search history in `localStorage`.
- `settingsService` stores app preferences (themes, notifications, cache settings).
- AI conversations are persisted locally in `localStorage` under `AI_CONVERSATIONS_STORAGE_KEY`.

## Folder structure

```text
src/
  app/              # app entry and root-level bootstrapping
  assets/           # images, fonts, icons, shared styles
  components/       # reusable UI components and layout shells
  config/           # environment constants and runtime config
  pages/            # page views grouped by feature
  routes/           # application route definitions
  services/         # backend API service layer
  store/            # app state helpers and auth store
  types/            # shared TypeScript interfaces
  utils/            # helpers, constants, local storage wrappers
```

## Setup

1. Install dependencies

```bash
npm install
```

2. Create `.env` in the root:

```env
VITE_API_BASE_URL=https://railtrack-ai.onrender.com/api/v1
```

3. Start the dev server

```bash
npm run dev
```

## Build & preview

```bash
npm run build
npm run preview
```

## Notes

- Authentication state is handled in `src/store/authStore.ts` and persisted via storage helpers.
- The Axios client in `src/services/api.ts` automatically attaches bearer tokens and redirects users to login on 401.
- Most pages are lazy-loaded through `src/routes/AppRoutes.tsx` for faster initial load.
- The AI assistant keeps conversations locally so users can continue a chat across refreshes.

## Backend deployment note

The backend is deployed on Render using the free tier, so it will go into idle/shutdown mode after about 10 minutes of inactivity. For that reason, the first request after a period of inactivity can take up to **~2 minutes** while Render wakes the service back up.

> Because the backend is on Render free, the app may feel slow on the first request after a break. Subsequent requests are much faster until the service idles again.
