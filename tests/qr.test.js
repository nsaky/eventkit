'use strict';

const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const { PNG } = require('pngjs');
const jsQR = require('jsqr');
const JsonStorage = require('../src/storage/json-storage');
const EventManager = require('../src/core/event');
const AttendeeManager = require('../src/core/attendee');
const QRService = require('../src/services/qr');
const {
  TicketNotFoundError,
  InvalidQRFormatError,
  FileAlreadyExistsError
} = require('../src/utils/errors');

function decodeQRFromPNG(buffer) {
  const png = PNG.sync.read(buffer);
  const code = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  if (!code) return null;
  return JSON.parse(code.data);
}

describe('QRService', () => {
  let tempDir;
  let storage;
  let eventManager;
  let attendeeManager;
  let qrService;
  let sampleEvent;
  let sampleAttendee;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'eventkit-qr-test-'));
    storage = new JsonStorage();
    await storage.initialize({ storagePath: tempDir });
    eventManager = new EventManager(storage);
    attendeeManager = new AttendeeManager(storage);
    qrService = new QRService(storage);

    sampleEvent = await eventManager.createEvent({
      name: 'Mobile Dev Summit',
      date: '2026-10-10'
    });

    sampleAttendee = await attendeeManager.registerAttendee(sampleEvent.id, {
      name: 'John Developer',
      email: 'john@example.com',
      phone: '+1 555-456-7890'
    });
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('generates a valid PNG QR code containing the minimal ticket reference payload', async () => {
    const result = await qrService.generateQRCode(sampleAttendee.ticket.id, {
      format: 'png',
      width: 250
    });

    expect(result.ticketId).toBe(sampleAttendee.ticket.id);
    expect(result.eventId).toBe(sampleEvent.id);
    expect(result.format).toBe('png');
    expect(result.mimeType).toBe('image/png');
    expect(Buffer.isBuffer(result.data)).toBe(true);
    expect(result.filePath).toBeNull();

    // Verify decoded content directly using jsQR
    const decodedPayload = decodeQRFromPNG(result.data);
    expect(decodedPayload).toEqual({
      ticketId: sampleAttendee.ticket.id,
      eventId: sampleEvent.id
    });

    // Verify no attendee PII is encoded
    const rawPayloadString = result.data.toString('utf-8');
    expect(rawPayloadString.includes('John Developer')).toBe(false);
    expect(rawPayloadString.includes('john@example.com')).toBe(false);
    expect(rawPayloadString.includes('555-456-7890')).toBe(false);
  });

  it('generates a valid SVG QR code string', async () => {
    const result = await qrService.generateQRCode(sampleAttendee.ticket.id, {
      format: 'svg'
    });

    expect(result.format).toBe('svg');
    expect(result.mimeType).toBe('image/svg+xml');
    expect(typeof result.data).toBe('string');
    expect(result.data).toContain('<svg');
    expect(result.data).toContain('</svg>');
  });

  it('saves generated QR code to a file when filePath is provided', async () => {
    const outPath = path.join(tempDir, 'nested', 'qr', 'test-ticket.png');

    const result = await qrService.generateQRCode(sampleAttendee.ticket.id, {
      format: 'png',
      filePath: outPath
    });

    expect(result.filePath).toBe(outPath);

    // Verify file exists on disk and is readable
    const fileBytes = await fs.readFile(outPath);
    expect(Buffer.isBuffer(fileBytes)).toBe(true);

    const decoded = decodeQRFromPNG(fileBytes);
    expect(decoded.ticketId).toBe(sampleAttendee.ticket.id);
  });

  it('prevents overwriting existing files unless overwrite: true is passed', async () => {
    const outPath = path.join(tempDir, 'existing.png');
    await fs.writeFile(outPath, 'pre-existing dummy data');

    // Attempt without overwrite -> throws FileAlreadyExistsError
    await expect(
      qrService.generateQRCode(sampleAttendee.ticket.id, {
        filePath: outPath,
        overwrite: false
      })
    ).rejects.toThrow(FileAlreadyExistsError);

    // Verify file content was not overwritten
    expect(await fs.readFile(outPath, 'utf-8')).toBe('pre-existing dummy data');

    // Attempt with overwrite: true -> succeeds
    const result = await qrService.generateQRCode(sampleAttendee.ticket.id, {
      filePath: outPath,
      overwrite: true
    });
    expect(result.filePath).toBe(outPath);
  });

  it('throws InvalidQRFormatError for unsupported format', async () => {
    await expect(
      qrService.generateQRCode(sampleAttendee.ticket.id, { format: 'jpeg' })
    ).rejects.toThrow(InvalidQRFormatError);
  });

  it('throws TicketNotFoundError when ticket does not exist', async () => {
    await expect(
      qrService.generateQRCode('EK-0000000000')
    ).rejects.toThrow(TicketNotFoundError);
  });

  it('throws an error if QRService is instantiated without storage', () => {
    expect(() => new QRService()).toThrow('Storage instance is required for QRService.');
  });
});
