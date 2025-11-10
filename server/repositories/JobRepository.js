/**
 * Job Repository
 *
 * Handles all database operations for print jobs.
 * Implements CRUD operations and job state management.
 */

const { v4: uuidv4 } = require('crypto');

/**
 * Job states (Finite State Machine)
 */
const JOB_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  PRINTING: 'printing',
  COMPLETED: 'completed',
  FAILED: 'failed',
};

/**
 * Valid state transitions
 * Maps: current_state -> [allowed_next_states]
 */
const STATE_TRANSITIONS = {
  [JOB_STATUS.PENDING]: [JOB_STATUS.APPROVED, JOB_STATUS.REJECTED],
  [JOB_STATUS.APPROVED]: [JOB_STATUS.PRINTING, JOB_STATUS.REJECTED],
  [JOB_STATUS.REJECTED]: [], // Terminal state
  [JOB_STATUS.PRINTING]: [JOB_STATUS.COMPLETED, JOB_STATUS.FAILED],
  [JOB_STATUS.COMPLETED]: [], // Terminal state
  [JOB_STATUS.FAILED]: [JOB_STATUS.PRINTING, JOB_STATUS.APPROVED], // Can retry
};

class JobRepository {
  /**
   * @param {Database} db - better-sqlite3 database instance
   */
  constructor(db) {
    this.db = db;

    // Prepare statements for better performance
    this.statements = {
      insert: db.prepare(`
        INSERT INTO jobs (
          status, raw_data, parsed_json, preview_html,
          printer_id, user, notes, chain_depth, origin_service, trace_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `),

      findById: db.prepare(`
        SELECT * FROM jobs WHERE id = ? AND deleted_at IS NULL
      `),

      updateStatus: db.prepare(`
        UPDATE jobs SET status = ?, notes = ? WHERE id = ?
      `),

      update: db.prepare(`
        UPDATE jobs SET
          status = ?,
          printer_id = ?,
          user = ?,
          notes = ?,
          is_modified = ?,
          modified_code = ?
        WHERE id = ?
      `),

      softDelete: db.prepare(`
        UPDATE jobs SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?
      `),

      listByStatus: db.prepare(`
        SELECT * FROM jobs
        WHERE status = ? AND deleted_at IS NULL
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `),

      listAll: db.prepare(`
        SELECT * FROM jobs
        WHERE deleted_at IS NULL
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `),

      countByStatus: db.prepare(`
        SELECT COUNT(*) as count FROM jobs
        WHERE status = ? AND deleted_at IS NULL
      `),

      countAll: db.prepare(`
        SELECT COUNT(*) as count FROM jobs WHERE deleted_at IS NULL
      `),
    };
  }

  /**
   * Create a new job
   * @param {Object} jobData - Job data
   * @param {Buffer} jobData.rawData - Raw ESC-POS bytes
   * @param {Object} [jobData.parsedJson] - Parsed command structure
   * @param {string} [jobData.previewHtml] - Rendered HTML preview
   * @param {number} [jobData.printerId] - Target printer ID
   * @param {string} [jobData.user] - Submitting user
   * @param {string} [jobData.notes] - Job notes
   * @param {number} [jobData.chainDepth=0] - Chain depth for forwarded jobs
   * @param {string} [jobData.originService] - Origin service URL
   * @param {string} [jobData.traceId] - Trace ID for chain tracking
   * @returns {Object} Created job with ID
   */
  create(jobData) {
    const {
      rawData,
      parsedJson = null,
      previewHtml = null,
      printerId = null,
      user = 'system',
      notes = null,
      chainDepth = 0,
      originService = null,
      traceId = null,
    } = jobData;

    // Generate trace ID if not provided (for origin jobs)
    const finalTraceId = traceId || this._generateTraceId();

    const info = this.statements.insert.run(
      JOB_STATUS.PENDING,
      rawData,
      parsedJson ? JSON.stringify(parsedJson) : null,
      previewHtml,
      printerId,
      user,
      notes,
      chainDepth,
      originService,
      finalTraceId
    );

    return this.findById(info.lastInsertRowid);
  }

  /**
   * Find job by ID
   * @param {number} id - Job ID
   * @returns {Object|null} Job or null if not found
   */
  findById(id) {
    const job = this.statements.findById.get(id);
    return job ? this._deserializeJob(job) : null;
  }

  /**
   * List jobs with pagination
   * @param {Object} options - Query options
   * @param {string} [options.status] - Filter by status
   * @param {number} [options.limit=50] - Page size
   * @param {number} [options.offset=0] - Page offset
   * @returns {Object} { jobs: [], total: number }
   */
  list(options = {}) {
    const { status = null, limit = 50, offset = 0 } = options;

    let jobs;
    let total;

    if (status) {
      jobs = this.statements.listByStatus.all(status, limit, offset);
      total = this.statements.countByStatus.get(status).count;
    } else {
      jobs = this.statements.listAll.all(limit, offset);
      total = this.statements.countAll.get().count;
    }

    return {
      jobs: jobs.map((j) => this._deserializeJob(j)),
      total,
      limit,
      offset,
    };
  }

  /**
   * Update job status with validation
   * @param {number} id - Job ID
   * @param {string} newStatus - New status
   * @param {string} [notes] - Status change notes
   * @param {string} [user] - User making the change
   * @returns {Object} Updated job
   * @throws {Error} If transition is invalid
   */
  updateStatus(id, newStatus, notes = null, user = 'system') {
    const job = this.findById(id);
    if (!job) {
      throw new Error(`Job ${id} not found`);
    }

    // Validate state transition
    if (!this.canTransition(job.status, newStatus)) {
      throw new Error(
        `Invalid state transition: ${job.status} -> ${newStatus}`
      );
    }

    this.statements.updateStatus.run(newStatus, notes, id);
    return this.findById(id);
  }

  /**
   * Update job data
   * @param {number} id - Job ID
   * @param {Object} updates - Fields to update
   * @returns {Object} Updated job
   */
  update(id, updates) {
    const job = this.findById(id);
    if (!job) {
      throw new Error(`Job ${id} not found`);
    }

    const {
      status = job.status,
      printerId = job.printer_id,
      user = job.user,
      notes = job.notes,
      isModified = job.is_modified,
      modifiedCode = job.modified_code,
    } = updates;

    // Validate status transition if status is changing
    if (status !== job.status && !this.canTransition(job.status, status)) {
      throw new Error(
        `Invalid state transition: ${job.status} -> ${status}`
      );
    }

    this.statements.update.run(
      status,
      printerId,
      user,
      notes,
      isModified ? 1 : 0,
      modifiedCode,
      id
    );

    return this.findById(id);
  }

  /**
   * Soft delete a job
   * @param {number} id - Job ID
   * @returns {boolean} Success
   */
  delete(id) {
    const job = this.findById(id);
    if (!job) {
      return false;
    }

    this.statements.softDelete.run(id);
    return true;
  }

  /**
   * Approve a job
   * @param {number} id - Job ID
   * @param {string} [user] - User approving
   * @returns {Object} Updated job
   */
  approve(id, user = 'system') {
    return this.updateStatus(id, JOB_STATUS.APPROVED, 'Approved', user);
  }

  /**
   * Reject a job
   * @param {number} id - Job ID
   * @param {string} reason - Rejection reason
   * @param {string} [user] - User rejecting
   * @returns {Object} Updated job
   */
  reject(id, reason, user = 'system') {
    return this.updateStatus(id, JOB_STATUS.REJECTED, reason, user);
  }

  /**
   * Mark job as printing
   * @param {number} id - Job ID
   * @returns {Object} Updated job
   */
  markPrinting(id) {
    return this.updateStatus(id, JOB_STATUS.PRINTING, 'Sending to printer');
  }

  /**
   * Mark job as completed
   * @param {number} id - Job ID
   * @param {string} [notes] - Completion notes
   * @returns {Object} Updated job
   */
  markCompleted(id, notes = 'Print successful') {
    return this.updateStatus(id, JOB_STATUS.COMPLETED, notes);
  }

  /**
   * Mark job as failed
   * @param {number} id - Job ID
   * @param {string} errorMessage - Error message
   * @returns {Object} Updated job
   */
  markFailed(id, errorMessage) {
    return this.updateStatus(id, JOB_STATUS.FAILED, errorMessage);
  }

  /**
   * Check if state transition is valid
   * @param {string} currentStatus - Current status
   * @param {string} newStatus - New status
   * @returns {boolean} True if transition is valid
   */
  canTransition(currentStatus, newStatus) {
    const allowedTransitions = STATE_TRANSITIONS[currentStatus] || [];
    return allowedTransitions.includes(newStatus);
  }

  /**
   * Get pending jobs (needing approval)
   * @param {number} [limit=50] - Max results
   * @returns {Array} Pending jobs
   */
  getPending(limit = 50) {
    return this.list({ status: JOB_STATUS.PENDING, limit }).jobs;
  }

  /**
   * Get approved jobs (ready to print)
   * @param {number} [limit=50] - Max results
   * @returns {Array} Approved jobs
   */
  getApproved(limit = 50) {
    return this.list({ status: JOB_STATUS.APPROVED, limit }).jobs;
  }

  /**
   * Clean up old completed/rejected jobs
   * @param {number} daysOld - Delete jobs older than this many days
   * @returns {number} Number of jobs deleted
   */
  cleanup(daysOld = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    const cutoffISO = cutoffDate.toISOString();

    const stmt = this.db.prepare(`
      UPDATE jobs
      SET deleted_at = CURRENT_TIMESTAMP
      WHERE deleted_at IS NULL
        AND (status = ? OR status = ?)
        AND created_at < ?
    `);

    const result = stmt.run(JOB_STATUS.COMPLETED, JOB_STATUS.REJECTED, cutoffISO);
    return result.changes;
  }

  /**
   * Get jobs by trace ID (for chain printing)
   * @param {string} traceId - Trace ID
   * @returns {Array} Jobs with this trace ID
   */
  getByTraceId(traceId) {
    const stmt = this.db.prepare(`
      SELECT * FROM jobs
      WHERE trace_id = ? AND deleted_at IS NULL
      ORDER BY chain_depth ASC, created_at ASC
    `);

    const jobs = stmt.all(traceId);
    return jobs.map((j) => this._deserializeJob(j));
  }

  /**
   * Deserialize job from database row
   * @private
   */
  _deserializeJob(row) {
    return {
      ...row,
      parsed_json: row.parsed_json ? JSON.parse(row.parsed_json) : null,
      is_modified: Boolean(row.is_modified),
    };
  }

  /**
   * Generate a new trace ID for job chains
   * @private
   */
  _generateTraceId() {
    // Use crypto.randomUUID if available (Node 14.17+)
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    // Fallback: generate a simple UUID v4
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}

module.exports = {
  JobRepository,
  JOB_STATUS,
  STATE_TRANSITIONS,
};
