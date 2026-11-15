# Changelog

All notable changes to the `@nsaky/eventkit` package will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2026-11-16

### Initial Public Release

`@nsaky/eventkit` is a lightweight, zero-database Node.js toolkit for event registration, digital ticketing, QR code generation, ticket validation, attendee check-in, attendance analytics, and data export.

#### Added
- **Core Event Management**:
  - `createEvent`: Create events with auto-generated unique IDs (`evt_<24-hex>`), ISO timestamps, and capacity constraints.
  - `getEvent`: Retrieve single event by ID.
  - `getAllEvents`: List all stored events.
  - `updateEvent`: Update permitted fields while preserving immutable fields and enforcing capacity floors.
  - `deleteEvent`: Delete events with cascade cleanup of associated attendees and tickets.
- **Attendee Registration**:
  - `registerAttendee`: Register participants with schema validation, email normalization, duplicate prevention, and capacity enforcement. Automatically generates and links a digital ticket.
  - `getAttendee`: Retrieve attendee details including associated ticket metadata.
  - `getAttendees`: Retrieve all attendees registered for a specific event.
  - `removeAttendee`: Remove an attendee and cascade-remove their associated ticket.
- **Digital Ticketing**:
  - Cryptographically secure ticket ID generator (`EK-<10-HEX>`).
  - `getTicket`: Fetch ticket record by ID.
  - `getAllTickets`: Retrieve all tickets across events.
  - `getTickets`: Retrieve all tickets belonging to a specific event.
  - `generateTicket`: Standalone ticket generation for historical or manual workflows.
  - `cancelTicket`: Invalidate active tickets while preventing cancellation of already used tickets.
  - Status lifecycle: `ACTIVE`, `USED`, and `CANCELLED`.
- **Scannable QR Codes**:
  - `generateQRCode`: Generate scannable QR codes in **PNG** (Buffer) or **SVG** (string) format.
  - Encodes minimal, non-PII reference payload: `{ ticketId, eventId }`.
  - Configurable width, margin, error correction level, and optional file saving with overwrite guards.
- **Ticket Validation & Arrival Check-in**:
  - `validateTicket`: Non-destructive inspection returning structured states: `VALID`, `INVALID`, `WRONG_EVENT`, `ALREADY_CHECKED_IN`, and `CANCELLED`.
  - `checkIn`: Atomic attendee check-in transitioning ticket to `USED` and attendee to `checkedIn: true`.
  - Duplicate check-in prevention with precise ISO timestamp preservation.
  - `getCheckInStatus`: Retrieve arrival state and timestamp for any ticket.
  - `getCheckedInAttendees`: Retrieve all checked-in participants for an event.
- **Real-Time Attendance Analytics**:
  - `getAttendanceStats`: Calculates total registrations, checked-in count, pending count, attendance percentage, and registration capacity fill rate without division-by-zero risks.
- **Search Engine**:
  - `searchAttendees`: Case-insensitive substring search by attendee name, email, or ticket ID, with status filters (`checkedIn`, `status`).
  - `searchTicket`: Resolves ticket record along with full attendee and event metadata.
- **Data Export System**:
  - `exportAttendees`: Export attendee rosters to JSON or RFC 4180 compliant CSV (with proper escaping of quotes, commas, newlines, and unicode text).
  - `exportEvent`: Export full event snapshot with summary statistics and attendee rosters.
  - Optional disk persistence with path validation and overwrite protection.
- **Persistent JSON Storage Engine**:
  - Local file-based persistence (`events.json`, `attendees.json`, `tickets.json`) without external database dependencies.
  - Atomic writes via staged temporary files and atomic renames.
  - In-process concurrency mutex (`runExclusive`) to serialize write operations.
  - Corruption resilience: refuses to overwrite invalid JSON and preserves corrupt data for recovery.
  - Fully configurable storage path (defaults to `./eventkit-data`).
- **Structured Error Handling**:
  - Unified error hierarchy extending `EventKitError` with stable machine-readable error codes.
