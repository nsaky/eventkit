'use strict';

const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const JsonStorage = require('../src/storage/json-storage');
const EventManager = require('../src/core/event');
const AttendeeManager = require('../src/core/attendee');
const CheckInManager = require('../src/core/checkin');
const AttendanceStatsService = require('../src/services/stats');
const { EventNotFoundError } = require('../src/utils/errors');

describe('AttendanceStatsService', () => {
  let tempDir;
  let storage;
  let eventManager;
  let attendeeManager;
  let checkInManager;
  let statsService;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'eventkit-stats-test-'));
    storage = new JsonStorage();
    await storage.initialize({ storagePath: tempDir });
    eventManager = new EventManager(storage);
    attendeeManager = new AttendeeManager(storage);
    checkInManager = new CheckInManager(storage);
    statsService = new AttendanceStatsService(storage);
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('calculates correct statistics for an event with registrations and check-ins', async () => {
    const event = await eventManager.createEvent({
      name: 'DevOps Day',
      date: '2026-10-15',
      capacity: 10
    });

    const att1 = await attendeeManager.registerAttendee(event.id, { name: 'A', email: 'a@ex.com' });
    const att2 = await attendeeManager.registerAttendee(event.id, { name: 'B', email: 'b@ex.com' });
    const att3 = await attendeeManager.registerAttendee(event.id, { name: 'C', email: 'c@ex.com' });
    const att4 = await attendeeManager.registerAttendee(event.id, { name: 'D', email: 'd@ex.com' });

    // Check in 2 out of 4 attendees
    await checkInManager.checkIn(event.id, att1.ticket.id);
    await checkInManager.checkIn(event.id, att3.ticket.id);

    const stats = await statsService.getAttendanceStats(event.id);

    expect(stats.eventId).toBe(event.id);
    expect(stats.eventName).toBe('DevOps Day');
    expect(stats.totalRegistrations).toBe(4);
    expect(stats.totalCheckedIn).toBe(2);
    expect(stats.totalPending).toBe(2);
    expect(stats.attendancePercentage).toBe(50.0); // 2/4 * 100
    expect(stats.capacity).toBe(10);
    expect(stats.registrationPercentage).toBe(40.0); // 4/10 * 100
  });

  it('handles empty events with zero registrations safely without division by zero', async () => {
    const event = await eventManager.createEvent({
      name: 'Empty Event',
      date: '2026-10-15',
      capacity: 50
    });

    const stats = await statsService.getAttendanceStats(event.id);

    expect(stats.totalRegistrations).toBe(0);
    expect(stats.totalCheckedIn).toBe(0);
    expect(stats.totalPending).toBe(0);
    expect(stats.attendancePercentage).toBe(0);
    expect(stats.registrationPercentage).toBe(0);
  });

  it('handles events with unlimited capacity (capacity = null)', async () => {
    const event = await eventManager.createEvent({
      name: 'Free Webinar',
      date: '2026-10-15'
    });

    await attendeeManager.registerAttendee(event.id, { name: 'A', email: 'a@ex.com' });

    const stats = await statsService.getAttendanceStats(event.id);
    expect(stats.capacity).toBeNull();
    expect(stats.registrationPercentage).toBeNull();
    expect(stats.attendancePercentage).toBe(0);
  });

  it('isolates statistics cleanly between multiple events', async () => {
    const event1 = await eventManager.createEvent({ name: 'E1', date: '2026-01-01', capacity: 10 });
    const event2 = await eventManager.createEvent({ name: 'E2', date: '2026-02-02', capacity: 20 });

    const a1 = await attendeeManager.registerAttendee(event1.id, { name: 'A1', email: 'a1@ex.com' });
    await attendeeManager.registerAttendee(event2.id, { name: 'A2', email: 'a2@ex.com' });

    await checkInManager.checkIn(event1.id, a1.ticket.id);

    const s1 = await statsService.getAttendanceStats(event1.id);
    const s2 = await statsService.getAttendanceStats(event2.id);

    expect(s1.totalRegistrations).toBe(1);
    expect(s1.totalCheckedIn).toBe(1);

    expect(s2.totalRegistrations).toBe(1);
    expect(s2.totalCheckedIn).toBe(0);
  });

  it('throws EventNotFoundError for non-existent event', async () => {
    await expect(statsService.getAttendanceStats('evt_000000000000000000000000'))
      .rejects.toThrow(EventNotFoundError);
  });

  it('throws an error if AttendanceStatsService is instantiated without storage', () => {
    expect(() => new AttendanceStatsService()).toThrow('Storage instance is required for AttendanceStatsService.');
  });
});
