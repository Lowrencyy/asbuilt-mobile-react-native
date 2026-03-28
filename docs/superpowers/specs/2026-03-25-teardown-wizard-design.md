# Teardown Wizard Design Spec

**Date:** 2026-03-25
**Project:** TelcoVantage Mobile (react-test/my-app)
**Feature:** Lineman Teardown Wizard Flow

---

## Overview

A step-by-step wizard that guides a lineman through a full cable teardown:
capturing photos of both poles in a span, selecting which span they worked on,
reporting cable collection, and inputting recovered components — then submitting
everything in one API call that maps directly to a daily report.

---

## User Flow

```
poles.tsx (existing)
  └→ pole-detail.tsx        ← MODIFIED: add "Select Pair" CTA
       └→ teardown/select-pair.tsx    ← NEW
            └→ teardown/kabila-pole.tsx   ← NEW
                 └→ teardown/components.tsx ← NEW
                      └→ daily-report (existing)
```

---

## Draft File Storage

All photos are saved to a shared `draftDir` on the filesystem:
```
{FileSystem.documentDirectory}teardown_drafts/{project}/{node_id}/{pole_id}/
```

Filenames are deterministic (based on pole codes):
```
{from_pole_code}_before.jpg   {from_pole_code}_after.jpg   {from_pole_code}_poletag.jpg
{to_pole_code}_before.jpg     {to_pole_code}_after.jpg     {to_pole_code}_poletag.jpg
{from_pole_code}_cable.jpg    (optional — missing cable photo)
```

**Photo URIs are never passed as route params.** URIs are too long and risk
truncation on Android. Each screen reconstructs photo URIs from the known
`draftDir` path + deterministic filename using only the pole codes (which
travel in route params).

**Copy-on-enter (select-pair screen):** When `teardown/select-pair.tsx` mounts,
it copies from_pole photos from `pole_drafts/{project}/{node_id}/{pole_id}/`
into `teardown_drafts/` under the deterministic names above.
- If the source file is missing: show alert "Starting pole photos not found.
  Please go back and retake them." with a Back button. Do not proceed.
- Original `pole_drafts/` files are deleted on successful submission.

---

## Screen 1 — `app/projects/pole-detail.tsx` (modified)

### What changes

- No changes to existing photo capture logic (before, after, pole_tag, GPS).
- Add a **"Select Pair →"** button that appears at the bottom once all required
  fields are filled: GPS + before photo + pole_tag photo.
- After photo remains optional (same as now).
- Button is disabled while any required field is missing.
- On press: navigate to `teardown/select-pair` passing IDs and codes only —
  **no photo URIs** (photos are already on disk in `pole_drafts/`).

### Params passed forward

```
pole_id, pole_code, node_id, project_id, project_name, accent
```

---

## Screen 2 — `app/teardown/select-pair.tsx` (new)

### Purpose

Identify which span (and thus which destination pole) the lineman is working on.

### On Mount
1. Copy from_pole photos from `pole_drafts/` → `teardown_drafts/`.
   On copy failure → show alert + Back button, do not proceed.
2. Call `GET /api/v1/poles/{pole_id}/spans` — show a loading spinner
   while in flight.
3. Evaluate result:
   - **Network error** → show "Could not load spans. Check your connection."
     with a Retry button.
   - **0 spans** → show "No spans found for this pole." with a Back button.
     Do not auto-proceed.
   - **1 span** → auto-navigate to `teardown/kabila-pole` immediately,
     no selection UI shown.
   - **2+ spans** → show span selection UI.

### Selection UI (2+ spans)

- Header: "Which pole did you see on the other end?"
- One card per span:
  - Destination pole code (large, prominent)
  - Span code (small, secondary)
  - Expected cable (e.g. "252m expected")
- Lineman taps the pole they saw on the other end → navigate to kabila-pole.

### Params passed forward

```
pole_id, pole_code, node_id, project_id, project_name, accent,
span_id, span_code, to_pole_id, to_pole_code,
expected_cable, length_meters, declared_runs,
expected_node, expected_amplifier, expected_extender,
expected_tsc, expected_powersupply, expected_powersupply_housing
```

---

## Screen 3 — `app/teardown/destination-pole.tsx` (new)

### Purpose

Capture before, after, and pole_tag photos of the destination pole.

### UI

- Header shows: "Destination Pole: [to_pole_code]"
- Three photo boxes using the same `PhotoBox` pattern as pole-detail:
  - Before photo (`to_before`) — required
  - After photo (`to_after`) — required
  - Pole Tag photo (`to_tag`) — required
- Photos saved to `teardown_drafts/` under deterministic filenames on capture.
- GPS is captured in the background on mount (last-known first, then current,
  background retry on failure — same pattern as pole-detail). Stored as
  `toPoleGps` in component state. GPS is **not** a blocker for the
  "Proceed" button — if unavailable, `to_pole_latitude/longitude` are simply
  omitted from the submission payload.
- "Proceed to Teardown →" button enabled only when all 3 photos are captured.

### Params passed forward

Same params as received — no new params added. To_pole photos are on disk
in `teardown_drafts/` and are reconstructed by Screen 4 from `to_pole_code`.

---

## Screen 4 — `app/teardown/components.tsx` (new)

### On Mount
- Load all 6 photos from `teardown_drafts/` using deterministic paths.
- Capture a form-level GPS fix in background (general location for the
  submission audit trail, separate from per-pole GPS).
- Capture `started_at` via `getTrustedNow()` (existing tamper-resistant
  server-anchored timestamp in `lib/trustedTime.ts`).

### Purpose

Show teardown state summary, collect cable data and component counts via modals,
then submit everything in one API call.

### Main Screen Layout

```
┌──────────────────────────────────┐
│  POLE-001  →  POLE-002           │
│  3 photos ✓     3 photos ✓       │
└──────────────────────────────────┘

┌──────────────────────────────────┐
│  🔌  Cable Collection        →   │
│  Status: Not yet filled          │  ← tappable card
└──────────────────────────────────┘

┌──────────────────────────────────┐
│  📦  Components              →   │
│  Status: Not yet filled          │  ← tappable card
└──────────────────────────────────┘

      [  Submit Teardown  ]
      (disabled until both cards filled)
```

After each modal is saved, the card updates:

- Cable: "Collected: 252m ✓" or "Unrecovered: 42m ⚠️"
- Components: "6 / 6 items filled ✓"

**No photo thumbnails. No review cards. No extra tappable items.**
Linemen only interact with the two modal cards and the submit button.

---

## Modal A — Cable Collection

Triggered by tapping the Cable card.

```
╔══════════════════════════════════╗
║  🔌  Cable Collection            ║
╠══════════════════════════════════╣
║                                  ║
║  Expected Cable                  ║
║  ┌────────────────────────────┐  ║
║  │  63m × 4 runs = 252m       │  ║
║  └────────────────────────────┘  ║
║                                  ║
║  Did you collect all cable?      ║
║  ┌──────────┐  ┌─────────────┐   ║
║  │  ✓ YES   │  │  ✗ NO       │   ║
║  └──────────┘  └─────────────┘   ║
║                                  ║
║  ─── (visible only if NO) ─────  ║
║                                  ║
║  Meters Recovered                ║
║  ┌────────────────────────────┐  ║
║  │  210                   m   │  ║
║  └────────────────────────────┘  ║
║                                  ║
║  Unrecovered (auto-calc)         ║
║  ┌────────────────────────────┐  ║
║  │  42m  ⚠️                    │  ║
║  └────────────────────────────┘  ║
║                                  ║
║  Reason                          ║
║  ┌────────────────────────────┐  ║
║  │  Stolen / Cut / etc...     │  ║
║  └────────────────────────────┘  ║
║                                  ║
║  Photo of Missing Cable          ║
║  ┌────────────────────────────┐  ║
║  │  📷  Attach Photo          │  ║
║  │  (tap to capture/upload)   │  ║
║  └────────────────────────────┘  ║
║                                  ║
║  ┌────────────────────────────┐  ║
║  │      Confirm Cable         │  ║
║  └────────────────────────────┘  ║
╚══════════════════════════════════╝
```

### Cable calculation logic

- `expected_cable` = `length_meters × declared_runs` (from span, shown read-only)
- `unrecovered` = `expected_cable − recovered` (auto-calculated, shown live)
- `collected_cable`:
  - If YES → equals `expected_cable`
  - If NO → equals the recovered input value
- `recovered_cable` is also sent as a separate field when NO (in addition
  to `collected_cable`)
- Missing cable photo → saved to `teardown_drafts/` as `{from_pole}_cable.jpg`,
  maps to `before_span` field in API and `photo_type: missing_cable` in
  `teardown_log_images`

---

## Modal B — Components

Triggered by tapping the Components card.

```
╔══════════════════════════════════╗
║  📦  Collected Components        ║
╠══════════════════════════════════╣
║                                  ║
║  [ Node  exp:2  − 2 + ]  [ Amp  exp:1  − 1 + ]   ║
║  [ Ext   exp:3  − 3 + ]  [ TSC  exp:0  − 0 + ]   ║
║  [ PS    exp:1  − 1 + ]  [ PSH  exp:1  − 1 + ]   ║
║                                  ║
║  ┌────────────────────────────┐  ║
║  │      Save Components       │  ║
║  └────────────────────────────┘  ║
╚══════════════════════════════════╝
```

Counters displayed **2 per row**. Each row is a
`<View style={{flexDirection: 'row'}}>` wrapping two counters, each with
`flex: 1, marginHorizontal: 4`.

Each counter shows:
- Component name
- Expected count from span (`exp: N`)
- Decrement (−) button, current value, Increment (+) button
- Decrement disabled at 0; **no upper limit** (lineman may find more than expected)
- Minimum touch target for − and + buttons: 44×44pt

`did_collect_components` is set to `true` if any of the 6 collected values > 0.

Components tracked:

| Field | Label |
|-------|-------|
| `collected_node` | Node |
| `collected_amplifier` | Amplifier |
| `collected_extender` | Extender |
| `collected_tsc` | TSC |
| `collected_powersupply` | Power Supply |
| `collected_powersupply_housing` | PS Housing |

---

## Submission

### Timestamps
- `started_at`: captured on Screen 4 mount via `getTrustedNow()`.
- `finished_at`: captured at submit press via `getTrustedNow()`.

### User identity
- `submitted_by` → `tokenStore.getUser().name` (from `lib/token.ts`)
- `team` → `tokenStore.getUser().team`

### GPS fields
- **Form-level** (`captured_latitude`, `captured_longitude`,
  `gps_accuracy_meters`, `gps_source`): captured on Screen 4 mount —
  general location at submission time.
- **Per-pole** (`from_pole_latitude/longitude/gps_captured_at`,
  `to_pole_latitude/longitude/gps_captured_at`): captured at first photo
  tap on each pole screen. Falls back to form-level GPS if unavailable.
  All GPS fields are optional — submission is not blocked if GPS unavailable.

### API Call

`POST /api/v1/teardown-logs` — multipart/form-data

**Text fields:**
```
pole_span_id, node_id, project_id,
submitted_by, team,
did_collect_all_cable, collected_cable, unrecovered_cable, unrecovered_reason,
recovered_cable  (only when did_collect_all_cable = false),
did_collect_components,
collected_node, collected_amplifier, collected_extender, collected_tsc,
collected_powersupply, collected_powersupply_housing,
started_at, finished_at,
captured_latitude, captured_longitude, gps_accuracy_meters, gps_source,
from_pole_latitude, from_pole_longitude, from_pole_gps_captured_at, from_pole_gps_accuracy,
to_pole_latitude, to_pole_longitude, to_pole_gps_captured_at, to_pole_gps_accuracy
```

**Photo fields (inline multipart):**
```
from_before, from_after, from_tag,
to_before, to_after, to_tag,
before_span  (optional — only when missing cable photo captured)
```

### Error handling

| Response | Behavior |
|----------|----------|
| 201 Created | Delete drafts, navigate to daily report |
| 409 Conflict | Alert: "This span has already been submitted." Navigate back to pole list |
| 422 Validation | Alert showing fields from `response.data.errors` |
| Network / timeout | Alert: "Submission failed. Check your connection and try again." Stay on screen |

Offline queuing is **out of scope** for this feature. A simple failure alert
is shown if the device is offline. Offline support is a follow-up sprint.

### Post-success cleanup
1. Delete `teardown_drafts/{project}/{node_id}/{pole_id}/`
2. Delete `pole_drafts/{project}/{node_id}/{pole_id}/`
3. Navigate to daily report

---

## New Files

| File | Description |
|------|-------------|
| `app/teardown/_layout.tsx` | Expo Router layout for teardown group |
| `app/teardown/select-pair.tsx` | Span selection (loading / error / empty states) |
| `app/teardown/destination-pole.tsx` | Destination pole photo capture |
| `app/teardown/components.tsx` | Cable modal + Components modal + Submit |

## Modified Files

| File | Change |
|------|--------|
| `app/projects/pole-detail.tsx` | Add "Select Pair →" CTA after required fields filled |

## Backend Changes

### 1. `TeardownLogController.php` — add to `store()` validation:
```php
'collected_powersupply'         => 'nullable|integer|min:0',
'collected_powersupply_housing' => 'nullable|integer|min:0',
```

### 2. `TeardownLog.php` — add to `$fillable`:
```php
'collected_powersupply',
'collected_powersupply_housing',
```
(DB columns already exist from original migration.)

### 3. `TeardownLogResource.php` (if it exists)
Add both fields to the resource array.
