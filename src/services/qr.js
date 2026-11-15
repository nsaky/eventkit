'use strict';

const fs = require('fs/promises');
const path = require('path');
const QRCode = require('qrcode');
const { validateTicketId } = require('../utils/validators');
const {
  TicketNotFoundError,
  InvalidQRFormatError,
  QRGenerationFailedError,
  FileAlreadyExistsError
} = require('../utils/errors');

/**
 * Service for generating ticket QR codes in PNG and SVG formats.
 */
class QRService {
  /**
   * @param {import('../storage/storage')} storage - Storage instance.
   */
  constructor(storage) {
    if (!storage) {
      throw new Error('Storage instance is required for QRService.');
    }
    this._storage = storage;
  }

  /**
   * Generates a QR code for a given ticket ID.
   *
   * @param {string} ticketId - Unique ticket identifier.
   * @param {object} [options={}] - Generation options (format, width, margin, errorCorrectionLevel, filePath, overwrite).
   * @returns {Promise<object>} Result containing ticketId, eventId, format, mimeType, data (Buffer or string), and filePath.
   */
  async generateQRCode(ticketId, options = {}) {
    validateTicketId(ticketId);

    const ticket = this._storage.getTicketById(ticketId);
    if (!ticket) {
      throw new TicketNotFoundError(ticketId);
    }

    const rawFormat = options.format || 'png';
    const format = typeof rawFormat === 'string' ? rawFormat.trim().toLowerCase() : '';

    if (format !== 'png' && format !== 'svg') {
      throw new InvalidQRFormatError(rawFormat);
    }

    const width = typeof options.width === 'number' && options.width > 0 ? options.width : 300;
    const margin = typeof options.margin === 'number' && options.margin >= 0 ? options.margin : 2;
    const errorCorrectionLevel = ['L', 'M', 'Q', 'H'].includes(options.errorCorrectionLevel)
      ? options.errorCorrectionLevel
      : 'M';

    // Encode minimal structured payload (no attendee PII)
    const payload = JSON.stringify({
      ticketId: ticket.id,
      eventId: ticket.eventId
    });

    let data;
    let mimeType;

    try {
      if (format === 'png') {
        mimeType = 'image/png';
        data = await QRCode.toBuffer(payload, {
          type: 'png',
          width,
          margin,
          errorCorrectionLevel
        });
      } else {
        mimeType = 'image/svg+xml';
        data = await QRCode.toString(payload, {
          type: 'svg',
          width,
          margin,
          errorCorrectionLevel
        });
      }
    } catch (err) {
      throw new QRGenerationFailedError(`QR code generation failed: ${err.message}`, err);
    }

    // Optional file saving
    let savedFilePath = null;
    if (options.filePath) {
      const targetPath = path.isAbsolute(options.filePath)
        ? path.normalize(options.filePath)
        : path.resolve(process.cwd(), options.filePath);

      // Check if file exists when overwrite is false
      if (!options.overwrite) {
        try {
          await fs.access(targetPath);
          throw new FileAlreadyExistsError(targetPath);
        } catch (accessErr) {
          if (accessErr instanceof FileAlreadyExistsError) {
            throw accessErr;
          }
          // File does not exist, proceed
        }
      }

      try {
        await fs.mkdir(path.dirname(targetPath), { recursive: true });
        await fs.writeFile(targetPath, data);
        savedFilePath = targetPath;
      } catch (writeErr) {
        if (writeErr instanceof FileAlreadyExistsError) {
          throw writeErr;
        }
        throw new QRGenerationFailedError(
          `Failed to save QR code file at '${targetPath}': ${writeErr.message}`,
          writeErr
        );
      }
    }

    return {
      ticketId: ticket.id,
      eventId: ticket.eventId,
      format,
      mimeType,
      data,
      filePath: savedFilePath
    };
  }
}

module.exports = QRService;
