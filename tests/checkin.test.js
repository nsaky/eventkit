'use strict';

const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const JsonStorage = require('../src/storage/json-storage');
const EventManager = require('../src/core/event');
const AttendeeManager = require('../src/core/attendee');
const TicketManager = require('../src/core/ticket');
const CheckInManager = require('../src/core/checkin');
const {
  EventNotFoundError,
  TicketNotFoundError,
  TicketCancelledError,
  WrongEventError,
  AlreadyCheckedInError
} = require('../src/utils/errors');

describe('CheckInManager & Ticket Validation', () => {
  let tempDir;
  let storage;
  let eventManager;
  let attendeeManager;
  let ticketManager;
  let checkInManager;
  let eventA;
  let eventB;
  let attendeeA;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'eventkit-checkin-test-'));
    storage = new JsonStorage();
    await storage.initialize({ storagePath: tempDir });
    eventManager = new EventManager(storage);
    attendeeManager = new AttendeeManager(storage);
    ticketManager = new TicketManager(storage);
    checkInManager = new CheckInManager(storage);

    eventA = await eventManager.createEvent({ name: 'Event A', date: '2026-10-10' });
    eventB = await eventManager.createEvent({ name: 'Event B', date: '2026-10-11' });

    attendeeA = await attendeeManager.registerAttendee(eventA.id, {
      name: 'Alice',
      email: 'alice@example.com'
    });
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  describe('Ticket Validation (validateTicket)', () => {
    it('returns VALID status for an active, matching ticket', async () => {
      const res = await ticketManager.validateTicket(eventA.id, attendeeA.ticket.id);

      expect(res.valid).toBe(true);
      expect(res.status).toBe('VALID');
      expect(res.ticket.id).toBe(attendeeA.ticket.id);
      expect(res.attendee.id).toBe(attendeeA.id);
    });

    it('returns INVALID status when ticket does not exist', async () => {
      const res = await ticketManager.validateTicket(eventA.id, 'EK-9999999999');

      expect(res.valid).toBe(false);
      expect(res.status).toBe('INVALID');
      expect(res.ticket).toBeNull();
      expect(res.attendee).toBeNull();
    });

    it('returns WRONG_EVENT status when ticket belongs to another event', async () => {
      const res = await ticketManager.validateTicket(eventB.id, attendeeA.ticket.id);

      expect(res.valid).toBe(false);
      expect(res.status).toBe('WRONG_EVENT');
      expect(res.ticket.id).toBe(attendeeA.ticket.id);
      expect(res.attendee).toBeNull(); // do not expose attendee on wrong event
    });

    it('returns CANCELLED status when ticket is cancelled', async () => {
      await ticketManager.cancelTicket(attendeeA.ticket.id);

      const res = await ticketManager.validateTicket(eventA.id, attendeeA.ticket.id);
      expect(res.valid).toBe(false);
      expect(res.status).toBe('CANCELLED');
    });

    it('returns ALREADY_CHECKED_IN status when ticket has already been used', async () => {
      await checkInManager.checkIn(eventA.id, attendeeA.ticket.id);

      const res = await ticketManager.validateTicket(eventA.id, attendeeA.ticket.id);
      expect(res.valid).toBe(false);
      expect(res.status).toBe('ALREADY_CHECKED_IN');
    });

    it('does NOT modify any records during validation', async () => {
      const beforeTicket = await ticketManager.getTicket(attendeeA.ticket.id);
      const beforeAttendee = await attendeeManager.getAttendee(attendeeA.id);

      await ticketManager.validateTicket(eventA.id, attendeeA.ticket.id);

      const afterTicket = await ticketManager.getTicket(attendeeA.ticket.id);
      const afterAttendee = await attendeeManager.getAttendee(attendeeA.id);

      expect(afterTicket).toEqual(beforeTicket);
      expect(afterAttendee.checkedIn).toBe(false);
    });
  });

  describe('Check-In Workflow (checkIn)', () => {
    it('successfully checks in an attendee with an active ticket', async () => {
      const result = await checkInManager.checkIn(eventA.id, attendeeA.ticket.id);

      expect(result.success).toBe(true);
      expect(result.status).toBe('CHECKED_IN');
      expect(result.ticketId).toBe(attendeeA.ticket.id);
      expect(result.attendeeId).toBe(attendeeA.id);
      expect(result.attendeeName).toBe('Alice');
      expect(result.checkedInAt).toBeDefined();

      // Verify ticket state in storage
      const ticket = await ticketManager.getTicket(attendeeA.ticket.id);
      expect(ticket.status).toBe('USED');
      expect(ticket.checkedInAt).toBe(result.checkedInAt);

      // Verify attendee state in storage
      const attendee = await attendeeManager.getAttendee(attendeeA.id);
      expect(attendee.checkedIn).toBe(true);
      expect(attendee.checkedInAt).toBe(result.checkedInAt);
    });

    it('rejects check-in for ticket belonging to a different event with WrongEventError', async () => {
      await expect(
        checkInManager.checkIn(eventB.id, attendeeA.ticket.id)
      ).rejects.toThrow(WrongEventError);
    });

    it('rejects check-in for a cancelled ticket with TicketCancelledError', async () => {
      await ticketManager.cancelTicket(attendeeA.ticket.id);

      await expect(
        checkInManager.checkIn(eventA.id, attendeeA.ticket.id)
      ).rejects.toThrow(TicketCancelledError);
    });

    it('strictly prevents repeated check-ins and preserves the original timestamp', async () => {
      const firstCheckIn = await checkInManager.checkIn(eventA.id, attendeeA.ticket.id);
      const originalTimestamp = firstCheckIn.checkedInAt;

      // Small delay
      await new Promise(r => setTimeout(r, 5));

      // Repeated check-in must throw AlreadyCheckedInError
      await expect(
        checkInManager.checkIn(eventA.id, attendeeA.ticket.id)
      ).rejects.toThrow(AlreadyCheckedInError);

      // Verify original timestamp is preserved
      const ticket = await ticketManager.getTicket(attendeeA.ticket.id);
      expect(ticket.checkedInAt).toBe(originalTimestamp);
    });

    it('persists check-in state across restart / reinitialization', async () => {
      await checkInManager.checkIn(eventA.id, attendeeA.ticket.id);

      // Reinitialize on same storage directory
      const newStorage = new JsonStorage();
      await newStorage.initialize({ storagePath: tempDir });
      const newCheckIn = new CheckInManager(newStorage);

      const status = await newCheckIn.getCheckInStatus(attendeeA.ticket.id);
      expect(status.checkedIn).toBe(true);
      expect(status.status).toBe('USED');
    });

    it('handles concurrent check-in attempts safely with only 1 successful check-in', async () => {
      const attempts = 10;
      const promises = [];

      for (let i = 0; i < attempts; i++) {
        promises.push(
          checkInManager.checkIn(eventA.id, attendeeA.ticket.id).then(
            res => ({ success: true, res }),
            err => ({ success: false, err })
          )
        );
      }

      const results = await Promise.all(promises);
      const successes = results.filter(r => r.success);
      const failures = results.filter(r => !r.success && r.err instanceof AlreadyCheckedInError);

      expect(successes.length).toBe(1);
      expect(failures.length).toBe(attempts - 1);
    });

    it('retrieves check-in status accurately via getCheckInStatus', async () => {
      const statusBefore = await checkInManager.getCheckInStatus(attendeeA.ticket.id);
      expect(statusBefore.checkedIn).toBe(false);
      expect(statusBefore.status).toBe('ACTIVE');

      await checkInManager.checkIn(eventA.id, attendeeA.ticket.id);

      const statusAfter = await checkInManager.getCheckInStatus(attendeeA.ticket.id);
      expect(statusAfter.checkedIn).toBe(true);
      expect(statusAfter.status).toBe('USED');
      expect(statusAfter.checkedInAt).toBeDefined();
    });

    it('retrieves only checked-in attendees for an event via getCheckedInAttendees', async () => {
      const attendeeB = await attendeeManager.registerAttendee(eventA.id, {
        name: 'Bob',
        email: 'bob@example.com'
      });

      // Initially no one is checked in
      expect(await checkInManager.getCheckedInAttendees(eventA.id)).toEqual([]);

      // Check in Alice
      await checkInManager.checkIn(eventA.id, attendeeA.ticket.id);

      const checkedInList = await checkInManager.getCheckedInAttendees(eventA.id);
      expect(checkedInList.length).toBe(1);
      expect(checkedInList[0].id).toBe(attendeeA.id);
      expect(checkedInList[0].checkedIn).toBe(true);
    });
  });
});
