# EventKit

A lightweight, modular, and reusable Node.js toolkit for event registration and attendee management with persistent JSON file storage.

> **Phase 1 Release (Current)**: Core Infrastructure, Persistent Storage, Event Management, and Attendee Registration.  
> *Note: Digital ticketing, QR code generation, check-in verification, attendance statistics, advanced search, and data export are scheduled for Phase 2 and Phase 3.*

---

## Features (Phase 1)

- **Persistent JSON Storage**: Zero external database requirement. Maintains local persistent storage (`./eventkit-data/` by default or custom path) with atomic file writes via temporary files and automatic directory/file initialization.
- **Write Serialization & Data Integrity**: Built-in concurrency lock (`runExclusive`) and batch update mechanism preventing concurrent write race conditions.
- **Event Management**: Create, retrieve, list, update, and delete events. Updating protects creation metadata and prevents capacity reductions below current registration count.
- **Cascade Deletion**: Deleting an event atomically cascades to all associated attendee records.
- **Attendee Registration**: Register attendees with validation, email normalization (`trim` + `toLowerCase`), and cryptographically secure IDs.
- **Duplicate Prevention**: Strictly prevents registering the same normalized email address more than once for the same event, while permitting registration across different events.
- **Capacity Enforcement**: Enforces configured maximum attendee capacity derived dynamically from actual stored attendee records.
- **Structured Error Handling**: Comprehensive custom error classes with stable error codes (`EVENT_NOT_FOUND`, `DUPLICATE_REGISTRATION`, `EVENT_CAPACITY_REACHED`, `STORAGE_CORRUPTED`, etc.).
- **CommonJS & Node.js 20+**: Native CommonJS interface, asynchronous Promise-based API, returning safe copies of in-memory records.

---

## Installation

```bash
npm install eventkit
```

*Requirements: Node.js >= 20.0.0*

---

## Quick Start

```javascript
const EventKit = require('eventkit');

async function main() {
  // 1. Initialize EventKit (uses './eventkit-data' by default or custom path)
  await EventKit.initialize({ storagePath: './my-event-data' });

  // 2. Create an event
  const event = await EventKit.createEvent({
    name: 'Tech Summit 2026',
    description: 'Annual technology conference',
    date: '2026-12-15',
    location: 'Pune',
    capacity: 100
  });
  console.log('Created Event:', event);

  // 3. Register an attendee
  const attendee = await EventKit.registerAttendee(event.id, {
    name: 'John Doe',
    email: 'john@example.com',
    phone: '+919876543210'
  });
  console.log('Registered Attendee:', attendee);

  // 4. Retrieve attendees for the event
  const attendees = await EventKit.getAttendees(event.id);
  console.log(`Attendees for event (${attendees.length}):`, attendees);
}

main().catch(console.error);
```

---

## API Reference (Phase 1)

### Initialization

#### `EventKit.initialize(options)`
Initializes the persistent JSON storage engine. Safe to call multiple times.
- `options.storagePath` *(string, optional)*: Custom directory path. Defaults to `./eventkit-data`. Relative paths are resolved against `process.cwd()`.

### Event Management

#### `EventKit.createEvent(data)`
Creates a new event and persists it.
- **Parameters**:
  - `data.name` *(string, required)*: Non-empty event name.
  - `data.date` *(string, required)*: Calendar date in `YYYY-MM-DD` format.
  - `data.description` *(string, optional)*: Event description (or `null`).
  - `data.location` *(string, optional)*: Event location (or `null`).
  - `data.capacity` *(number, optional)*: Positive integer for maximum attendees (or `null` for unlimited).
- **Returns**: `Promise<object>` - Created event record (`id` prefix `evt_`).

#### `EventKit.getEvent(eventId)`
Retrieves an event by its ID.
- **Returns**: `Promise<object|null>` - Event object or `null` if not found.

#### `EventKit.getAllEvents()`
Retrieves all stored events.
- **Returns**: `Promise<Array<object>>` - Safe copy of all events.

#### `EventKit.updateEvent(eventId, updates)`
Updates permitted fields (`name`, `date`, `description`, `location`, `capacity`).
- Note: Modifying `id` or `createdAt` is forbidden. Capacity cannot be reduced below current attendee count.
- **Returns**: `Promise<object>` - Updated event record.

#### `EventKit.deleteEvent(eventId)`
Deletes an event and cascade-deletes all associated attendees.
- **Returns**: `Promise<object>` - Deleted event record.

---

### Attendee Management

#### `EventKit.registerAttendee(eventId, attendeeData)`
Registers an attendee for a specified event.
- **Parameters**:
  - `eventId` *(string, required)*: Target event ID.
  - `attendeeData.name` *(string, required)*: Non-empty attendee name.
  - `attendeeData.email` *(string, required)*: Valid email address (normalized to lowercase).
  - `attendeeData.phone` *(string, optional)*: Optional international phone number.
- **Returns**: `Promise<object>` - Registered attendee record (`id` prefix `att_`).

#### `EventKit.getAttendee(attendeeId)`
Retrieves an attendee by attendee ID.
- **Returns**: `Promise<object|null>` - Attendee object or `null` if not found.

#### `EventKit.getAttendees(eventId)`
Retrieves all attendees registered for a given event.
- **Throws**: `EventNotFoundError` if event does not exist.
- **Returns**: `Promise<Array<object>>` - List of attendees for the event.

#### `EventKit.removeAttendee(attendeeId)`
Removes an attendee record.
- **Throws**: `AttendeeNotFoundError` if attendee does not exist.
- **Returns**: `Promise<object>` - Removed attendee record.

---

## Error Handling

EventKit throws structured errors extending `EventKitError`. Each error contains a human-readable message and a stable `code` property:

```javascript
const EventKit = require('eventkit');
const {
  EventNotFoundError,
  DuplicateRegistrationError,
  EventCapacityReachedError,
  InvalidEventDataError,
  InvalidAttendeeDataError,
  StorageCorruptedError
} = EventKit.errors;

try {
  await EventKit.registerAttendee('evt_123', {
    name: 'Jane Doe',
    email: 'jane@example.com'
  });
} catch (err) {
  if (err instanceof DuplicateRegistrationError) {
    console.error(`Duplicate: ${err.message} (Code: ${err.code})`);
  } else if (err instanceof EventCapacityReachedError) {
    console.error(`Capacity full: ${err.message}`);
  } else {
    console.error('Unexpected error:', err);
  }
}
```

### Handled Error Codes
- `EVENT_NOT_FOUND`
- `ATTENDEE_NOT_FOUND`
- `INVALID_EVENT_DATA`
- `INVALID_ATTENDEE_DATA`
- `INVALID_EMAIL`
- `DUPLICATE_REGISTRATION`
- `EVENT_CAPACITY_REACHED`
- `INVALID_EVENT_ID`
- `STORAGE_ERROR`
- `STORAGE_CORRUPTED`
- `NOT_INITIALIZED`

---

## Development Limitations

- **Single-Process Storage**: The storage engine is designed for a single Node.js process accessing a local storage directory. Multi-process clustering or distributed storage coordination is not supported.
- **Future Roadmap**: Digital ticket issuing, QR code rendering, ticket validation, check-in tracking, search queries, and CSV/JSON export are planned for Phase 2 and Phase 3.

---

## Running Tests

Automated testing is powered by Vitest:

```bash
npm test
```

To run the interactive usage example:

```bash
node examples/basic-usage.js
```

---

## License

MIT © [Yasir Eqbal](LICENSE)
