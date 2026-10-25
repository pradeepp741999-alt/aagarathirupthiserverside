# 08 — Business Rules

Implement these in **services**, not controllers. All "today" values are IST (`Asia/Kolkata`).

## 1. Enquiry state machine (D6, D7)

Canonical statuses: `submitted, provider_reviewing, quote_sent, accepted, confirmed, completed, cancelled, rejected`. Terminal: `completed, cancelled, rejected`.

| From | To | Actor | Conditions & effects |
| :-- | :-- | :-- | :-- |
| `submitted` | `provider_reviewing` | provider (first `GET /enquiries/:id`, or PATCH) / system (auto-accept setting) | `isNewLead=false`, `firstRespondedAt` set once, timeline `Provider viewed enquiry` |
| `submitted`, `provider_reviewing` | `quote_sent` | provider | via `POST …/quote` (preferred). `PATCH status=quote_sent` without a stored quote → 422 `QUOTE_REQUIRED` |
| `quote_sent` | `quote_sent` | provider | re-quote (overwrites quote, new timeline entry) |
| `submitted`, `provider_reviewing`, `quote_sent` | `rejected` | provider | `note`/`reason` **required**; notify customer; user sees `cancelled` + `rejectionReason` |
| `quote_sent` | `accepted` | customer **or** provider (offline agreement) | user may send `accepted` / `confirmed` / `customer_reviewing` / `confirmation_pending` (all normalize to `accepted`); notify the other party |
| `accepted` (or `quote_sent` when provider records an offline agreement) | `confirmed` | **provider only** | runs **§3 confirm transaction** → booking + calendar |
| `confirmed` | `completed` | provider only | delegates to booking completion (§3) — never completes without a booking |
| `submitted`, `provider_reviewing`, `quote_sent`, `accepted` | `cancelled` | customer or provider | `cancelledBy`, `cancelReason`; notify the other party |
| `confirmed` | `cancelled` | customer or provider | cascades to booking cancel (§3) |
| any terminal | anything | — | 409 `INVALID_STATUS_TRANSITION` |
| same → same | — | — | idempotent 200 no-op (no duplicate timeline) |

Disallowed actor/target combos (e.g. customer sending `confirmed`→ already normalized to `accepted`; customer sending `completed`) → 403 `FORBIDDEN`. Every transition appends `timeline[{kind:'status', status, author, message, at}]` with a default message (`Quote submitted`, `Customer accepted the quote`, `Booking confirmed`, …) or the supplied note/reason.

## 2. Calendar semantics (D8)

- Day key = `"YYYY-MM-DD"` (IST). Stored sparsely in `provider_availability` (`blocked | booked`); no doc = `available`.
- A provider **cannot** make a day `blocked`/`available` if it is `booked` **by a booking** (`bookingId` set) → 409 `DATE_HAS_BOOKING`. Manual `booked` (no `bookingId`) models offline bookings and may be freed by the provider.
- **Bookable for a customer** = stored status not in (`blocked`,`booked`) **and** `date ≥ today + advanceNoticeDays`.
- Multi-day events (`eventEndDate`): all days in range must be free; confirming marks each day `booked` with the same `bookingId`. Max 7 days per enquiry.
- Month endpoints return **every day** of the month; stats count all days of that month.
- One booking per day per provider (Q7). Unique index `{providerId,date}` is the race guard: a duplicate-key during confirm → 409 `DATE_ALREADY_BOOKED`.

## 3. Booking lifecycle & transactions

### 3.1 Confirm (enquiry → booking) — Mongo transaction
1. Load enquiry (owned by provider, status `accepted` or `quote_sent`, no `bookingId`).
2. Verify all days free (read `provider_availability`) → else 409 `DATE_ALREADY_BOOKED` / `DATE_UNAVAILABLE`.
3. Create booking: `totalAmount = quote.amount ?? estimatedTotal`; `advanceRequired = round(totalAmount × provider.pricing.advancePercentage / 100)`; `payments=[]`, `advancePaid=0`, `balanceDue=totalAmount`, `paymentStatus='unpaid'`, `venue=enquiry.location`, `startTime=enquiry.eventTime`, `code=BKG-…`, customer snapshot.
4. Insert `provider_availability{status:'booked', bookingId, note:'{customer} {eventType}'}` for each day.
5. Enquiry → `confirmed`, `bookingId`, timeline entry. 6. After commit: CRM recompute, notify customer (`booking`: **Booking confirmed!**).

### 3.2 Start / complete / cancel
- `confirmed → in_progress`: provider manual.
- `→ completed`: sets `completedAt`; enquiry → `completed`; CRM recompute; notify customer (`booking`): title `How was {businessName}?`, message `Rate your experience`, `referenceType:'enquiry'` (deep link to review).
- `→ cancelled`: `cancelledAt`, `cancelledBy`; delete availability docs with that `bookingId`; enquiry → `cancelled`; notify the other party; CRM recompute. Recorded payments stay (no refund logic, Q6).

### 3.3 Payments — transaction
`POST /bookings/:id/payments`: booking not `cancelled`; `amount ≤ balanceDue`; append payment `{amount, method, referenceId, notes, receiptNo=REC-…, paidAt=now}`; `advancePaid = Σ payments`; `balanceDue = totalAmount − advancePaid`; `paymentStatus = balanceDue==0 ? 'paid' : advancePaid>0 ? 'partially_paid' : 'unpaid'`. Invalidate cached invoice. CRM recompute.

## 4. Provider matching & ranking (`POST /providers/match`)

**Input:** requirement `{category, eventDate, eventEndDate?, district, location(area), guestCount, makeupPersonsCount?, simultaneousStyling?, budgetMin, budgetMax, lat?, lng?}` (lat/lng default to caller's saved `geo`, else locality/district centroid).

**Hard filters (query):** `status='approved' ∧ isActive ∧ isOnline ∧ (category==c ∨ c∈secondaryCategories) ∧ (isAllDistricts ∨ district∈coverage.districts)`.

**Capacity filter (in code):** catering/decoration/audio: `minCapacity ≤ guestCount ≤ maxCapacity` (skip bound if unset). Makeup: `persons ≤ maxCapacity` and, if simultaneous, `persons ≤ maxDailyClients`.

**Estimated starting total:** `per_plate → startingPrice × guestCount`; `per_event|fixed → startingPrice`; `hourly → startingPrice × DEFAULT_HOURS (4)`. **Budget filter:** drop if `estimated > budgetMax × 1.2` (when `budgetMax>0`).

**Availability:** one query on `provider_availability` for candidate ids and the date range (`$in`); provider is *available* iff no stored day in range **and** `eventDate ≥ today + advanceNoticeDays`. Unavailable ones stay in results with `isAvailable:false`, `unavailableDates` (rank after available).

**Distance:** `haversineKm(origin, provider.geo)` (R = 6371 km), 1 dp. Missing coordinates → `null`.

**Relevance score (0–100):**
`rating × 8` (max 40) + distance (30: `max(0, 1 − d/50) × 30`; unknown → 15) + price fit (20: inside `[min,max]` → 20; below min → 15; between max and max×1.2 → linear 10→0; no budget → 10) + verified (5) + responsiveness (5 if `avgResponseMinutes ≤ 120`, else 2.5).

**Sort:** `relevance` (default, score desc) · `rating` desc · `distance` asc (nulls last) · `price` asc (`estimated`). Available before unavailable regardless of sort. Paginate in memory (`page`, `limit` default 20).

## 5. Makeup staffing (simultaneous styling & backup artist)

| Persons `P` | `simultaneousStyling` | Result |
| :-: | :-: | :-- |
| 1 | true | **400/422**: "simultaneousStyling requires at least 2 persons" |
| 1 | false | lead 1, backup 0 |
| ≥2 | true | **lead 1 + backup 1**, `backupArtistNeeded/Assigned = true` (everyone ready at the same time) |
| ≥2 | false | lead 1, backup 0 (sequential), `hoursPerPerson {1.5, 2}` ⇒ `estimatedHours {1.5×P, 2×P}` |

Stored as `staffing: {leadArtists, backupArtists, hoursPerPerson:{min,max}, estimatedHours:{min,max}}` on the enquiry and returned in both DTOs. **Server overrides** any client-sent `backupArtistNeeded/Assigned`. Date range for makeup uses `eventDate`→`eventEndDate` (e.g. Mehendi → Muhurtham).

## 6. CRM sync (`crm.sync.service.recompute(providerId, mobile)`)

Called after: enquiry created, quote sent, enquiry status change, booking confirm/cancel/complete, payment. **Recompute from source** (idempotent, no incremental counters):

- `totalEnquiries` = count enquiries (provider+mobile)
- `totalBookings` = count bookings with status ≠ `cancelled`
- `totalSpent` = Σ `advancePaid` of bookings ≠ `cancelled`
- `lastEventDate` = max `eventDate` of non-cancelled bookings
- `lastContactAt` = max(latest enquiry timeline `at`, latest note `createdAt`)
- **stage** (first match): `booked` (has `confirmed|in_progress` booking) → `completed` (has completed booking, none active) → `quoted` (has `quote_sent|accepted` enquiry) → `contacted` (has `provider_reviewing` enquiry) → `lost` (all enquiries `cancelled|rejected`, no booking) → `new_lead`
- **tags**: `repeat` (bookings ≥ 2) · `high_value` (spent ≥ ₹1,00,000) · `vip` (bookings ≥ 3 or spent ≥ ₹2,50,000) · `recent` (lastContactAt ≤ 30 days). Thresholds are constants.
Upsert key `(providerId, mobile)`; copy name/whatsapp/email/avatar from the latest enquiry snapshot; link `userId`.

## 7. Notification triggers

| Event | Recipient | `type` | Title / message |
| :-- | :-- | :-- | :-- |
| Enquiry submitted | provider | `new_enquiry` | `New Enquiry from {name}` / `{eventType} for {guests} guests on {Mon D, YYYY}` |
| Stale enquiry (24 h, unanswered) | provider | `enquiry_update` | `Enquiry waiting for your response` |
| Quote sent | user | `quote_received` | `Quote Received!` / `{business} sent a quote for ₹{amt}` |
| Provider rejected | user | `enquiry_update` | `Enquiry declined` / `{business} can't take this booking` |
| Customer accepted quote | provider | `enquiry_update` | `Quote accepted` / `{name} accepted your quote` |
| Booking confirmed | user | `booking` | `Booking confirmed!` / `{business} confirmed your {eventType} on {date}` |
| Cancelled by customer | provider | `enquiry_update` | `Enquiry cancelled` |
| Cancelled by provider | user | `booking` | `Booking cancelled` |
| Booking completed | user | `booking` | `How was {business}?` / `Rate your experience` |
| Review submitted | provider | `review` | `New {n}★ review` / `{customer}: "{first 80 chars}"` |
| Provider replied to review | user | `review` | `{business} replied to your review` |
| Approved / rejected / suspended | provider | `approval` | per admin action |
| Doc verified / rejected / expiring | provider | `document` | `FSSAI expires in {n} days` etc. |

`notify.service` creates the DB row, then (best effort) sends Expo push using the latest session `pushToken`.

## 8. Metric formulas

**User summary (`/enquiries/summary`):** `activeCount` = enquiries with status ∈ {`submitted, provider_reviewing, quote_sent, accepted, confirmed`}; `awaitingResponseCount` = status `quote_sent`.

**Provider dashboard (`/dashboard/metrics`):**
- `active_enquiries` = status ∈ {`submitted, provider_reviewing, quote_sent, accepted`}
- `quote_pending` = status ∈ {`submitted, provider_reviewing`}
- `upcoming_bookings` = bookings `confirmed` with `eventDate ≥ today`
- `month_earnings` = Σ payments with `paidAt` in the current IST month
- `response_rate_percent` = `round(100 × answered / received)` over enquiries created in the last 90 days (`answered` = has `firstRespondedAt` or status ≠ `submitted`); 100 when none.

**CRM stats:** `total_customers` = count; `repeat_clients` = `totalBookings ≥ 2`; `repeat_rate_percent` = `repeat/total × 100` (1 dp); `avg_lifetime_value` = mean `totalSpent` over customers with ≥1 booking (rounded).

**Analytics overview (period → date range on booking `eventDate`):** `total_revenue` = Σ `totalAmount` of `completed` bookings; `completed_events` = their count; `total_guests_served` = Σ `guestCount`; `avg_event_value` = revenue / events (0 if none); `conversion_rate_percent` = `(enquiries with status confirmed|completed or bookingId) / enquiries created in period × 100` (1 dp). `this_month` = current IST month; `last_3_months` = rolling 3 calendar months incl. current; `this_year` = Jan 1 → today.

**Revenue chart:** per month `revenue` = Σ `totalAmount` of completed bookings by event month; `events` = count.

**Earnings:**
- `total_lifetime_earnings` = Σ payments on non-cancelled bookings × (1 − commission%)
- `this_month_earnings` = same, current month by `paidAt`
- `escrow_advance_held` = Σ payments on bookings `confirmed|in_progress`
- `pending_payout` = (Σ payments on `completed` bookings × (1 − commission%)) − Σ payouts with status ≠ `failed`, floored at 0
- `next_payout_date` = next Tuesday (IST) as `YYYY-MM-DD` (per provider FAQ)

## 9. Scheduled jobs (`node-cron`, IST)

| Job | Schedule | Action |
| :-- | :-- | :-- |
| `documentExpiry` | daily 09:00 | For docs with `expiryDate` in 30/7/1 days (track `lastReminderDays`) → notify provider (`document`); expired FSSAI → recompute `verified`. |
| `staleEnquiry` | hourly | `submitted`, > 24 h old, `staleReminderSent=false` → notify provider once. |
| `comboHousekeeping` | daily 00:30 | Set `isActive=false` for combos past `validUntil` (queries also filter, this is cosmetic for provider list). |

Jobs must be idempotent and disabled when `JOBS_ENABLED=false`.

## 10. Transaction boundaries (require replica set)

| Operation | Collections touched |
| :-- | :-- |
| Submit enquiry | `enquiries`, `counters` (CRM sync + notify after commit) |
| Confirm booking | `enquiries`, `bookings`, `provider_availability`, `counters` |
| Cancel booking | `bookings`, `enquiries`, `provider_availability` |
| Complete booking | `bookings`, `enquiries` |
| Record payment | `bookings`, `counters` |
| Submit review | `reviews`, `enquiries`, `providers` (rating aggregates) |
| Bulk calendar update | `provider_availability` (`bulkWrite`, not transactional) |

## 11. Rating recompute (`rating.service`)

After any review insert/hide: aggregate `status='published'` reviews of the provider → `rating = round(avg(rating),1)`, `ratingBreakdown {1..5}`, `reviewCount`. Provider public summary also exposes pillar averages. Provider "reply" never changes ratings.
