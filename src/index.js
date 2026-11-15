'use strict';

const JsonStorage = require('./storage/json-storage');
const EventManager = require('./core/event');
const AttendeeManager = require('./core/attendee');
const errors = require('./utils/errors');
const { NotInitializedError } = errors;

/**
 * EventKit main class providing a unified asynchronous API for event
 * and attendee management with persistent JSON file storage.
 */
class EventKit {
  constructor(options = {}) {
    this._storage = null;
    this._eventManager = null;
    this._attendeeManager = null;
    this._isInitialized = false;

    if (options.storagePath) {
      this._defaultStoragePath = options.storagePath;
    }
  }

  /**
   * Initializes the persistent JSON storage engine.
   *
   * @param {object} [options={}] - Configuration options.
   * @param {string} [options.storagePath='./eventkit-data'] - Path to storage directory.
   * @returns {Promise<void>}
   */
  async initialize(options = {}) {
    const storagePath = options.storagePath || this._defaultStoragePath;

    if (!this._storage) {
      this._storage = new JsonStorage({ storagePath });
    }

    await this._storage.initialize({ storagePath });
    this._eventManager = new EventManager(this._storage);
    this._attendeeManager = new AttendeeManager(this._storage);
    this._isInitialized = true;
  }

  /**
   * Asserts that EventKit has been initialized.
   * @private
   */
  _assertInitialized() {
    if (!this._isInitialized || !this._storage || !this._eventManager || !this._attendeeManager) {
      throw new NotInitializedError();
    }
  }

  // --- Event Management Methods ---

  /**
   * Creates a new event record.
   *
   * @param {object} data - Event parameters (name, date, description, location, capacity).
   * @returns {Promise<object>} The created event record.
   */
  async createEvent(data) {
    this._assertInitialized();
    return this._eventManager.createEvent(data);
  }

  /**
   * Retrieves an event by its unique ID.
   *
   * @param {string} eventId - Unique event identifier.
   * @returns {Promise<object|null>} Safe copy of event or null if not found.
   */
  async getEvent(eventId) {
    this._assertInitialized();
    return this._eventManager.getEvent(eventId);
  }

  /**
   * Retrieves all event records.
   *
   * @returns {Promise<Array<object>>} Safe list of all events.
   */
  async getAllEvents() {
    this._assertInitialized();
    return this._eventManager.getAllEvents();
  }

  /**
   * Updates permitted fields of an existing event.
   *
   * @param {string} eventId - ID of event to update.
   * @param {object} updates - Permitted updates (name, date, description, location, capacity).
   * @returns {Promise<object>} The updated event record.
   */
  async updateEvent(eventId, updates) {
    this._assertInitialized();
    return this._eventManager.updateEvent(eventId, updates);
  }

  /**
   * Deletes an event and cascade-deletes all associated attendees.
   *
   * @param {string} eventId - ID of event to delete.
   * @returns {Promise<object>} The deleted event record.
   */
  async deleteEvent(eventId) {
    this._assertInitialized();
    return this._eventManager.deleteEvent(eventId);
  }

  // --- Attendee Management Methods ---

  /**
   * Registers a new attendee for an event.
   *
   * @param {string} eventId - Unique event identifier.
   * @param {object} attendeeData - Attendee input data (name, email, optional phone).
   * @returns {Promise<object>} The registered attendee record.
   */
  async registerAttendee(eventId, attendeeData) {
    this._assertInitialized();
    return this._attendeeManager.registerAttendee(eventId, attendeeData);
  }

  /**
   * Retrieves an attendee by attendee ID.
   *
   * @param {string} attendeeId - Unique attendee identifier.
   * @returns {Promise<object|null>} Safe copy of attendee or null if not found.
   */
  async getAttendee(attendeeId) {
    this._assertInitialized();
    return this._attendeeManager.getAttendee(attendeeId);
  }

  /**
   * Retrieves all attendees registered for a specific event.
   *
   * @param {string} eventId - Unique event identifier.
   * @returns {Promise<Array<object>>} Safe list of attendees for the event.
   */
  async getAttendees(eventId) {
    this._assertInitialized();
    return this._attendeeManager.getAttendees(eventId);
  }

  /**
   * Removes an attendee record by attendee ID.
   *
   * @param {string} attendeeId - Unique attendee identifier.
   * @returns {Promise<object>} The removed attendee record.
   */
  async removeAttendee(attendeeId) {
    this._assertInitialized();
    return this._attendeeManager.removeAttendee(attendeeId);
  }

  /**
   * Resets internal state (useful for test isolation).
   * @returns {Promise<void>}
   */
  async reset() {
    if (this._storage) {
      await this._storage.reset();
    }
    this._storage = null;
    this._eventManager = null;
    this._attendeeManager = null;
    this._isInitialized = false;
  }
}

// Default singleton instance
const defaultInstance = new EventKit();

// Bind methods so they can be destructured if needed
const api = {
  initialize: defaultInstance.initialize.bind(defaultInstance),
  createEvent: defaultInstance.createEvent.bind(defaultInstance),
  getEvent: defaultInstance.getEvent.bind(defaultInstance),
  getAllEvents: defaultInstance.getAllEvents.bind(defaultInstance),
  updateEvent: defaultInstance.updateEvent.bind(defaultInstance),
  deleteEvent: defaultInstance.deleteEvent.bind(defaultInstance),
  registerAttendee: defaultInstance.registerAttendee.bind(defaultInstance),
  getAttendee: defaultInstance.getAttendee.bind(defaultInstance),
  getAttendees: defaultInstance.getAttendees.bind(defaultInstance),
  removeAttendee: defaultInstance.removeAttendee.bind(defaultInstance),
  reset: defaultInstance.reset.bind(defaultInstance),

  // Allow class instantiation
  EventKit,
  createInstance: (options) => new EventKit(options),

  // Export errors
  errors,
  ...errors
};

module.exports = api;
