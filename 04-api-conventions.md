# 04 — API Conventions (cross-cutting)

Build all of this **before** any feature module (build-plan phase 1).

## 1. Base

- Base path: `/api/v1`. JSON only (`application/json`), except media upload (`PUT` to storage URL).
- Body limit 1 MB. UTF-8 everywhere (Tamil text must round-trip).
- Trust proxy enabled in prod (`app.set('trust proxy', 1)`).

## 2. Headers

| Header | Direction | Rule |
| :-- | :-- | :-- |
| `X-App-Role: user\|provider` | request | **Both apps must send it on every request.** Required for `/auth/*`; recommended elsewhere (D2). |
| `Authorization: Bearer <accessToken>` | request | Protected routes. |
| `X-App-Version` | request | Optional; logged. |
| `X-Request-Id` | both | Echo if sent, else generate. Included in error bodies as `requestId`. |

## 3. Role resolution (`roleContext` middleware, D2)

```
1. role = header X-App-Role (if valid 'user'|'provider')
2. if Authorization present and valid: tokenRole = jwt.role
     if header present and header != tokenRole -> 403 ROLE_MISMATCH
     role = tokenRole
3. if role missing:
     - path starts with /auth  -> 400 ROLE_REQUIRED
     - otherwise               -> role = 'user'
4. req.appRole = role
```
`admin` tokens are separate (`role: 'admin'`, only valid under `/admin/*`).

## 4. Authentication

- **Access token:** JWT HS256, 15 min, claims `{sub, role, sid}`.
- **Refresh token:** opaque random 48 bytes, 30 days, stored hashed in `sessions`, **rotated** on every refresh (old one revoked). Reuse of a revoked refresh token revokes the whole session.
- User app receives `token` (= access token) and also `refreshToken`; provider app receives `access_token`/`refresh_token` (snake via D4). The user app may ignore the refresh token; if it does, set `ACCESS_TOKEN_TTL_USER=30d` via env so users aren't logged out every 15 min. (Provider keeps 15 min + refresh.)
- Middleware: `authenticate` (401 `UNAUTHORIZED` / `TOKEN_EXPIRED`), `requireRole(role)` (403 `FORBIDDEN`), `requireApprovedProvider` (403 `PROVIDER_NOT_APPROVED`, D19), `optionalAuth` for public routes whose output varies by login.
- Blocked users / suspended or inactive providers → 403 `ACCOUNT_DISABLED` on every authenticated call.

## 5. Role-aware dispatch (D1)

```ts
// common/middleware/byRole.ts
router.get('/', authenticate, byRole({ user: userCtrl.list, provider: providerCtrl.list }));
```
- Picks handler by `req.auth.role`. A role with no handler → 403 `ROLE_MISMATCH`.
- Provider-only or user-only routes simply use `requireRole`.

## 6. Success envelope (`respond` helper, D3)

Controllers call `respond.ok(req, res, payload, opts?)`, `respond.created(...)`, `respond.list(req, res, items, {page, limit, total})`, `respond.message(req, res, 'text')`.

| Role | Output |
| :-- | :-- |
| `provider` / `admin` | `{ "success": true, "data": <payload>, "message"?: string, "meta"?: {total,page,total_pages} }` (after snake_case transform). `data` omitted when payload is `undefined` (message-only replies). |
| `user` | `<payload>` exactly (array or object). |

**User payloads that contain `success`** (e.g. `send-otp`, `logout`) are returned as the payload object by the controller, including `success:true` — see doc 05. For lists the user app wants a bare array only where the user doc shows one; paginated user lists use the object shape stated per endpoint in doc 06.

**Provider paging meta:** `{ "total": 24, "page": 1, "total_pages": 2 }` (`limit` default 20, max 100).

## 7. Casing transform (D4)

- `caseTransform` middleware runs **only when `req.appRole === 'provider'`**:
  - request: deep `snake_case → camelCase` on `req.body` and `req.query` (keys only, values untouched);
  - response: wraps `res.json` so the final body is deep `camelCase → snake_case` (keys only).
- Never convert values, never convert keys that already contain digits-first like `5_star` (leave as is).
- Controllers/services/DTOs always use camelCase. DTOs must be **plain objects** (never Mongoose docs, `ObjectId`, or `Date` instances — convert to `string`/ISO).
- A provider DTO field name is simply the camelCase of the snake name in the reference doc (e.g. `advancePaid` → `advance_paid`, `itemsCount` → `items_count`, `pricePerPlate` → `price_per_plate`). The reference doc is the exact contract; contract tests enforce the key set.

## 8. Canonical enums & per-role maps

### 8.1 Enquiry status (D6, D7)

| Canonical (DB) | User sees | Provider sees | Notes |
| :-- | :-- | :-- | :-- |
| `submitted` | `submitted` | `pending` | |
| `provider_reviewing` | `provider_reviewing` | `reviewing` | set automatically on provider's first open of detail |
| `quote_sent` | `quote_sent` | `quote_sent` | Q1 |
| `accepted` | `accepted` | `accepted` | customer accepted quote |
| `confirmed` | `confirmed` | `confirmed` | booking exists |
| `completed` | `completed` | `completed` | |
| `cancelled` | `cancelled` | `cancelled` | |
| `rejected` | `cancelled` (+ `rejectionReason`) | `rejected` | user union has no `rejected` |

**Input aliases** (accepted on `PATCH …/status` and as list filters, normalized to canonical):
`pending|new → submitted`; `reviewing → provider_reviewing`; `responded|provider_responded → quote_sent`; `customer_reviewing|confirmation_pending → accepted`.
Provider list filter `status=pending` etc. accepts comma lists (`status=pending,reviewing`).

### 8.2 Calendar day (D8)
`available | blocked | booked`; alias `unavailable → blocked`.

### 8.3 Booking
`confirmed | in_progress | completed | cancelled`. List filter alias: `upcoming` = `status=confirmed AND eventDate ≥ today(IST)`.

### 8.4 Provider
`draft | pending | under_review | approved | rejected | suspended`.

### 8.5 Notification `type` role map (D16)

| Canonical | User DTO `type` | Provider DTO `type` |
| :-- | :-- | :-- |
| `new_enquiry` | n/a | `new_enquiry` |
| `quote_received`, `enquiry_update` | `enquiry` | `enquiry_update` |
| `booking` | `booking` | `booking` |
| `review` | `review` | `review` |
| `approval`, `document` | n/a | `approval` / `document` |
| `system` | `system` | `system` |
| `promotion` | `promotion` | n/a |

## 9. Errors (D5)

`AppError(httpStatus, code, message, details?)`. Central `errorHandler` emits:

**Provider / admin**
```json
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "The given data failed validation.",
  "details": [ { "field": "starting_price", "message": "starting_price must be greater than 0" } ] } }
```
(field names are converted to snake_case in `details[].field` for provider.)

**User**
```json
{ "success": false, "statusCode": 400, "code": "VALIDATION_ERROR",
  "message": "Validation failed: eventEndDate must be equal or later than eventDate",
  "errors": [ { "field": "eventEndDate", "message": "must be equal or later than eventDate" } ] }
```

| HTTP | `code` | When |
| :-: | :-- | :-- |
| 400 (user) / 422 (provider) | `VALIDATION_ERROR` | zod failure, malformed id, bad enum |
| 400 | `ROLE_REQUIRED`, `OTP_INVALID`, `OTP_EXPIRED` | |
| 401 | `UNAUTHORIZED`, `TOKEN_EXPIRED`, `REFRESH_INVALID` | |
| 403 | `FORBIDDEN`, `ROLE_MISMATCH`, `PROVIDER_NOT_APPROVED`, `ACCOUNT_DISABLED` | |
| 404 | `NOT_FOUND` | also used when a record exists but belongs to another tenant (do not leak existence) |
| 409 | `INVALID_STATUS_TRANSITION`, `DATE_UNAVAILABLE`, `DATE_ALREADY_BOOKED`, `DATE_HAS_BOOKING`, `PROVIDER_NOT_ACCEPTING`, `REVIEW_ALREADY_EXISTS`, `NOT_REVIEWABLE`, `REPLY_ALREADY_EXISTS`, `REGISTRATION_LOCKED`, `ALREADY_EXISTS` | |
| 422 | `QUOTE_REQUIRED`, `PREVIOUS_STEP_INCOMPLETE`, `INSUFFICIENT_NOTICE`, `PAYMENT_EXCEEDS_BALANCE`, `INVALID_FILE_URL` | |
| 429 | `RATE_LIMITED`, `OTP_ATTEMPTS_EXCEEDED` | |
| 500 | `INTERNAL_ERROR` | message generic; stack only in logs |

Mongo duplicate-key (11000) → 409 `ALREADY_EXISTS`. Never leak stack traces or Mongo messages.

## 10. Route mounting order (matters!)

Static segments **must** be registered before `/:id` in the same router, or Express will treat `me`, `dishes`, … as an id. In `routes/index.ts`:

```
GET  /api/v1/health
/api/v1/auth                         auth.routes
/api/v1/app                          master.routes   (onboarding)
/api/v1/categories  /districts  /config      master.routes
/api/v1/media                        media.routes
/api/v1/user                         users.routes
/api/v1/requirements                 requirements.routes
/api/v1/combos                       combos public/alias routes   (GET/POST /special)
/api/v1/providers                    providers router, in THIS order:
     1. registration     /registration/draft | /registration/step/:n | /registration/summary | /registration/submit
     2. me               /me | /me/status | /me/online-status
     3. settings         /settings
     4. documents        /documents | /documents/:type
     5. dishes           /dishes | /dishes/:id | /dishes/:id/status
     6. packages         /packages | /packages/:id | /packages/:id/status
     7. combos           /combos | /combos/:id | /combos/:id/status
     8. availability     /availability/month | /availability/date | /availability/bulk
     9. reviews (own)    /reviews | /reviews/summary | /reviews/:id/reply
    10. earnings         /earnings/summary | /earnings/transactions
    11. discovery        /nearby | /filters-meta | /match | /   (directory)
    12. public detail    /:id | /:id/calendar | /:id/calendar/date (PUT, provider alias D20)
                         /:id/availability | /:id/reviews | /:id/menu | /:id/packages
/api/v1/enquiries                    in order: /summary, /counts, /, /:id, /:id/status, /:id/quote, /:id/messages
/api/v1/bookings                     /counts, /, /:id, /:id/status, /:id/payments, /:id/invoice
/api/v1/crm                          /customers, /stats, /customers/:id, /customers/:id/history, /customers/:id/notes
/api/v1/dashboard                    /metrics
/api/v1/analytics                    /overview | /revenue-chart | /export
/api/v1/reviews                      POST /
/api/v1/notifications                /unread-count, /mark-all-read, /, /:id/read, /:id
/api/v1/support                      /faqs, /tickets, /enquiry
/api/v1/admin                        admin.routes (separate auth)
```
Add a test that enumerates the router stack and fails if any `/:id` route precedes a static sibling.

## 11. Validation, ids, dates, pagination

- **Validation:** Zod schemas are `.strict()` (unknown keys → 400/422) except where the doc sends extra fields (e.g. `providerId` in `POST /combos/special`; use `.passthrough()` there and ignore). Trim strings. Mobile `/^[6-9]\d{9}$/` (strip `+91`/spaces first).
- **ObjectId params:** `validate({params: z.object({id: objectId})})` → 400 on malformed.
- **Dates:** inputs `YYYY-MM-DD` validated with dayjs strict; `eventEndDate ≥ eventDate`; event date ≥ today(IST). "Today" is always `dayjs().tz('Asia/Kolkata')`.
- **Pagination:** `page` (default 1), `limit` (default 20, max 100). Offset-based is fine.
- **Sorting defaults:** lists newest-first unless doc says otherwise.
- **Currency:** integer rupees; display formatting is the client's job (`₹16,000`) except in notification messages (use `formatINR`).

## 12. Security & hardening checklist

1. `helmet`, `cors` with allowlist from `CORS_ORIGINS` (mobile apps send no Origin → allowed).
2. `express-mongo-sanitize` + strict Zod → no operator injection (`$gt`, `$where`).
3. Rate limits: global 300 req / 15 min / IP; **OTP**: max **3 sends per mobile per 15 min**, **30 s** resend cooldown, **5 verify attempts** per OTP then invalidate; send-otp also IP-limited (20 / hour).
4. OTP: 6 digits, hashed with bcrypt, TTL 5 min (`expiresInSeconds: 300`), single-use. In prod never log it; `OTP_DEV_MODE=true` forces `123456` and **must be rejected at startup when `NODE_ENV=production`**.
5. Document numbers (Aadhaar/PAN/GST/FSSAI/trade license) encrypted with AES-256-GCM (`DOC_ENCRYPTION_KEY`, 32 bytes base64); only masked values leave the server; full values visible to admin API only.
6. `file_url`/`photo_url`/`image_url`/`cover_image`/`portfolio_images[]`/`photos[]` accepted only if they start with `CDN_BASE_URL` **and** exist in `media_uploads` for the same owner (or are pre-approved seed/Unsplash URLs when `ALLOW_EXTERNAL_IMAGE_URLS=true`, dev only). Reject others with 422 `INVALID_FILE_URL`.
7. Uploads: mime allowlist (`image/jpeg`, `image/png`, `image/webp`; `application/pdf` only for `provider_documents`), max 10 MB (5 MB images), randomized keys `category/ownerId/uuid.ext`.
8. Tenant isolation: provider queries include `providerId = req.auth.sub`; user queries `userId = req.auth.sub`; foreign records → 404.
9. Logging: pino with redaction of `authorization`, `otp`, `mobile`(last 4 kept), `token`, `refresh_token`, `*.number`, `file_url` query strings.
10. No stack traces to clients; `X-Powered-By` disabled; JSON parse errors → 400.
11. Secrets only from env; app refuses to start if `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET`/`DOC_ENCRYPTION_KEY` missing or < 32 chars.
12. Indexes created before traffic; graceful shutdown closes HTTP + Mongo.
