'use strict';

const crypto = require('crypto');

/**
 * Generates a cryptographically secure random identifier with a given prefix.
 *
 * @param {string} prefix - The prefix for the identifier (e.g., 'evt', 'att').
 * @param {number} [bytes=12] - Number of random bytes (default 12 -> 24 hex chars).
 * @returns {string} The formatted unique identifier (e.g. 'evt_abc123...').
 */
function generateId(prefix, bytes = 12) {
  const randomHex = crypto.randomBytes(bytes).toString('hex');
  return `${prefix}_${randomHex}`;
}

/**
 * Generates an event ID ('evt_<24-hex-chars>').
 * Guarantees uniqueness against a set or collection of existing IDs.
 *
 * @param {Set<string>|Array<{id: string}>} [existingRecords] - Optional set or list of existing records to check for collisions.
 * @returns {string} Unique event ID.
 */
function generateEventId(existingRecords) {
  let id;
  const existingSet = existingRecords instanceof Set
    ? existingRecords
    : Array.isArray(existingRecords)
      ? new Set(existingRecords.map(r => r.id))
      : null;

  do {
    id = generateId('evt');
  } while (existingSet && existingSet.has(id));

  return id;
}

/**
 * Generates an attendee ID ('att_<24-hex-chars>').
 * Guarantees uniqueness against a set or collection of existing IDs.
 *
 * @param {Set<string>|Array<{id: string}>} [existingRecords] - Optional set or list of existing records to check for collisions.
 * @returns {string} Unique attendee ID.
 */
function generateAttendeeId(existingRecords) {
  let id;
  const existingSet = existingRecords instanceof Set
    ? existingRecords
    : Array.isArray(existingRecords)
      ? new Set(existingRecords.map(r => r.id))
      : null;

  do {
    id = generateId('att');
  } while (existingSet && existingSet.has(id));

  return id;
}

module.exports = {
  generateId,
  generateEventId,
  generateAttendeeId
};
