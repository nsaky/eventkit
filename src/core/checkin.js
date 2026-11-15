'use strict';

const {
  validateEventId,
  validateTicketId
} = require('../utils/validators');
const {
  EventNotFoundError,
  AttendeeNotFoundError,
  TicketNotFoundError,
  TicketCancelledError,
  WrongEventError,
  AlreadyCheckedInError
} = require('../utils/errors');

/**
 * Check-in management service handling attendee arrival, status verification, and duplicate check-in prevention.
 */
class CheckInManager {
  /**
   * @param {import('../storage/storage')} storage - Storage instance.
   */
  constructor(storage) {
    if (!storage) {
      throw new Error('Storage instance is required for CheckInManager.');
    }
    this._storage = storage;
  }

  /**
   * Checks in an attendee using their ticket ID for a specified event.
   *
   * @param {string} eventId - Unique event identifier.
   * @param {string} ticketId - Unique ticket identifier.
   * @returns {Promise<object>} Structured check-in response.
   */
  async checkIn(eventId, ticketId) {
    validateEventId(eventId);
    validateTicketId(ticketId);

    return this._storage.runExclusive(async () => {
      // 1. Verify event exists
      const event = this._storage.getEventById(eventId);
      if (!event) {
        throw new EventNotFoundError(eventId);
      }

      // 2. Retrieve ticket
      const allTickets = this._storage.getTickets();
      const ticketIndex = allTickets.findIndex(t => t.id === ticketId);
      if (ticketIndex === -1) {
        throw new TicketNotFoundError(ticketId);
      }
      const ticket = allTickets[ticketIndex];

      // 3. Verify event association
      if (ticket.eventId !== eventId) {
        throw new WrongEventError(ticketId, ticket.eventId, eventId);
      }

      // 4. Verify ticket status
      if (ticket.status === 'CANCELLED') {
        throw new TicketCancelledError(ticketId);
      }

      if (ticket.status === 'USED' || ticket.checkedInAt !== null) {
        throw new AlreadyCheckedInError(ticketId, ticket.checkedInAt);
      }

      // 5. Retrieve associated attendee
      const allAttendees = this._storage.getAttendees();
      const attendeeIndex = allAttendees.findIndex(a => a.id === ticket.attendeeId);
      if (attendeeIndex === -1) {
        throw new AttendeeNotFoundError(ticket.attendeeId);
      }
      const attendee = allAttendees[attendeeIndex];

      if (attendee.checkedIn) {
        throw new AlreadyCheckedInError(ticketId, attendee.checkedInAt);
      }

      // 6. Generate check-in timestamp and update records atomically
      const timestamp = new Date().toISOString();

      allAttendees[attendeeIndex] = {
        ...attendee,
        checkedIn: true,
        checkedInAt: timestamp
      };

      allTickets[ticketIndex] = {
        ...ticket,
        status: 'USED',
        checkedInAt: timestamp
      };

      // 7. Persist both records consistently
      await this._storage.saveBatch({
        attendees: allAttendees,
        tickets: allTickets
      });

      return {
        success: true,
        status: 'CHECKED_IN',
        ticketId: ticket.id,
        eventId,
        attendeeId: attendee.id,
        attendeeName: attendee.name,
        checkedInAt: timestamp,
        message: `Attendee ${attendee.name} successfully checked in.`
      };
    });
  }

  /**
   * Retrieves the current check-in status of a ticket.
   *
   * @param {string} ticketId - Unique ticket identifier.
   * @returns {Promise<object>} Status object.
   */
  async getCheckInStatus(ticketId) {
    validateTicketId(ticketId);

    const ticket = this._storage.getTicketById(ticketId);
    if (!ticket) {
      throw new TicketNotFoundError(ticketId);
    }

    const attendee = this._storage.getAttendeeById(ticket.attendeeId);

    return {
      ticketId: ticket.id,
      eventId: ticket.eventId,
      attendeeId: ticket.attendeeId,
      status: ticket.status,
      checkedIn: ticket.status === 'USED' || (attendee ? attendee.checkedIn : false),
      checkedInAt: ticket.checkedInAt || (attendee ? attendee.checkedInAt : null)
    };
  }

  /**
   * Retrieves all checked-in attendees for a given event.
   *
   * @param {string} eventId - Unique event identifier.
   * @returns {Promise<Array<object>>} Safe list of checked-in attendees with ticket info.
   */
  async getCheckedInAttendees(eventId) {
    validateEventId(eventId);

    const event = this._storage.getEventById(eventId);
    if (!event) {
      throw new EventNotFoundError(eventId);
    }

    const attendees = this._storage.getAttendeesByEventId(eventId);
    const checkedInList = attendees.filter(a => a.checkedIn === true);

    return checkedInList.map(a => {
      const ticket = this._storage.getTicketByAttendeeId(a.id);
      return {
        ...a,
        ticket: ticket || null
      };
    });
  }
}

module.exports = CheckInManager;
