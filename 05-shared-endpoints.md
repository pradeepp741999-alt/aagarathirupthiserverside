# 05 — Shared Endpoints (used by both apps)

Payload JSON: see `reference/user-app_API_DOCUMENTATION.md` (U-docs) and `reference/provider-app_SCREEN_API_DOCUMENTATION.md` (P-docs). This doc adds **server behavior**. "Auth" column: `—` public, `U` user token, `P` provider token, `P✓` approved provider, `U/P` either, `A` admin.

## 1. Auth — `/api/v1/auth`

All require `X-App-Role` (D2). Same URLs, different response shapes (D3/D4).

| # | Method & Path | Auth | Request | Behavior |
| :-: | :-- | :-: | :-- | :-- |
| 1 | `POST /auth/send-otp` | — | `{mobile}` | Normalize mobile. Enforce limits (doc 04 §12.3). Create `otp_sessions` doc `{mobile, role, txnId, otpHash, expiresAt=+300s}`. Send via SMS adapter. **User response:** `{success:true,message:"OTP sent successfully",txnId,expiresInSeconds:300}`. **Provider response (data):** `{mobile, expires_in_seconds:300, resend_available_in_seconds:30}` + message `"OTP sent successfully to +91 XXXXXXXXXX"`. |
| 2 | `POST /auth/verify-otp` | — | user: `{mobile,otp,txnId}`; provider: `{mobile,otp}` | Find latest unconsumed, unexpired session for `(mobile, role)` (by `txnId` if given). Wrong OTP → `attempts++` → 400 `OTP_INVALID`; at 5 → 429 `OTP_ATTEMPTS_EXCEEDED`. Expired → 400 `OTP_EXPIRED`. On success: mark consumed; **upsert** the account for that role; create `sessions` row; issue tokens. |
| 3 | `POST /auth/resend-otp` | — | `{mobile}` | Same limits; 30 s cooldown (429 `RATE_LIMITED` with `retryAfterSeconds`). New `txnId`. User resp: `{success,message:"New OTP sent",txnId}`. Provider data: `{resend_available_in_seconds:30}`. |
| 4 | `POST /auth/logout` | U/P | provider may send `{push_token}` | Revoke current session (`sid`). Remove `push_token` if given. Resp message `"Logged out successfully"` (user raw: `{success:true,message}`). |
| A1 | `POST /auth/refresh-token` | — | `{refresh_token}` / `{refreshToken}` | Validate + rotate (doc 04 §4). Returns new access + refresh tokens in the role's shape. |
| A2 | `PUT /auth/push-token` | U/P | `{push_token, device?}` | Save on current session. Used by `notify.service` to push via Expo. |

### verify-otp response shapes
**User** (raw):
```json
{ "token": "<access>", "refreshToken": "<refresh>", "isNewUser": true,
  "user": { "id": "...", "name": null, "mobile": "9876543210", "district": null, "location": null } }
```
`isNewUser = !user.profileCompleted`. Upsert creates `{mobile, profileCompleted:false}`.

**Provider** (`data`, snake after transform):
```json
{ "accessToken": "...", "refreshToken": "...",
  "provider": { "id": "...", "mobile": "9876543210", "status": "draft", "registrationStep": 1, "businessName": null } }
```
Upsert creates `{mobile, status:'draft', registrationStep:1}`. Existing approved provider returns `status:'approved', registrationStep:7`.

---

## 2. Master data (public, role-shaped)

All `GET`, no auth, cacheable (`Cache-Control: public, max-age=300`). Shape chosen by `req.appRole` (D2, D14, D15).

| # | Path | User response | Provider response (`data`) |
| :-: | :-- | :-- | :-- |
| 1 | `GET /app/onboarding` | `{slides:[{id,title,subtitle,image}]}` (role `user` slides, ordered) | provider app doesn't call it; return provider slides if asked |
| 2 | `GET /categories` | `[{id,name,icon,color}]` (active, by `sortOrder`) | `[{id,title,icon}]` where `title=name`, `icon=providerIcon` |
| 3 | `GET /categories/details` | `[{id,name,icon,color,description,startingPrice,highlights[],serviceScope[],isActive}]` | same list (provider rarely calls) |
| 4 | `GET /districts` | `[{id,name,isDefault,areas:[names]}]` (Salem first, then A→Z). `?district=salem` may filter one. | `[{district:name, areas:[names]}]` |
| 5 | `GET /config/event-types?category=makeup` | `{eventTypes:[String], services:[String]}` from `categories` doc; 400 if category unknown | same |
| 6 | `GET /providers/filters-meta` | `{priceRange:{min,max}, dietary:['veg','non_veg','both'], sortOptions:['relevance','rating','distance','price'], ratingOptions:[4.5,4,3.5,3]}`; `min/max` from approved providers' `startingPrice` (optionally `?category=`) | n/a |
| 7 | `GET /support/faqs` | faqs where role in (`user`,`both`) | faqs where role in (`provider`,`both`): `[{id,question,answer}]` |

Seed requirements: doc 09 §5.

---

## 3. Media — `/api/v1/media`

| # | Method & Path | Auth | Request | Behavior |
| :-: | :-- | :-: | :-- | :-- |
| 1 | `POST /media/upload-url` | U/P | `{file_name, mime_type, category}` | Validate mime/category (doc 04 §12.7: only `provider_documents` allows PDF; only provider may use `provider_documents|dishes|combos|covers|portfolio`; user may use `avatars|reviews`). Generate key `category/ownerId/uuid.ext`. Insert `media_uploads{status:'pending'}`. Storage adapter returns `{uploadUrl, fileUrl}`. Resp data: `{upload_url, file_url, expires_in_seconds:900}`. |
| A3 | `PUT /media/local-upload/:token` | token | raw bytes | **Dev driver only** (404 when `STORAGE_DRIVER≠local`). Streams to `./uploads/`, serves under `/static/uploads/*`, flips `media_uploads.status='uploaded'`. |

When any module later accepts a `file_url`, it calls `storage.assertOwned(url, {ownerRole, ownerId})` (doc 04 §12.6) and marks the upload `uploaded`.

---

## 4. Enquiries — `/api/v1/enquiries` (role-aware, D1)

One resource, two views. State machine and side effects are in **doc 08 §1**; this is the routing matrix.

| # | Route | User (customer) | Provider |
| :-: | :-- | :-- | :-- |
| 1 | `POST /enquiries` | **Submit enquiry** (doc 06 §E1) | 403 |
| 2 | `GET /enquiries` | Own enquiries, newest first. U-doc 14.1 shape (array). Optional `?status=`. | Own received enquiries. P-docs 13.1 shape. Query `status` (comma list; aliases doc 04 §8.1), `search` (customer name / mobile / event type / code), `page`, `limit` (home screen uses `limit=3&status=pending`). `meta` paging. |
| 3 | `GET /enquiries/summary` | `{activeCount, awaitingResponseCount}` (doc 08 §8) | 403 |
| 4 | `GET /enquiries/counts` | 403 | `{all, pending, reviewing, quote_sent, accepted, cancelled}` (provider labels; `cancelled` also counts `rejected`) |
| 5 | `GET /enquiries/:id` | Full user DTO (U-doc 15.1 + `timeline`, `staffing`, `provider{phone,whatsapp}`, `quote`). Owner only. | Full provider DTO (P-doc 14.1). **Side effect:** if `status=submitted` → set `provider_reviewing`, add timeline `"Provider viewed enquiry"`, `isNewLead=false`, set `firstRespondedAt`. Owner only. |
| 6 | `PATCH /enquiries/:id/status` | Body `{status, reason?}`; allowed targets: `accepted` (aliases `confirmed`, `customer_reviewing`, `confirmation_pending`), `cancelled`. Returns updated user DTO. | Body `{status, note?}`; allowed targets per doc 08 §1. Returns `{id, status, updated_at}` (P-doc 14.2). `confirmed` additionally returns `booking_id`. |
| 7 | `POST /enquiries/:id/quote` | 403 | P✓ — body `{quote_amount, valid_until?, inclusions[], terms?, message?}`. See doc 07 §4. |
| 8 | `POST /enquiries/:id/messages` | 403 (v1: no customer messaging) | P✓ — body `{sender?:'provider', message}` → timeline `{kind:'message', author:'provider'}`; returns `{id, created_at}`. Server ignores client-sent `sender`. |

Role auth for the whole router: `authenticate` first; each row above enforces its role via `byRole`/`requireRole`; provider routes also `requireApprovedProvider`.

DTO field lists live next to the module (`enquiries.dto.ts`); the user one must contain every field of the `Enquiry` TypeScript model in `user-app_PROJECT_DOCUMENTATION.md` §7 (`id, providerId, providerName, category, createdAt, eventType, eventDate, eventEndDate, location, guestCount, makeupPersonsCount, simultaneousStyling, backupArtistAssigned, items[], estimatedTotal, notes, status, providerQuote, providerMessage, hasReview`) plus `code`, `staffing`, `timeline`, `quote`, `provider{...}`, `expectedResponseBy` (createdAt + provider `avgResponseMinutes`, default 2 h), `rejectionReason?`.

---

## 5. Notifications — `/api/v1/notifications` (role-aware by recipient)

Recipient is always `{recipientRole: req.auth.role, recipientId: req.auth.sub}`.

| # | Method & Path | Auth | Behavior |
| :-: | :-- | :-: | :-- |
| 1 | `GET /notifications/unread-count` | U/P | `user: {unreadCount}`; provider data `{unread_count}` |
| 2 | `PATCH /notifications/mark-all-read` | U/P | `updateMany isRead=true`. User: `{success:true}`; provider message `"All notifications marked as read"`. |
| 3 | `GET /notifications` | U/P | Newest first, `page/limit` (default 30). **User item:** `{id,title,message,time:"10 mins ago",read,type,createdAt,referenceId?}` (type via doc 04 §8.5). **Provider item:** `{id,type,title,message,read,reference_id,created_at}`. |
| 4 | `PATCH /notifications/:id/read` | U/P | Own only. User `{success:true}`; provider `{id, read:true}`. |
| 5 | `DELETE /notifications/:id` | P | (provider screen only; allow for users too, harmless). Message `"Notification removed"`. |

Creation is **only** via `notify.service.createNotification({recipientRole, recipientId, type, title, message, referenceType, referenceId})`, which also sends an Expo push if a push token exists (failures are swallowed + logged). Trigger list: doc 08 §7.

---

## 6. Combos alias (D20)

| # | Method & Path | Auth | Behavior |
| :-: | :-- | :-: | :-- |
| 1 | `GET /combos/special` | — | Public. Active combos, `validUntil ≥ now`, provider approved + active + online, newest first, `limit` default 10. User shape: `[{id,providerId,providerName,name,description,includedItems,price,originalPrice,image,validUntil:"Valid till 30 Nov 2026",badge}]`. `badge` = stored badge, else `"{N}% OFF"` when `originalPrice > price`, else omitted. Optional `?category=&district=`. |
| 2 | `POST /combos/special` | P✓ | Alias of provider combo create (doc 07 §6). Ignore `providerId` in body; `category` optional (defaults to provider's primary). Returns user doc shape of created combo (201) — i.e. same as GET item. |
