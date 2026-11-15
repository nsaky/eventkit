'use strict';

const fs = require('fs/promises');
const path = require('path');
const { validateEventId } = require('../utils/validators');
const {
  EventNotFoundError,
  UnsupportedExportFormatError,
  ExportFailedError,
  FileAlreadyExistsError
} = require('../utils/errors');

/**
 * Escapes a single value for RFC 4180 compliant CSV output.
 *
 * @param {any} value - Value to escape.
 * @returns {string} Escaped CSV field.
 */
function escapeCSV(value) {
  if (value === null || value === undefined) {
    return '';
  }
  const stringValue = String(value);
  if (
    stringValue.includes(',') ||
    stringValue.includes('"') ||
    stringValue.includes('\n') ||
    stringValue.includes('\r')
  ) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

/**
 * Converts an array of attendee records (with tickets) to CSV string.
 *
 * @param {Array<object>} attendees - Attendees with tickets.
 * @returns {string} CSV formatted string.
 */
function convertAttendeesToCSV(attendees) {
  const headers = [
    'Attendee ID',
    'Attendee Name',
    'Email Address',
    'Phone Number',
    'Ticket ID',
    'Ticket Status',
    'Registration Timestamp',
    'Attendance Status',
    'Check-in Timestamp'
  ];

  const rows = [headers.join(',')];

  for (const a of attendees) {
    const ticketId = a.ticket ? a.ticket.id : '';
    const ticketStatus = a.ticket ? a.ticket.status : '';
    const attendanceStatus = a.checkedIn ? 'CHECKED_IN' : 'PENDING';
    const checkInTime = a.checkedInAt || '';

    const row = [
      escapeCSV(a.id),
      escapeCSV(a.name),
      escapeCSV(a.email),
      escapeCSV(a.phone),
      escapeCSV(ticketId),
      escapeCSV(ticketStatus),
      escapeCSV(a.registeredAt),
      escapeCSV(attendanceStatus),
      escapeCSV(checkInTime)
    ];

    rows.push(row.join(','));
  }

  return rows.join('\n') + '\n';
}

/**
 * Service for exporting event and attendee data into JSON and CSV formats.
 */
class ExportService {
  /**
   * @param {import('../storage/storage')} storage - Storage instance.
   */
  constructor(storage) {
    if (!storage) {
      throw new Error('Storage instance is required for ExportService.');
    }
    this._storage = storage;
  }

  /**
   * Saves content to disk with overwrite protection and directory creation.
   * @private
   */
  async _saveToFile(filePath, content, overwrite = false) {
    const targetPath = path.isAbsolute(filePath)
      ? path.normalize(filePath)
      : path.resolve(process.cwd(), filePath);

    if (!overwrite) {
      try {
        await fs.access(targetPath);
        throw new FileAlreadyExistsError(targetPath);
      } catch (err) {
        if (err instanceof FileAlreadyExistsError) {
          throw err;
        }
        // File does not exist, safe to proceed
      }
    }

    try {
      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.writeFile(targetPath, content, 'utf-8');
      return targetPath;
    } catch (err) {
      if (err instanceof FileAlreadyExistsError) {
        throw err;
      }
      throw new ExportFailedError(`Failed to save export file at '${targetPath}': ${err.message}`, err);
    }
  }

  /**
   * Wraps export result according to whether filePath was requested.
   * @private
   */
  _formatResult(content, savedFilePath) {
    if (!savedFilePath) {
      return content;
    }
    const resultObj = new String(content);
    resultObj.content = content;
    resultObj.filePath = savedFilePath;
    return resultObj;
  }

  /**
   * Exports attendee records for a specified event in JSON or CSV format.
   *
   * @param {string} eventId - Unique event identifier.
   * @param {string} [format='json'] - Export format ('json' or 'csv').
   * @param {object} [options={}] - Options (filePath, overwrite).
   * @returns {Promise<string|object>} Exported content string or object with filePath.
   */
  async exportAttendees(eventId, format = 'json', options = {}) {
    validateEventId(eventId);

    const event = this._storage.getEventById(eventId);
    if (!event) {
      throw new EventNotFoundError(eventId);
    }

    const cleanFormat = typeof format === 'string' ? format.trim().toLowerCase() : '';
    if (cleanFormat !== 'json' && cleanFormat !== 'csv') {
      throw new UnsupportedExportFormatError(format);
    }

    const attendees = this._storage.getAttendeesByEventId(eventId).map(a => {
      const ticket = this._storage.getTicketByAttendeeId(a.id);
      return {
        ...a,
        ticket: ticket || null
      };
    });

    let content;
    if (cleanFormat === 'json') {
      content = JSON.stringify(attendees, null, 2);
    } else {
      content = convertAttendeesToCSV(attendees);
    }

    let savedPath = null;
    if (options.filePath) {
      savedPath = await this._saveToFile(options.filePath, content, options.overwrite);
    }

    return this._formatResult(content, savedPath);
  }

  /**
   * Exports full event information including metadata, attendees, and tickets.
   *
   * @param {string} eventId - Unique event identifier.
   * @param {string} [format='json'] - Export format ('json' or 'csv').
   * @param {object} [options={}] - Options (filePath, overwrite).
   * @returns {Promise<string|object>} Exported content string or object with filePath.
   */
  async exportEvent(eventId, format = 'json', options = {}) {
    validateEventId(eventId);

    const event = this._storage.getEventById(eventId);
    if (!event) {
      throw new EventNotFoundError(eventId);
    }

    const cleanFormat = typeof format === 'string' ? format.trim().toLowerCase() : '';
    if (cleanFormat !== 'json' && cleanFormat !== 'csv') {
      throw new UnsupportedExportFormatError(format);
    }

    const attendees = this._storage.getAttendeesByEventId(eventId).map(a => {
      const ticket = this._storage.getTicketByAttendeeId(a.id);
      return {
        ...a,
        ticket: ticket || null
      };
    });

    let content;
    if (cleanFormat === 'json') {
      const totalCheckedIn = attendees.filter(a => a.checkedIn).length;
      const exportData = {
        event,
        attendees,
        summary: {
          totalRegistrations: attendees.length,
          totalCheckedIn,
          totalPending: attendees.length - totalCheckedIn,
          exportedAt: new Date().toISOString()
        }
      };
      content = JSON.stringify(exportData, null, 2);
    } else {
      content = convertAttendeesToCSV(attendees);
    }

    let savedPath = null;
    if (options.filePath) {
      savedPath = await this._saveToFile(options.filePath, content, options.overwrite);
    }

    return this._formatResult(content, savedPath);
  }
}

module.exports = ExportService;
