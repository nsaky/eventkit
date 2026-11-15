'use strict';

const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const JsonStorage = require('../src/storage/json-storage');
const EventManager = require('../src/core/event');
const AttendeeManager = require('../src/core/attendee');
const ExportService = require('../src/services/export');
const {
  EventNotFoundError,
  UnsupportedExportFormatError,
  FileAlreadyExistsError
} = require('../src/utils/errors');

describe('ExportService', () => {
  let tempDir;
  let storage;
  let eventManager;
  let attendeeManager;
  let exportService;
  let event;
  let att1;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'eventkit-export-test-'));
    storage = new JsonStorage();
    await storage.initialize({ storagePath: tempDir });
    eventManager = new EventManager(storage);
    attendeeManager = new AttendeeManager(storage);
    exportService = new ExportService(storage);

    event = await eventManager.createEvent({
      name: 'Global Tech Con',
      date: '2026-12-01'
    });

    att1 = await attendeeManager.registerAttendee(event.id, {
      name: 'Doe, John "The Coder"', // Test commas and quotes
      email: 'john@example.com',
      phone: '+1 555-0199'
    });
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('exports attendees in valid JSON format', async () => {
    const rawJson = await exportService.exportAttendees(event.id, 'json');
    const parsed = JSON.parse(rawJson);

    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBe(1);
    expect(parsed[0].id).toBe(att1.id);
    expect(parsed[0].name).toBe('Doe, John "The Coder"');
    expect(parsed[0].ticket.id).toBe(att1.ticket.id);
  });

  it('exports attendees in CSV format with properly escaped quotes and commas', async () => {
    const csv = await exportService.exportAttendees(event.id, 'csv');
    const lines = csv.trim().split('\n');

    expect(lines.length).toBe(2); // Header + 1 record

    const expectedHeader = 'Attendee ID,Attendee Name,Email Address,Phone Number,Ticket ID,Ticket Status,Registration Timestamp,Attendance Status,Check-in Timestamp';
    expect(lines[0]).toBe(expectedHeader);

    // Verify escaped name: Doe, John "The Coder" -> "Doe, John ""The Coder"""
    expect(lines[1]).toContain('"Doe, John ""The Coder"""');
    expect(lines[1]).toContain(att1.id);
    expect(lines[1]).toContain('john@example.com');
  });

  it('handles empty events by outputting valid JSON and CSV headers', async () => {
    const emptyEvent = await eventManager.createEvent({ name: 'Empty Event', date: '2026-10-10' });

    const json = await exportService.exportAttendees(emptyEvent.id, 'json');
    expect(JSON.parse(json)).toEqual([]);

    const csv = await exportService.exportAttendees(emptyEvent.id, 'csv');
    const lines = csv.trim().split('\n');
    expect(lines.length).toBe(1);
    expect(lines[0]).toContain('Attendee ID');
  });

  it('exports full event snapshot with metadata and attendee list in JSON', async () => {
    const rawJson = await exportService.exportEvent(event.id, 'json');
    const parsed = JSON.parse(rawJson);

    expect(parsed.event.id).toBe(event.id);
    expect(parsed.event.name).toBe('Global Tech Con');
    expect(parsed.attendees.length).toBe(1);
    expect(parsed.summary.totalRegistrations).toBe(1);
  });

  it('saves export content to a specified file and respects overwrite protection', async () => {
    const targetFile = path.join(tempDir, 'exports', 'attendees.csv');

    const result = await exportService.exportAttendees(event.id, 'csv', {
      filePath: targetFile
    });

    expect(result.filePath).toBe(targetFile);

    const onDiskContent = await fs.readFile(targetFile, 'utf-8');
    expect(onDiskContent).toBe(result.content);

    // Overwrite: false when file exists throws FileAlreadyExistsError
    await expect(
      exportService.exportAttendees(event.id, 'csv', { filePath: targetFile, overwrite: false })
    ).rejects.toThrow(FileAlreadyExistsError);

    // Overwrite: true succeeds
    const overwriteResult = await exportService.exportAttendees(event.id, 'csv', {
      filePath: targetFile,
      overwrite: true
    });
    expect(overwriteResult.filePath).toBe(targetFile);
  });

  it('throws UnsupportedExportFormatError for invalid format', async () => {
    await expect(exportService.exportAttendees(event.id, 'xml'))
      .rejects.toThrow(UnsupportedExportFormatError);
  });

  it('throws EventNotFoundError for non-existent event ID', async () => {
    await expect(exportService.exportAttendees('evt_000000000000000000000000', 'json'))
      .rejects.toThrow(EventNotFoundError);
  });

  it('verifies export operations do not modify stored records', async () => {
    const beforeAttendees = storage.getAttendees();
    const beforeTickets = storage.getTickets();

    await exportService.exportAttendees(event.id, 'json');
    await exportService.exportAttendees(event.id, 'csv');
    await exportService.exportEvent(event.id, 'json');

    expect(storage.getAttendees()).toEqual(beforeAttendees);
    expect(storage.getTickets()).toEqual(beforeTickets);
  });
});
