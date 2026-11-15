# EventKit

A lightweight, modular, and reusable Node.js toolkit for event registration, digital ticketing, QR code generation, ticket validation, attendee check-in, attendance tracking, and data export with persistent JSON file storage.

> **Phase 2 Release (Current)**: Core Infrastructure, Persistent Storage, Event & Attendee Management, Digital Ticketing, QR Codes (PNG & SVG), Validation, Check-in, Attendance Analytics, Search, and JSON/CSV Exports.  
> *Note: Phase 3 will introduce comprehensive benchmark suites, developer guide demos, and npm packaging verification.*

---

## Features

- **Persistent JSON Storage**: No external database needed. Maintains local JSON records (`events.json`, `attendees.json`, `tickets.json`) with atomic file writes via temporary files and automatic schema initialization.
- **Write Serialization & Concurrency Protection**: In-process mutex (`runExclusive`) and atomic batch operations (`saveBatch`) to prevent concurrent write collisions.
- **Automatic & Standalone Ticketing**: Generates cryptographically secure ticket IDs (`EK-<10-HEX>`). Automatically creates a ticket on registration and supports standalone issuance.
- **QR Code Generation**: Generates scannable QR codes in both **PNG** (Buffer) and **SVG** (string) with customizable dimensions, error correction levels, and file-saving options. Encodes only non-PII references (`{ ticketId, eventId }`).
- **Ticket Validation**: Non-destructive validation reporting statuses: `VALID`, `INVALID`, `WRONG_EVENT`, `ALREADY_CHECKED_IN`, and `CANCELLED`.
- **Attendee Check-in**: Synchronized check-in updating ticket status to `USED` and attendee `checkedIn` to `true`, preventing duplicate check-ins and recording precise timestamps.
- **Real-Time Attendance Analytics**: Computes total registrations, checked-in count, pending count, attendance rate, and capacity fill rate without division-by-zero risks.
- **Record Search**: Case-insensitive substring search by attendee name, email, or ticket ID, with filters for attendance status.
- **Data Export (JSON & CSV)**: Exports event and attendee snapshots directly as strings or writes to disk with RFC 4180 CSV escaping and overwrite protection.
- **Structured Error Handling**: Centralized error classes with stable error codes (`EVENT_NOT_FOUND`, `DUPLICATE_REGISTRATION`, `ALREADY_CHECKED_IN`, etc.).

---

## Installation

```bash
npm install eventkit
```

*Requirements: Node.js >= 20.0.0*

---

## Complete Workflow Example

```javascript
const EventKit = require('eventkit');

async function main() {
  // 1. Initialize EventKit with storage directory
  await EventKit.initialize({ storagePath: './my-event-data' });

  // 2. Create an event
  const event = await EventKit.createEvent({
    name: 'Tech Summit 2026',
    description: 'Annual technology conference',
    date: '2026-12-15',
    location: 'Pune',
    capacity: 200
  });

  // 3. Register an attendee (automatically generates a ticket)
  const attendee = await EventKit.registerAttendee(event.id, {
    name: 'Jane Doe',
    email: 'jane@example.com',
    phone: '+919876543210'
  });
  console.log(`Registered: ${attendee.name}, Ticket ID: ${attendee.ticket.id}`);

  // 4. Generate QR code (PNG Buffer or save to file)
  const qr = await EventKit.generateQRCode(attendee.ticket.id, {
    format: 'png',
    filePath: './tickets/jane-ticket.png'
  });
  console.log(`QR code saved to: ${qr.filePath}`);

  // 5. Validate ticket before check-in
  const validation = await EventKit.validateTicket(event.id, attendee.ticket.id);
  console.log(`Validation status: ${validation.status}`); // 'VALID'

  // 6. Check in attendee
  const checkIn = await EventKit.checkIn(event.id, attendee.ticket.id);
  console.log(`Check-in successful at: ${checkIn.checkedInAt}`);

  // 7. Get attendance statistics
  const stats = await EventKit.getAttendanceStats(event.id);
  console.log(`Attendance: ${stats.totalCheckedIn}/${stats.totalRegistrations} (${stats.attendancePercentage}%)`);

  // 8. Search attendees
  const searchResults = await EventKit.searchAttendees(event.id, 'jane', { checkedIn: true });
  console.log(`Found ${searchResults.length} checked-in attendee(s).`);

  // 9. Export to CSV
  const csv = await EventKit.exportAttendees(event.id, 'csv', {
    filePath: './exports/attendees.csv'
  });
  console.log('Exported attendees to CSV.');
}

main().catch(console.error);
```

---

## API Reference

### 1. Initialization

#### `EventKit.initialize(options)`
Initializes the storage directory and JSON files (`events.json`, `attendees.json`, `tickets.json`). Safe to call multiple times.
- `options.storagePath` *(string, optional)*: Custom directory. Defaults to `./eventkit-data`.

---

### 2. Event Management

#### `EventKit.createEvent(data)`
Creates a new event record.
- **Parameters**:
  - `data.name` *(string, required)*
  - `data.date` *(string, required)*: `YYYY-MM-DD` calendar date
  - `data.description` *(string, optional)*
  - `data.location` *(string, optional)*
  - `data.capacity` *(number, optional)*: Positive integer or `null`
- **Returns**: `Promise<object>` (`id` prefix `evt_`).

#### `EventKit.getEvent(eventId)`
Retrieves an event by ID or returns `null`.

#### `EventKit.getAllEvents()`
Returns a list of all events.

#### `EventKit.updateEvent(eventId, updates)`
Updates permitted fields (`name`, `date`, `description`, `location`, `capacity`). Cannot modify `id` or `createdAt`. Cannot reduce capacity below current registration count.

#### `EventKit.deleteEvent(eventId)`
Deletes an event and cascade-deletes all associated attendees and tickets.

---

### 3. Attendee Management

#### `EventKit.registerAttendee(eventId, attendeeData)`
Registers an attendee and automatically creates a digital ticket.
- **Parameters**:
  - `eventId` *(string, required)*
  - `attendeeData.name` *(string, required)*
  - `attendeeData.email` *(string, required)*: Normalized to lowercase. Duplicate emails for the same event are rejected.
  - `attendeeData.phone` *(string, optional)*
- **Returns**: `Promise<object>` - Attendee record with nested `ticket` object.

#### `EventKit.getAttendee(attendeeId)`
Retrieves an attendee by ID (with ticket metadata) or `null`.

#### `EventKit.getAttendees(eventId)`
Retrieves all attendees registered for the given event.

#### `EventKit.removeAttendee(attendeeId)`
Removes an attendee and cascade-deletes their associated ticket.

---

### 4. Ticket Management

#### `EventKit.generateTicket(attendeeId, options)`
Generates a standalone ticket for an existing attendee.
- `options.returnExisting` *(boolean, default: false)*: If true, returns existing ticket instead of throwing `TicketAlreadyExistsError`.

#### `EventKit.getTicket(ticketId)`
Retrieves a ticket record by ID or returns `null`.

#### `EventKit.validateTicket(eventId, ticketId)`
Validates ticket authenticity without mutating records.
- **Returns**:
  ```javascript
  {
    valid: boolean,
    status: 'VALID' | 'INVALID' | 'WRONG_EVENT' | 'ALREADY_CHECKED_IN' | 'CANCELLED',
    message: string,
    ticket: object | null,
    attendee: object | null
  }
  ```

#### `EventKit.cancelTicket(ticketId)`
Cancels an active ticket. Throws `TicketAlreadyUsedError` if the ticket was already used for check-in.

#### `EventKit.generateQRCode(ticketId, options)`
Generates a QR code containing `{ ticketId, eventId }`.
- **Options**:
  - `format`: `'png'` (default) or `'svg'`
  - `width`: number (default: 300)
  - `margin`: number (default: 2)
  - `errorCorrectionLevel`: `'L' | 'M' | 'Q' | 'H'` (default: `'M'`)
  - `filePath`: string (optional, saves to file)
  - `overwrite`: boolean (default: false)
- **Returns**:
  ```javascript
  {
    ticketId: string,
    eventId: string,
    format: 'png' | 'svg',
    mimeType: 'image/png' | 'image/svg+xml',
    data: Buffer | string,
    filePath: string | null
  }
  ```

---

### 5. Check-in Management

#### `EventKit.checkIn(eventId, ticketId)`
Performs an attendee check-in.
- Verifies ticket belongs to `eventId`, is `ACTIVE`, and has not been used.
- Atomically sets ticket status to `USED` and attendee `checkedIn` to `true`.
- Repeated check-ins throw `AlreadyCheckedInError`.
- **Returns**:
  ```javascript
  {
    success: true,
    status: 'CHECKED_IN',
    ticketId: string,
    eventId: string,
    attendeeId: string,
    attendeeName: string,
    checkedInAt: string,
    message: string
  }
  ```

#### `EventKit.getCheckInStatus(ticketId)`
Returns current check-in state:
```javascript
{
  ticketId: string,
  eventId: string,
  attendeeId: string,
  status: 'ACTIVE' | 'USED' | 'CANCELLED',
  checkedIn: boolean,
  checkedInAt: string | null
}
```

#### `EventKit.getCheckedInAttendees(eventId)`
Returns a list of all attendees for the event who have checked in.

---

### 6. Attendance Statistics

#### `EventKit.getAttendanceStats(eventId)`
Calculates attendance metrics from persistent records:
```javascript
{
  eventId: string,
  eventName: string,
  totalRegistrations: number,
  totalCheckedIn: number,
  totalPending: number,
  attendancePercentage: number,
  capacity: number | null,
  registrationPercentage: number | null
}
```

---

### 7. Search

#### `EventKit.searchAttendees(eventId, query, options)`
Case-insensitive search across name, email, or ticket ID.
- `options.checkedIn` *(boolean, optional)*
- `options.status` *(string, optional)*

#### `EventKit.searchTicket(ticketId)`
Retrieves a ticket along with its associated `attendee` and `event` objects.

---

### 8. Export

#### `EventKit.exportAttendees(eventId, format, options)`
Exports attendee records for an event in `'json'` or `'csv'`.
- `options.filePath` *(string, optional)*
- `options.overwrite` *(boolean, default: false)*

#### `EventKit.exportEvent(eventId, format, options)`
Exports a full event snapshot with summary analytics and attendee records.

---

## Error Handling

All custom errors inherit from `EventKitError` and include stable error codes:

```javascript
const EventKit = require('eventkit');
const {
  EventNotFoundError,
  TicketNotFoundError,
  WrongEventError,
  AlreadyCheckedInError,
  TicketCancelledError,
  DuplicateRegistrationError,
  EventCapacityReachedError
} = EventKit.errors;
```

### Stable Error Codes
- `EVENT_NOT_FOUND`
- `ATTENDEE_NOT_FOUND`
- `TICKET_NOT_FOUND`
- `INVALID_EVENT_ID`
- `INVALID_TICKET_ID`
- `TICKET_ALREADY_EXISTS`
- `TICKET_ALREADY_USED`
- `TICKET_CANCELLED`
- `WRONG_EVENT`
- `ALREADY_CHECKED_IN`
- `DUPLICATE_REGISTRATION`
- `EVENT_CAPACITY_REACHED`
- `INVALID_QR_FORMAT`
- `QR_GENERATION_FAILED`
- `UNSUPPORTED_EXPORT_FORMAT`
- `EXPORT_FAILED`
- `FILE_ALREADY_EXISTS`
- `INVALID_EXPORT_PATH`
- `STORAGE_ERROR`
- `STORAGE_CORRUPTED`
- `NOT_INITIALIZED`

---

## Running Tests & Examples

Run the Vitest test suite:

```bash
npm test
```

Run the complete workflow demonstration:

```bash
node examples/complete-workflow.js
```

---

## License

MIT © [Yasir Eqbal](LICENSE)
