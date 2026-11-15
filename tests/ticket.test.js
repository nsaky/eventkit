'use strict';

const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const JsonStorage = require('../src/storage/json-storage');
const EventManager = require('../src/core/event');
const AttendeeManager = require('../src/core/attendee');
const TicketManager = require('../src/core/ticket');
const {
  TicketNotFoundError,
  InvalidTicketIdError,
  TicketAlreadyExistsError,
  TicketAlreadyUsedError,
  AttendeeNotFoundError
} = require('../src/utils/errors');

describe('TicketManager & Automatic Ticketing', () => {
  let tempDir;
  let storage;
  let eventManager;
  let attendeeManager;
  let ticketManager;
  let sampleEvent;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'eventkit-ticket-test-'));
    storage = new JsonStorage();
    await storage.initialize({ storagePath: tempDir });
    eventManager = new EventManager(storage);
    attendeeManager = new AttendeeManager(storage);
    ticketManager = new TicketManager(storage);

    sampleEvent = await eventManager.createEvent({
      name: 'Fullstack Conference 2026',
      date: '2026-11-25',
      capacity: 5
    });
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('automatically generates exactly one unique ticket upon attendee registration', async () => {
    const attendee = await attendeeManager.registerAttendee(sampleEvent.id, {
      name: 'Alice Wonder',
      email: 'alice@example.com'
    });

    expect(attendee.ticket).toBeDefined();
    expect(attendee.ticket.id).toMatch(/^EK-[A-F0-9]{10}$/);
    expect(attendee.ticket.eventId).toBe(sampleEvent.id);
    expect(attendee.ticket.attendeeId).toBe(attendee.id);
    expect(attendee.ticket.status).toBe('ACTIVE');
    expect(attendee.ticket.checkedInAt).toBeNull();
    expect(new Date(attendee.ticket.createdAt).toISOString()).toBe(attendee.ticket.createdAt);

    // Verify ticket is retrievable via getTicket
    const ticket = await ticketManager.getTicket(attendee.ticket.id);
    expect(ticket).toEqual(attendee.ticket);
  });

  it('persists tickets to tickets.json and reloads them after reinitialization', async () => {
    const attendee = await attendeeManager.registerAttendee(sampleEvent.id, {
      name: 'Bob Ross',
      email: 'bob@example.com'
    });

    // Reinitialize on the same storage path
    const newStorage = new JsonStorage();
    await newStorage.initialize({ storagePath: tempDir });
    const newTicketManager = new TicketManager(newStorage);

    const reloaded = await newTicketManager.getTicket(attendee.ticket.id);
    expect(reloaded).toEqual(attendee.ticket);
  });

  it('generates unique, cryptographically random ticket IDs for multiple attendees', async () => {
    const count = 5;
    const ticketIds = new Set();

    for (let i = 0; i < count; i++) {
      const att = await attendeeManager.registerAttendee(sampleEvent.id, {
        name: `User ${i}`,
        email: `user${i}@example.com`
      });
      expect(ticketIds.has(att.ticket.id)).toBe(false);
      ticketIds.add(att.ticket.id);
    }

    expect(ticketIds.size).toBe(count);
  });

  it('supports standalone ticket generation for existing attendees without a ticket', async () => {
    // Directly seed an attendee without a ticket (representing a historical Phase 1 attendee)
    const historicalAttendee = {
      id: 'att_historical0123456789ab',
      eventId: sampleEvent.id,
      name: 'Old User',
      email: 'old@example.com',
      phone: null,
      registeredAt: new Date().toISOString(),
      status: 'REGISTERED',
      checkedIn: false,
      checkedInAt: null
    };
    await storage.saveAttendees([historicalAttendee]);

    const generated = await ticketManager.generateTicket(historicalAttendee.id);
    expect(generated.id).toMatch(/^EK-[A-F0-9]{10}$/);
    expect(generated.attendeeId).toBe(historicalAttendee.id);
    expect(generated.eventId).toBe(sampleEvent.id);
    expect(generated.status).toBe('ACTIVE');

    // Attempting standalone generation again throws TicketAlreadyExistsError
    await expect(ticketManager.generateTicket(historicalAttendee.id))
      .rejects.toThrow(TicketAlreadyExistsError);

    // With returnExisting option, returns the existing ticket
    const existing = await ticketManager.generateTicket(historicalAttendee.id, { returnExisting: true });
    expect(existing.id).toBe(generated.id);
  });

  it('throws AttendeeNotFoundError when generating ticket for non-existent attendee', async () => {
    await expect(ticketManager.generateTicket('att_nonexistent0123456789'))
      .rejects.toThrow(AttendeeNotFoundError);
  });

  it('cancels an active ticket, updating status to CANCELLED and preserving timestamps', async () => {
    const attendee = await attendeeManager.registerAttendee(sampleEvent.id, {
      name: 'Charlie Brown',
      email: 'charlie@example.com'
    });

    const originalCreatedAt = attendee.ticket.createdAt;
    const cancelled = await ticketManager.cancelTicket(attendee.ticket.id);

    expect(cancelled.status).toBe('CANCELLED');
    expect(cancelled.createdAt).toBe(originalCreatedAt);

    // Repeated cancellation is idempotent and succeeds
    const again = await ticketManager.cancelTicket(attendee.ticket.id);
    expect(again.status).toBe('CANCELLED');
  });

  it('prevents cancelling an already used ticket', async () => {
    const attendee = await attendeeManager.registerAttendee(sampleEvent.id, {
      name: 'David Miller',
      email: 'david@example.com'
    });

    // Simulate ticket marked as USED
    const tickets = storage.getTickets();
    tickets[0].status = 'USED';
    tickets[0].checkedInAt = new Date().toISOString();
    await storage.saveTickets(tickets);

    await expect(ticketManager.cancelTicket(attendee.ticket.id))
      .rejects.toThrow(TicketAlreadyUsedError);
  });

  it('throws TicketNotFoundError for non-existent ticket in getTicket and cancelTicket', async () => {
    const nonExistent = 'EK-0000000000';
    expect(await ticketManager.getTicket(nonExistent)).toBeNull();
    await expect(ticketManager.cancelTicket(nonExistent)).rejects.toThrow(TicketNotFoundError);
  });

  it('validates ticket ID format and throws InvalidTicketIdError if invalid', async () => {
    await expect(ticketManager.getTicket('invalid')).rejects.toThrow(InvalidTicketIdError);
    await expect(ticketManager.cancelTicket('')).rejects.toThrow(InvalidTicketIdError);
  });
});
