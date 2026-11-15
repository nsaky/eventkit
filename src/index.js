'use strict';

const JsonStorage = require('./storage/json-storage');
const EventManager = require('./core/event');
const AttendeeManager = require('./core/attendee');
const TicketManager = require('./core/ticket');
const CheckInManager = require('./core/checkin');
const QRService = require('./services/qr');
const AttendanceStatsService = require('./services/stats');
const SearchService = require('./services/search');
const ExportService = require('./services/export');
const errors = require('./utils/errors');
const { NotInitializedError } = errors;

/**
 * EventKit main class providing a unified asynchronous API for event registration,
 * ticketing, QR code generation, ticket validation, check-in management, attendance
 * tracking, search, and data export with persistent JSON file storage.
 */
class EventKit {
  constructor(options = {}) {
    this._storage = null;
    this._eventManager = null;
    this._attendeeManager = null;
    this._ticketManager = null;
    this._checkInManager = null;
    this._qrService = null;
    this._statsService = null;
    this._searchService = null;
    this._exportService = null;
    this._isInitialized = false;

    if (options.storagePath) {
      this._defaultStoragePath = options.storagePath;
    }
  }

  /**
   * Initializes the persistent JSON storage engine and all domain services.
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
    this._ticketManager = new TicketManager(this._storage);
    this._checkInManager = new CheckInManager(this._storage);
    this._qrService = new QRService(this._storage);
    this._statsService = new AttendanceStatsService(this._storage);
    this._searchService = new SearchService(this._storage);
    this._exportService = new ExportService(this._storage);
    this._isInitialized = true;
  }

  /**
   * Asserts that EventKit has been initialized.
   * @private
   */
  _assertInitialized() {
    if (!this._isInitialized || !this._storage) {
      throw new NotInitializedError();
    }
  }

  // --- Event Management Methods ---

  async createEvent(data) {
    this._assertInitialized();
    return this._eventManager.createEvent(data);
  }

  async getEvent(eventId) {
    this._assertInitialized();
    return this._eventManager.getEvent(eventId);
  }

  async getAllEvents() {
    this._assertInitialized();
    return this._eventManager.getAllEvents();
  }

  async updateEvent(eventId, updates) {
    this._assertInitialized();
    return this._eventManager.updateEvent(eventId, updates);
  }

  async deleteEvent(eventId) {
    this._assertInitialized();
    return this._eventManager.deleteEvent(eventId);
  }

  // --- Attendee Management Methods ---

  async registerAttendee(eventId, attendeeData) {
    this._assertInitialized();
    return this._attendeeManager.registerAttendee(eventId, attendeeData);
  }

  async getAttendee(attendeeId) {
    this._assertInitialized();
    return this._attendeeManager.getAttendee(attendeeId);
  }

  async getAttendees(eventId) {
    this._assertInitialized();
    return this._attendeeManager.getAttendees(eventId);
  }

  async removeAttendee(attendeeId) {
    this._assertInitialized();
    return this._attendeeManager.removeAttendee(attendeeId);
  }

  // --- Ticket Management Methods ---

  async generateTicket(attendeeId, options) {
    this._assertInitialized();
    return this._ticketManager.generateTicket(attendeeId, options);
  }

  async getTicket(ticketId) {
    this._assertInitialized();
    return this._ticketManager.getTicket(ticketId);
  }

  async getAllTickets() {
    this._assertInitialized();
    return this._ticketManager.getAllTickets();
  }

  async getTickets(eventId) {
    this._assertInitialized();
    return this._ticketManager.getTicketsByEventId(eventId);
  }

  async validateTicket(eventId, ticketId) {
    this._assertInitialized();
    return this._ticketManager.validateTicket(eventId, ticketId);
  }

  async cancelTicket(ticketId) {
    this._assertInitialized();
    return this._ticketManager.cancelTicket(ticketId);
  }

  async generateQRCode(ticketId, options) {
    this._assertInitialized();
    return this._qrService.generateQRCode(ticketId, options);
  }

  // --- Check-in Management Methods ---

  async checkIn(eventId, ticketId) {
    this._assertInitialized();
    return this._checkInManager.checkIn(eventId, ticketId);
  }

  async getCheckInStatus(ticketId) {
    this._assertInitialized();
    return this._checkInManager.getCheckInStatus(ticketId);
  }

  async getCheckedInAttendees(eventId) {
    this._assertInitialized();
    return this._checkInManager.getCheckedInAttendees(eventId);
  }

  // --- Attendance Statistics Methods ---

  async getAttendanceStats(eventId) {
    this._assertInitialized();
    return this._statsService.getAttendanceStats(eventId);
  }

  // --- Search Methods ---

  async searchAttendees(eventId, query, options) {
    this._assertInitialized();
    return this._searchService.searchAttendees(eventId, query, options);
  }

  async searchTicket(ticketId) {
    this._assertInitialized();
    return this._searchService.searchTicket(ticketId);
  }

  // --- Export Methods ---

  async exportAttendees(eventId, format, options) {
    this._assertInitialized();
    return this._exportService.exportAttendees(eventId, format, options);
  }

  async exportEvent(eventId, format, options) {
    this._assertInitialized();
    return this._exportService.exportEvent(eventId, format, options);
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
    this._ticketManager = null;
    this._checkInManager = null;
    this._qrService = null;
    this._statsService = null;
    this._searchService = null;
    this._exportService = null;
    this._isInitialized = false;
  }
}

// Default singleton instance
const defaultInstance = new EventKit();

// Bind methods so they can be destructured or called directly
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
  generateTicket: defaultInstance.generateTicket.bind(defaultInstance),
  getTicket: defaultInstance.getTicket.bind(defaultInstance),
  getAllTickets: defaultInstance.getAllTickets.bind(defaultInstance),
  getTickets: defaultInstance.getTickets.bind(defaultInstance),
  validateTicket: defaultInstance.validateTicket.bind(defaultInstance),
  cancelTicket: defaultInstance.cancelTicket.bind(defaultInstance),
  generateQRCode: defaultInstance.generateQRCode.bind(defaultInstance),
  checkIn: defaultInstance.checkIn.bind(defaultInstance),
  getCheckInStatus: defaultInstance.getCheckInStatus.bind(defaultInstance),
  getCheckedInAttendees: defaultInstance.getCheckedInAttendees.bind(defaultInstance),
  getAttendanceStats: defaultInstance.getAttendanceStats.bind(defaultInstance),
  searchAttendees: defaultInstance.searchAttendees.bind(defaultInstance),
  searchTicket: defaultInstance.searchTicket.bind(defaultInstance),
  exportAttendees: defaultInstance.exportAttendees.bind(defaultInstance),
  exportEvent: defaultInstance.exportEvent.bind(defaultInstance),
  reset: defaultInstance.reset.bind(defaultInstance),

  // Allow class instantiation
  EventKit,
  createInstance: (options) => new EventKit(options),

  // Export errors
  errors,
  ...errors
};

module.exports = api;
