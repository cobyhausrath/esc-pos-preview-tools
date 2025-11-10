# ESC-POS Spool Service - Usage Guide

Complete guide to using the ESC-POS Spool Service for print job management and approval workflows.

---

## Table of Contents

- [Quick Start](#quick-start)
- [Installation](#installation)
- [Basic Workflow](#basic-workflow)
- [Web Dashboard](#web-dashboard)
- [Command Line Usage](#command-line-usage)
- [Integration Examples](#integration-examples)
- [Chain Printing](#chain-printing)
- [Troubleshooting](#troubleshooting)

---

## Quick Start

### 1. Install Dependencies

```bash
yarn install
```

### 2. Start the API Server

```bash
yarn server
```

The server will start on:
- HTTP API: `http://127.0.0.1:3000`
- WebSocket: `ws://127.0.0.1:8765`
- Database: `data/spool.db`

### 3. Open the Dashboard

Open in your browser:
```
file:///path/to/esc-pos-preview-tools/web/dashboard.html
```

Or use a local web server:
```bash
python3 -m http.server 8080 --directory web
# Then open http://localhost:8080/dashboard.html
```

### 4. Register a Printer

Using curl:
```bash
curl -X POST http://127.0.0.1:3000/api/printers \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Kitchen Printer",
    "type": "physical",
    "connectionInfo": {
      "host": "192.168.1.100",
      "port": 9100
    }
  }'
```

Or use the web dashboard (printer management feature coming soon).

### 5. Submit a Test Job

```bash
curl -X POST http://127.0.0.1:3000/api/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "rawData": [27, 64, 72, 101, 108, 108, 111, 10, 29, 86, 0],
    "printerId": 1,
    "user": "test",
    "notes": "Test receipt"
  }'
```

### 6. Approve and Print

Use the web dashboard to:
1. View the pending job
2. Click to see details
3. Click "Approve"
4. Click "Print" to send to printer

---

## Installation

### Prerequisites

- **Node.js** ≥ 16.0.0
- **Yarn** package manager
- **ESC-POS printer** (TCP/IP network printer) or another spool service

### Setup Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/cobyhausrath/esc-pos-preview-tools.git
   cd esc-pos-preview-tools
   ```

2. **Install dependencies**
   ```bash
   yarn install
   ```

3. **Initialize database** (automatic on first run)
   The database is automatically created when you start the server for the first time.

4. **Verify installation**
   ```bash
   # Test database
   node server/test-db.js

   # Start server
   yarn server
   ```

---

## Basic Workflow

### Job Lifecycle

1. **Submit** → Job created with status `pending`
2. **Review** → View job in dashboard
3. **Approve/Reject** → Decision made
4. **Print** → Send to printer (status: `printing` → `completed`)

### Workflow Diagram

```
┌─────────────┐
│ POS System  │
└──────┬──────┘
       │ Submit job via API
       ↓
┌─────────────────┐
│  Spool Service  │
│  Status:pending │
└──────┬──────────┘
       │ Review in dashboard
       ↓
   ┌───┴───┐
   │Approve│ Reject
   └───┬───┘   └─→ Status: rejected (terminal)
       │
       ↓ Status: approved
┌─────────────┐
│    Print    │
└──────┬──────┘
       │
   ┌───┴────┐
Success    Fail
   │          │
   ↓          ↓
completed   failed
            (retry available)
```

---

## Web Dashboard

### Features

- **Real-time updates** via WebSocket
- **Job filtering** by status (pending, approved, etc.)
- **Job cards** with metadata and actions
- **Modal view** for detailed job inspection
- **Statistics** showing job counts and database size

### Dashboard Sections

#### 1. Header
- Connection status indicator
- Refresh button

#### 2. Sidebar
- Status filter tabs
- Job count badges
- Statistics display

#### 3. Job List
- Grid of job cards
- Status badges
- Action buttons (Approve, Reject, Print, Delete)
- Click card to view details

#### 4. Job Detail Modal
- Full job metadata
- Preview (coming soon)
- Action buttons

### Keyboard Shortcuts

Currently not implemented. Planned for future versions.

---

## Command Line Usage

### API Server

```bash
# Start server (default ports)
yarn server

# Start server on custom ports
node server/api-server.js --port 8080 --ws-port 8081

# Development mode with auto-reload
yarn server:dev
```

### Test Database

```bash
# Run database tests and create sample data
node server/test-db.js
```

### Printer Bridge (Legacy)

For direct WebSocket-to-printer bridge (pre-spool):

```bash
# Start bridge
yarn bridge

# Custom port
yarn bridge -- --port 9000
```

### Send to Printer (CLI Tool)

```bash
# Send ESC-POS file directly to printer
node bin/escpos-send.js 192.168.1.100 9100 samples/receipt.bin

# Using stdin
cat samples/receipt.bin | node bin/escpos-send.js 192.168.1.100 9100
```

---

## Integration Examples

### 1. Node.js Integration

```javascript
const axios = require('axios');

// Submit a job
async function submitReceipt(receiptData) {
  const response = await axios.post('http://127.0.0.1:3000/api/jobs', {
    rawData: Array.from(receiptData), // Buffer to array
    printerId: 1,
    user: 'pos-terminal-1',
    notes: `Order #${orderId}`,
  });

  return response.data.id;
}

// Check job status
async function checkStatus(jobId) {
  const response = await axios.get(`http://127.0.0.1:3000/api/jobs/${jobId}`);
  return response.data.status;
}

// Wait for approval
async function waitForApproval(jobId, timeout = 60000) {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    const status = await checkStatus(jobId);

    if (status === 'approved') return true;
    if (status === 'rejected') return false;

    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  throw new Error('Timeout waiting for approval');
}

// Usage
const jobId = await submitReceipt(myReceiptBuffer);
const approved = await waitForApproval(jobId);

if (approved) {
  console.log('Receipt approved and queued for printing');
} else {
  console.log('Receipt rejected');
}
```

### 2. Python Integration

```python
import requests
import time

API_BASE = 'http://127.0.0.1:3000/api'

def submit_job(receipt_bytes, printer_id=1, user='pos-system'):
    """Submit a print job"""
    response = requests.post(f'{API_BASE}/jobs', json={
        'rawData': list(receipt_bytes),
        'printerId': printer_id,
        'user': user,
        'notes': 'Receipt from Python POS'
    })
    response.raise_for_status()
    return response.json()['id']

def get_job_status(job_id):
    """Get job status"""
    response = requests.get(f'{API_BASE}/jobs/{job_id}')
    response.raise_for_status()
    return response.json()['status']

def wait_for_approval(job_id, timeout=60):
    """Wait for job to be approved or rejected"""
    start = time.time()

    while time.time() - start < timeout:
        status = get_job_status(job_id)

        if status == 'approved':
            return True
        elif status == 'rejected':
            return False

        time.sleep(1)

    raise TimeoutError('Timeout waiting for approval')

# Usage
receipt = b'\x1B\x40Hello\n\x1D\x56\x00'
job_id = submit_job(receipt)
print(f'Job submitted: {job_id}')

if wait_for_approval(job_id):
    print('Receipt approved!')
else:
    print('Receipt rejected')
```

### 3. WebSocket Listener (JavaScript)

```javascript
const ws = new WebSocket('ws://127.0.0.1:8765');

ws.onopen = () => {
  console.log('Connected to spool service');
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);

  switch (data.event) {
    case 'job:created':
      console.log(`New job ${data.data.id} created`);
      // Trigger notification, update UI, etc.
      break;

    case 'job:approved':
      console.log(`Job ${data.data.id} approved`);
      break;

    case 'job:completed':
      console.log(`Job ${data.data.id} printed successfully`);
      break;

    case 'job:failed':
      console.error(`Job ${data.data.id} failed:`, data.data.error);
      break;
  }
};

ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};

ws.onclose = () => {
  console.log('Disconnected from spool service');
  // Implement reconnection logic
  setTimeout(connectWebSocket, 3000);
};
```

---

## Chain Printing

Chain printing allows you to forward jobs through multiple spool services for multi-stage approval.

### Use Case: Dev → Staging → Production

**Setup:**

1. **Service A** (Development) - port 3000
2. **Service B** (Staging) - port 3001
3. **Service C** (Production) - port 3002 → Physical Printer

### Configuration

**Service A** registers Service B as a spool printer:

```bash
curl -X POST http://127.0.0.1:3000/api/printers \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Staging Spool",
    "type": "spool",
    "connectionInfo": {
      "url": "http://localhost:3001/api/jobs"
    }
  }'
```

**Service B** registers Service C:

```bash
curl -X POST http://127.0.0.1:3001/api/printers \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Production Spool",
    "type": "spool",
    "connectionInfo": {
      "url": "http://localhost:3002/api/jobs"
    }
  }'
```

**Service C** registers the physical printer:

```bash
curl -X POST http://127.0.0.1:3002/api/printers \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Kitchen Printer",
    "type": "physical",
    "connectionInfo": {
      "host": "192.168.1.100",
      "port": 9100
    }
  }'
```

### Workflow

1. Submit job to **Service A**
2. Developer approves in **Service A** dashboard
3. Job automatically forwarded to **Service B** (chain_depth = 1)
4. Manager approves in **Service B** dashboard
5. Job automatically forwarded to **Service C** (chain_depth = 2)
6. Production operator approves in **Service C** dashboard
7. Job sent to physical printer

### Tracing

All jobs in the chain share the same `trace_id` for end-to-end tracking.

```bash
# Get all jobs in a chain
curl http://127.0.0.1:3000/api/jobs | jq '.jobs[] | select(.trace_id == "550e8400-...")'
```

---

## Troubleshooting

### Database Issues

**Problem:** Database file locked

**Solution:**
```bash
# Stop the server
# Remove lock files
rm data/spool.db-wal data/spool.db-shm
# Restart server
yarn server
```

---

**Problem:** Database corruption

**Solution:**
```bash
# Backup current database
cp data/spool.db data/spool.db.backup

# Reset database (WARNING: deletes all data)
rm data/spool.db*
yarn server  # Will create fresh database
```

---

### Printer Connection Issues

**Problem:** Connection timeout

**Solution:**
1. Verify printer IP and port
2. Check network connectivity: `ping 192.168.1.100`
3. Test port: `nc -zv 192.168.1.100 9100`
4. Increase timeout in printer settings
5. Check printer is powered on and ready

---

**Problem:** Print jobs stuck in "printing"

**Solution:**
```bash
# Check job status
curl http://127.0.0.1:3000/api/jobs/42

# Check printer last error
curl http://127.0.0.1:3000/api/printers/1

# Manually mark as failed (if needed)
# Connect to database and update manually or reset job
```

---

### WebSocket Issues

**Problem:** Dashboard shows "Disconnected"

**Solutions:**
1. Ensure API server is running: `curl http://127.0.0.1:3000/health`
2. Check WebSocket port is available: `netstat -an | grep 8765`
3. Try different WebSocket port: `yarn server -- --ws-port 8766`
4. Check browser console for errors
5. Verify firewall isn't blocking WebSocket connections

---

**Problem:** Real-time updates not working

**Solution:**
1. Check WebSocket connection in browser DevTools → Network → WS tab
2. Verify WebSocket events in console
3. Try refreshing the page
4. Check server logs for WebSocket errors

---

### API Errors

**Problem:** 400 Bad Request - Invalid state transition

**Cause:** Trying to transition job to invalid state

**Solution:** Check current job status and valid transitions:
- `pending` → `approved` or `rejected`
- `approved` → `printing`
- `printing` → `completed` or `failed`

---

**Problem:** 404 Not Found

**Cause:** Job or printer doesn't exist

**Solution:**
```bash
# List all jobs
curl http://127.0.0.1:3000/api/jobs

# List all printers
curl http://127.0.0.1:3000/api/printers
```

---

### Performance Issues

**Problem:** Slow job listing

**Solution:**
```bash
# Clean up old completed jobs
node -e "
const { getDatabase } = require('./server/db');
const { JobRepository } = require('./server/repositories/JobRepository');
const db = getDatabase();
const repo = new JobRepository(db);
const deleted = repo.cleanup(7); // Delete jobs older than 7 days
console.log(\`Deleted \${deleted} old jobs\`);
db.close();
"
```

---

**Problem:** Database growing too large

**Solution:**
```bash
# Vacuum database to reclaim space
node -e "
const { getDatabase } = require('./server/db');
const db = getDatabase();
db.exec('VACUUM');
console.log('Database vacuumed');
db.close();
"
```

---

## Best Practices

### 1. Job Submission

- **Include metadata**: Always set `user` and `notes` for audit trail
- **Validate data**: Ensure ESC-POS bytes are valid before submission
- **Set printer**: Specify `printerId` to avoid manual assignment

### 2. Job Approval

- **Review carefully**: Check job metadata before approving
- **Rejection reasons**: Always provide clear rejection reasons
- **Auto-print**: Use `autoPrint: true` for trusted sources

### 3. Printer Management

- **Descriptive names**: Use clear, unique printer names
- **Test connections**: Use `/api/printers/:id/test` before production
- **Monitor status**: Check `last_failure_at` and `last_error` regularly
- **Disable unused**: Disable printers when offline instead of deleting

### 4. Database Maintenance

- **Regular cleanup**: Schedule job cleanup (e.g., weekly)
- **Backup**: Backup `data/spool.db` regularly
- **Monitor size**: Check database size in stats
- **Vacuum**: Run VACUUM monthly to reclaim space

### 5. Security

- **Localhost only**: Never expose API to internet without authentication
- **Network isolation**: Run on isolated network or VPN
- **Future auth**: Plan for Phase 2 authentication implementation

---

## Next Steps

### Phase 2 Features (Coming Soon)

- **Job Modification**: Edit receipts before printing using Python verifier
- **Authentication**: Multi-user with roles (admin, operator, viewer)
- **Templates**: Receipt template library
- **API Keys**: For POS system integration

### Phase 3 Features

- **USB Printer Support**: Direct USB printer connection
- **Advanced Monitoring**: Prometheus metrics, Grafana dashboards
- **Docker Deployment**: Production-ready containerization
- **Mobile App**: React Native or PWA dashboard

---

## Support

- **Documentation**: See `docs/` directory
- **API Reference**: `docs/API.md`
- **GitHub Issues**: https://github.com/cobyhausrath/esc-pos-preview-tools/issues
- **Project Planning**: `PRINT_SPOOL_ROADMAP_v2.md`

---

**Last Updated:** 2025-11-10
**Version:** 1.0.0 (MVP)
**Session:** claude/implement-print-spool-roadmap-011CUyJsD2M6mzBwbFpY5wcA
