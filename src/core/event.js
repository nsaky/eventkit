'use strict';

const { generateEventId } = require('../utils/id-generator');
const {
  validateEventId,
  validateEventData,
  validateEventUpdates
} = require('../utils/validators');
const {
  EventNotFoundError,
  InvalidEventIdError
} = require('../utils/errors');

/**
 * Event management service handling event creation, retrieval, updates, and deletion.
 */
class EventManager {
  /**
   * @param {import('../storage/storage')} storage - Storage instance.
   */
  constructor(storage) {
    if (!storage) {
      throw new Error('Storage instance is required for EventManager.');
    }
    this._storage = storage;
  }

  /**
   * Creates a new event record.
   *
   * @param {object} data - Event parameters (name, date, description, location, capacity).
   * @returns {Promise<object>} The created event record.
   */
  async createEvent(data) {
    const validated = validateEventData(data);

    return this._storage.runExclusive(async () => {
      const existingEvents = this._storage.getEvents();
      const id = generateEventId(existingEvents);
      const timestamp = new Date().toISOString();

      const newEvent = {
        id,
        name: validated.name,
        description: validated.description,
        date: validated.date,
        location: validated.location,
        capacity: validated.capacity,
        createdAt: timestamp,
        updatedAt: timestamp
      };

      existingEvents.push(newEvent);
      await this._storage.saveEvents(existingEvents);

      return this._storage.getEventById(id);
    });
  }

  /**
   * Retrieves an event by its unique ID.
   *
   * @param {string} eventId - Unique event identifier.
   * @returns {Promise<object|null>} Safe copy of event or null if not found.
   */
  async getEvent(eventId) {
    validateEventId(eventId);
    const event = this._storage.getEventById(eventId);
    return event || null;
  }

  /**
   * Retrieves all event records.
   *
   * @returns {Promise<Array<object>>} Safe list of all events.
   */
  async getAllEvents() {
    return this._storage.getEvents();
  }

  /**
   * Updates permitted fields of an existing event.
   *
   * @param {string} eventId - ID of event to update.
   * @param {object} updates - Permitted updates (name, date, description, location, capacity).
   * @returns {Promise<object>} The updated event record.
   */
  async updateEvent(eventId, updates) {
    validateEventId(eventId);

    return this._storage.runExclusive(async () => {
      const events = this._storage.getEvents();
      const index = events.findIndex(e => e.id === eventId);
      if (index === -1) {
        throw new EventNotFoundError(eventId);
      }

      // Check current registration count for capacity validation
      const attendees = this._storage.getAttendeesByEventId(eventId);
      const currentRegistrationCount = attendees.length;

      const validatedUpdates = validateEventUpdates(updates, currentRegistrationCount);

      const existingEvent = events[index];
      const updatedEvent = {
        ...existingEvent,
        ...validatedUpdates,
        id: existingEvent.id, // prevent modification
        createdAt: existingEvent.createdAt, // prevent modification
        updatedAt: new Date().toISOString()
      };

      events[index] = updatedEvent;
      await this._storage.saveEvents(events);

      return this._storage.getEventById(eventId);
    });
  }

  /**
   * Deletes an event and cascade-deletes all associated attendees and tickets.
   *
   * @param {string} eventId - ID of event to delete.
   * @returns {Promise<object>} The deleted event record.
   */
  async deleteEvent(eventId) {
    validateEventId(eventId);

    return this._storage.runExclusive(async () => {
      const events = this._storage.getEvents();
      const eventIndex = events.findIndex(e => e.id === eventId);
      if (eventIndex === -1) {
        throw new EventNotFoundError(eventId);
      }

      const deletedEvent = events[eventIndex];
      const remainingEvents = events.filter(e => e.id !== eventId);

      // Cascade remove associated attendees
      const allAttendees = this._storage.getAttendees();
      const remainingAttendees = allAttendees.filter(a => a.eventId !== eventId);

      // Cascade remove associated tickets
      const allTickets = this._storage.getTickets();
      const remainingTickets = allTickets.filter(t => t.eventId !== eventId);

      await this._storage.saveBatch({
        events: remainingEvents,
        attendees: remainingAttendees,
        tickets: remainingTickets
      });

      return deletedEvent;
    });
  }
}

module.exports = EventManager;
