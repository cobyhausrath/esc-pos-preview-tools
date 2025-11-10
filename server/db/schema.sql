-- ESC-POS Print Spool Service Database Schema
-- SQLite 3.x
-- Created: 2025-11-10

-- ============================================================================
-- JOBS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    -- Timestamps
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Job status (FSM states)
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN (
        'pending',      -- Newly submitted, awaiting approval
        'approved',     -- Approved, ready to print
        'rejected',     -- Rejected, will not print
        'printing',     -- Currently being sent to printer
        'completed',    -- Successfully printed
        'failed'        -- Print failed
    )),

    -- Job data
    raw_data BLOB NOT NULL,                  -- Raw ESC-POS bytes
    parsed_json TEXT,                        -- Parsed command structure (JSON)
    preview_html TEXT,                       -- Rendered preview HTML

    -- Metadata
    printer_id INTEGER,                      -- Target printer (FK to printers)
    user TEXT,                               -- Submitting user/system
    notes TEXT,                              -- User notes, rejection reasons, etc.

    -- Modification tracking
    is_modified BOOLEAN DEFAULT 0,           -- Was job modified before print?
    original_data BLOB,                      -- Original data if modified
    modified_code TEXT,                      -- Python code used for modification

    -- Chain printing
    chain_depth INTEGER DEFAULT 0,           -- 0 = origin, 1+ = forwarded
    origin_service TEXT,                     -- Originating service URL/ID
    trace_id TEXT,                           -- UUID for tracking across services
    upstream_job_id TEXT,                    -- Job ID in upstream service

    -- Soft delete
    deleted_at DATETIME,                     -- NULL = active, timestamp = deleted

    FOREIGN KEY (printer_id) REFERENCES printers(id)
);

-- Indexes for jobs table
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at);
CREATE INDEX IF NOT EXISTS idx_jobs_printer_id ON jobs(printer_id);
CREATE INDEX IF NOT EXISTS idx_jobs_trace_id ON jobs(trace_id);
CREATE INDEX IF NOT EXISTS idx_jobs_deleted_at ON jobs(deleted_at);

-- ============================================================================
-- PRINTERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS printers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    -- Timestamps
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Printer identity
    name TEXT NOT NULL UNIQUE,               -- Human-readable name (e.g., "Kitchen Printer")
    model TEXT,                              -- Printer model (e.g., "Netum 80-V-UL")
    description TEXT,                        -- Optional description

    -- Printer type and connection
    type TEXT NOT NULL CHECK(type IN (
        'physical',     -- Physical TCP/IP printer
        'spool',        -- Another spool service (chain printing)
        'usb'           -- USB printer (future)
    )),

    connection_info TEXT NOT NULL,           -- JSON: {"host": "...", "port": ...} or {"url": "..."}

    -- Status
    enabled BOOLEAN DEFAULT 1,               -- Can jobs be sent to this printer?
    last_success_at DATETIME,                -- Last successful print
    last_failure_at DATETIME,                -- Last failed print
    last_error TEXT,                         -- Last error message

    -- Settings
    timeout_ms INTEGER DEFAULT 5000,         -- Connection timeout
    retry_attempts INTEGER DEFAULT 3,        -- Number of retry attempts

    -- Soft delete
    deleted_at DATETIME
);

-- Indexes for printers table
CREATE INDEX IF NOT EXISTS idx_printers_name ON printers(name);
CREATE INDEX IF NOT EXISTS idx_printers_type ON printers(type);
CREATE INDEX IF NOT EXISTS idx_printers_enabled ON printers(enabled);

-- ============================================================================
-- JOB_HISTORY TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS job_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    -- Timestamps
    timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Job reference
    job_id INTEGER NOT NULL,

    -- State transition
    old_status TEXT,                         -- Previous status (NULL for creation)
    new_status TEXT NOT NULL,                -- New status

    -- Metadata
    user TEXT,                               -- User who performed action
    notes TEXT,                              -- Action notes (e.g., rejection reason)
    error_message TEXT,                      -- Error message if transition failed

    FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
);

-- Indexes for job_history table
CREATE INDEX IF NOT EXISTS idx_job_history_job_id ON job_history(job_id);
CREATE INDEX IF NOT EXISTS idx_job_history_timestamp ON job_history(timestamp);

-- ============================================================================
-- USERS TABLE (Phase 2 - Multi-user support)
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    -- Timestamps
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Identity
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,             -- bcrypt hash

    -- Authorization
    role TEXT NOT NULL DEFAULT 'viewer' CHECK(role IN (
        'admin',        -- Full access
        'operator',     -- Can approve/reject/modify jobs
        'viewer',       -- Read-only access
        'api_client'    -- Can submit jobs only (for POS systems)
    )),

    -- API access
    api_key TEXT UNIQUE,                     -- API key for api_client role

    -- Status
    enabled BOOLEAN DEFAULT 1,
    last_login_at DATETIME,

    -- Soft delete
    deleted_at DATETIME
);

-- Indexes for users table
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_api_key ON users(api_key);
CREATE INDEX IF NOT EXISTS idx_users_enabled ON users(enabled);

-- ============================================================================
-- TEMPLATES TABLE (Phase 2 - Receipt templates)
-- ============================================================================
CREATE TABLE IF NOT EXISTS templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    -- Timestamps
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Template identity
    name TEXT NOT NULL UNIQUE,
    description TEXT,

    -- Template code
    code TEXT NOT NULL,                      -- Python-escpos code with {{variables}}

    -- Metadata
    created_by TEXT,                         -- Username who created template
    category TEXT,                           -- Template category (receipt, label, etc.)

    -- Soft delete
    deleted_at DATETIME
);

-- Indexes for templates table
CREATE INDEX IF NOT EXISTS idx_templates_name ON templates(name);
CREATE INDEX IF NOT EXISTS idx_templates_category ON templates(category);

-- ============================================================================
-- CONFIGURATION TABLE (Global settings)
-- ============================================================================
CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Default configuration values
INSERT OR IGNORE INTO config (key, value, description) VALUES
    ('auto_print', 'false', 'Automatically print approved jobs'),
    ('job_retention_days', '30', 'Days to keep completed jobs'),
    ('max_chain_depth', '5', 'Maximum chain depth for spool forwarding'),
    ('default_printer_id', NULL, 'Default printer ID'),
    ('service_id', NULL, 'Unique service identifier for chain printing'),
    ('version', '1.0.0', 'Database schema version');

-- ============================================================================
-- TRIGGERS (Auto-update timestamps)
-- ============================================================================

-- Update jobs.updated_at on UPDATE
CREATE TRIGGER IF NOT EXISTS update_jobs_timestamp
AFTER UPDATE ON jobs
FOR EACH ROW
BEGIN
    UPDATE jobs SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;

-- Update printers.updated_at on UPDATE
CREATE TRIGGER IF NOT EXISTS update_printers_timestamp
AFTER UPDATE ON printers
FOR EACH ROW
BEGIN
    UPDATE printers SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;

-- Update users.updated_at on UPDATE
CREATE TRIGGER IF NOT EXISTS update_users_timestamp
AFTER UPDATE ON users
FOR EACH ROW
BEGIN
    UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;

-- Update templates.updated_at on UPDATE
CREATE TRIGGER IF NOT EXISTS update_templates_timestamp
AFTER UPDATE ON templates
FOR EACH ROW
BEGIN
    UPDATE templates SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;

-- Auto-create job_history entry on job status change
CREATE TRIGGER IF NOT EXISTS track_job_status_change
AFTER UPDATE OF status ON jobs
FOR EACH ROW
WHEN NEW.status != OLD.status
BEGIN
    INSERT INTO job_history (job_id, old_status, new_status, user, notes)
    VALUES (NEW.id, OLD.status, NEW.status, NEW.user, NEW.notes);
END;

-- ============================================================================
-- VIEWS (Convenient queries)
-- ============================================================================

-- Active jobs (not soft-deleted)
CREATE VIEW IF NOT EXISTS active_jobs AS
SELECT * FROM jobs WHERE deleted_at IS NULL;

-- Pending jobs needing approval
CREATE VIEW IF NOT EXISTS pending_jobs AS
SELECT * FROM jobs WHERE status = 'pending' AND deleted_at IS NULL;

-- Active printers
CREATE VIEW IF NOT EXISTS active_printers AS
SELECT * FROM printers WHERE deleted_at IS NULL AND enabled = 1;

-- Job summary with printer name
CREATE VIEW IF NOT EXISTS job_summary AS
SELECT
    j.id,
    j.created_at,
    j.updated_at,
    j.status,
    j.user,
    j.notes,
    j.is_modified,
    j.chain_depth,
    j.trace_id,
    p.name as printer_name,
    p.type as printer_type
FROM jobs j
LEFT JOIN printers p ON j.printer_id = p.id
WHERE j.deleted_at IS NULL
ORDER BY j.created_at DESC;
