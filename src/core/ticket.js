'use strict';

const { generateTicketId } = require('../utils/id-generator');
const {
  validateEventId,
  validateAttendeeId,
  validateTicketId
} = require('../utils/validators');
const {
  AttendeeNotFoundError,
  TicketNotFoundError,
  TicketAlreadyExistsError,
  TicketAlreadyUsedError
} = require('../utils/errors');

/**
 * Ticket management service handling ticket generation, retrieval, validation, and cancellation.
 */
class TicketManager {
  /**
   * @param {import('../storage/storage')} storage - Storage instance.
   */
  constructor(storage) {
    if (!storage) {
      throw new Error('Storage instance is required for TicketManager.');
    }
    this._storage = storage;
  }

  /**
   * Generates a ticket for an existing attendee in standalone workflows.
   *
   * @param {string} attendeeId - The attendee ID.
   * @param {object} [options={}] - Options (e.g. { returnExisting: false }).
   * @returns {Promise<object>} The generated or existing ticket record.
   * @throws {AttendeeNotFoundError|TicketAlreadyExistsError}
   */
  async generateTicket(attendeeId, options = {}) {
    validateAttendeeId(attendeeId);

    return this._storage.runExclusive(async () => {
      const attendee = this._storage.getAttendeeById(attendeeId);
      if (!attendee) {
        throw new AttendeeNotFoundError(attendeeId);
      }

      const existingTicket = this._storage.getTicketByAttendeeId(attendeeId);
      if (existingTicket) {
        if (options.returnExisting) {
          return existingTicket;
        }
        throw new TicketAlreadyExistsError(attendeeId, existingTicket.id);
      }

      const allTickets = this._storage.getTickets();
      const ticketId = generateTicketId(allTickets);
      const timestamp = new Date().toISOString();

      const newTicket = {
        id: ticketId,
        eventId: attendee.eventId,
        attendeeId: attendee.id,
        status: 'ACTIVE',
        createdAt: timestamp,
        checkedInAt: null
      };

      allTickets.push(newTicket);
      await this._storage.saveTickets(allTickets);

      return this._storage.getTicketById(ticketId);
    });
  }

  /**
   * Retrieves a ticket by its unique ticket ID.
   *
   * @param {string} ticketId - Unique ticket identifier (e.g. 'EK-ABC1234567').
   * @returns {Promise<object|null>} Safe copy of ticket or null if not found.
   */
  async getTicket(ticketId) {
    validateTicketId(ticketId);
    const ticket = this._storage.getTicketById(ticketId);
    return ticket || null;
  }

  /**
   * Retrieves all tickets.
   *
   * @returns {Promise<Array<object>>} Safe list of all tickets.
   */
  async getAllTickets() {
    return this._storage.getTickets();
  }

  /**
   * Retrieves all tickets for a specific event.
   *
   * @param {string} eventId
   * @returns {Promise<Array<object>>} Safe list of tickets for the event.
   */
  async getTicketsByEventId(eventId) {
    validateEventId(eventId);
    return this._storage.getTicketsByEventId(eventId);
  }

  /**
   * Cancels an existing ticket.
   *
   * @param {string} ticketId - Unique ticket identifier.
   * @returns {Promise<object>} The updated ticket record.
   * @throws {TicketNotFoundError|TicketAlreadyUsedError}
   */
  async cancelTicket(ticketId) {
    validateTicketId(ticketId);

    return this._storage.runExclusive(async () => {
      const tickets = this._storage.getTickets();
      const index = tickets.findIndex(t => t.id === ticketId);
      if (index === -1) {
        throw new TicketNotFoundError(ticketId);
      }

      const ticket = tickets[index];

      // If already cancelled, return as idempotent operation
      if (ticket.status === 'CANCELLED') {
        return ticket;
      }

      // Cannot cancel a ticket that has already been used
      if (ticket.status === 'USED' || ticket.checkedInAt !== null) {
        throw new TicketAlreadyUsedError(ticketId);
      }

      const updatedTicket = {
        ...ticket,
        status: 'CANCELLED'
      };

      tickets[index] = updatedTicket;
      await this._storage.saveTickets(tickets);

      return this._storage.getTicketById(ticketId);
    });
  }

  /**
   * Validates a ticket against an event without performing a check-in.
   *
   * @param {string} eventId - Unique event identifier.
   * @param {string} ticketId - Unique ticket identifier.
   * @returns {Promise<object>} Structured validation result.
   */
  async validateTicket(eventId, ticketId) {
    validateEventId(eventId);
    validateTicketId(ticketId);

    const ticket = this._storage.getTicketById(ticketId);
    if (!ticket) {
      return {
        valid: false,
        status: 'INVALID',
        message: `Ticket '${ticketId}' does not exist.`,
        ticket: null,
        attendee: null
      };
    }

    if (ticket.eventId !== eventId) {
      return {
        valid: false,
        status: 'WRONG_EVENT',
        message: `Ticket '${ticketId}' is registered for a different event ('${ticket.eventId}').`,
        ticket,
        attendee: null
      };
    }

    if (ticket.status === 'CANCELLED') {
      return {
        valid: false,
        status: 'CANCELLED',
        message: `Ticket '${ticketId}' has been cancelled.`,
        ticket,
        attendee: null
      };
    }

    if (ticket.status === 'USED' || ticket.checkedInAt !== null) {
      return {
        valid: false,
        status: 'ALREADY_CHECKED_IN',
        message: `Ticket '${ticketId}' has already been checked in.`,
        ticket,
        attendee: null
      };
    }

    // Ticket is valid and ACTIVE; attach attendee information
    const attendee = this._storage.getAttendeeById(ticket.attendeeId);

    return {
      valid: true,
      status: 'VALID',
      message: 'Ticket is valid and ready for check-in.',
      ticket,
      attendee: attendee || null
    };
  }
}

module.exports = TicketManager;
