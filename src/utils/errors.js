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
  NotInitializedError
};
