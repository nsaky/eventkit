'use strict';

const {
  validateEventId,
  validateTicketId,
  normalizeEmail
} = require('../utils/validators');
const { EventNotFoundError } = require('../utils/errors');

/**
 * Service for searching attendees and tickets across persistent records.
 */
class SearchService {
  /**
   * @param {import('../storage/storage')} storage - Storage instance.
   */
  constructor(storage) {
    if (!storage) {
      throw new Error('Storage instance is required for SearchService.');
    }
    this._storage = storage;
  }

  /**
   * Searches attendees for a specific event by name, email, or ticket ID, with optional filters.
   *
   * @param {string} eventId - Unique event identifier.
   * @param {string} [query=''] - Search term (name, email, or ticket ID).
   * @param {object} [options={}] - Filter options (e.g. { checkedIn: true, status: 'REGISTERED' }).
   * @returns {Promise<Array<object>>} Matching attendees with ticket information.
   */
  async searchAttendees(eventId, query = '', options = {}) {
    validateEventId(eventId);

    const event = this._storage.getEventById(eventId);
    if (!event) {
      throw new EventNotFoundError(eventId);
    }

    const attendees = this._storage.getAttendeesByEventId(eventId);
    const cleanQuery = typeof query === 'string' ? query.trim().toLowerCase() : '';

    return attendees
      .map(attendee => {
        const ticket = this._storage.getTicketByAttendeeId(attendee.id);
        return {
          ...attendee,
          ticket: ticket || null
        };
      })
      .filter(record => {
        // Query match
        if (cleanQuery) {
          const nameMatch = record.name.toLowerCase().includes(cleanQuery);
          const emailMatch = record.email.toLowerCase().includes(cleanQuery);
          const ticketMatch = record.ticket && record.ticket.id.toLowerCase().includes(cleanQuery);

          if (!nameMatch && !emailMatch && !ticketMatch) {
            return false;
          }
        }

        // Filter by checkedIn status if specified
        if (typeof options.checkedIn === 'boolean') {
          if (record.checkedIn !== options.checkedIn) {
            return false;
          }
        }

        // Filter by attendee status if specified
        if (typeof options.status === 'string' && options.status.trim()) {
          if (record.status.toLowerCase() !== options.status.trim().toLowerCase()) {
            return false;
          }
        }

        return true;
      });
  }

  /**
   * Searches for a ticket by its ID and includes associated attendee and event metadata.
   *
   * @param {string} ticketId - Unique ticket identifier.
   * @returns {Promise<object|null>} Ticket details with attendee and event, or null if not found.
   */
  async searchTicket(ticketId) {
    validateTicketId(ticketId);

    const ticket = this._storage.getTicketById(ticketId);
    if (!ticket) {
      return null;
    }

    const attendee = this._storage.getAttendeeById(ticket.attendeeId);
    const event = this._storage.getEventById(ticket.eventId);

    return {
      ticket,
      attendee: attendee || null,
      event: event || null
    };
  }
}

module.exports = SearchService;
