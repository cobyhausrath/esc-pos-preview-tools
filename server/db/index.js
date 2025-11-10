/**
 * Database Initialization and Management
 *
 * Handles SQLite database connection, initialization, and migrations.
 * Uses better-sqlite3 for synchronous, fast database operations.
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DEFAULT_DB_PATH = path.join(__dirname, '../../data/spool.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

/**
 * Initialize the database with schema
 * @param {string} dbPath - Path to SQLite database file
 * @returns {Database} - better-sqlite3 Database instance
 */
function initDatabase(dbPath = DEFAULT_DB_PATH) {
  // Ensure data directory exists
  const dataDir = path.dirname(dbPath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Open database connection
  const db = new Database(dbPath, {
    verbose: process.env.NODE_ENV === 'development' ? console.log : null,
  });

  // Enable foreign keys (disabled by default in SQLite)
  db.pragma('foreign_keys = ON');

  // Set journal mode to WAL for better concurrency
  db.pragma('journal_mode = WAL');

  // Read and execute schema
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
  db.exec(schema);

  console.log(`✓ Database initialized at ${dbPath}`);

  return db;
}

/**
 * Get or create database instance (singleton pattern)
 */
let dbInstance = null;

function getDatabase(dbPath = DEFAULT_DB_PATH) {
  if (!dbInstance) {
    dbInstance = initDatabase(dbPath);
  }
  return dbInstance;
}

/**
 * Close database connection
 */
function closeDatabase() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
    console.log('✓ Database connection closed');
  }
}

/**
 * Reset database (for testing)
 * WARNING: This deletes all data!
 */
function resetDatabase(dbPath = DEFAULT_DB_PATH) {
  closeDatabase();
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
    // Also delete WAL and SHM files
    const walPath = `${dbPath}-wal`;
    const shmPath = `${dbPath}-shm`;
    if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
    if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
  }
  return initDatabase(dbPath);
}

/**
 * Run a database migration
 * @param {Database} db - Database instance
 * @param {string} migrationSQL - SQL migration code
 */
function runMigration(db, migrationSQL) {
  db.exec(migrationSQL);
  console.log('✓ Migration completed');
}

/**
 * Health check - verify database is accessible
 * @param {Database} db - Database instance
 * @returns {boolean} - true if database is healthy
 */
function checkHealth(db) {
  try {
    const result = db.prepare('SELECT 1').get();
    return result !== undefined;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}

/**
 * Get database statistics
 * @param {Database} db - Database instance
 * @returns {Object} - Database statistics
 */
function getStats(db) {
  const stats = {};

  // Count records in each table
  const tables = ['jobs', 'printers', 'job_history', 'users', 'templates'];
  for (const table of tables) {
    try {
      const result = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get();
      stats[table] = result.count;
    } catch (error) {
      stats[table] = 0;
    }
  }

  // Get job counts by status
  const statusCounts = db.prepare(`
    SELECT status, COUNT(*) as count
    FROM jobs
    WHERE deleted_at IS NULL
    GROUP BY status
  `).all();

  stats.jobsByStatus = {};
  for (const row of statusCounts) {
    stats.jobsByStatus[row.status] = row.count;
  }

  // Get database file size
  try {
    const dbPath = db.name;
    if (fs.existsSync(dbPath)) {
      const fileStats = fs.statSync(dbPath);
      stats.fileSizeBytes = fileStats.size;
      stats.fileSizeMB = (fileStats.size / (1024 * 1024)).toFixed(2);
    }
  } catch (error) {
    stats.fileSizeBytes = 0;
    stats.fileSizeMB = '0.00';
  }

  return stats;
}

module.exports = {
  initDatabase,
  getDatabase,
  closeDatabase,
  resetDatabase,
  runMigration,
  checkHealth,
  getStats,
  DEFAULT_DB_PATH,
};
