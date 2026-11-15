'use strict';

const {
  InvalidEventDataError,
  InvalidAttendeeDataError,
  InvalidEmailError,
  InvalidEventIdError
} = require('./errors');

const DATE_REGEX = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
const PHONE_REGEX = /^\+?[0-9\s\-()]{7,25}$/;

/**
 * Validates a date string in YYYY-MM-DD format, verifying calendar correctness.
 *
 * @param {string} dateStr - Date string to validate.
 * @returns {boolean} True if valid calendar date in YYYY-MM-DD format.
 */
function isValidDate(dateStr) {
  if (typeof dateStr !== 'string' || !DATE_REGEX.test(dateStr)) {
    return false;
  }

  const [yearStr, monthStr, dayStr] = dateStr.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);

  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/**
 * Normalizes an email address by trimming whitespace and converting to lowercase.
 *
 * @param {string} email - Email address to normalize.
 * @returns {string} Normalized email address.
 */
function normalizeEmail(email) {
  if (typeof email !== 'string') {
    return '';
  }
  return email.trim().toLowerCase();
}

/**
 * Validates an email address.
 *
 * @param {string} email - Email address to test.
 * @returns {boolean} True if email is valid.
 */
function isValidEmail(email) {
  if (typeof email !== 'string') {
    return false;
  }
  const normalized = email.trim();
  if (normalized.length === 0 || normalized.length > 254) {
    return false;
  }
  return EMAIL_REGEX.test(normalized);
}

/**
 * Validates an optional phone number.
 *
 * @param {string} phone - Phone number to test.
 * @returns {boolean} True if phone format is valid.
 */
function isValidPhone(phone) {
  if (typeof phone !== 'string') {
    return false;
  }
  const trimmed = phone.trim();
  if (trimmed.length === 0) {
    return false;
  }
  // Count actual digits: require at least 7 digits
  const digitCount = (trimmed.match(/\d/g) || []).length;
  if (digitCount < 7 || digitCount > 17) {
    return false;
  }
  return PHONE_REGEX.test(trimmed);
}

/**
 * Validates an event ID string.
 *
 * @param {string} eventId - The event ID to validate.
 * @throws {InvalidEventIdError} If invalid.
 */
function validateEventId(eventId) {
  if (typeof eventId !== 'string' || !eventId.trim()) {
    throw new InvalidEventIdError(eventId, 'Event ID must be a non-empty string.');
  }
  if (!eventId.startsWith('evt_') || eventId.length < 8) {
    throw new InvalidEventIdError(eventId, `Event ID '${eventId}' is not in valid 'evt_<unique-id>' format.`);
  }
}

/**
 * Validates an attendee ID string.
 *
 * @param {string} attendeeId - The attendee ID to validate.
 * @throws {InvalidAttendeeDataError} If invalid.
 */
function validateAttendeeId(attendeeId) {
  if (typeof attendeeId !== 'string' || !attendeeId.trim()) {
    throw new InvalidAttendeeDataError('Attendee ID must be a non-empty string.', { attendeeId });
  }
  if (!attendeeId.startsWith('att_') || attendeeId.length < 8) {
    throw new InvalidAttendeeDataError(`Attendee ID '${attendeeId}' is not in valid 'att_<unique-id>' format.`, { attendeeId });
  }
}

/**
 * Validates event creation input data.
 *
 * @param {object} data - Event creation data.
 * @returns {object} Validated and normalized event data.
 * @throws {InvalidEventDataError}
 */
function validateEventData(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new InvalidEventDataError('Event data must be an object.');
  }

  // Name: required, non-empty string
  if (typeof data.name !== 'string' || !data.name.trim()) {
    throw new InvalidEventDataError('Event name is required and must be a non-empty string.', { field: 'name' });
  }

  // Date: required, YYYY-MM-DD
  if (!data.date || !isValidDate(data.date)) {
    throw new InvalidEventDataError("Event date is required and must be a valid calendar date in 'YYYY-MM-DD' format.", { field: 'date', value: data.date });
  }

  // Description: optional string
  let description = null;
  if (data.description !== undefined && data.description !== null) {
    if (typeof data.description !== 'string') {
      throw new InvalidEventDataError('Event description must be a string when provided.', { field: 'description' });
    }
    description = data.description.trim();
  }

  // Location: optional string
  let location = null;
  if (data.location !== undefined && data.location !== null) {
    if (typeof data.location !== 'string') {
      throw new InvalidEventDataError('Event location must be a string when provided.', { field: 'location' });
    }
    location = data.location.trim();
  }

  // Capacity: optional positive integer
  let capacity = null;
  if (data.capacity !== undefined && data.capacity !== null) {
    if (typeof data.capacity !== 'number' || !Number.isInteger(data.capacity) || data.capacity <= 0) {
      throw new InvalidEventDataError('Event capacity must be a positive integer greater than 0 when provided.', { field: 'capacity', value: data.capacity });
    }
    capacity = data.capacity;
  }

  return {
    name: data.name.trim(),
    description,
    date: data.date,
    location,
    capacity
  };
}

/**
 * Validates event update input data.
 *
 * @param {object} updates - Updates to apply to event.
 * @param {number} [currentAttendeeCount=0] - Current attendee count for capacity check.
 * @returns {object} Validated updates.
 * @throws {InvalidEventDataError}
 */
function validateEventUpdates(updates, currentAttendeeCount = 0) {
  if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
    throw new InvalidEventDataError('Event updates must be an object.');
  }

  if (Object.keys(updates).length === 0) {
    throw new InvalidEventDataError('No update fields provided.');
  }

  if ('id' in updates) {
    throw new InvalidEventDataError('Modifying event ID is not permitted.', { field: 'id' });
  }

  if ('createdAt' in updates) {
    throw new InvalidEventDataError('Modifying event creation timestamp (createdAt) is not permitted.', { field: 'createdAt' });
  }

  const validated = {};

  if ('name' in updates) {
    if (typeof updates.name !== 'string' || !updates.name.trim()) {
      throw new InvalidEventDataError('Event name must be a non-empty string.', { field: 'name' });
    }
    validated.name = updates.name.trim();
  }

  if ('date' in updates) {
    if (!isValidDate(updates.date)) {
      throw new InvalidEventDataError("Event date must be a valid calendar date in 'YYYY-MM-DD' format.", { field: 'date', value: updates.date });
    }
    validated.date = updates.date;
  }

  if ('description' in updates) {
    if (updates.description === null) {
      validated.description = null;
    } else if (typeof updates.description === 'string') {
      validated.description = updates.description.trim();
    } else {
      throw new InvalidEventDataError('Event description must be a string or null.', { field: 'description' });
    }
  }

  if ('location' in updates) {
    if (updates.location === null) {
      validated.location = null;
    } else if (typeof updates.location === 'string') {
      validated.location = updates.location.trim();
    } else {
      throw new InvalidEventDataError('Event location must be a string or null.', { field: 'location' });
    }
  }

  if ('capacity' in updates) {
    if (updates.capacity === null) {
      validated.capacity = null;
    } else if (typeof updates.capacity === 'number' && Number.isInteger(updates.capacity) && updates.capacity > 0) {
      if (updates.capacity < currentAttendeeCount) {
        throw new InvalidEventDataError(
          `Cannot reduce event capacity to ${updates.capacity} because ${currentAttendeeCount} attendees are already registered.`,
          { field: 'capacity', newCapacity: updates.capacity, currentAttendeeCount }
        );
      }
      validated.capacity = updates.capacity;
    } else {
      throw new InvalidEventDataError('Event capacity must be a positive integer greater than 0, or null for unlimited.', { field: 'capacity', value: updates.capacity });
    }
  }

  return validated;
}

/**
 * Validates attendee registration input data.
 *
 * @param {object} data - Attendee registration data.
 * @returns {object} Validated and normalized attendee data.
 * @throws {InvalidAttendeeDataError|InvalidEmailError}
 */
function validateAttendeeData(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new InvalidAttendeeDataError('Attendee data must be an object.');
  }

  // Name: required string
  if (typeof data.name !== 'string' || !data.name.trim()) {
    throw new InvalidAttendeeDataError('Attendee name is required and must be a non-empty string.', { field: 'name' });
  }

  // Email: required, valid format
  if (typeof data.email !== 'string' || !isValidEmail(data.email)) {
    throw new InvalidEmailError(data.email);
  }

  // Phone: optional string
  let phone = null;
  if (data.phone !== undefined && data.phone !== null && data.phone !== '') {
    if (typeof data.phone !== 'string' || !isValidPhone(data.phone)) {
      throw new InvalidAttendeeDataError(
        `Invalid phone number format: '${data.phone}'. Phone must contain between 7 and 17 digits.`,
        { field: 'phone', value: data.phone }
      );
    }
    phone = data.phone.trim();
  }

  return {
    name: data.name.trim(),
    email: normalizeEmail(data.email),
    phone
  };
}

module.exports = {
  isValidDate,
  normalizeEmail,
  isValidEmail,
  isValidPhone,
  validateEventId,
  validateAttendeeId,
  validateEventData,
  validateEventUpdates,
  validateAttendeeData
};
