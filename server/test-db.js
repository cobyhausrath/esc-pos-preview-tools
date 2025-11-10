#!/usr/bin/env node

/**
 * Database Test Script
 * Tests database initialization and repository operations
 */

const { getDatabase, getStats, resetDatabase } = require('./db');
const { JobRepository, JOB_STATUS } = require('./repositories/JobRepository');
const { PrinterRepository, PRINTER_TYPE } = require('./repositories/PrinterRepository');

console.log('=== Testing Database and Repositories ===\n');

// Initialize database
console.log('1. Initializing database...');
const db = getDatabase();
console.log('   ✓ Database initialized\n');

// Create repositories
console.log('2. Creating repositories...');
const jobRepo = new JobRepository(db);
const printerRepo = new PrinterRepository(db);
console.log('   ✓ Repositories created\n');

// Test printer creation
console.log('3. Testing printer creation...');
const printer1 = printerRepo.create({
  name: 'Kitchen Printer',
  model: 'Netum 80-V-UL',
  description: 'Main kitchen receipt printer',
  type: PRINTER_TYPE.PHYSICAL,
  connectionInfo: {
    host: '192.168.1.100',
    port: 9100,
  },
  enabled: true,
});
console.log('   ✓ Created printer:', printer1.id, printer1.name);

const printer2 = printerRepo.create({
  name: 'Staging Spool',
  description: 'Staging environment spool service',
  type: PRINTER_TYPE.SPOOL,
  connectionInfo: {
    url: 'http://localhost:3001/api/jobs',
  },
  enabled: true,
});
console.log('   ✓ Created printer:', printer2.id, printer2.name);
console.log('');

// Test job creation
console.log('4. Testing job creation...');
const sampleData = Buffer.from([
  0x1B, 0x40, // ESC @ - Initialize
  0x1B, 0x61, 0x01, // ESC a 1 - Center alignment
  'Hello World\n'.split('').map(c => c.charCodeAt(0)),
  0x1D, 0x56, 0x00, // GS V 0 - Cut paper
].flat());

const job1 = jobRepo.create({
  rawData: sampleData,
  printerId: printer1.id,
  user: 'test-user',
  notes: 'Test job 1',
});
console.log('   ✓ Created job:', job1.id, 'Status:', job1.status);

const job2 = jobRepo.create({
  rawData: sampleData,
  printerId: printer2.id,
  user: 'test-user',
  notes: 'Test job 2 for chain printing',
  chainDepth: 0,
});
console.log('   ✓ Created job:', job2.id, 'Status:', job2.status);
console.log('');

// Test job listing
console.log('5. Testing job listing...');
const allJobs = jobRepo.list({ limit: 10 });
console.log('   ✓ Total jobs:', allJobs.total);
console.log('   ✓ Jobs returned:', allJobs.jobs.length);
console.log('');

// Test printer listing
console.log('6. Testing printer listing...');
const allPrinters = printerRepo.list();
console.log('   ✓ Total printers:', allPrinters.length);
allPrinters.forEach(p => {
  console.log('     -', p.name, `(${p.type})`);
});
console.log('');

// Test job state transitions
console.log('7. Testing job state transitions...');
try {
  const approved = jobRepo.approve(job1.id, 'test-user');
  console.log('   ✓ Approved job:', approved.id, 'New status:', approved.status);

  const rejected = jobRepo.reject(job2.id, 'Test rejection', 'test-user');
  console.log('   ✓ Rejected job:', rejected.id, 'New status:', rejected.status);
} catch (error) {
  console.error('   ✗ Error:', error.message);
}
console.log('');

// Test invalid state transition
console.log('8. Testing invalid state transition...');
try {
  jobRepo.markCompleted(job2.id); // Should fail - can't go from rejected to completed
  console.log('   ✗ Should have failed!');
} catch (error) {
  console.log('   ✓ Correctly rejected invalid transition:', error.message);
}
console.log('');

// Get statistics
console.log('9. Database statistics:');
const stats = getStats(db);
console.log('   Jobs:', stats.jobs);
console.log('   Printers:', stats.printers);
console.log('   Job History:', stats.job_history);
console.log('   Database Size:', stats.fileSizeMB, 'MB');
console.log('   Jobs by Status:', stats.jobsByStatus);
console.log('');

console.log('=== All Tests Passed! ===\n');

// Close database
db.close();
