'use strict';

/**
 * Base storage interface defining the contract for EventKit persistence layers.
 */
class Storage {
  /**
   * Initializes the storage layer.
   * @param {object} [options] - Configuration options.
   * @returns {Promise<void>}
   */
  async initialize(options = {}) {
    throw new Error('Method initialize() must be implemented.');
  }

  /**
   * Loads all records from storage into memory.
   * @returns {Promise<{events: Array<object>, attendees: Array<object>, tickets: Array<object>}>}
   */
  async load() {
    throw new Error('Method load() must be implemented.');
  }

  /**
   * Closes or resets the storage layer.
   * @returns {Promise<void>}
   */
  async close() {
    throw new Error('Method close() must be implemented.');
  }

  /**
   * Executes a callback within a serialized write lock.
   * @param {Function} callback
   * @returns {Promise<any>}
   */
  async runExclusive(callback) {
    throw new Error('Method runExclusive() must be implemented.');
  }
}

module.exports = Storage;
