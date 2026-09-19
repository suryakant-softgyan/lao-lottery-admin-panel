# Admin Panel ↔ Backend Integration — Plan & Status

> Updated after every stage. Legend: ✅ done · 🔄 in progress · ⏳ pending
> Backend plan: [../backend/ACTION_PLAN.md](../backend/ACTION_PLAN.md)

Last updated: 2026-09-18

## Finding that shapes the work

`environment.useMockData` only switches `AuthService` and the generic CRUD methods of `BaseRepository`.
Every domain method (approve, publish, freeze, statistics, timelines, dashboard, reports, …) reads or
mutates the in-memory seed only. So each repository gets a **live implementation behind the same public
API** — components and templates stay untouched, and `useMockData: true` still gives the offline demo.

## Approach

| Concern | Decision |
|---|---|
| Switch | `environment.useMockData = false` for development; mock branch kept for offline demos |
| Dev server | `proxy.conf.json` forwards `/api` and `/ws` to `http://localhost:8080` (no CORS needed) |
| Envelope | New `envelopeInterceptor` unwraps `{success,data}` so repositories keep returning plain models |
| Tenant | `defaultTenantId` → `LAO_NATIONAL` (the backend's tenant code) |
| Paging | `BaseRepository.toHttpParams` emits `sort` + `direction`, `from`/`to`, quick filters as plain params |
| Permissions | Backend codes are translated to the panel's catalogue in one adapter (`permission-map.ts`) |
| Models | Backend DTO → panel model mappers per feature; fields the backend does not have get neutral defaults |
| Real time | Notification bell + live draw over STOMP WebSocket (`/ws`), polling fallback |
| Gaps | Where the panel needs data the backend lacks, a backend endpoint is added (listed below) |

## Stages

### Stage A — Plumbing & authentication
- ✅ `proxy.conf.json`, `angular.json` serve option, environment flag + tenant id
- ✅ Envelope interceptor, error interceptor mapping of backend error body (`code`, `fieldErrors`, `traceId`)
- ✅ `BaseRepository` live paging params + `liveList` / `liveGet` helpers
- ✅ Permission code translation (backend → panel catalogue)
- ✅ `AuthService` live: login, MFA, resend, forgot/reset (OTP), change password, refresh, logout, `/auth/me`
- ✅ Login screen: real demo accounts

### Stage B — Users, roles, permissions
- ✅ `UserRepository` live (list, CRUD, status, KYC, reset password, login/device history, activity, timeline, stats, roles, permission matrix)

### Stage C — Lottery, draws, tickets
- ✅ `LotteryRepository` · ✅ `DrawRepository` (full maker-checker lifecycle) · ✅ `TicketRepository` (browser check in Stage H)

### Stage D — Wallet & payments
- ✅ `WalletRepository` (accounts, ledger, freeze, transfer → approval queue, settlements) · ✅ `PaymentRepository` (transactions, gateways, banks, refunds, reconciliation) — browser check in Stage H

### Stage E — Agents & retailers
- ✅ `AgentRepository` · ✅ `RetailerRepository` (+ POS devices, coverage map) — browser check in Stage H

### Stage F — Notifications & audit
- ✅ `NotificationRepository` (templates, segments, campaigns) · ✅ `AuditRepository` — inbox follows in Stage G

### Stage G — Dashboard, reports, search, settings, real time
- ✅ `DashboardService` (+ live sidebar badges, footer / about health) · ✅ `ReportService` · ✅ `GlobalSearchService`
- ✅ `NotificationCentreService` over STOMP WebSocket (REST inbox + live push, polling fallback) · ✅ Feature flags, general / financial / notification settings, branding, regional, theme and dashboard layout synced to the server (`RemoteConfigService`) · ✅ Profile login history / devices

### Stage H — Verification
- ✅ `tsc` + `ng build --configuration production` clean · ✅ backend `mvn verify` green (16 tests, Flyway V2 included)
- ✅ Browser walk-through as `admin` against PostgreSQL + Redis: 40 screens opened with no failed API call — dashboard, users (list, roles, permission matrix, verification), lottery, draws (all, schedule, live studio, results), tickets (all, winning), wallet (accounts, transactions, transfer, settlement), payments (transactions, gateways, banks, refunds, reconciliation), agents (list, approvals, commission, performance), retailers (list, devices, coverage map), notifications (centre, templates, segments, campaigns), audit, reports (centre + sales report), settings, profile
- ✅ Write path proven in the UI: operator recorded a result through the API → the admin's bell updated live over the WebSocket → admin **verified** and **published** the draw from *Results & Verification* (status Published, winning number shown)
- ✅ Docs updated

## Backend additions made for the panel
- `POST /auth/forgot-password` with `channel=EMAIL` now e-mails a one-time reset **link** (`/auth/reset-password?token=…`), and `POST /auth/reset-password` accepts that token without an OTP code — matches the panel's reset screen. In dev the link is printed in the backend log (dummy e-mail).
- `GET /admin/stats/lotteries`, `/draws`, `/tickets` — sums behind the header cards.
- `status=A,B` multi-value filter on `/admin/tickets` and `/admin/draws`.
- `POST /admin/draws/{id}/verify`: `winningNumber` is now optional (sign-off only) because the panel's verify dialog has no re-key field.
- `GET /admin/stats/wallets`, `/payments` · `POST /admin/wallets/transfer` (approval type `WALLET_TRANSFER`) · `PATCH /admin/payments/gateways/{id}/status` · `PATCH /admin/payments/banks/{id}/active` · `POST /admin/payments/transactions/{id}/reconcile`.
- `GET /admin/stats/network`, `/audit` · POS device `qrCode` (Flyway V2) + `POST /admin/pos-devices/{id}/qr` · forced activation through the status endpoint.
- `StaffNotifier`: inbox + WebSocket push to every staff user holding the permission needed to act.
- Dashboard overview: `salesByProvince`, `latestTransactions`; pending counters: `liveDraws`, `failedPaymentsToday`.
- `PUT /admin/feature-flags/{key}` and `PUT /admin/settings` now upsert panel-owned keys (`panel.*`).

## Known gaps / not wired
- **Approvals queue has no screen.** Wallet transfers / adjustments are correctly parked for a second person, but the panel has no page to review them (`GET /admin/approvals`, `POST /admin/approvals/{id}/review`). Until one is added they can only be approved through the API / Swagger. *Recommended next UI task.*
- **Blind re-key on draw verification** is not enforced from the panel (its dialog has no number field), so the API accepts a sign-off without the number. The maker-checker identity rule (verifier ≠ operator) is still enforced.
- **Draw result entry:** the API stores one drawn number and derives every tier; the live studio's per-tier inputs are reduced to the longest number entered.
- **Commission:** one override rate per agent (panel model allows many rules per lottery type); only the first rule is saved.
- **Not available from the API, shown as neutral defaults:** agent targets / ranking trend, retailer rating, POS IMEI and per-device sales, gateway average response time, CPU / memory / disk gauges, campaign open counts, geo-location of logins.
- **Advanced filter builder:** only `eq` criteria are applied server side. Report filters by product / province / agent are not applied by the API yet.
- **Campaign pause** and **ticket "void" as a separate state** do not exist on the API (void = cancel + refund).
- Only the `admin` role was walked through in the browser; other roles rely on the permission translation table in `core/authentication/permission-map.ts` — review it with the business before go-live.

## Change log
| Date | Change |
|---|---|
| 2026-09-18 | Plan created after analysing the panel's data layer |
| 2026-09-18 | **Stage A done** — proxy, live environment, envelope + error interceptors, base repository live helpers, permission translation, live auth (login, MFA, refresh, logout, reset link), live demo credentials on the login screen. Type-check clean |
| 2026-09-18 | **Stage B done** — users, roles, permission matrix, KYC, history and audit timeline are live. Verified in the browser: live login as `admin`, Users page lists the 11 real accounts with live counters. Environment notes: backend moved to port **8090** (8080 is Zookeeper on this machine), CORS now accepts any `localhost` port in dev |
| 2026-09-18 | **Stage C done** — lottery (with live sales counters), draw lifecycle commands, tickets (validate, cancel, claim, statistics, timelines). Backend: `/admin/stats/{lotteries,draws,tickets}`, comma-separated `status` filters, verify number made optional |
| 2026-09-18 | **Stage D done** — wallets, ledger, freeze/unfreeze, credit limit, transfer (goes to the maker-checker queue), settlements, payments, gateways, banks, refunds, reconciliation |
| 2026-09-18 | **Stage E done** — agents (hierarchy, approval, suspend/block, commission, leaderboard), retailers, POS devices (status, forced activation, QR), province coverage. Backend: Flyway `V2__pos_device_qr.sql`, `/admin/stats/network`, `POST /admin/pos-devices/{id}/qr` |
| 2026-09-18 | **Stage F done** — notification templates, rule-based segments with live sizes, campaigns (launch / cancel), audit log with category tabs and header cards. Backend: `/admin/stats/audit`, multi-value `category` filter |
| 2026-09-18 | **Stage G done** — dashboard, reports, universal search, real-time notification bell, server-backed feature flags and settings, profile. Backend: staff are notified in real time when work is waiting for them (draw to verify / publish, approval, withdrawal, agent or retailer application, prize claim); dashboard overview extended; feature-flag and `panel.*` setting upsert |
| 2026-09-18 | **Stage H done** — found and fixed during the walk-through: CORS rejected the dev origin (now any `localhost` port in dev); wallet ledger `direction` filter collided with the sort direction (API filter renamed to `flow`); drawn number now visible to verifiers before publication. All stages complete |
| 2026-09-19 | Login showed raw HTML "Cannot POST /api/v1/auth/login": the `ng serve` on :4200 had been started before `proxy.conf.json` existed, so the dev server answered the POST itself. Restarted it (proxy now active, verified). The error interceptor now turns an HTML error body into a readable "API could not be reached" message |
| 2026-09-19 | Lottery cards showed the product name in the top-left corner: it was the alt text of an `<img>` with an empty `src` (live products have no banner image yet). Cards now render the image only when a banner URL exists and loads; otherwise a **generated banner** (product colour, rings and one lottery ball per digit) is drawn. Verified in the browser |

## How to run the integrated stack

```bash
cd backend && docker compose up -d      # PostgreSQL :5433, Redis :6379
cd backend && mvn spring-boot:run       # API on http://localhost:8090  (Swagger: /swagger-ui.html)
cd admin-panel && npm start             # http://localhost:4200 — /api and /ws are proxied to :8090
```

Sign in with the **Demo accounts** panel on the login page (`admin`, `operator`, `finance`, `auditor` →
`Demo@12345`; `superadmin` → `Admin@12345`). An `ng serve` started before `proxy.conf.json` existed must be
restarted once. Offline demo without a backend: set `useMockData: true` in `src/environments/environment.ts`.
