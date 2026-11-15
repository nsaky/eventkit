'use strict';

const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const { PNG } = require('pngjs');
const jsQR = require('jsqr');
const EventKit = require('../src/index');
const {
  AlreadyCheckedInError,
  EventNotFoundError,
  WrongEventError,
  TicketNotFoundError
} = EventKit.errors;

describe('Phase 2 Full End-to-End Workflow Integration Test', () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'eventkit-phase2-workflow-'));
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

  it('successfully executes the complete 20-step Phase 2 integration lifecycle', async () => {
    // 1. Initialize EventKit with a temporary storage directory
    await EventKit.initialize({ storagePath: tempDir });

    // 2. Create an event with a fixed capacity
    const event = await EventKit.createEvent({
      name: 'Global Node Summit 2026',
      description: 'The premier conference for Node.js developers and architects.',
      date: '2026-11-15',
      location: 'Pune',
      capacity: 5
    });
    expect(event.id).toMatch(/^evt_/);
    expect(event.capacity).toBe(5);

    // 3. Register multiple attendees
    const att1 = await EventKit.registerAttendee(event.id, {
      name: 'Alice Johnson',
      email: 'alice@example.com',
      phone: '+1 555-0100'
    });

    const att2 = await EventKit.registerAttendee(event.id, {
      name: 'Bob Smith',
      email: 'bob@example.com',
      phone: '+1 555-0200'
    });

    const att3 = await EventKit.registerAttendee(event.id, {
      name: 'Charlie Davis',
      email: 'charlie@example.com'
    });

    // 4. Verify automatic ticket generation
    expect(att1.ticket).toBeDefined();
    expect(att1.ticket.id).toMatch(/^EK-[A-F0-9]{10}$/);
    expect(att1.ticket.status).toBe('ACTIVE');
    expect(att1.ticket.attendeeId).toBe(att1.id);

    expect(att2.ticket).toBeDefined();
    expect(att3.ticket).toBeDefined();
    expect(att1.ticket.id).not.toBe(att2.ticket.id);

    // 5. Retrieve the tickets
    const fetchedTicket1 = await EventKit.getTicket(att1.ticket.id);
    expect(fetchedTicket1).toEqual(att1.ticket);

    // 6. Generate a PNG QR code
    const pngResult = await EventKit.generateQRCode(att1.ticket.id, {
      format: 'png',
      width: 200
    });
    expect(pngResult.mimeType).toBe('image/png');
    expect(Buffer.isBuffer(pngResult.data)).toBe(true);

    // Decode QR code buffer to verify payload
    const pngParsed = PNG.sync.read(pngResult.data);
    const decodedQR = jsQR(new Uint8ClampedArray(pngParsed.data), pngParsed.width, pngParsed.height);
    expect(decodedQR).not.toBeNull();
    const payload = JSON.parse(decodedQR.data);
    expect(payload).toEqual({
      ticketId: att1.ticket.id,
      eventId: event.id
    });

    // 7. Generate an SVG QR code
    const svgResult = await EventKit.generateQRCode(att1.ticket.id, {
      format: 'svg'
    });
    expect(svgResult.mimeType).toBe('image/svg+xml');
    expect(typeof svgResult.data).toBe('string');
    expect(svgResult.data).toContain('<svg');

    // 8. Validate a ticket
    const validationValid = await EventKit.validateTicket(event.id, att1.ticket.id);
    expect(validationValid.valid).toBe(true);
    expect(validationValid.status).toBe('VALID');
    expect(validationValid.ticket.id).toBe(att1.ticket.id);
    expect(validationValid.attendee.id).toBe(att1.id);

    // 9. Attempt to validate a ticket against the wrong event
    const otherEvent = await EventKit.createEvent({
      name: 'Other Event',
      date: '2026-12-01'
    });
    const validationWrong = await EventKit.validateTicket(otherEvent.id, att1.ticket.id);
    expect(validationWrong.valid).toBe(false);
    expect(validationWrong.status).toBe('WRONG_EVENT');

    // 10. Check in a valid attendee
    const checkInResult = await EventKit.checkIn(event.id, att1.ticket.id);
    expect(checkInResult.success).toBe(true);
    expect(checkInResult.status).toBe('CHECKED_IN');
    expect(checkInResult.attendeeName).toBe('Alice Johnson');

    const status1 = await EventKit.getCheckInStatus(att1.ticket.id);
    expect(status1.checkedIn).toBe(true);
    expect(status1.status).toBe('USED');

    // 11. Attempt to check in the same attendee again
    await expect(EventKit.checkIn(event.id, att1.ticket.id)).rejects.toThrow(AlreadyCheckedInError);

    // 12. Verify attendance statistics
    const stats = await EventKit.getAttendanceStats(event.id);
    expect(stats.totalRegistrations).toBe(3);
    expect(stats.totalCheckedIn).toBe(1);
    expect(stats.totalPending).toBe(2);
    expect(stats.attendancePercentage).toBe(33.33);
    expect(stats.capacity).toBe(5);
    expect(stats.registrationPercentage).toBe(60.0);

    // 13. Search for attendees
    const searchByName = await EventKit.searchAttendees(event.id, 'alice');
    expect(searchByName.length).toBe(1);
    expect(searchByName[0].id).toBe(att1.id);

    const searchCheckedIn = await EventKit.searchAttendees(event.id, '', { checkedIn: true });
    expect(searchCheckedIn.length).toBe(1);
    expect(searchCheckedIn[0].id).toBe(att1.id);

    // 14. Search for a ticket
    const ticketSearch = await EventKit.searchTicket(att1.ticket.id);
    expect(ticketSearch).not.toBeNull();
    expect(ticketSearch.ticket.id).toBe(att1.ticket.id);
    expect(ticketSearch.attendee.name).toBe('Alice Johnson');
    expect(ticketSearch.event.name).toBe('Global Node Summit 2026');

    // 15. Export JSON records
    const jsonExport = await EventKit.exportAttendees(event.id, 'json');
    const parsedJson = JSON.parse(jsonExport);
    expect(parsedJson.length).toBe(3);

    // 16. Export CSV records
    const csvExport = await EventKit.exportAttendees(event.id, 'csv');
    expect(csvExport).toContain('Attendee ID,Attendee Name');
    expect(csvExport).toContain('Alice Johnson');

    // 17. Remove an attendee and verify associated ticket removal
    const removedAttendee = await EventKit.removeAttendee(att3.id);
    expect(removedAttendee.id).toBe(att3.id);
    expect(await EventKit.getAttendee(att3.id)).toBeNull();
    expect(await EventKit.getTicket(att3.ticket.id)).toBeNull();

    // 18. Delete the other event and verify all associated records are removed
    await EventKit.deleteEvent(otherEvent.id);
    expect(await EventKit.getEvent(otherEvent.id)).toBeNull();

    // 19. Reinitialize EventKit using the same storage directory
    await EventKit.reset();
    await EventKit.initialize({ storagePath: tempDir });

    // 20. Verify that all expected records and statuses persist
    const reloadedEvent = await EventKit.getEvent(event.id);
    expect(reloadedEvent.name).toBe('Global Node Summit 2026');

    const reloadedAtt1 = await EventKit.getAttendee(att1.id);
    expect(reloadedAtt1.checkedIn).toBe(true);

    const reloadedTicket1 = await EventKit.getTicket(att1.ticket.id);
    expect(reloadedTicket1.status).toBe('USED');

    const reloadedAtt2 = await EventKit.getAttendee(att2.id);
    expect(reloadedAtt2.checkedIn).toBe(false);

    const checkedInList = await EventKit.getCheckedInAttendees(event.id);
    expect(checkedInList.length).toBe(1);
    expect(checkedInList[0].id).toBe(att1.id);
  });
});
