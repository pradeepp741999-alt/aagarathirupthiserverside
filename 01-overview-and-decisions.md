# 01 — Overview & Contract Decisions

## 1. Purpose

One backend, two clients. The client apps were designed and documented separately, so their API docs overlap, collide and disagree. This document records **what the system is** and **exactly how every collision was resolved** so the backend can serve both without client rewrites.

## 2. The two clients

| | User app | Provider app |
| :-- | :-- | :-- |
| Audience | Customers | Service providers |
| Role claim | `user` | `provider` |
| Stack | Expo SDK 57 / RN 0.86 / Zustand / TS | React Native (Expo) / TS |
| Screens | 19 | 32 (+ registration layout) |
| API contract doc | `reference/user-app_API_DOCUMENTATION.md` | `reference/provider-app_SCREEN_API_DOCUMENTATION.md` |
| Response style | Raw JSON, camelCase | `{success,data}` envelope, snake_case |
| Auth | Mobile OTP → JWT | Mobile OTP → access + refresh JWT |
| Core jobs | Discover → build requirement → enquire → accept quote → review | Register → get approved → catalog + calendar → quote → booking → payments → CRM |

## 3. Architecture

```
 User App (RN)                    Provider App (RN)
      │  X-App-Role: user              │  X-App-Role: provider
      └───────────────┬────────────────┘
                      ▼   HTTPS  /api/v1
        ┌──────────────────────────────────┐
        │  Express API (Node 20, TS)       │
        │  middleware: role → auth → case  │
        │  modules: auth, users, providers,│
        │  catalog, availability,          │
        │  enquiries, bookings, crm,       │
        │  reviews, notifications, …       │
        └───────┬───────────┬──────────────┘
                │           │
        ┌───────▼───┐  ┌────▼─────────────────────────┐
        │ MongoDB   │  │ Adapters (swap by env):      │
        │ replica   │  │  SMS (OTP) · Push (Expo) ·   │
        │ set       │  │  Storage (local | S3/R2) ·   │
        └───────────┘  │  PDF (pdfkit)                │
                       └──────────────────────────────┘
```

Domain glossary: **Enquiry** = customer request to one provider (with optional quote). **Booking** = a confirmed enquiry with money tracking. **Combo** = provider promo package shown on user Home. **Package** = per-plate menu bundle. **Dish** = single menu item. **Calendar day** = provider's per-date status.

## 4. Source precedence

1. Docs 01–09 (this set).
2. `user-app_API_DOCUMENTATION.md` for user payloads; `provider-app_SCREEN_API_DOCUMENTATION.md` for provider payloads.
3. `user-app_PROJECT_DOCUMENTATION.md` for TypeScript models.
4. `provider-app_BACKEND_SPECIFICATION_legacy.md` — ideas only (see D9).

## 5. Contract decisions (D1 – D20)

| ID | Conflict found | Decision |
| :-: | :-- | :-- |
| **D1** | Both apps call the same paths with different meaning: `/enquiries`, `/enquiries/:id`, `/enquiries/:id/status`, `/notifications*`, `/auth/*`, `/categories`, `/districts`. | **Role-aware shared routes.** One route, handler picks logic by authenticated role (via `byRole({user, provider})`). Unauthenticated calls use `X-App-Role`. No duplicate `/user/*` or `/provider/*` URLs. |
| **D2** | Server must know which app is calling, even before login. | Role resolution order: JWT `role` claim → `X-App-Role` header → (auth endpoints only) 400 `ROLE_REQUIRED`; on public master-data endpoints default to `user`. If JWT role ≠ header role → 403 `ROLE_MISMATCH`. |
| **D3** | User app expects raw bodies (`[...]`, `{token,…}`); provider app expects `{success,data,message,meta}`. | One `respond()` helper. Provider role → envelope; user role → raw payload exactly as in the user doc. Admin → provider style. |
| **D4** | User docs are camelCase; provider screen docs are snake_case (legacy spec was camelCase). | DB and services use camelCase. For role `provider`, a response transformer converts keys to snake_case and a request transformer converts body/query keys to camelCase. User role is never transformed. |
| **D5** | Error shapes differ (`{success,statusCode,message,errors}` vs `{success,error:{code,message,details}}`); validation is 400 for user, 422 for provider. | Central error handler emits per-role shape. User gets an extra `code`. Validation → 400 for user, 422 for provider. |
| **D6** | Enquiry status vocab differs across three docs (`submitted/provider_reviewing/provider_responded/…` vs `pending/reviewing/quote_sent/…` vs `new/reviewing/responded/…`). | **Canonical enum** (8 values): `submitted, provider_reviewing, quote_sent, accepted, confirmed, completed, cancelled, rejected`. Per-role output maps and legacy input aliases are in doc 04 §8. |
| **D7** | Who "accepts" and who "confirms"? User doc sends `status:"confirmed"` when accepting a quote; provider doc has both `accepted` and `confirmed`. | Customer accepting a quote (sends `accepted` **or** `confirmed`) → canonical `accepted`. **Only the provider** moves `accepted → confirmed`, which creates the Booking and blocks calendar dates. Provider may also record `accepted` themselves (customer agreed by phone/WhatsApp). |
| **D8** | Calendar statuses: `available/blocked/booked` (screen docs) vs `available/unavailable/partial/booked` (legacy). | Canonical: `available`, `blocked`, `booked`. Input alias `unavailable → blocked`. `partial` is not supported. Only non-default days are stored (missing doc = `available`). |
| **D9** | Provider has two backend docs: legacy `BACKEND_SPECIFICATION` (`/api/v1/provider/*`, camelCase, Postgres/Redis) and `SCREEN_API_DOCUMENTATION` (`/api/v1/providers/*`, snake_case, 79 APIs, tied to real screen files). | The **screen doc is the contract**. Legacy paths are **not** implemented. Legacy DB ideas (CRM stages, secondary categories, document expiry) are adopted in Mongo form. If the provider app later turns out to call `/provider/*`, add a thin alias router — do not restructure. |
| **D10** | Enum values differ: pricing model (`per_plate/per_event/fixed/hourly` vs `per_dish/per_person/package/custom`), doc types (`aadhaar/pan/gst/trade_license/fssai` vs `owner_id/address_proof/…`), veg pref (`non-veg` vs `non_veg`). | Use the **screen doc** values. Accept `non-veg` on input; store `non_veg`; emit `non-veg` to provider role. |
| **D11** | Mock ids are strings like `prov-glam-glow`, `enq-2001`, `usr_9918`. | Real ids are Mongo ObjectId strings (`id` in DTOs). Human-readable `code` fields exist where shown to people: `ENQ-100001`, `BKG-100001`, `REC-100001`, `INV-100001`, `TKT-100001` (from a `counters` collection). Routes accept ObjectId only; 400 on malformed id. |
| **D12** | Dates appear as `YYYY-MM-DD`, ISO timestamps, `"Valid till 30 Nov 2026"`, `"10 mins ago"`. | Event/calendar dates stored as `"YYYY-MM-DD"` strings (IST day, no TZ drift). Timestamps stored UTC. Display strings (`"10 mins ago"`, `"Valid till …"`) are produced only in user-role DTOs. |
| **D13** | "Nearby providers" needs provider coordinates; neither app captures them. | `providers.geo = {lat,lng}` is derived from the provider's primary area/district centroid at registration; optional explicit `lat`/`lng` accepted on `PUT /providers/me` (additive). Distance = **Haversine computed in app code** (same as the client); no `$geoNear`. User origin = GPS lat/lng → else locality centroid → else district centroid. |
| **D14** | Category icons differ: user uses Ionicons (`restaurant`, `color-wand`…) + color; provider uses Lucide (`utensils`, `sparkles`…) + `title`. | One `categories` doc stores `name`, `icon` (Ionicons), `providerIcon` (Lucide), `color`. User DTO: `{id,name,icon,color}`. Provider DTO: `{id,title:name,icon:providerIcon}`. |
| **D15** | `/districts`: user wants `[{id,name,isDefault}]` + Salem localities; provider wants `[{district,areas[]}]` (taluks and localities). | One `districts` doc with `areas[{name,type:'locality'|'taluk',lat,lng}]`. User DTO adds `areas` (names). Provider DTO: `{district:name, areas:[names]}`. |
| **D16** | Notification `type` differs (`enquiry` vs `new_enquiry`); user wants relative `time` string, provider wants `created_at`, `reference_id`. | Store canonical types (doc 03). Role DTO maps (doc 05 §5). User DTO includes `time` + `createdAt`; provider DTO via snake transform. |
| **D17** | Combo `validUntil`: user shows `"Valid till 30 Nov 2026"`; provider uses `"2026-12-31"` and `"31 Dec 2026"`. | Store `validUntil` as `Date` (end of that IST day). Parse tolerant input (ISO, `D MMM YYYY`, `Valid till D MMM YYYY`). User DTO: `"Valid till D MMM YYYY"`. Provider DTO: `YYYY-MM-DD`. |
| **D18** | `registration_step` semantics are inconsistent in examples (draft shows 1 after step 1 saved; save returns next step). | `registrationStep` = **the next step the client should show** (1–7). Saving step *n* sets it to `max(current, n+1)` capped at 7. 7 = review/submit screen. Approved providers report 7. Steps 1–6 are saved by `PUT /providers/registration/step/:n`; step 7 is `POST …/submit`. |
| **D19** | What may unapproved/offline providers do and who can see them? | Providers in `draft/pending/under_review/rejected` may call only: auth, registration, `/providers/me/status`, `/providers/documents`, `/providers/me` (GET), support, master data, media. Everything else → 403 `PROVIDER_NOT_APPROVED`. Users see only `approved` + `isActive` providers. `isOnline=false` providers stay visible (flag `isOnline:false`), are excluded from `match`/`nearby`, and cannot receive new enquiries (409 `PROVIDER_NOT_ACCEPTING`). |
| **D20** | User app doc contains two **provider-mode** actions: `POST /combos/special` and `PUT /providers/:id/calendar/date`. | Implemented as aliases that require role `provider`; `:id` must equal the token's provider id; `providerId` in bodies is ignored. They share handlers with `POST /providers/combos` and `PUT /providers/availability/date`. |

## 6. Additive items (not in client docs, required to make the system work)

| # | Item | Why |
| :-: | :-- | :-- |
| A1 | `POST /auth/refresh-token` | Provider doc issues refresh tokens but defines no refresh endpoint. |
| A2 | `PUT /auth/push-token` | Logout sends `push_token`, but no doc registers it. |
| A3 | `PUT /media/local-upload/:token` | Dev-only storage driver target for `upload_url`. |
| A4 | `GET /health` | Ops / docker healthcheck. |
| A5 | **Admin API** (11 endpoints, doc 07 §10) | Provider approval is manual; nothing else can move a provider from `pending` → `approved`, verify documents, or create payouts. |
| A6 | `PUT /providers/me` accepts optional `portfolio_images[]`, `lat`, `lng` | User app shows a "Previous Work" gallery and distance; provider app has no way to set them. |
| A7 | `POST /enquiries` accepts optional `mealType`, `eventTime` | Provider enquiry detail shows `meal_type`; booking detail shows `start_time`. |
| A8 | `POST /reviews` accepts optional `ratings:{quality,communication,value,timeliness}` | User app has 4-pillar scoring (project doc) but the API body omits it. |

Counts: **99 client-contract endpoints** + **15 additive** (A1–A4 = 4, A5 = 11).

## 7. Out of scope for v1

Payment gateway / real escrow (payments are **recorded manually** by the provider; "escrow held" and payouts are derived/admin-entered), realtime chat/WebSockets (WhatsApp/phone deep links only), admin web UI (API only), Tamil UI strings from server (but all text fields must be UTF-8 safe — Tamil input like `ஆகார திருப்தி` must round-trip), multi-capacity-per-day scheduling, refunds.

## 8. Open questions (defaults already chosen — change via constants)

| # | Question | Default used |
| :-: | :-- | :-- |
| Q1 | When a quote is sent, does the user UI expect `quote_sent` or `provider_responded`? | Emit `quote_sent`; accept `provider_responded` on input as alias. One constant in `statusMaps.ts`. |
| Q2 | Which provider documents are mandatory? | `aadhaar`, `pan` required; `gst`, `trade_license`, `fssai` optional (`REQUIRED_DOC_TYPES` constant). |
| Q3 | Verified badge rule? | `verified = approved by admin`, and for `catering` additionally FSSAI doc `verified` (per provider FAQ). |
| Q4 | Platform commission on bookings? | 0% in v1 (`PLATFORM_COMMISSION_PERCENT=0`). |
| Q5 | Who may mark an enquiry/booking `completed`? | Provider only (via booking status or enquiry status); cascades to the other. |
| Q6 | Cancellation after confirmation? | Either party may cancel; booking → `cancelled`, calendar dates freed, other party notified. No refund logic. |
| Q7 | Multiple bookings per day per provider? | No — one booking per calendar day (v1 limitation). |
| Q8 | SMS provider? | Pluggable: `console` (dev, OTP fixed `123456` when `OTP_DEV_MODE=true`), `msg91`, `fast2sms`, `twilio`. |
| Q9 | Storage provider? | `local` in dev, S3-compatible (S3/R2) in prod. |
| Q10 | `auto_accept_enquiries=true`? | New enquiries auto-move `submitted → provider_reviewing` with a system timeline entry. It never auto-confirms. |
