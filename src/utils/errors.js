'use strict';

/**
 * Base error class for all EventKit errors.
 */
class EventKitError extends Error {
  /**
   * @param {string} message - Human-readable error message.
   * @param {string} code - Stable error code.
   * @param {object} [context={}] - Additional context information.
   * @param {Error} [cause] - Underlying cause error if any.
   */
  constructor(message, code, context = {}, cause = undefined) {
    super(message, cause ? { cause } : undefined);
    this.name = this.constructor.name;
    this.code = code;
    this.context = context;
    if (cause && !this.cause) {
      this.cause = cause;
    }
    Error.captureStackTrace(this, this.constructor);
  }
}

// Core Domain Errors
class EventNotFoundError extends EventKitError {
  constructor(eventId, context = {}) {
    super(`Event with ID '${eventId}' was not found.`, 'EVENT_NOT_FOUND', { eventId, ...context });
  }
}

class AttendeeNotFoundError extends EventKitError {
  constructor(attendeeId, context = {}) {
    super(`Attendee with ID '${attendeeId}' was not found.`, 'ATTENDEE_NOT_FOUND', { attendeeId, ...context });
  }
}

class InvalidEventDataError extends EventKitError {
  constructor(message, context = {}) {
    super(message || 'Invalid event data provided.', 'INVALID_EVENT_DATA', context);
  }
}

class InvalidAttendeeDataError extends EventKitError {
  constructor(message, context = {}) {
    super(message || 'Invalid attendee data provided.', 'INVALID_ATTENDEE_DATA', context);
  }
}

class InvalidEmailError extends EventKitError {
  constructor(email, context = {}) {
    super(`Invalid email address format: '${email}'.`, 'INVALID_EMAIL', { email, ...context });
  }
}

class DuplicateRegistrationError extends EventKitError {
  constructor(eventId, email, context = {}) {
    super(
      `Attendee with email '${email}' is already registered for event '${eventId}'.`,
      'DUPLICATE_REGISTRATION',
      { eventId, email, ...context }
    );
  }
}

class EventCapacityReachedError extends EventKitError {
  constructor(eventId, capacity, currentCount, context = {}) {
    super(
      `Event '${eventId}' has reached maximum capacity (${capacity} attendees).`,
      'EVENT_CAPACITY_REACHED',
      { eventId, capacity, currentCount, ...context }
    );
  }
}

class InvalidEventIdError extends EventKitError {
  constructor(eventId, message, context = {}) {
    super(
      message || `Invalid event ID format or value: '${eventId}'.`,
      'INVALID_EVENT_ID',
      { eventId, ...context }
    );
  }
}

class StorageError extends EventKitError {
  constructor(message, cause, context = {}) {
    super(message || 'A storage error occurred.', 'STORAGE_ERROR', context, cause);
  }
}

class StorageCorruptedError extends EventKitError {
  constructor(filePath, cause, context = {}) {
    super(
      `Storage file corrupted at '${filePath}'. Data could not be parsed as valid JSON.`,
      'STORAGE_CORRUPTED',
      { filePath, ...context },
      cause
    );
  }
}

class NotInitializedError extends EventKitError {
  constructor(message = 'EventKit has not been initialized. Call EventKit.initialize() first.', context = {}) {
    super(message, 'NOT_INITIALIZED', context);
  }
}

// Ticketing, Arrival & Service Errors
class TicketNotFoundError extends EventKitError {
  constructor(ticketId, context = {}) {
    super(`Ticket with ID '${ticketId}' was not found.`, 'TICKET_NOT_FOUND', { ticketId, ...context });
  }
}

class InvalidTicketIdError extends EventKitError {
  constructor(ticketId, message, context = {}) {
    super(
      message || `Invalid ticket ID format or value: '${ticketId}'.`,
      'INVALID_TICKET_ID',
      { ticketId, ...context }
    );
  }
}

class TicketAlreadyExistsError extends EventKitError {
  constructor(attendeeId, ticketId, context = {}) {
    super(
      `Attendee '${attendeeId}' already has an associated ticket '${ticketId}'.`,
      'TICKET_ALREADY_EXISTS',
      { attendeeId, ticketId, ...context }
    );
  }
}

class TicketAlreadyUsedError extends EventKitError {
  constructor(ticketId, context = {}) {
    super(
      `Ticket '${ticketId}' has already been used and cannot be cancelled or re-used.`,
      'TICKET_ALREADY_USED',
      { ticketId, ...context }
    );
  }
}

class TicketCancelledError extends EventKitError {
  constructor(ticketId, context = {}) {
    super(`Ticket '${ticketId}' has been cancelled.`, 'TICKET_CANCELLED', { ticketId, ...context });
  }
}

class WrongEventError extends EventKitError {
  constructor(ticketId, ticketEventId, targetEventId, context = {}) {
    super(
      `Ticket '${ticketId}' belongs to event '${ticketEventId}', not '${targetEventId}'.`,
      'WRONG_EVENT',
      { ticketId, ticketEventId, targetEventId, ...context }
    );
  }
}

class AlreadyCheckedInError extends EventKitError {
  constructor(ticketId, checkedInAt, context = {}) {
    super(
      `Ticket '${ticketId}' has already been checked in (at ${checkedInAt}).`,
      'ALREADY_CHECKED_IN',
      { ticketId, checkedInAt, ...context }
    );
  }
}

class InvalidQRFormatError extends EventKitError {
  constructor(format, context = {}) {
    super(
      `Unsupported QR format '${format}'. Supported formats are 'png' and 'svg'.`,
      'INVALID_QR_FORMAT',
      { format, ...context }
    );
  }
}

class QRGenerationFailedError extends EventKitError {
  constructor(message, cause, context = {}) {
    super(message || 'Failed to generate QR code.', 'QR_GENERATION_FAILED', context, cause);
  }
}

class UnsupportedExportFormatError extends EventKitError {
  constructor(format, context = {}) {
    super(
      `Unsupported export format '${format}'. Supported formats are 'json' and 'csv'.`,
      'UNSUPPORTED_EXPORT_FORMAT',
      { format, ...context }
    );
  }
}

class ExportFailedError extends EventKitError {
  constructor(message, cause, context = {}) {
    super(message || 'Failed to export data.', 'EXPORT_FAILED', context, cause);
  }
}

class FileAlreadyExistsError extends EventKitError {
  constructor(filePath, context = {}) {
    super(
      `File already exists at '${filePath}'. Set 'overwrite: true' to overwrite existing files.`,
      'FILE_ALREADY_EXISTS',
      { filePath, ...context }
    );
  }
}

class InvalidExportPathError extends EventKitError {
  constructor(filePath, message, context = {}) {
    super(
      message || `Invalid export file path: '${filePath}'.`,
      'INVALID_EXPORT_PATH',
      { filePath, ...context }
    );
  }
}

module.exports = {
  EventKitError,
  EventNotFoundError,
  AttendeeNotFoundError,
  InvalidEventDataError,
  InvalidAttendeeDataError,
  InvalidEmailError,
  DuplicateRegistrationError,
  EventCapacityReachedError,
  InvalidEventIdError,
  StorageError,
  StorageCorruptedError,
  NotInitializedError,

  // Ticketing, Arrival & Service Errors
  TicketNotFoundError,
  InvalidTicketIdError,
  TicketAlreadyExistsError,
  TicketAlreadyUsedError,
  TicketCancelledError,
  WrongEventError,
  AlreadyCheckedInError,
  InvalidQRFormatError,
  QRGenerationFailedError,
  UnsupportedExportFormatError,
  ExportFailedError,
  FileAlreadyExistsError,
  InvalidExportPathError
};
