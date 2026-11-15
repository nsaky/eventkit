'use strict';

const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const JsonStorage = require('../src/storage/json-storage');
const EventManager = require('../src/core/event');
const {
  EventNotFoundError,
  InvalidEventDataError,
  InvalidEventIdError
} = require('../src/utils/errors');

describe('EventManager', () => {
  let tempDir;
  let storage;
  let eventManager;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'eventkit-event-test-'));
    storage = new JsonStorage();
    await storage.initialize({ storagePath: tempDir });
    eventManager = new EventManager(storage);
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('creates an event with all valid fields and generates unique id and timestamps', async () => {
    const input = {
      name: 'Tech Summit 2026',
      description: 'Annual technology conference',
      date: '2026-12-15',
      location: 'Pune',
      capacity: 200
    };

    const event = await eventManager.createEvent(input);

    expect(event.id).toMatch(/^evt_[a-f0-9]{24}$/);
    expect(event.name).toBe('Tech Summit 2026');
    expect(event.description).toBe('Annual technology conference');
    expect(event.date).toBe('2026-12-15');
    expect(event.location).toBe('Pune');
    expect(event.capacity).toBe(200);
    expect(new Date(event.createdAt).toISOString()).toBe(event.createdAt);
    expect(new Date(event.updatedAt).toISOString()).toBe(event.updatedAt);
    expect(event.createdAt).toBe(event.updatedAt);
  });

  it('creates an event with optional fields omitted or null', async () => {
    const event = await eventManager.createEvent({
      name: 'Open Community Meetup',
      date: '2026-05-10'
    });

    expect(event.description).toBeNull();
    expect(event.location).toBeNull();
    expect(event.capacity).toBeNull();
  });

  it('rejects event creation when required fields are missing or invalid', async () => {
    // Missing name
    await expect(eventManager.createEvent({ date: '2026-10-10' }))
      .rejects.toThrow(InvalidEventDataError);

    // Empty name
    await expect(eventManager.createEvent({ name: '   ', date: '2026-10-10' }))
      .rejects.toThrow(InvalidEventDataError);

    // Missing date
    await expect(eventManager.createEvent({ name: 'Valid Name' }))
      .rejects.toThrow(InvalidEventDataError);

    // Invalid date format
    await expect(eventManager.createEvent({ name: 'Valid Name', date: '15-12-2026' }))
      .rejects.toThrow(InvalidEventDataError);

    // Impossible calendar date (Feb 30)
    await expect(eventManager.createEvent({ name: 'Valid Name', date: '2026-02-30' }))
      .rejects.toThrow(InvalidEventDataError);

    // Non-leap year Feb 29 (2025 is not a leap year)
    await expect(eventManager.createEvent({ name: 'Valid Name', date: '2025-02-29' }))
      .rejects.toThrow(InvalidEventDataError);

    // Invalid capacity (negative, zero, float, string)
    await expect(eventManager.createEvent({ name: 'Event', date: '2026-10-10', capacity: 0 }))
      .rejects.toThrow(InvalidEventDataError);
    await expect(eventManager.createEvent({ name: 'Event', date: '2026-10-10', capacity: -5 }))
      .rejects.toThrow(InvalidEventDataError);
    await expect(eventManager.createEvent({ name: 'Event', date: '2026-10-10', capacity: 10.5 }))
      .rejects.toThrow(InvalidEventDataError);
    await expect(eventManager.createEvent({ name: 'Event', date: '2026-10-10', capacity: '100' }))
      .rejects.toThrow(InvalidEventDataError);
  });

  it('retrieves an event by id or returns null if not found', async () => {
    const created = await eventManager.createEvent({
      name: 'Developer Workshop',
      date: '2026-08-20'
    });

    const retrieved = await eventManager.getEvent(created.id);
    expect(retrieved).toEqual(created);

    const nonExistent = await eventManager.getEvent('evt_0123456789abcdef01234567');
    expect(nonExistent).toBeNull();

    // Invalid ID format throws InvalidEventIdError
    await expect(eventManager.getEvent('invalid-id')).rejects.toThrow(InvalidEventIdError);
  });

  it('retrieves all events', async () => {
    expect(await eventManager.getAllEvents()).toEqual([]);

    const evt1 = await eventManager.createEvent({ name: 'Evt 1', date: '2026-01-01' });
    const evt2 = await eventManager.createEvent({ name: 'Evt 2', date: '2026-02-02' });

    const all = await eventManager.getAllEvents();
    expect(all.length).toBe(2);
    expect(all.map(e => e.id)).toEqual([evt1.id, evt2.id]);
  });

  it('updates permitted event fields and preserves unspecified fields', async () => {
    const created = await eventManager.createEvent({
      name: 'Original Name',
      description: 'Original Desc',
      date: '2026-06-01',
      location: 'Delhi',
      capacity: 50
    });

    // Small delay to ensure timestamp change
    await new Promise(r => setTimeout(r, 5));

    const updated = await eventManager.updateEvent(created.id, {
      name: 'Updated Name',
      capacity: 75
    });

    expect(updated.name).toBe('Updated Name');
    expect(updated.capacity).toBe(75);
    expect(updated.description).toBe('Original Desc'); // preserved
    expect(updated.location).toBe('Delhi'); // preserved
    expect(updated.date).toBe('2026-06-01'); // preserved
    expect(updated.id).toBe(created.id); // preserved
    expect(updated.createdAt).toBe(created.createdAt); // preserved
    expect(new Date(updated.updatedAt).getTime()).toBeGreaterThanOrEqual(new Date(created.updatedAt).getTime());
  });

  it('rejects invalid updates and prohibited field modifications', async () => {
    const created = await eventManager.createEvent({
      name: 'Sample Event',
      date: '2026-07-07'
    });

    // Cannot modify id
    await expect(eventManager.updateEvent(created.id, { id: 'evt_newid123' }))
      .rejects.toThrow(InvalidEventDataError);

    // Cannot modify createdAt
    await expect(eventManager.updateEvent(created.id, { createdAt: '2020-01-01T00:00:00.000Z' }))
      .rejects.toThrow(InvalidEventDataError);

    // Cannot provide empty updates
    await expect(eventManager.updateEvent(created.id, {}))
      .rejects.toThrow(InvalidEventDataError);

    // Updating non-existent event throws EventNotFoundError
    await expect(eventManager.updateEvent('evt_nonexistent1234567890', { name: 'New' }))
      .rejects.toThrow(EventNotFoundError);
  });

  it('prevents event capacity from being reduced below current registered attendees count', async () => {
    const created = await eventManager.createEvent({
      name: 'Concert',
      date: '2026-09-09',
      capacity: 10
    });

    // Directly simulate 3 registered attendees in storage
    await storage.saveAttendees([
      { id: 'att_1', eventId: created.id, name: 'User 1', email: 'u1@ex.com' },
      { id: 'att_2', eventId: created.id, name: 'User 2', email: 'u2@ex.com' },
      { id: 'att_3', eventId: created.id, name: 'User 3', email: 'u3@ex.com' }
    ]);

    // Reducing to 3 or more is fine
    const updated = await eventManager.updateEvent(created.id, { capacity: 3 });
    expect(updated.capacity).toBe(3);

    // Reducing below 3 (e.g. 2) must be rejected
    await expect(eventManager.updateEvent(created.id, { capacity: 2 }))
      .rejects.toThrow(InvalidEventDataError);
  });

  it('deletes an event and cascade-deletes all associated attendees', async () => {
    const evt1 = await eventManager.createEvent({ name: 'Event 1', date: '2026-11-11' });
    const evt2 = await eventManager.createEvent({ name: 'Event 2', date: '2026-11-12' });

    // Seed attendees for both events
    await storage.saveAttendees([
      { id: 'att_1', eventId: evt1.id, name: 'A1', email: 'a1@ex.com' },
      { id: 'att_2', eventId: evt1.id, name: 'A2', email: 'a2@ex.com' },
      { id: 'att_3', eventId: evt2.id, name: 'B1', email: 'b1@ex.com' }
    ]);

    const deleted = await eventManager.deleteEvent(evt1.id);
    expect(deleted.id).toBe(evt1.id);

    // Evt 1 should be gone, Evt 2 should remain
    expect(await eventManager.getEvent(evt1.id)).toBeNull();
    expect(await eventManager.getEvent(evt2.id)).not.toBeNull();

    // Associated attendees of Evt 1 should be gone, Evt 2 attendees intact
    const remainingAttendees = storage.getAttendees();
    expect(remainingAttendees.length).toBe(1);
    expect(remainingAttendees[0].id).toBe('att_3');
  });

  it('throws EventNotFoundError when deleting non-existent event', async () => {
    await expect(eventManager.deleteEvent('evt_nonexistent1234567890'))
      .rejects.toThrow(EventNotFoundError);
  });
});
