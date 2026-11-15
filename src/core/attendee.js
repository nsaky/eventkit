'use strict';

const {
  generateAttendeeId,
  generateTicketId
} = require('../utils/id-generator');
const {
  validateEventId,
  validateAttendeeId,
  validateAttendeeData
} = require('../utils/validators');
const {
  EventNotFoundError,
  AttendeeNotFoundError,
  DuplicateRegistrationError,
  EventCapacityReachedError
} = require('../utils/errors');

/**
 * Attendee management service handling registration, retrieval, and removal.
 */
class AttendeeManager {
  /**
   * @param {import('../storage/storage')} storage - Storage instance.
   */
  constructor(storage) {
    if (!storage) {
      throw new Error('Storage instance is required for AttendeeManager.');
    }
    this._storage = storage;
  }

  /**
   * Registers a new attendee for an event and automatically creates a digital ticket.
   *
   * @param {string} eventId - Unique event identifier.
   * @param {object} attendeeData - Attendee input data (name, email, optional phone).
   * @returns {Promise<object>} The registered attendee record with associated ticket.
   */
  async registerAttendee(eventId, attendeeData) {
    validateEventId(eventId);
    const validated = validateAttendeeData(attendeeData);

    return this._storage.runExclusive(async () => {
      // 1. Verify that event exists
      const event = this._storage.getEventById(eventId);
      if (!event) {
        throw new EventNotFoundError(eventId);
      }

      const allAttendees = this._storage.getAttendees();
      const eventAttendees = allAttendees.filter(a => a.eventId === eventId);

      // 2. Prevent duplicate registration (eventId + normalizedEmail)
      const isDuplicate = eventAttendees.some(
        a => a.email.toLowerCase() === validated.email.toLowerCase()
      );
      if (isDuplicate) {
        throw new DuplicateRegistrationError(eventId, validated.email);
      }

      // 3. Enforce capacity check
      if (event.capacity !== null && eventAttendees.length >= event.capacity) {
        throw new EventCapacityReachedError(
          eventId,
          event.capacity,
          eventAttendees.length
        );
      }

      // 4. Generate unique attendee ID and ticket ID
      const allTickets = this._storage.getTickets();
      const attendeeId = generateAttendeeId(allAttendees);
      const ticketId = generateTicketId(allTickets);
      const timestamp = new Date().toISOString();

      const newAttendee = {
        id: attendeeId,
        eventId,
        name: validated.name,
        email: validated.email,
        phone: validated.phone,
        registeredAt: timestamp,
        status: 'REGISTERED',
        checkedIn: false,
        checkedInAt: null
      };

      const newTicket = {
        id: ticketId,
        eventId,
        attendeeId,
        status: 'ACTIVE',
        createdAt: timestamp,
        checkedInAt: null
      };

      allAttendees.push(newAttendee);
      allTickets.push(newTicket);

      // 5. Persist both records consistently
      await this._storage.saveBatch({
        attendees: allAttendees,
        tickets: allTickets
      });

      const savedAttendee = this._storage.getAttendeeById(attendeeId);
      const savedTicket = this._storage.getTicketById(ticketId);

      return {
        ...savedAttendee,
        ticket: savedTicket
      };
    });
  }

  /**
   * Retrieves an attendee by attendee ID.
   *
   * @param {string} attendeeId - Unique attendee identifier.
   * @returns {Promise<object|null>} Safe copy of attendee or null if not found.
   */
  async getAttendee(attendeeId) {
    validateAttendeeId(attendeeId);
    const attendee = this._storage.getAttendeeById(attendeeId);
    if (!attendee) return null;

    const ticket = this._storage.getTicketByAttendeeId(attendeeId);
    return {
      ...attendee,
      ticket: ticket || null
    };
  }

  /**
   * Retrieves all attendees registered for a specific event.
   *
   * @param {string} eventId - Unique event identifier.
   * @returns {Promise<Array<object>>} Safe list of attendees for the event.
   * @throws {EventNotFoundError} If the event does not exist.
   */
  async getAttendees(eventId) {
    validateEventId(eventId);

    const event = this._storage.getEventById(eventId);
    if (!event) {
      throw new EventNotFoundError(eventId);
    }

    const attendees = this._storage.getAttendeesByEventId(eventId);
    return attendees.map(a => {
      const ticket = this._storage.getTicketByAttendeeId(a.id);
      return {
        ...a,
        ticket: ticket || null
      };
    });
  }

  /**
   * Removes an attendee record and cascade-removes the associated ticket record.
   *
   * @param {string} attendeeId - Unique attendee identifier.
   * @returns {Promise<object>} The removed attendee record.
   * @throws {AttendeeNotFoundError} If the attendee does not exist.
   */
  async removeAttendee(attendeeId) {
    validateAttendeeId(attendeeId);

    return this._storage.runExclusive(async () => {
      const allAttendees = this._storage.getAttendees();
      const index = allAttendees.findIndex(a => a.id === attendeeId);
      if (index === -1) {
        throw new AttendeeNotFoundError(attendeeId);
      }

      const removedAttendee = allAttendees[index];
      const remainingAttendees = allAttendees.filter(a => a.id !== attendeeId);

      // Cascade remove associated ticket
      const allTickets = this._storage.getTickets();
      const remainingTickets = allTickets.filter(t => t.attendeeId !== attendeeId);

      await this._storage.saveBatch({
        attendees: remainingAttendees,
        tickets: remainingTickets
      });

      return removedAttendee;
    });
  }
}

module.exports = AttendeeManager;
