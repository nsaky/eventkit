'use strict';

const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const Storage = require('./storage');
const {
  StorageError,
  StorageCorruptedError,
  NotInitializedError
} = require('../utils/errors');

/**
 * Deep clone utility.
 * Uses structuredClone if available, with JSON fallback.
 */
function deepClone(obj) {
  if (obj === undefined || obj === null) return obj;
  if (typeof structuredClone === 'function') {
    return structuredClone(obj);
  }
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Async mutex lock for serialized write operations.
 */
class AsyncLock {
  constructor() {
    this._locked = false;
    this._waiting = [];
  }

  acquire() {
    if (!this._locked) {
      this._locked = true;
      return Promise.resolve(() => this.release());
    }
    return new Promise(resolve => {
      this._waiting.push(() => {
        this._locked = true;
        resolve(() => this.release());
      });
    });
  }

  release() {
    if (this._waiting.length > 0) {
      const next = this._waiting.shift();
      next();
    } else {
      this._locked = false;
    }
  }

  async runExclusive(callback) {
    const release = await this.acquire();
    try {
      return await callback();
    } finally {
      release();
    }
  }
}

/**
 * Persistent JSON file-based storage engine for EventKit.
 */
class JsonStorage extends Storage {
  constructor(options = {}) {
    super();
    this._storagePath = null;
    this._resolvedPath = null;
    this._eventsFilePath = null;
    this._attendeesFilePath = null;
    this._initialized = false;
    this._lock = new AsyncLock();

    // In-memory record collections
    this._events = [];
    this._attendees = [];

    if (options.storagePath) {
      this._configurePath(options.storagePath);
    }
  }

  /**
   * Resolves and sets internal paths based on provided or default directory.
   * @private
   */
  _configurePath(customPath) {
    const rawPath = customPath || './eventkit-data';
    this._storagePath = rawPath;
    this._resolvedPath = path.isAbsolute(rawPath)
      ? path.normalize(rawPath)
      : path.resolve(process.cwd(), rawPath);

    this._eventsFilePath = path.join(this._resolvedPath, 'events.json');
    this._attendeesFilePath = path.join(this._resolvedPath, 'attendees.json');
  }

  /**
   * Gets the resolved storage directory path.
   * @returns {string|null}
   */
  get storagePath() {
    return this._resolvedPath;
  }

  /**
   * Checks whether storage is initialized.
   * @returns {boolean}
   */
  get isInitialized() {
    return this._initialized;
  }

  /**
   * Initializes storage: ensures directory and files exist, loads data into memory.
   *
   * @param {object} [options={}] - Configuration options.
   * @param {string} [options.storagePath] - Custom directory path.
   * @returns {Promise<void>}
   */
  async initialize(options = {}) {
    return this._lock.runExclusive(async () => {
      const targetPath = options.storagePath || this._storagePath || './eventkit-data';
      const resolvedTarget = path.isAbsolute(targetPath)
        ? path.normalize(targetPath)
        : path.resolve(process.cwd(), targetPath);

      // If re-initializing with a different path, reset in-memory cache
      if (this._initialized && this._resolvedPath !== resolvedTarget) {
        this._events = [];
        this._attendees = [];
        this._initialized = false;
      }

      this._configurePath(targetPath);

      try {
        // Ensure directory exists
        await fs.mkdir(this._resolvedPath, { recursive: true });

        // Load or initialize files
        this._events = await this._loadOrInitFile(this._eventsFilePath);
        this._attendees = await this._loadOrInitFile(this._attendeesFilePath);
        this._initialized = true;
      } catch (err) {
        if (err instanceof StorageCorruptedError || err instanceof StorageError) {
          throw err;
        }
        throw new StorageError(
          `Failed to initialize storage at '${this._resolvedPath}': ${err.message}`,
          err,
          { storagePath: this._resolvedPath }
        );
      }
    });
  }

  /**
   * Loads a JSON file or initializes it with [] if missing.
   * If file contains invalid JSON or non-array, throws StorageCorruptedError.
   * @private
   */
  async _loadOrInitFile(filePath) {
    let rawContent;
    try {
      rawContent = await fs.readFile(filePath, 'utf-8');
    } catch (err) {
      if (err.code === 'ENOENT') {
        // Initialize file with empty array
        const initialContent = '[]\n';
        await this._atomicWrite(filePath, initialContent);
        return [];
      }
      throw new StorageError(
        `Failed to read storage file at '${filePath}': ${err.message}`,
        err,
        { filePath }
      );
    }

    // File exists, parse JSON
    try {
      const parsed = JSON.parse(rawContent);
      if (!Array.isArray(parsed)) {
        throw new Error('Root JSON structure must be an Array.');
      }
      return parsed;
    } catch (err) {
      throw new StorageCorruptedError(filePath, err);
    }
  }

  /**
   * Writes content to a file atomically via a temporary file in the same directory.
   * @private
   */
  async _atomicWrite(targetPath, content) {
    const dir = path.dirname(targetPath);
    const tempFileName = `.${path.basename(targetPath)}.${Date.now()}.${crypto.randomBytes(6).toString('hex')}.tmp`;
    const tempFilePath = path.join(dir, tempFileName);

    try {
      await fs.writeFile(tempFilePath, content, { encoding: 'utf-8', mode: 0o644 });
      await fs.rename(tempFilePath, targetPath);
    } catch (err) {
      // Clean up temp file if it still exists
      try {
        await fs.unlink(tempFilePath);
      } catch (cleanupErr) {
        // ignore unlink error if file wasn't created
      }
      throw new StorageError(
        `Failed to write storage file at '${targetPath}': ${err.message}`,
        err,
        { targetPath, tempFilePath }
      );
    }
  }

  /**
   * Asserts that storage is initialized.
   * @private
   */
  _assertInitialized() {
    if (!this._initialized) {
      throw new NotInitializedError();
    }
  }

  /**
   * Runs an exclusive operation wrapped in the write lock.
   * @param {Function} callback
   * @returns {Promise<any>}
   */
  async runExclusive(callback) {
    this._assertInitialized();
    return this._lock.runExclusive(callback);
  }

  // --- In-Memory Queries (Return Safe Clones) ---

  /**
   * Retrieves a copy of all events in memory.
   * @returns {Array<object>} Safe copy of events.
   */
  getEvents() {
    this._assertInitialized();
    return deepClone(this._events);
  }

  /**
   * Retrieves an event by ID.
   * @param {string} eventId
   * @returns {object|null} Safe copy of event or null.
   */
  getEventById(eventId) {
    this._assertInitialized();
    const event = this._events.find(e => e.id === eventId);
    return event ? deepClone(event) : null;
  }

  /**
   * Retrieves a copy of all attendees in memory.
   * @returns {Array<object>} Safe copy of attendees.
   */
  getAttendees() {
    this._assertInitialized();
    return deepClone(this._attendees);
  }

  /**
   * Retrieves an attendee by ID.
   * @param {string} attendeeId
   * @returns {object|null} Safe copy of attendee or null.
   */
  getAttendeeById(attendeeId) {
    this._assertInitialized();
    const attendee = this._attendees.find(a => a.id === attendeeId);
    return attendee ? deepClone(attendee) : null;
  }

  /**
   * Retrieves all attendees for a given event ID.
   * @param {string} eventId
   * @returns {Array<object>} Safe copy of attendees for event.
   */
  getAttendeesByEventId(eventId) {
    this._assertInitialized();
    const filtered = this._attendees.filter(a => a.eventId === eventId);
    return deepClone(filtered);
  }

  // --- Persistence Mutations (Under Write Lock) ---

  /**
   * Atomically persists updated events list.
   * @param {Array<object>} newEvents
   * @returns {Promise<void>}
   */
  async saveEvents(newEvents) {
    this._assertInitialized();
    const serialized = JSON.stringify(newEvents, null, 2) + '\n';
    await this._atomicWrite(this._eventsFilePath, serialized);
    this._events = deepClone(newEvents);
  }

  /**
   * Atomically persists updated attendees list.
   * @param {Array<object>} newAttendees
   * @returns {Promise<void>}
   */
  async saveAttendees(newAttendees) {
    this._assertInitialized();
    const serialized = JSON.stringify(newAttendees, null, 2) + '\n';
    await this._atomicWrite(this._attendeesFilePath, serialized);
    this._attendees = deepClone(newAttendees);
  }

  /**
   * Atomically persists changes to both events and attendees collections.
   * Writes both temporary files first, then renames. In-memory state is only
   * committed once all file operations complete.
   *
   * @param {object} batch
   * @param {Array<object>} [batch.events]
   * @param {Array<object>} [batch.attendees]
   * @returns {Promise<void>}
   */
  async saveBatch({ events, attendees }) {
    this._assertInitialized();

    const writes = [];
    if (events !== undefined) {
      writes.push({
        targetPath: this._eventsFilePath,
        content: JSON.stringify(events, null, 2) + '\n',
        inMemoryTarget: 'events',
        data: events
      });
    }
    if (attendees !== undefined) {
      writes.push({
        targetPath: this._attendeesFilePath,
        content: JSON.stringify(attendees, null, 2) + '\n',
        inMemoryTarget: 'attendees',
        data: attendees
      });
    }

    if (writes.length === 0) return;

    // Stage temporary files
    const staged = [];
    try {
      for (const item of writes) {
        const dir = path.dirname(item.targetPath);
        const tempFileName = `.${path.basename(item.targetPath)}.${Date.now()}.${crypto.randomBytes(6).toString('hex')}.tmp`;
        const tempFilePath = path.join(dir, tempFileName);
        await fs.writeFile(tempFilePath, item.content, { encoding: 'utf-8', mode: 0o644 });
        staged.push({ tempFilePath, targetPath: item.targetPath, inMemoryTarget: item.inMemoryTarget, data: item.data });
      }

      // Rename into place
      for (const s of staged) {
        await fs.rename(s.tempFilePath, s.targetPath);
      }

      // Commit to in-memory state only upon successful disk writes
      for (const s of staged) {
        if (s.inMemoryTarget === 'events') {
          this._events = deepClone(s.data);
        } else if (s.inMemoryTarget === 'attendees') {
          this._attendees = deepClone(s.data);
        }
      }
    } catch (err) {
      // Clean up any remaining staged temp files
      for (const s of staged) {
        try {
          await fs.unlink(s.tempFilePath);
        } catch (cleanupErr) {
          // ignore cleanup error
        }
      }
      throw new StorageError(
        `Failed to commit batch persistence: ${err.message}`,
        err
      );
    }
  }

  /**
   * Resets the storage engine (primarily for test cleanup).
   */
  async reset() {
    return this._lock.runExclusive(async () => {
      this._events = [];
      this._attendees = [];
      this._initialized = false;
      this._storagePath = null;
      this._resolvedPath = null;
      this._eventsFilePath = null;
      this._attendeesFilePath = null;
    });
  }
}

module.exports = JsonStorage;
