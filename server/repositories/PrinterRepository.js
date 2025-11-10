/**
 * Printer Repository
 *
 * Handles all database operations for printer configurations.
 * Manages physical printers, spool services, and USB printers.
 */

/**
 * Printer types
 */
const PRINTER_TYPE = {
  PHYSICAL: 'physical', // TCP/IP network printer
  SPOOL: 'spool', // Another spool service (chain printing)
  USB: 'usb', // USB printer (future)
};

class PrinterRepository {
  /**
   * @param {Database} db - better-sqlite3 database instance
   */
  constructor(db) {
    this.db = db;

    // Prepare statements
    this.statements = {
      insert: db.prepare(`
        INSERT INTO printers (
          name, model, description, type, connection_info,
          enabled, timeout_ms, retry_attempts
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `),

      findById: db.prepare(`
        SELECT * FROM printers WHERE id = ? AND deleted_at IS NULL
      `),

      findByName: db.prepare(`
        SELECT * FROM printers WHERE name = ? AND deleted_at IS NULL
      `),

      update: db.prepare(`
        UPDATE printers SET
          name = ?,
          model = ?,
          description = ?,
          type = ?,
          connection_info = ?,
          enabled = ?,
          timeout_ms = ?,
          retry_attempts = ?
        WHERE id = ?
      `),

      updateStatus: db.prepare(`
        UPDATE printers SET
          enabled = ?
        WHERE id = ?
      `),

      updateLastSuccess: db.prepare(`
        UPDATE printers SET
          last_success_at = CURRENT_TIMESTAMP,
          last_error = NULL
        WHERE id = ?
      `),

      updateLastFailure: db.prepare(`
        UPDATE printers SET
          last_failure_at = CURRENT_TIMESTAMP,
          last_error = ?
        WHERE id = ?
      `),

      softDelete: db.prepare(`
        UPDATE printers SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?
      `),

      listAll: db.prepare(`
        SELECT * FROM printers
        WHERE deleted_at IS NULL
        ORDER BY name ASC
      `),

      listEnabled: db.prepare(`
        SELECT * FROM printers
        WHERE deleted_at IS NULL AND enabled = 1
        ORDER BY name ASC
      `),

      listByType: db.prepare(`
        SELECT * FROM printers
        WHERE type = ? AND deleted_at IS NULL
        ORDER BY name ASC
      `),
    };
  }

  /**
   * Create a new printer
   * @param {Object} printerData - Printer configuration
   * @param {string} printerData.name - Unique printer name
   * @param {string} [printerData.model] - Printer model
   * @param {string} [printerData.description] - Description
   * @param {string} printerData.type - Printer type (physical, spool, usb)
   * @param {Object} printerData.connectionInfo - Connection details
   * @param {boolean} [printerData.enabled=true] - Is printer enabled?
   * @param {number} [printerData.timeoutMs=5000] - Connection timeout
   * @param {number} [printerData.retryAttempts=3] - Retry attempts
   * @returns {Object} Created printer with ID
   */
  create(printerData) {
    const {
      name,
      model = null,
      description = null,
      type,
      connectionInfo,
      enabled = true,
      timeoutMs = 5000,
      retryAttempts = 3,
    } = printerData;

    // Validate printer type
    if (!Object.values(PRINTER_TYPE).includes(type)) {
      throw new Error(`Invalid printer type: ${type}`);
    }

    // Validate connection info based on type
    this._validateConnectionInfo(type, connectionInfo);

    const info = this.statements.insert.run(
      name,
      model,
      description,
      type,
      JSON.stringify(connectionInfo),
      enabled ? 1 : 0,
      timeoutMs,
      retryAttempts
    );

    return this.findById(info.lastInsertRowid);
  }

  /**
   * Find printer by ID
   * @param {number} id - Printer ID
   * @returns {Object|null} Printer or null
   */
  findById(id) {
    const printer = this.statements.findById.get(id);
    return printer ? this._deserializePrinter(printer) : null;
  }

  /**
   * Find printer by name
   * @param {string} name - Printer name
   * @returns {Object|null} Printer or null
   */
  findByName(name) {
    const printer = this.statements.findByName.get(name);
    return printer ? this._deserializePrinter(printer) : null;
  }

  /**
   * List all printers
   * @param {Object} options - Query options
   * @param {boolean} [options.enabledOnly=false] - Only enabled printers
   * @param {string} [options.type] - Filter by type
   * @returns {Array} Printers
   */
  list(options = {}) {
    const { enabledOnly = false, type = null } = options;

    let printers;

    if (type) {
      printers = this.statements.listByType.all(type);
    } else if (enabledOnly) {
      printers = this.statements.listEnabled.all();
    } else {
      printers = this.statements.listAll.all();
    }

    return printers.map((p) => this._deserializePrinter(p));
  }

  /**
   * Update printer
   * @param {number} id - Printer ID
   * @param {Object} updates - Fields to update
   * @returns {Object} Updated printer
   */
  update(id, updates) {
    const printer = this.findById(id);
    if (!printer) {
      throw new Error(`Printer ${id} not found`);
    }

    const {
      name = printer.name,
      model = printer.model,
      description = printer.description,
      type = printer.type,
      connectionInfo = printer.connection_info,
      enabled = printer.enabled,
      timeoutMs = printer.timeout_ms,
      retryAttempts = printer.retry_attempts,
    } = updates;

    // Validate if type changed
    if (type !== printer.type && !Object.values(PRINTER_TYPE).includes(type)) {
      throw new Error(`Invalid printer type: ${type}`);
    }

    // Validate connection info
    this._validateConnectionInfo(type, connectionInfo);

    this.statements.update.run(
      name,
      model,
      description,
      type,
      JSON.stringify(connectionInfo),
      enabled ? 1 : 0,
      timeoutMs,
      retryAttempts,
      id
    );

    return this.findById(id);
  }

  /**
   * Enable or disable a printer
   * @param {number} id - Printer ID
   * @param {boolean} enabled - Enable/disable
   * @returns {Object} Updated printer
   */
  setEnabled(id, enabled) {
    const printer = this.findById(id);
    if (!printer) {
      throw new Error(`Printer ${id} not found`);
    }

    this.statements.updateStatus.run(enabled ? 1 : 0, id);
    return this.findById(id);
  }

  /**
   * Record successful print
   * @param {number} id - Printer ID
   */
  recordSuccess(id) {
    this.statements.updateLastSuccess.run(id);
  }

  /**
   * Record failed print
   * @param {number} id - Printer ID
   * @param {string} error - Error message
   */
  recordFailure(id, error) {
    this.statements.updateLastFailure.run(error, id);
  }

  /**
   * Soft delete a printer
   * @param {number} id - Printer ID
   * @returns {boolean} Success
   */
  delete(id) {
    const printer = this.findById(id);
    if (!printer) {
      return false;
    }

    this.statements.softDelete.run(id);
    return true;
  }

  /**
   * Get printers by type
   * @param {string} type - Printer type
   * @returns {Array} Printers
   */
  getByType(type) {
    return this.list({ type });
  }

  /**
   * Get all enabled printers
   * @returns {Array} Enabled printers
   */
  getEnabled() {
    return this.list({ enabledOnly: true });
  }

  /**
   * Test printer connection
   * @param {number} id - Printer ID
   * @returns {Promise<boolean>} Connection success
   */
  async testConnection(id) {
    const printer = this.findById(id);
    if (!printer) {
      throw new Error(`Printer ${id} not found`);
    }

    // Connection testing logic will be implemented in the printer service
    // This method is a placeholder for the API
    return true;
  }

  /**
   * Validate connection info based on printer type
   * @private
   */
  _validateConnectionInfo(type, connectionInfo) {
    if (!connectionInfo) {
      throw new Error('Connection info is required');
    }

    switch (type) {
      case PRINTER_TYPE.PHYSICAL:
        // Physical printers need host and port
        if (!connectionInfo.host || !connectionInfo.port) {
          throw new Error('Physical printers require host and port');
        }
        if (
          typeof connectionInfo.port !== 'number' ||
          connectionInfo.port < 1 ||
          connectionInfo.port > 65535
        ) {
          throw new Error('Invalid port number');
        }
        break;

      case PRINTER_TYPE.SPOOL:
        // Spool services need URL
        if (!connectionInfo.url) {
          throw new Error('Spool printers require url');
        }
        // Basic URL validation
        try {
          new URL(connectionInfo.url);
        } catch (error) {
          throw new Error('Invalid spool service URL');
        }
        break;

      case PRINTER_TYPE.USB:
        // USB printers need vendor/product ID or path
        if (!connectionInfo.vendorId && !connectionInfo.path) {
          throw new Error('USB printers require vendorId or path');
        }
        break;

      default:
        throw new Error(`Unknown printer type: ${type}`);
    }
  }

  /**
   * Deserialize printer from database row
   * @private
   */
  _deserializePrinter(row) {
    return {
      ...row,
      connection_info: row.connection_info
        ? JSON.parse(row.connection_info)
        : null,
      enabled: Boolean(row.enabled),
    };
  }
}

module.exports = {
  PrinterRepository,
  PRINTER_TYPE,
};
