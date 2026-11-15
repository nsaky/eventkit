'use strict';

const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const JsonStorage = require('../src/storage/json-storage');
const EventManager = require('../src/core/event');
const AttendeeManager = require('../src/core/attendee');
const CheckInManager = require('../src/core/checkin');
const SearchService = require('../src/services/search');
const { EventNotFoundError } = require('../src/utils/errors');

describe('SearchService', () => {
  let tempDir;
  let storage;
  let eventManager;
  let attendeeManager;
  let checkInManager;
  let searchService;
  let event;
  let att1;
  let att2;
  let att3;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'eventkit-search-test-'));
    storage = new JsonStorage();
    await storage.initialize({ storagePath: tempDir });
    eventManager = new EventManager(storage);
    attendeeManager = new AttendeeManager(storage);
    checkInManager = new CheckInManager(storage);
    searchService = new SearchService(storage);

    event = await eventManager.createEvent({
      name: 'Search Summit',
      date: '2026-10-20'
    });

    att1 = await attendeeManager.registerAttendee(event.id, {
      name: 'Johnathan Archer',
      email: 'johnathan@enterprise.com'
    });

    att2 = await attendeeManager.registerAttendee(event.id, {
      name: 'T\'Pol Vulcan',
      email: 'tpol@vulcan.org'
    });

    att3 = await attendeeManager.registerAttendee(event.id, {
      name: 'Malcolm Reed',
      email: 'reed@security.com'
    });

    // Check in att1
    await checkInManager.checkIn(event.id, att1.ticket.id);
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('searches attendees by partial, case-insensitive name', async () => {
    const results = await searchService.searchAttendees(event.id, 'john');
    expect(results.length).toBe(1);
    expect(results[0].name).toBe('Johnathan Archer');
  });

  it('searches attendees by partial, case-insensitive email', async () => {
    const results = await searchService.searchAttendees(event.id, 'vulcan.org');
    expect(results.length).toBe(1);
    expect(results[0].email).toBe('tpol@vulcan.org');
  });

  it('searches attendees by exact or partial ticket ID', async () => {
    const results = await searchService.searchAttendees(event.id, att3.ticket.id);
    expect(results.length).toBe(1);
    expect(results[0].id).toBe(att3.id);
  });

  it('filters attendees by checked-in status', async () => {
    const checkedIn = await searchService.searchAttendees(event.id, '', { checkedIn: true });
    expect(checkedIn.length).toBe(1);
    expect(checkedIn[0].id).toBe(att1.id);

    const pending = await searchService.searchAttendees(event.id, '', { checkedIn: false });
    expect(pending.length).toBe(2);
    expect(pending.map(a => a.id)).toEqual([att2.id, att3.id]);
  });

  it('combines search query with attendance status filter', async () => {
    // Both att1 and att2 have some letters, but let's query 'enterprise' with checkedIn: true
    const results = await searchService.searchAttendees(event.id, 'enterprise', { checkedIn: true });
    expect(results.length).toBe(1);
    expect(results[0].id).toBe(att1.id);

    // Query 'enterprise' with checkedIn: false -> no matches
    const none = await searchService.searchAttendees(event.id, 'enterprise', { checkedIn: false });
    expect(none.length).toBe(0);
  });

  it('searches ticket by ID and includes associated attendee and event metadata', async () => {
    const ticketSearch = await searchService.searchTicket(att1.ticket.id);
    expect(ticketSearch).toBeDefined();
    expect(ticketSearch.ticket.id).toBe(att1.ticket.id);
    expect(ticketSearch.attendee.id).toBe(att1.id);
    expect(ticketSearch.event.id).toBe(event.id);
  });

  it('returns null when searching for a non-existent ticket ID', async () => {
    const res = await searchService.searchTicket('EK-0000000000');
    expect(res).toBeNull();
  });

  it('throws EventNotFoundError when searching attendees for non-existent event', async () => {
    await expect(searchService.searchAttendees('evt_000000000000000000000000'))
      .rejects.toThrow(EventNotFoundError);
  });

  it('throws an error if SearchService is instantiated without storage', () => {
    expect(() => new SearchService()).toThrow('Storage instance is required for SearchService.');
  });
});
