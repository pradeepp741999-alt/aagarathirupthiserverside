# Decisions Log

This document records all architectural choices, contract reconciliations, and default configurations adopted in the Aagara Thirupthi backend.

## Contract Decisions (D1 - D20)

- **D1: Role-aware Shared Routes:** The same URL endpoints (`/api/v1/enquiries`, `/notifications`, `/auth/*`, `/categories`, `/districts`) serve both User and Provider applications, dispatching dynamically based on the verified role.
- **D2: Role Resolution:** Role is determined by the verified JWT `role` claim, or fallback to the `X-App-Role` header (`user` | `provider`), defaulting to `user` on public master data endpoints. Mismatches return 403 `ROLE_MISMATCH`.
- **D3: Response Envelopes:** Provider role responses are wrapped in `{ success: true, data: ..., message?: string, meta?: ... }`. User role responses receive the raw payload matching the existing React Native client.
- **D4: Field Casing:** Provider role receives deep `snake_case` keys and accepts `snake_case` inputs. User role receives and sends `camelCase`.
- **D5: Error Envelopes:** Provider errors follow `{ success: false, error: { code, message, details } }` with HTTP 422 for validation. User errors follow `{ success: false, statusCode, code, message, errors }` with HTTP 400 for validation.
- **D6: Canonical Status Enum:** All internal enquiry states are mapped to 8 canonical values: `submitted`, `provider_reviewing`, `quote_sent`, `accepted`, `confirmed`, `completed`, `cancelled`, `rejected`.
- **D7: Acceptance vs Confirmation:** Customer accepting quote moves status to canonical `accepted`. Only the provider can confirm the booking, triggering calendar reservation and booking creation.
- **D8: Calendar Availability:** Days are stored sparsely (`available`, `blocked`, `booked`). Non-existing records default to `available`.
- **D9: Provider Screen API as Contract:** Legacy `/api/v1/provider/*` paths are discarded in favor of documented screen endpoints under `/api/v1/providers/*`.
- **D10: Enum Standardization:** Input normalization for `non-veg` / `non_veg`, catering pricing models (`per_plate`, `per_event`, `fixed`, `hourly`), and document types.
- **D11: Human-readable Codes:** Prefixed sequential identifiers (`ENQ-100001`, `BKG-100001`, `REC-100001`, `INV-100001`, `TKT-100001`).
- **D12: Date Normalization:** Event and calendar dates stored as `"YYYY-MM-DD"` in Indian Standard Time (`Asia/Kolkata`).
- **D13: Distance Calculations:** Haversine formula computed in application memory based on provider's primary district/area coordinates.
- **D14: Category Icons:** Stored with both Ionicons (user) and Lucide (provider) representations.
- **D15: District Area Models:** Districts include localities and taluks; responses formatted according to user and provider schema requirements.
- **D16: Notification Type Mapping:** Canonical types mapped to user and provider specific category labels.
- **D17: Combo Validity Dates:** Tolerant parsing supporting ISO and display date formats, formatted cleanly for each client.
- **D18: Registration Step Sequence:** Next step number returned to the client (1-7), preventing skipping ahead.
- **D19: Provider Access Gating:** Unapproved providers restricted to registration, profile status, documents, and support endpoints.
- **D20: Provider-mode Aliases:** User-side combo and calendar management actions routed to provider catalog and availability services.
