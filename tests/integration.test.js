'use strict';

const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const EventKit = require('../src/index');
const {
  EventNotFoundError,
  AttendeeNotFoundError,
  DuplicateRegistrationError,
  EventCapacityReachedError,
  InvalidEventDataError,
  NotInitializedError
} = EventKit.errors;

describe('EventKit Integration Tests', () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'eventkit-integration-test-'));
    await EventKit.reset();
  });

  afterEach(async () => {
    await EventKit.reset();
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('rejects API calls before initialize() is executed', async () => {
    await expect(EventKit.createEvent({ name: 'Test', date: '2026-12-01' }))
      .rejects.toThrow(NotInitializedError);
    await expect(EventKit.getEvent('evt_1234567890abcdef12345678'))
      .rejects.toThrow(NotInitializedError);
    await expect(EventKit.getAllEvents())
      .rejects.toThrow(NotInitializedError);
    await expect(EventKit.registerAttendee('evt_1234567890abcdef12345678', { name: 'A', email: 'a@a.com' }))
      .rejects.toThrow(NotInitializedError);
    await expect(EventKit.getAttendees('evt_1234567890abcdef12345678'))
      .rejects.toThrow(NotInitializedError);
    await expect(EventKit.getAllTickets())
      .rejects.toThrow(NotInitializedError);
    await expect(EventKit.getTickets('evt_1234567890abcdef12345678'))
      .rejects.toThrow(NotInitializedError);
    await expect(EventKit.cancelTicket('EK-1234567890'))
      .rejects.toThrow(NotInitializedError);
    await expect(EventKit.exportEvent('evt_1234567890abcdef12345678', 'json'))
      .rejects.toThrow(NotInitializedError);
  });

  it('executes the full end-to-end event and attendee lifecycle', async () => {
    // 1. Initialize
    await EventKit.initialize({ storagePath: tempDir });

    // 2. Create an event
    const event = await EventKit.createEvent({
      name: 'Global Node.js Conference',
      description: 'The premier conference for Node.js developers.',
      date: '2026-10-25',
      location: 'Bengaluru',
      capacity: 3
    });

    expect(event.id).toMatch(/^evt_/);
    expect(event.name).toBe('Global Node.js Conference');
    expect(event.capacity).toBe(3);

    // 3. Register multiple attendees
    const att1 = await EventKit.registerAttendee(event.id, {
      name: 'Alice Johnson',
      email: 'Alice.J@Example.com',
      phone: '+91 9876543210'
    });

    const att2 = await EventKit.registerAttendee(event.id, {
      name: 'Bob Miller',
      email: 'bob@example.com'
    });

    expect(att1.id).toMatch(/^att_/);
    expect(att1.email).toBe('alice.j@example.com');
    expect(att2.id).toMatch(/^att_/);
    expect(att2.phone).toBeNull();

    // 4. Retrieve the event
    const fetchedEvent = await EventKit.getEvent(event.id);
    expect(fetchedEvent).toEqual(event);

    // 5. Retrieve all event attendees
    const attendees = await EventKit.getAttendees(event.id);
    expect(attendees.length).toBe(2);
    expect(attendees.map(a => a.id)).toEqual([att1.id, att2.id]);

    // Retrieve all tickets and tickets for event
    const allTickets = await EventKit.getAllTickets();
    expect(allTickets.length).toBe(2);
    const eventTickets = await EventKit.getTickets(event.id);
    expect(eventTickets.length).toBe(2);

    // 6. Attempt duplicate registration (same normalized email)
    await expect(EventKit.registerAttendee(event.id, {
      name: 'Alice Duplicate',
      email: '  alice.j@example.COM  '
    })).rejects.toThrow(DuplicateRegistrationError);

    // 7. Register 3rd attendee to reach capacity
    const att3 = await EventKit.registerAttendee(event.id, {
      name: 'Charlie Davis',
      email: 'charlie@example.com'
    });
    expect(att3.id).toBeDefined();

    // 8. Attempt registration after capacity is reached
    await expect(EventKit.registerAttendee(event.id, {
      name: 'Dana White',
      email: 'dana@example.com'
    })).rejects.toThrow(EventCapacityReachedError);

    // 9. Update the event (increase capacity)
    const updatedEvent = await EventKit.updateEvent(event.id, {
      capacity: 5,
      description: 'Updated conference description.'
    });
    expect(updatedEvent.capacity).toBe(5);
    expect(updatedEvent.description).toBe('Updated conference description.');

    // Now registration should succeed since capacity was increased
    const att4 = await EventKit.registerAttendee(event.id, {
      name: 'Dana White',
      email: 'dana@example.com'
    });
    expect(att4.id).toBeDefined();

    // 10. Remove an attendee
    const removedAtt2 = await EventKit.removeAttendee(att2.id);
    expect(removedAtt2.id).toBe(att2.id);
    expect(await EventKit.getAttendee(att2.id)).toBeNull();

    const remainingAttendees = await EventKit.getAttendees(event.id);
    expect(remainingAttendees.length).toBe(3); // att1, att3, att4

    // 11. Create a second event to ensure isolation during deletion
    const event2 = await EventKit.createEvent({
      name: 'Web Security Summit',
      date: '2026-11-05',
      capacity: 10
    });
    const attSec = await EventKit.registerAttendee(event2.id, {
      name: 'Security Pro',
      email: 'sec@example.com'
    });

    // 12. Delete the first event
    const deletedEvent = await EventKit.deleteEvent(event.id);
    expect(deletedEvent.id).toBe(event.id);
    expect(await EventKit.getEvent(event.id)).toBeNull();

    // Verify first event's attendees are cascade deleted
    await expect(EventKit.getAttendees(event.id)).rejects.toThrow(EventNotFoundError);
    expect(await EventKit.getAttendee(att1.id)).toBeNull();
    expect(await EventKit.getAttendee(att3.id)).toBeNull();
    expect(await EventKit.getAttendee(att4.id)).toBeNull();

    // Verify second event and its attendee are unaffected
    expect(await EventKit.getEvent(event2.id)).not.toBeNull();
    expect(await EventKit.getAttendee(attSec.id)).not.toBeNull();
    expect((await EventKit.getAttendees(event2.id)).length).toBe(1);

    // 13. Reinitialize EventKit on the same storage path and verify persistence
    await EventKit.reset();
    await EventKit.initialize({ storagePath: tempDir });

    const persistedEvents = await EventKit.getAllEvents();
    expect(persistedEvents.length).toBe(1);
    expect(persistedEvents[0].id).toBe(event2.id);

    const persistedAttendees = await EventKit.getAttendees(event2.id);
    expect(persistedAttendees.length).toBe(1);
    expect(persistedAttendees[0].id).toBe(attSec.id);
  });

  it('handles concurrent registration attempts within capacity limits', async () => {
    await EventKit.initialize({ storagePath: tempDir });

    const capacity = 5;
    const event = await EventKit.createEvent({
      name: 'High-concurrency Event',
      date: '2026-09-01',
      capacity
    });

    // Attempt 15 concurrent registrations simultaneously
    const totalAttempts = 15;
    const registrationPromises = [];

    for (let i = 0; i < totalAttempts; i++) {
      registrationPromises.push(
        EventKit.registerAttendee(event.id, {
          name: `User ${i}`,
          email: `user${i}@test.com`
        }).then(
          res => ({ success: true, result: res }),
          err => ({ success: false, error: err })
        )
      );
    }

    const results = await Promise.all(registrationPromises);

    const successes = results.filter(r => r.success);
    const capacityFailures = results.filter(
      r => !r.success && r.error instanceof EventCapacityReachedError
    );

    // Exactly `capacity` registrations must succeed
    expect(successes.length).toBe(capacity);
    // The remaining must have failed with EventCapacityReachedError
    expect(capacityFailures.length).toBe(totalAttempts - capacity);

    // Verify stored attendee count matches capacity
    const attendees = await EventKit.getAttendees(event.id);
    expect(attendees.length).toBe(capacity);
  });

  it('supports independent instances via EventKit.createInstance()', async () => {
    const dir1 = path.join(tempDir, 'instance1');
    const dir2 = path.join(tempDir, 'instance2');

    const kit1 = EventKit.createInstance({ storagePath: dir1 });
    const kit2 = EventKit.createInstance({ storagePath: dir2 });

    await kit1.initialize();
    await kit2.initialize();

    const e1 = await kit1.createEvent({ name: 'Kit 1 Event', date: '2026-01-01' });
    const e2 = await kit2.createEvent({ name: 'Kit 2 Event', date: '2026-02-02' });

    expect((await kit1.getAllEvents()).length).toBe(1);
    expect((await kit1.getAllEvents())[0].name).toBe('Kit 1 Event');

    expect((await kit2.getAllEvents()).length).toBe(1);
    expect((await kit2.getAllEvents())[0].name).toBe('Kit 2 Event');
  });
});
