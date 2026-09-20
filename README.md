# Lao National Lottery — Admin Portal

Enterprise administration portal for a national lottery management system, built with
**Angular 20** (standalone components, signals, strict TypeScript), **Angular Material**,
**Angular CDK**, **Chart.js** and **ngx-translate**.

Every screen runs against an in-memory mock data layer today, behind a repository
abstraction that already speaks the REST contract — see [Swapping in a real API](#swapping-in-a-real-api).

> **Status:** `dev/v1` — feature-complete against the product specification, running on
> mock data. No backend yet.

---

## Getting started

```bash
npm install
npm start          # dev server on http://localhost:4200
```

### Demo accounts

The portal ships with seeded accounts so it can be explored without a backend.
Every account uses the password **`Lottery@2026`**.

| Username     | Role          | What it demonstrates                              |
| ------------ | ------------- | ------------------------------------------------- |
| `superadmin` | Super Admin   | Unrestricted access to every module                |
| `admin`      | Administrator | Full operations access, no tenant control          |
| `operator`   | Draw Operator | Draw execution only — **and the OTP login flow**   |
| `finance`    | Finance       | Wallet, payments, settlement and reports           |
| `support`    | Support       | Customer assistance with limited write access      |
| `auditor`    | Auditor       | Read-only across the platform, plus the audit trail |

Signing in as different roles is the quickest way to see RBAC at work — the sidebar,
row actions and route guards all react to the permission set.

### Scripts

| Command                | Purpose                                        |
| ---------------------- | ---------------------------------------------- |
| `npm start`            | Development server with HMR                    |
| `npm run build`        | Production build                               |
| `npm run watch`        | Development build in watch mode                |
| `npm test`             | Unit tests (Karma + Jasmine)                   |
| `npm run format`       | Prettier over `src/**`                         |
| `npm run format:check` | Verify formatting without writing              |

---

## Architecture

Feature-first, clean-architecture layering. The dependency direction is strictly
`features → shared → core`; nothing in `core` imports from `features`.

```
src/app/
├── core/                     # Cross-cutting concerns; imported by everything
│   ├── authentication/       # AuthService, TokenService, SessionService, PermissionService
│   ├── constants/            # Permissions, navigation tree, theme presets, status maps
│   ├── enums/                # Domain enums matching the backend contract
│   ├── guards/               # auth, guest, permission, role, feature-flag, unsaved-changes
│   ├── interceptors/         # api-url, cache, auth, loading, retry, error
│   ├── layout/               # Shell: sidebar, header, footer, command palette, toasts
│   ├── mock/                 # Seeded in-memory dataset (deleted when the API lands)
│   ├── models/               # Interfaces for every domain entity
│   ├── services/             # Theme, layout, navigation, export, search, notifications…
│   └── utilities/            # Formatting, colour maths, query engine, seeded RNG
├── shared/                   # Reusable, feature-agnostic UI
│   ├── base/                 # ListPageBase — the query lifecycle every list screen extends
│   ├── components/           # Data table, dynamic form, charts, cards, states, timeline…
│   ├── dialogs/              # Confirm and generic form dialogs
│   ├── directives/           # *llHasPermission, autofocus, click-outside, column resize
│   ├── pipes/                # Locale-aware currency, date, relative time, masking
│   └── validators/           # Lao phone, strong password, cross-field, date range
└── features/                 # One lazily loaded folder per business module
    ├── auth/  dashboard/  users/  agents/  retailers/  lottery/  draws/
    └── tickets/  wallet/  payment/  notifications/  reports/  audit/  settings/  profile/
```

### Key building blocks

**`BaseRepository<T>`** — every feature repository extends it and gets paging, sorting,
filtering, CRUD and bulk operations for free. It contains the single `environment.useMockData`
branch that decides between the in-memory dataset and HTTP.

**`ListPageBase<T>`** — every list screen extends it and gets the query lifecycle: paging,
sorting, debounced search, quick filters, date range, loading/error state and export.
A concrete page supplies `fetch()` and its columns; nothing else is repeated.

**`DataTable`** — one component covers sorting, pagination, single and bulk selection, row
and bulk actions, column visibility, reordering, resizing, sticky header and columns,
expandable rows, and the loading/empty/error states. Column layout preferences persist per
table, per user.

**`DynamicForm`** — forms are declared as a `FormSchema` rather than hand-written markup, so
validation, layout, error messaging and required markers are identical everywhere. Supports
conditional fields, stepper wizards and a password-strength meter.

---

## Theming

`ThemeService` owns one signal of appearance state and projects it onto CSS custom
properties on `<html>`. **No component contains a hard-coded colour** — everything reads
`var(--ll-*)`, which is what makes the whole portal restyle instantly.

Configurable from **Settings → Appearance**:

- **13 presets** — Corporate Blue, Emerald Green, Royal Purple, Banking Navy, Crimson Red,
  Sunset Orange, Teal, Indigo, Executive Gold, Dark Professional, Midnight Black,
  Glassmorphism, Minimal White
- **Light / dark / auto** (auto follows the OS and switches with it)
- **Colour overrides** per role (primary, secondary, accent, sidebar, header, card, table header)
- **Typography** — six typefaces, font size, line height, letter spacing
- **Density** — comfortable, compact, ultra-compact
- **Shape & elevation** — corner radius, shadow intensity, glass effect
- **Component styles** — 8 button styles, 6 card styles, combinable table styles
- **Layout** — 5 sidebar modes, 4 header modes, 3 content widths, 3 navigation modes, 7 login themes
- **Motion** — full / reduced / none, with speed; the OS reduced-motion preference always wins
- **Accessibility** — high contrast, colour-blind-safe charts (Okabe–Ito), focus indicators,
  large touch targets, screen-reader hints

Appearance can be exported to JSON and imported into another deployment.
**Settings → Branding** covers white labelling: names, logos, imagery, login copy, support
contacts and regional formats (locale, currency, date and time format, first day of week).

---

## Languages

Screens are authored in English. `DomTranslatorService` translates what reaches the DOM — text
nodes, `placeholder` / `title` / `aria-label` attributes, the tab title and chart labels — by
looking each string up in `src/assets/i18n/phrases/<lang>.json`, and restores the English
source when the user switches back. Text that is not in the bundle (names, codes, API data)
stays as it is.

The bundle has exact `phrases`, `templates` for text with embedded values
(`"{1} agent(s) approved"`) and hand-written regex `rawPatterns` / `lastPatterns`; `patterns`
is generated. To pick up new copy:

```bash
node tools/extract-phrases.mjs --missing lo > missing.json   # untranslated copy in the source
# translate it into a { "English": "ລາວ" } map, then:
node tools/merge-phrases.mjs lo translated.json
```

The bundle also carries the backend's status codes (`KYC_PENDING`) and server messages, month
and weekday names (dates are matched by pattern, so number formats stay regional), and is used
by `ExportService` so CSV, Excel, PDF and print output follow the interface language. The
Material date picker takes its locale from `TranslationService.dateLocale`.

Chromium ships no Lao `Intl` data (`lo-LA` silently formats as English), which is why dates
are translated by pattern and why calendars use `AppDateAdapter` (built-in Lao month and weekday
names) instead of the native adapter. Announcements are stored per language on the backend; the
dashboard asks for the current one and reloads when the language changes.

Signing in adopts the language saved on the user's profile unless one was picked on the login
screen in that session; changing language while signed in saves it back (`PUT /me`). The root
component links the two, because `AuthService` and `TranslationService` cannot inject each other.

While Lao is active, `__llMissingPhrases()` in the browser console lists every string on the
visited screens that the bundle lacks. Mark an element `data-no-translate` to opt it out.
Adding a language means adding it to `supportedLanguages`, `LANGUAGES` and a new bundle file.

---

## Security model

- **RBAC** — `PermissionService` is the single authority. Route guards, the `*llHasPermission`
  directive, the navigation filter and table actions all consult it, so access rules exist in
  exactly one place.
- **Session control** — absolute session expiry plus an idle watchdog with a grace countdown.
  Timers run outside Angular's zone so a one-second tick does not trigger change detection.
- **JWT ready** — `TokenService` stores, decodes and refreshes tokens; the auth interceptor
  transparently recovers from a 401 by refreshing once and replaying the queued requests.
- **Four-eyes controls** — a draw result must be verified and published by different operators;
  destructive actions (draw rollback, wallet transfer) require typed confirmation and a reason
  that is written to the audit trail.
- **Feature flags** — modules can be switched off per deployment or scoped to specific roles
  without a code change.

---

## Swapping in a real API

Set `useMockData: false` in `src/environments/environment.ts` and point `apiBaseUrl` at the
gateway. That is the whole change.

Every repository already issues the correct HTTP call on the other side of that flag, using
the same `PageQuery` in and `Page<T>` out that the components consume today. The mock backend
simulates realistic latency, and `environment.mock.errorRate` injects failures so the error and
retry states can be exercised.

Once the API is live, `src/app/core/mock/` and
`src/app/core/authentication/demo-accounts.constants.ts` can be deleted outright.

---

## Notable implementation details

- **Deterministic mock data** — a seeded PRNG means the dataset is identical on every reload,
  so the portal can be demoed, screenshotted and tested against fixed expectations. Entities
  cross-reference each other by id: a retailer belongs to a real agent, a ticket points at a
  real draw, a wallet movement debits a real wallet.
- **Export without heavyweight dependencies** — CSV and JSON are generated directly, Excel via
  an HTML workbook that opens natively in Excel and Sheets, and PDF through a styled print
  document (the browser's "Save as PDF"). No PDF library in the bundle.
- **Charts follow the theme** — the Chart.js wrapper rebuilds on any palette change, so
  switching preset or toggling dark mode restyles every chart. Colour-blind-safe mode and
  reduced-motion are honoured automatically, and each chart carries a screen-reader summary.
- **Command palette** — `Ctrl/⌘ + K` searches pages, users, agents, retailers, tickets, draws
  and transactions, and runs quick actions. `Ctrl/⌘ + B` toggles the sidebar,
  `Ctrl/⌘ + Shift + D` toggles dark mode; the full list is in **Settings → About**.
- **PWA** — service worker, manifest and an offline-friendly caching strategy are configured
  and enabled in production builds.

---

## Known limitations

These are deliberate boundaries of a front-end built against mock services, not defects:

- **Maps** are represented as a province density grid rather than a tile map — vector
  boundaries need a real GIS source. The `map__canvas` block in the coverage view is the
  drop-in point.
- **QR and barcode scanning** are placeholders; the keyed validation path is fully functional.
  Ticket stubs render a decorative barcode rather than a real symbology.
- **Real-time notifications** run on a simulated push in mock mode. `NotificationCentreService`
  already owns the WebSocket lifecycle — the simulator branch is removed when the gateway exists.
- **Unit tests** are not included; the project is configured for Karma and Jasmine
  (`npm test`) but no specs have been written.

---

## A note on credentials

The demo accounts above are fixtures for the seeded dataset and grant nothing outside this
sandbox. No real keys, tokens or customer data belong in this repository — `.env` files,
private keys and keystores are ignored by [`.gitignore`](.gitignore) so they cannot be
committed by accident.
