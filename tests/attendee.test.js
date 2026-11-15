'use strict';

const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const JsonStorage = require('../src/storage/json-storage');
const EventManager = require('../src/core/event');
const AttendeeManager = require('../src/core/attendee');
const {
  EventNotFoundError,
  AttendeeNotFoundError,
  InvalidAttendeeDataError,
  InvalidEmailError,
  DuplicateRegistrationError,
  EventCapacityReachedError
} = require('../src/utils/errors');

describe('AttendeeManager', () => {
  let tempDir;
  let storage;
  let eventManager;
  let attendeeManager;
  let sampleEvent;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'eventkit-attendee-test-'));
    storage = new JsonStorage();
    await storage.initialize({ storagePath: tempDir });
    eventManager = new EventManager(storage);
    attendeeManager = new AttendeeManager(storage);

    sampleEvent = await eventManager.createEvent({
      name: 'Cloud Developer Summit',
      date: '2026-11-20',
      capacity: 3
    });
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('registers an attendee with valid data, generating unique id and initial statuses', async () => {
    const attendee = await attendeeManager.registerAttendee(sampleEvent.id, {
      name: 'Jane Doe',
      email: 'Jane.Doe@Example.com',
      phone: '+1 555-123-4567'
    });

    expect(attendee.id).toMatch(/^att_[a-f0-9]{24}$/);
    expect(attendee.eventId).toBe(sampleEvent.id);
    expect(attendee.name).toBe('Jane Doe');
    expect(attendee.email).toBe('jane.doe@example.com'); // normalized lowercase
    expect(attendee.phone).toBe('+1 555-123-4567');
    expect(attendee.status).toBe('REGISTERED');
    expect(attendee.checkedIn).toBe(false);
    expect(attendee.checkedInAt).toBeNull();
    expect(new Date(attendee.registeredAt).toISOString()).toBe(attendee.registeredAt);
  });

  it('registers an attendee without phone number, setting phone to null', async () => {
    const attendee = await attendeeManager.registerAttendee(sampleEvent.id, {
      name: 'Bob Smith',
      email: 'bob@example.com'
    });

    expect(attendee.phone).toBeNull();
  });

  it('rejects registration when attendee name or email is missing or invalid', async () => {
    // Missing name
    await expect(attendeeManager.registerAttendee(sampleEvent.id, { email: 'a@b.com' }))
      .rejects.toThrow(InvalidAttendeeDataError);

    // Empty name
    await expect(attendeeManager.registerAttendee(sampleEvent.id, { name: '  ', email: 'a@b.com' }))
      .rejects.toThrow(InvalidAttendeeDataError);

    // Invalid email formats
    const invalidEmails = ['plainaddress', '@missingusername.com', 'user@.com', 'user@domain'];
    for (const email of invalidEmails) {
      await expect(attendeeManager.registerAttendee(sampleEvent.id, { name: 'Test', email }))
        .rejects.toThrow(InvalidEmailError);
    }

    // Invalid phone number format
    await expect(attendeeManager.registerAttendee(sampleEvent.id, {
      name: 'Test',
      email: 'test@example.com',
      phone: '123' // too short
    })).rejects.toThrow(InvalidAttendeeDataError);
  });

  it('throws EventNotFoundError if registering for a non-existent event', async () => {
    await expect(attendeeManager.registerAttendee('evt_0123456789abcdef01234567', {
      name: 'Ghost Attendee',
      email: 'ghost@example.com'
    })).rejects.toThrow(EventNotFoundError);
  });

  it('normalizes email addresses (trims whitespace and converts to lowercase)', async () => {
    const attendee = await attendeeManager.registerAttendee(sampleEvent.id, {
      name: 'Alice Wonder',
      email: '   Alice.Wonder@Example.COM   '
    });

    expect(attendee.email).toBe('alice.wonder@example.com');
  });

  it('prevents duplicate registration for the same event with normalized email', async () => {
    await attendeeManager.registerAttendee(sampleEvent.id, {
      name: 'Alice Wonder',
      email: 'alice@example.com'
    });

    // Attempt duplicate with different casing and whitespace
    await expect(attendeeManager.registerAttendee(sampleEvent.id, {
      name: 'Alice W.',
      email: '  Alice@EXAMPLE.com  '
    })).rejects.toThrow(DuplicateRegistrationError);
  });

  it('allows the same email to register for different events', async () => {
    const secondEvent = await eventManager.createEvent({
      name: 'AI Hackathon',
      date: '2026-12-01'
    });

    const reg1 = await attendeeManager.registerAttendee(sampleEvent.id, {
      name: 'Alice',
      email: 'alice@example.com'
    });

    const reg2 = await attendeeManager.registerAttendee(secondEvent.id, {
      name: 'Alice',
      email: 'alice@example.com'
    });

    expect(reg1.id).not.toBe(reg2.id);
    expect(reg1.eventId).toBe(sampleEvent.id);
    expect(reg2.eventId).toBe(secondEvent.id);
    expect(reg1.email).toBe('alice@example.com');
    expect(reg2.email).toBe('alice@example.com');
  });

  it('enforces event capacity strictly and rejects registrations when full', async () => {
    // sampleEvent capacity is 3
    await attendeeManager.registerAttendee(sampleEvent.id, { name: 'User 1', email: 'u1@example.com' });
    await attendeeManager.registerAttendee(sampleEvent.id, { name: 'User 2', email: 'u2@example.com' });
    await attendeeManager.registerAttendee(sampleEvent.id, { name: 'User 3', email: 'u3@example.com' });

    // 4th registration should be rejected
    await expect(attendeeManager.registerAttendee(sampleEvent.id, {
      name: 'User 4',
      email: 'u4@example.com'
    })).rejects.toThrow(EventCapacityReachedError);
  });

  it('allows unlimited registrations when event capacity is not set', async () => {
    const unlimitedEvent = await eventManager.createEvent({
      name: 'Public Webinar',
      date: '2026-10-15'
    });

    for (let i = 1; i <= 10; i++) {
      const att = await attendeeManager.registerAttendee(unlimitedEvent.id, {
        name: `Attendee ${i}`,
        email: `attendee${i}@example.com`
      });
      expect(att.id).toBeDefined();
    }

    const attendees = await attendeeManager.getAttendees(unlimitedEvent.id);
    expect(attendees.length).toBe(10);
  });

  it('retrieves an attendee by attendeeId or returns null if not found', async () => {
    const created = await attendeeManager.registerAttendee(sampleEvent.id, {
      name: 'Clark Kent',
      email: 'clark@dailyplanet.com'
    });

    const found = await attendeeManager.getAttendee(created.id);
    expect(found).toEqual(created);

    const nonExistent = await attendeeManager.getAttendee('att_0123456789abcdef01234567');
    expect(nonExistent).toBeNull();
  });

  it('retrieves all attendees for an event and throws EventNotFoundError if event does not exist', async () => {
    await attendeeManager.registerAttendee(sampleEvent.id, { name: 'User 1', email: 'u1@ex.com' });
    await attendeeManager.registerAttendee(sampleEvent.id, { name: 'User 2', email: 'u2@ex.com' });

    const attendees = await attendeeManager.getAttendees(sampleEvent.id);
    expect(attendees.length).toBe(2);

    await expect(attendeeManager.getAttendees('evt_0123456789abcdef01234567'))
      .rejects.toThrow(EventNotFoundError);
  });

  it('removes an attendee by attendeeId and throws AttendeeNotFoundError if not found', async () => {
    const created = await attendeeManager.registerAttendee(sampleEvent.id, {
      name: 'Bruce Wayne',
      email: 'bruce@wayne.com'
    });

    const removed = await attendeeManager.removeAttendee(created.id);
    expect(removed.id).toBe(created.id);

    // Verify attendee is gone
    expect(await attendeeManager.getAttendee(created.id)).toBeNull();

    // Removing again should throw AttendeeNotFoundError
    await expect(attendeeManager.removeAttendee(created.id))
      .rejects.toThrow(AttendeeNotFoundError);
  });

  it('persists attendee records across restart/reinitialization', async () => {
    const created = await attendeeManager.registerAttendee(sampleEvent.id, {
      name: 'Diana Prince',
      email: 'diana@themyscira.com'
    });

    // Reinitialize fresh storage on same directory
    const newStorage = new JsonStorage();
    await newStorage.initialize({ storagePath: tempDir });
    const newAttendeeManager = new AttendeeManager(newStorage);

    const retrieved = await newAttendeeManager.getAttendee(created.id);
    expect(retrieved).toEqual(created);
  });

  it('throws an error if AttendeeManager is instantiated without storage', () => {
    expect(() => new AttendeeManager()).toThrow('Storage instance is required for AttendeeManager.');
  });
});
