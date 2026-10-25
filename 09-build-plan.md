# 09 — Build Plan, Environment, Seed Data & Tests

## 1. Quick start (target state)

```bash
cp .env.example .env            # fill secrets (scripts/gen-secrets.sh prints values)
docker compose up -d            # api + mongo replica set (rs0)
npm install
npm run seed                    # master data (categories, districts, slides, faqs)
npm run seed:demo               # optional demo users/providers/catalog/enquiries
npm run dev                     # http://localhost:4000/api/v1/health
npm test
```
Dev OTP: with `OTP_DEV_MODE=true` every OTP is **123456** (refused at startup if `NODE_ENV=production`).

## 2. Phases & acceptance

Each phase ends with `npm run lint && npm run typecheck && npm test` green, then commit `phase-N: …`.

### Phase 0 — Scaffold
Repo layout (doc 02), TS strict, ESLint/Prettier, Vitest, Dockerfile, docker-compose (Mongo replica set + init script), `config/env.ts` (zod, fail-fast), pino logger, `GET /health` (checks Mongo ping).
**Accept:** `docker compose up` healthy; `/health` → `{status:'ok', db:'up'}`.

### Phase 1 — Cross-cutting (doc 04)
`AppError`+codes, `asyncHandler`, `roleContext`, `authenticate/optionalAuth/requireRole/requireApprovedProvider`, `byRole`, `validate`, `respond` (per-role), `caseConvert` + `caseTransform`, `errorHandler` (per-role), rate limiters, `notFound`; utils: `dates` (IST, `eachDay`, `relativeTime`), `distance`, `mask`, `crypto`, `counters`, `objectId`; router-order test.
**Accept (unit tests):** snake↔camel deep conversion incl. arrays/nested/`5_star`; `respond` output for user vs provider; error shapes for user vs provider (400 vs 422); `roleContext` matrix (header, token, mismatch, missing); haversine Salem↔Namakkal ≈ known distance ±1 km; IST day boundary tests; AES-GCM round-trip.

### Phase 2 — Models, master data, media
All Mongoose models + indexes (doc 03). Seed script (§5). Endpoints: `/app/onboarding`, `/categories`, `/categories/details`, `/districts`, `/config/event-types`, `/support/faqs`, `/providers/filters-meta` (stub until P6), `/media/upload-url`, `/media/local-upload/:token`. Storage adapters (local, S3) with `assertOwned`.
**Accept:** same URL returns user shape with `X-App-Role: user` and provider shape with `provider` (contract tests for categories & districts); upload-url rejects PDF outside `provider_documents`; `npm run seed` is idempotent (upserts).

### Phase 3 — Auth & accounts
OTP service (hash, TTL, limits), SMS adapters (console + one real), token service (access/refresh rotation, reuse detection), sessions, endpoints: `send-otp`, `verify-otp`, `resend-otp`, `logout`, `refresh-token`, `push-token`; user profile endpoints (`POST/GET/PUT /user/profile`, `PATCH /user/location`).
**Accept:** full OTP flow for both roles with different response shapes; 4th OTP send in 15 min → 429; 6th wrong OTP → 429; refresh rotation + reuse → session revoked; `isNewUser` true→false after `POST /user/profile`; role mismatch → 403.

### Phase 4 — Provider onboarding & admin
Registration steps 1–6 + draft/summary/submit; documents (encrypt + mask + formats); `/providers/me*`, `/providers/settings`, `/providers/documents*`; support enquiry/tickets; admin API (login, list, detail, approve, reject, suspend, doc verify); gating (D19).
**Accept:** `tests/e2e/provider-registration.test.ts` — OTP → steps 1–6 → submit → (locked edits 409) → admin approve → provider can call `/providers/dishes`; unapproved provider gets 403 `PROVIDER_NOT_APPROVED` on catalog; document numbers never appear unmasked in any provider response; step skipping → 422.

### Phase 5 — Catalog & availability
Dishes, packages, combos CRUD + status toggles; `GET/POST /combos/special`; `calendar.service`; `GET availability/month`, `PUT availability/date`, `POST availability/bulk`, alias `PUT /providers/:id/calendar/date`.
**Accept:** tenant isolation (provider B cannot read/modify A's dish → 404); deleting a dish updates packages; combo expiry filter; `available` deletes doc; booked-by-booking day cannot be changed.

### Phase 6 — Discovery (user)
`matching.service`; `GET /providers`, `/nearby`, `POST /match`, `/:id`, `/:id/calendar`, `/:id/availability`, `/:id/menu`, `/:id/packages`, `/:id/reviews` (reads); `POST /requirements/draft`; real `filters-meta`.
**Accept:** match tests for each filter (category, district, capacity, budget, availability, offline provider); ranking order deterministic; makeup simultaneous staffing normalization; route-order test passes (`/providers/dishes` is not captured by `/:id`).

### Phase 7 — Enquiries, notifications, CRM
Enquiry submit + role-aware list/detail/status/quote/messages/counts/summary (state machine doc 08 §1); `notify.service` (+ Expo push); notifications endpoints; `crm.sync.service` + CRM endpoints.
**Accept:** every transition in the §1 table has a passing + failing test; provider's first detail view moves `submitted → provider_reviewing`; status labels differ per role (`pending` vs `submitted`); notifications created for each trigger; CRM stage/tags recompute tests.

### Phase 8 — Bookings, payments, earnings
Confirm/cancel/complete transactions; `GET/PATCH bookings`, `counts`, `payments`, `invoice` (pdfkit); earnings summary + transactions; admin payouts.
**Accept:** confirming marks all days `booked` and a second confirm on overlapping dates → 409; payment > balance → 422; payment updates `paymentStatus`; cancel frees days; invoice PDF regenerates after new payment; earnings formulas match doc 08 §8 on a fixture.

### Phase 9 — Reviews, dashboard, analytics
`POST /reviews`, provider reviews list/summary/reply, public reviews, `rating.service`; `/dashboard/metrics`; analytics overview/chart/export.
**Accept:** one review per enquiry (409); only completed enquiries reviewable; rating aggregates recomputed; reply once; analytics numbers match fixtures; export returns a downloadable URL (csv + pdf).

### Phase 10 — Jobs, hardening, docs
Cron jobs (doc 08 §9); security checklist (doc 04 §12) verified by tests; full contract-test coverage of every endpoint; `README.md`; Postman/Bruno collection in `docs/api-collection/`; update `docs/DECISIONS_LOG.md`.
**Accept:** `npm test` ≥ 80 % line coverage on `src/modules` + `src/services`; no endpoint without an integration test; `npm audit --omit=dev` has no high/critical.

### Phase 11 — End-to-end
`tests/e2e/customer-journey.test.ts`: user login → profile → search → enquiry → provider detail view → quote → customer accept → provider confirm → payment ×2 → complete → review → provider reply → both notification feeds correct.

## 3. Environment variables (`.env.example`)

| Var | Default / example | Notes |
| :-- | :-- | :-- |
| `NODE_ENV` | `development` | |
| `PORT` | `4000` | |
| `API_BASE_URL` | `http://localhost:4000` | used to build local upload/static URLs |
| `MONGODB_URI` | `mongodb://mongo:27017/aagara?replicaSet=rs0` | replica set required |
| `SYNC_INDEXES` | `true` (dev) | |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | 48+ random chars | startup fails if short |
| `ACCESS_TOKEN_TTL_PROVIDER` | `15m` | |
| `ACCESS_TOKEN_TTL_USER` | `30d` | see doc 04 §4 |
| `REFRESH_TOKEN_TTL_DAYS` | `30` | |
| `DOC_ENCRYPTION_KEY` | 32 bytes base64 | AES-256-GCM |
| `CORS_ORIGINS` | `http://localhost:8081` | comma list |
| `OTP_DEV_MODE` | `true` | forbidden in prod |
| `OTP_TTL_SECONDS` / `OTP_RESEND_COOLDOWN_SECONDS` | `300` / `30` | |
| `OTP_MAX_SENDS` / `OTP_WINDOW_MINUTES` / `OTP_MAX_ATTEMPTS` | `3` / `15` / `5` | |
| `SMS_DRIVER` | `console` | `console\|msg91\|fast2sms\|twilio` + provider keys |
| `SMS_NOTIFY_QUOTES` | `false` | SMS customer when quote is sent |
| `STORAGE_DRIVER` | `local` | `local\|s3` |
| `LOCAL_UPLOAD_DIR` | `./uploads` | |
| `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | | S3/R2 compatible |
| `CDN_BASE_URL` | `http://localhost:4000/static/uploads` | prefix of every valid `file_url` |
| `ALLOW_EXTERNAL_IMAGE_URLS` | `false` | dev-only, permits seeded Unsplash URLs |
| `EXPO_ACCESS_TOKEN` | | optional push |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | | seeds `admins` |
| `PLATFORM_COMMISSION_PERCENT` | `0` | Q4 |
| `JOBS_ENABLED` | `true` | |
| `LOG_LEVEL` | `info` | |

## 4. docker-compose notes

- Service `mongo`: `mongo:7`, `--replSet rs0 --bind_ip_all`, healthcheck runs `rs.status()`.
- Service `mongo-init`: one-shot, runs `scripts/mongo-init-replset.sh` (`rs.initiate({_id:'rs0',members:[{_id:0,host:'mongo:27017'}]})`).
- Service `api`: depends on `mongo` healthy; mounts `./uploads` volume for the local storage driver.

## 5. Seed data

### 5.1 Master (`npm run seed`, idempotent upserts)

**Categories**

| id | name | icon (Ionicons) | providerIcon (Lucide) | color |
| :-- | :-- | :-- | :-- | :-- |
| `catering` | Catering | `restaurant` | `utensils` | `#F97316` |
| `decoration` | Decoration | `color-wand` | `sparkles` | `#8B5CF6` |
| `audio` | Audio & Sound | `musical-notes` | `volume-2` | `#3B82F6` |
| `makeup` | Bridal Makeup | `sparkles` | `smile` | `#EC4899` |

**Event types / services** (`makeup` is from the user doc; the others are **assumed — edit freely**):
- `makeup`: types `["Bridal (Muhurtham)","Reception","Engagement","Sangeet / Mehendi"]`; services `["HD Bridal Makeup","Airbrush Makeover","Saree Draping","Bridal Hairstyling"]`
- `catering`: types `["Wedding","Reception","Engagement","Housewarming","Birthday","Temple / Festival","Corporate Event"]`; services `["Breakfast","Lunch","Dinner","Snacks & Beverages","Live Counters"]`
- `decoration`: types `["Wedding Mandap","Reception Stage","Engagement","Housewarming","Birthday"]`; services `["Floral Backdrop","Stage Lighting","Theme Setup","Entrance Decor"]`
- `audio`: types `["Wedding","Reception","Orchestra / Concert","Birthday","Corporate Event"]`; services `["Line Array Sound","DJ Setup","Live Mikes","Orchestra"]`

**Districts:** all 38 Tamil Nadu districts (Ariyalur, Chengalpattu, Chennai, Coimbatore, Cuddalore, Dharmapuri, Dindigul, Erode, Kallakurichi, Kancheepuram, Karur, Krishnagiri, Madurai, Mayiladuthurai, Nagapattinam, Kanniyakumari, Namakkal, Perambalur, Pudukkottai, Ramanathapuram, Ranipet, Salem, Sivaganga, Tenkasi, Thanjavur, Theni, Thiruvallur, Thiruvarur, Thoothukudi, Tiruchirappalli, Tirunelveli, Tirupathur, Tiruppur, Tiruvannamalai, The Nilgiris, Vellore, Viluppuram, Virudhunagar). `salem.isDefault=true`.
- **Salem** centroid `11.6643, 78.1460` (from the user doc). Areas — localities: Fairlands, Hasthampatti, Alagapuram, Junction, Shevapet, Ammapet, Suramangalam; taluks: Salem North, Salem South, Attur, Mettur, Omalur, Sankagiri, Edappadi.
- **Erode** areas: Erode City, Perundurai, Bhavani, Gobichettipalayam, Sathyamangalam. **Namakkal** areas: Namakkal, Tiruchengode, Rasipuram, Paramathi Velur.
- District centroids: use well-known approximate district-HQ coordinates. For areas without reliably known coordinates leave `lat/lng` **null** (distance then falls back to the district centroid) and add `// TODO verify` — do not invent precise values.

**Onboarding slides:** user — `{title:"Welcome to Aagara Thirupthi", subtitle:"Discover Salem's best catering, decor, makeup & sound services"}` + two more (compare providers; book with confidence). Provider — three slides (reach more customers; manage enquiries & bookings; grow with reviews).
**FAQs:** provider — the two in the provider doc (payout settlement weekly on Tuesday; FSSAI optional but unlocks verified badge) + a few more (assumed); user — 4–5 assumed (how enquiries work, cancelling, payments are made directly to the provider, reviews).
**Admin:** from `ADMIN_EMAIL`/`ADMIN_PASSWORD`.

### 5.2 Demo (`npm run seed:demo`)
Users: `Kavitha Rajan` 9876543210 (Salem, Fairlands). Providers (approved, demo mobiles `9000000001…`): *Sri Annapoorna Caterers* (catering), *Glow & Glamour Bridal Studio* (makeup), plus one decoration and one audio provider with invented names. For the caterer: ~12 dishes (e.g. Seeraga Samba Mutton Biriyani ₹280, Salem Special Thalassery Biryani ₹240, Elaneer Payasam ₹65), 2 packages, 2 combos (from the docs), a few blocked/booked calendar days. Enquiries covering every canonical status, one confirmed booking with a partial payment, one completed booking with a review. Image URLs may use the Unsplash links from the docs only when `ALLOW_EXTERNAL_IMAGE_URLS=true`.

## 6. Test strategy

- **Unit:** `common/utils/*`, `caseTransform`, `respond`, `errorHandler`, scoring/matching math, CRM recompute, status maps.
- **Integration (Supertest + mongodb-memory-server replset):** every endpoint: happy path, validation failure, auth failure (401), wrong role (403), wrong tenant (404).
- **Contract tests (`tests/contract/`):** for each endpoint, fixtures hold the **key set** copied from the reference doc's example (`fixtures/provider/*.json`, `fixtures/user/*.json`). Helper `expectShape(body, fixture)` asserts: all fixture keys exist with matching JS types (extra keys allowed). Provider fixtures assert snake_case + envelope; user fixtures assert raw camelCase.
- **Isolation tests:** two providers / two users; confirm no cross-reads or writes on dishes, packages, combos, availability, enquiries, bookings, CRM, reviews reply, notifications, documents.
- **E2E:** phase 4 and phase 11 scripts.
- **Time:** inject a clock (`dayjs` wrapper `now()`) so IST-boundary and "today" logic is testable.

## 7. Client-side changes required (small, per app)

| App | Change |
| :-- | :-- |
| Both | Create API client (`src/api/client.ts`) with base URL `…/api/v1`; send `X-App-Role` (`user` / `provider`) and `Authorization` on every request. |
| Both | Replace mock stores with API calls per the reference docs. |
| User | Store `token` (+ `refreshToken` if you use it); `POST /auth/refresh-token` on 401 `TOKEN_EXPIRED`. |
| Provider | After login and on token refresh, call `PUT /auth/push-token`; call `POST /auth/logout` with the same `push_token`. Use `POST /providers/registration/step/:n` flow exactly as in the screen doc. |
| Provider (optional) | Add `portfolio_images`, `lat/lng` fields to Edit Profile (A6) so the user app's "Previous Work" and distance work. |
| User (optional) | Send `mealType`/`eventTime` on enquiries (A7) and the four rating pillars on reviews (A8). |

## 8. Final deliverables checklist

- [ ] Running API with all 99 + 15 endpoints · [ ] seed scripts · [ ] tests green
- [ ] `README.md` (setup, scripts, env, architecture, how to point both apps at it)
- [ ] `docs/api-collection/` Postman/Bruno export (both roles' headers preconfigured)
- [ ] `docs/DECISIONS_LOG.md` listing every deviation or ambiguity resolved while building
