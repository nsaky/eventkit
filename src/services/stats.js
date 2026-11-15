'use strict';

const { validateEventId } = require('../utils/validators');
const { EventNotFoundError } = require('../utils/errors');

/**
 * Service for calculating real-time attendance statistics from persistent records.
 */
class AttendanceStatsService {
  /**
   * @param {import('../storage/storage')} storage - Storage instance.
   */
  constructor(storage) {
    if (!storage) {
      throw new Error('Storage instance is required for AttendanceStatsService.');
    }
    this._storage = storage;
  }

  /**
   * Calculates attendance statistics for an event based on stored records.
   *
   * @param {string} eventId - Unique event identifier.
   * @returns {Promise<object>} Structured statistics object.
   */
  async getAttendanceStats(eventId) {
    validateEventId(eventId);

    const event = this._storage.getEventById(eventId);
    if (!event) {
      throw new EventNotFoundError(eventId);
    }

    const attendees = this._storage.getAttendeesByEventId(eventId);
    const totalRegistrations = attendees.length;

    // Count checked-in attendees
    const totalCheckedIn = attendees.filter(a => a.checkedIn === true).length;
    const totalPending = totalRegistrations - totalCheckedIn;

    // Attendance percentage: (checkedIn / totalRegistrations) * 100
    const attendancePercentage = totalRegistrations > 0
      ? Number(((totalCheckedIn / totalRegistrations) * 100).toFixed(2))
      : 0;

    // Registration percentage: (totalRegistrations / capacity) * 100
    const registrationPercentage = event.capacity !== null && event.capacity > 0
      ? Number(((totalRegistrations / event.capacity) * 100).toFixed(2))
      : null;

    return {
      eventId: event.id,
      eventName: event.name,
      totalRegistrations,
      totalCheckedIn,
      totalPending,
      attendancePercentage,
      capacity: event.capacity,
      registrationPercentage
    };
  }
}

module.exports = AttendanceStatsService;
