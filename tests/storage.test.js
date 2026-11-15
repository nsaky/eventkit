'use strict';

const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const JsonStorage = require('../src/storage/json-storage');
const {
  StorageCorruptedError,
  StorageError,
  NotInitializedError
} = require('../src/utils/errors');

describe('JsonStorage', () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'eventkit-storage-test-'));
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  it('throws NotInitializedError if operations are performed before initialize()', async () => {
    const storage = new JsonStorage();
    expect(() => storage.getEvents()).toThrow(NotInitializedError);
    expect(() => storage.getAttendees()).toThrow(NotInitializedError);
    await expect(storage.saveEvents([])).rejects.toThrow(NotInitializedError);
  });

  it('creates custom storage directory and missing JSON files with empty arrays', async () => {
    const customDir = path.join(tempDir, 'sub', 'custom-data');
    const storage = new JsonStorage();
    await storage.initialize({ storagePath: customDir });

    expect(storage.isInitialized).toBe(true);
    expect(storage.storagePath).toBe(path.resolve(customDir));

    const eventsContent = await fs.readFile(path.join(customDir, 'events.json'), 'utf-8');
    const attendeesContent = await fs.readFile(path.join(customDir, 'attendees.json'), 'utf-8');

    expect(JSON.parse(eventsContent)).toEqual([]);
    expect(JSON.parse(attendeesContent)).toEqual([]);
    expect(storage.getEvents()).toEqual([]);
    expect(storage.getAttendees()).toEqual([]);
  });

  it('loads existing records from JSON files on initialization', async () => {
    const eventsData = [
      { id: 'evt_1', name: 'Tech Talk', date: '2026-10-10', createdAt: '2026-01-01T00:00:00.000Z' }
    ];
    const attendeesData = [
      { id: 'att_1', eventId: 'evt_1', name: 'Alice', email: 'alice@example.com' }
    ];

    await fs.writeFile(path.join(tempDir, 'events.json'), JSON.stringify(eventsData, null, 2));
    await fs.writeFile(path.join(tempDir, 'attendees.json'), JSON.stringify(attendeesData, null, 2));

    const storage = new JsonStorage();
    await storage.initialize({ storagePath: tempDir });

    expect(storage.getEvents()).toEqual(eventsData);
    expect(storage.getAttendees()).toEqual(attendeesData);
    expect(storage.getEventById('evt_1')).toEqual(eventsData[0]);
    expect(storage.getAttendeeById('att_1')).toEqual(attendeesData[0]);
    expect(storage.getAttendeesByEventId('evt_1')).toEqual(attendeesData);
  });

  it('persists records and keeps data across reinitialization', async () => {
    const storage = new JsonStorage();
    await storage.initialize({ storagePath: tempDir });

    const newEvents = [{ id: 'evt_abc', name: 'New Year Party', date: '2026-12-31' }];
    await storage.saveEvents(newEvents);

    expect(storage.getEvents()).toEqual(newEvents);

    // Reinitialize on the same directory
    const secondStorage = new JsonStorage();
    await secondStorage.initialize({ storagePath: tempDir });

    expect(secondStorage.getEvents()).toEqual(newEvents);
  });

  it('handles reinitialization with different path safely without retaining stale records', async () => {
    const dirA = path.join(tempDir, 'dirA');
    const dirB = path.join(tempDir, 'dirB');

    const storage = new JsonStorage();
    await storage.initialize({ storagePath: dirA });
    await storage.saveEvents([{ id: 'evt_a', name: 'Event in A' }]);

    expect(storage.getEvents().length).toBe(1);

    // Reinitialize same storage instance with dirB
    await storage.initialize({ storagePath: dirB });
    expect(storage.getEvents()).toEqual([]);
  });

  it('throws StorageCorruptedError and does NOT overwrite or destroy corrupted JSON', async () => {
    const corruptedPath = path.join(tempDir, 'events.json');
    const invalidJson = '{"broken": [true, false, invalid}';
    await fs.writeFile(corruptedPath, invalidJson, 'utf-8');

    const storage = new JsonStorage();
    await expect(storage.initialize({ storagePath: tempDir })).rejects.toThrow(StorageCorruptedError);

    // Verify file content was not overwritten or destroyed
    const preservedContent = await fs.readFile(corruptedPath, 'utf-8');
    expect(preservedContent).toBe(invalidJson);
  });

  it('throws StorageCorruptedError if JSON root is not an array', async () => {
    const invalidRoot = path.join(tempDir, 'events.json');
    await fs.writeFile(invalidRoot, '{"key": "value"}', 'utf-8');

    const storage = new JsonStorage();
    await expect(storage.initialize({ storagePath: tempDir })).rejects.toThrow(StorageCorruptedError);
  });

  it('returns deep copies so callers cannot mutate internal state', async () => {
    const storage = new JsonStorage();
    await storage.initialize({ storagePath: tempDir });

    await storage.saveEvents([{ id: 'evt_1', name: 'Original Name', metadata: { foo: 'bar' } }]);

    const retrieved = storage.getEventById('evt_1');
    retrieved.name = 'Hacked Name';
    retrieved.metadata.foo = 'baz';

    const fresh = storage.getEventById('evt_1');
    expect(fresh.name).toBe('Original Name');
    expect(fresh.metadata.foo).toBe('bar');
  });

  it('serializes concurrent writes and maintains data integrity', async () => {
    const storage = new JsonStorage();
    await storage.initialize({ storagePath: tempDir });

    const count = 20;
    const promises = [];

    for (let i = 0; i < count; i++) {
      promises.push(
        storage.runExclusive(async () => {
          const current = storage.getEvents();
          current.push({ id: `evt_${i}`, name: `Event ${i}` });
          await storage.saveEvents(current);
        })
      );
    }

    await Promise.all(promises);

    const finalEvents = storage.getEvents();
    expect(finalEvents.length).toBe(count);
  });

  it('supports saveBatch to persist both events and attendees atomically', async () => {
    const storage = new JsonStorage();
    await storage.initialize({ storagePath: tempDir });

    const events = [{ id: 'evt_batch', name: 'Batch Event' }];
    const attendees = [{ id: 'att_batch', eventId: 'evt_batch', name: 'Batch Attendee' }];

    await storage.saveBatch({ events, attendees });

    expect(storage.getEvents()).toEqual(events);
    expect(storage.getAttendees()).toEqual(attendees);

    // Verify written to disk
    const onDiskEvents = JSON.parse(await fs.readFile(path.join(tempDir, 'events.json'), 'utf-8'));
    const onDiskAttendees = JSON.parse(await fs.readFile(path.join(tempDir, 'attendees.json'), 'utf-8'));
    expect(onDiskEvents).toEqual(events);
    expect(onDiskAttendees).toEqual(attendees);
  });

  it('uses default storage path ./eventkit-data when none is provided', async () => {
    const storage = new JsonStorage();
    // Configure with null/undefined to verify default path
    await storage.initialize();
    expect(storage.storagePath).toBe(path.resolve(process.cwd(), './eventkit-data'));
    // Clean up default created directory if created
    try {
      await fs.rm(storage.storagePath, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('wraps filesystem write failures into StorageError', async () => {
    const storage = new JsonStorage();
    await storage.initialize({ storagePath: tempDir });

    // Make the storage directory read-only to simulate write failure
    await fs.chmod(tempDir, 0o444);

    try {
      await expect(storage.saveEvents([{ id: 'evt_fail', name: 'Will Fail' }]))
        .rejects.toThrow(StorageError);
    } finally {
      // Restore permissions so cleanup works
      await fs.chmod(tempDir, 0o777);
    }
  });
});
