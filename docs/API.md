# ESC-POS Spool Service - API Documentation

**Version:** 1.0.0
**Base URL:** `http://127.0.0.1:3000/api`
**WebSocket:** `ws://127.0.0.1:8765`

---

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Health & Statistics](#health--statistics)
- [Job Management](#job-management)
- [Printer Management](#printer-management)
- [WebSocket Events](#websocket-events)
- [Error Handling](#error-handling)
- [Examples](#examples)

---

## Overview

The ESC-POS Spool Service provides a RESTful API for managing print jobs and printers. It supports:

- Job submission, approval, and rejection workflow
- Multiple printer types (physical TCP/IP, spool chains, USB future)
- Real-time WebSocket notifications
- SQLite database for persistence
- Job state machine with validation

### API Principles

- **RESTful design** - Standard HTTP methods (GET, POST, PUT, DELETE)
- **JSON format** - All requests and responses use JSON
- **Synchronous operations** - API calls return immediately
- **WebSocket events** - Real-time updates for job state changes

---

## Authentication

**Current Status:** Not implemented in Phase 1 MVP

Authentication is planned for Phase 2. For now, the API is accessible without authentication but should only be exposed on localhost (127.0.0.1) for security.

---

## Health & Statistics

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "database": true,
  "timestamp": "2025-11-10T01:00:00.000Z"
}
```

**Status Codes:**
- `200` - Service is healthy
- `500` - Service has issues

---

### GET /api/stats

Get service statistics.

**Response:**
```json
{
  "jobs": 42,
  "printers": 3,
  "job_history": 156,
  "users": 0,
  "templates": 0,
  "fileSizeBytes": 98304,
  "fileSizeMB": "0.09",
  "jobsByStatus": {
    "pending": 5,
    "approved": 2,
    "printing": 1,
    "completed": 30,
    "rejected": 4
  }
}
```

---

## Job Management

### POST /api/jobs

Submit a new print job.

**Request Body:**
```json
{
  "rawData": [27, 64, 72, 101, 108, 108, 111, 10],
  "printerId": 1,
  "user": "pos-system",
  "notes": "Customer receipt #12345"
}
```

**Parameters:**
- `rawData` (required): Array of bytes representing ESC-POS commands
- `printerId` (optional): Target printer ID
- `user` (optional): Submitting user/system (default: "anonymous")
- `notes` (optional): Job notes or description

**Response:** `201 Created`
```json
{
  "id": 42,
  "status": "pending",
  "raw_data": "<Buffer>",
  "parsed_json": null,
  "preview_html": null,
  "printer_id": 1,
  "user": "pos-system",
  "notes": "Customer receipt #12345",
  "is_modified": false,
  "chain_depth": 0,
  "trace_id": "550e8400-e29b-41d4-a716-446655440000",
  "created_at": "2025-11-10T01:00:00.000Z",
  "updated_at": "2025-11-10T01:00:00.000Z"
}
```

**Triggers:** `job:created` WebSocket event

---

### GET /api/jobs

List jobs with optional filtering and pagination.

**Query Parameters:**
- `status` (optional): Filter by status (pending, approved, rejected, printing, completed, failed)
- `limit` (optional): Page size (default: 50, max: 100)
- `offset` (optional): Page offset (default: 0)

**Example:** `GET /api/jobs?status=pending&limit=10&offset=0`

**Response:** `200 OK`
```json
{
  "jobs": [
    {
      "id": 42,
      "status": "pending",
      "created_at": "2025-11-10T01:00:00.000Z",
      "updated_at": "2025-11-10T01:00:00.000Z",
      "user": "pos-system",
      "notes": "Customer receipt #12345",
      "printer_id": 1,
      "is_modified": false,
      "chain_depth": 0,
      "trace_id": "550e8400-e29b-41d4-a716-446655440000"
    }
  ],
  "total": 1,
  "limit": 50,
  "offset": 0
}
```

---

### GET /api/jobs/:id

Get job details by ID.

**URL Parameters:**
- `id` (required): Job ID

**Example:** `GET /api/jobs/42`

**Response:** `200 OK`
```json
{
  "id": 42,
  "status": "pending",
  "raw_data": "<Buffer>",
  "parsed_json": null,
  "preview_html": null,
  "printer_id": 1,
  "user": "pos-system",
  "notes": "Customer receipt #12345",
  "is_modified": false,
  "modified_code": null,
  "chain_depth": 0,
  "origin_service": null,
  "trace_id": "550e8400-e29b-41d4-a716-446655440000",
  "created_at": "2025-11-10T01:00:00.000Z",
  "updated_at": "2025-11-10T01:00:00.000Z"
}
```

**Status Codes:**
- `200` - Job found
- `404` - Job not found

---

### POST /api/jobs/:id/approve

Approve a pending job.

**URL Parameters:**
- `id` (required): Job ID

**Request Body:**
```json
{
  "user": "manager",
  "autoPrint": false
}
```

**Parameters:**
- `user` (optional): User approving the job (default: "anonymous")
- `autoPrint` (optional): Automatically trigger printing (default: false)

**Response:** `200 OK`
```json
{
  "id": 42,
  "status": "approved",
  ...
}
```

**Status Codes:**
- `200` - Job approved
- `400` - Invalid state transition
- `404` - Job not found

**Triggers:** `job:approved` WebSocket event

**State Transition:** `pending` → `approved`

---

### POST /api/jobs/:id/reject

Reject a pending job.

**URL Parameters:**
- `id` (required): Job ID

**Request Body:**
```json
{
  "reason": "Invalid receipt format",
  "user": "manager"
}
```

**Parameters:**
- `reason` (optional): Rejection reason (default: "Rejected by user")
- `user` (optional): User rejecting the job (default: "anonymous")

**Response:** `200 OK`
```json
{
  "id": 42,
  "status": "rejected",
  "notes": "Invalid receipt format",
  ...
}
```

**Status Codes:**
- `200` - Job rejected
- `400` - Invalid state transition
- `404` - Job not found

**Triggers:** `job:rejected` WebSocket event

**State Transition:** `pending` → `rejected`

---

### POST /api/jobs/:id/print

Manually trigger printing of an approved job.

**URL Parameters:**
- `id` (required): Job ID

**Response:** `200 OK`
```json
{
  "success": true,
  "bytesSent": 128
}
```

**Status Codes:**
- `200` - Print initiated
- `400` - Invalid state or print failed
- `404` - Job not found

**Triggers:**
- `job:printing` WebSocket event (when printing starts)
- `job:completed` WebSocket event (on success)
- `job:failed` WebSocket event (on failure)

**State Transitions:**
- `approved` → `printing` → `completed` (success)
- `approved` → `printing` → `failed` (error)

---

### DELETE /api/jobs/:id

Delete a job (soft delete).

**URL Parameters:**
- `id` (required): Job ID

**Response:** `200 OK`
```json
{
  "success": true
}
```

**Status Codes:**
- `200` - Job deleted
- `404` - Job not found

**Triggers:** `job:deleted` WebSocket event

**Note:** Only pending or rejected jobs can be deleted. Completed jobs are retained for audit purposes.

---

## Printer Management

### GET /api/printers

List all printers.

**Query Parameters:**
- `enabledOnly` (optional): Only return enabled printers (true/false)
- `type` (optional): Filter by type (physical, spool, usb)

**Example:** `GET /api/printers?enabledOnly=true`

**Response:** `200 OK`
```json
[
  {
    "id": 1,
    "name": "Kitchen Printer",
    "model": "Netum 80-V-UL",
    "description": "Main kitchen receipt printer",
    "type": "physical",
    "connection_info": {
      "host": "192.168.1.100",
      "port": 9100
    },
    "enabled": true,
    "timeout_ms": 5000,
    "retry_attempts": 3,
    "last_success_at": "2025-11-10T01:00:00.000Z",
    "last_failure_at": null,
    "last_error": null,
    "created_at": "2025-11-09T12:00:00.000Z",
    "updated_at": "2025-11-10T01:00:00.000Z"
  }
]
```

---

### POST /api/printers

Register a new printer.

**Request Body:**

**Physical Printer:**
```json
{
  "name": "Kitchen Printer",
  "model": "Netum 80-V-UL",
  "description": "Main kitchen receipt printer",
  "type": "physical",
  "connectionInfo": {
    "host": "192.168.1.100",
    "port": 9100
  },
  "enabled": true,
  "timeoutMs": 5000,
  "retryAttempts": 3
}
```

**Spool Service:**
```json
{
  "name": "Staging Spool",
  "description": "Staging environment spool service",
  "type": "spool",
  "connectionInfo": {
    "url": "http://localhost:3001/api/jobs"
  },
  "enabled": true
}
```

**Parameters:**
- `name` (required): Unique printer name
- `model` (optional): Printer model
- `description` (optional): Description
- `type` (required): Printer type (physical, spool, usb)
- `connectionInfo` (required): Type-specific connection details
  - **physical**: `{ host: string, port: number }`
  - **spool**: `{ url: string }`
  - **usb**: `{ vendorId: string, productId: string, path: string }` (future)
- `enabled` (optional): Is printer enabled? (default: true)
- `timeoutMs` (optional): Connection timeout (default: 5000)
- `retryAttempts` (optional): Retry attempts (default: 3)

**Response:** `201 Created`
```json
{
  "id": 1,
  "name": "Kitchen Printer",
  ...
}
```

**Status Codes:**
- `201` - Printer created
- `400` - Invalid data or duplicate name

---

### GET /api/printers/:id

Get printer details by ID.

**URL Parameters:**
- `id` (required): Printer ID

**Response:** `200 OK`
```json
{
  "id": 1,
  "name": "Kitchen Printer",
  ...
}
```

**Status Codes:**
- `200` - Printer found
- `404` - Printer not found

---

### PUT /api/printers/:id

Update printer configuration.

**URL Parameters:**
- `id` (required): Printer ID

**Request Body:**
```json
{
  "name": "Kitchen Printer (Updated)",
  "enabled": false
}
```

**Note:** Only provided fields are updated.

**Response:** `200 OK`
```json
{
  "id": 1,
  "name": "Kitchen Printer (Updated)",
  "enabled": false,
  ...
}
```

**Status Codes:**
- `200` - Printer updated
- `400` - Invalid data
- `404` - Printer not found

---

### DELETE /api/printers/:id

Delete a printer (soft delete).

**URL Parameters:**
- `id` (required): Printer ID

**Response:** `200 OK`
```json
{
  "success": true
}
```

**Status Codes:**
- `200` - Printer deleted
- `404` - Printer not found

---

### POST /api/printers/:id/test

Test printer connection.

**URL Parameters:**
- `id` (required): Printer ID

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Connection successful"
}
```

**Status Codes:**
- `200` - Connection test completed
- `400` - Connection failed
- `404` - Printer not found

---

## WebSocket Events

Connect to `ws://127.0.0.1:8765` for real-time updates.

### Connection Event

Sent when client connects.

```json
{
  "event": "connected",
  "message": "Connected to spool service",
  "timestamp": "2025-11-10T01:00:00.000Z"
}
```

### Job Events

All job events follow this format:

```json
{
  "event": "job:created|approved|rejected|printing|completed|failed|deleted",
  "data": {
    "id": 42,
    ...additional context...
  },
  "timestamp": "2025-11-10T01:00:00.000Z"
}
```

**Event Types:**
- `job:created` - New job submitted
- `job:approved` - Job approved
- `job:rejected` - Job rejected
- `job:printing` - Job sent to printer
- `job:completed` - Print successful
- `job:failed` - Print failed
- `job:deleted` - Job deleted

---

## Error Handling

### Error Response Format

All errors return JSON with this format:

```json
{
  "error": "Error message here"
}
```

### HTTP Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error, invalid state transition)
- `404` - Not Found
- `500` - Internal Server Error

### Common Errors

**Invalid State Transition:**
```json
{
  "error": "Invalid state transition: rejected -> completed"
}
```

**Job Not Found:**
```json
{
  "error": "Job 999 not found"
}
```

**Invalid Data:**
```json
{
  "error": "rawData must be array of bytes"
}
```

---

## Examples

### Example 1: Submit and Approve Job

```bash
# 1. Submit job
curl -X POST http://127.0.0.1:3000/api/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "rawData": [27, 64, 72, 101, 108, 108, 111, 10],
    "printerId": 1,
    "user": "pos-system",
    "notes": "Test receipt"
  }'

# Response: {"id": 42, "status": "pending", ...}

# 2. Approve job
curl -X POST http://127.0.0.1:3000/api/jobs/42/approve \
  -H "Content-Type: application/json" \
  -d '{
    "user": "manager",
    "autoPrint": true
  }'

# Response: {"id": 42, "status": "approved", ...}
```

### Example 2: List Pending Jobs

```bash
curl http://127.0.0.1:3000/api/jobs?status=pending&limit=10
```

### Example 3: Register Printer

```bash
curl -X POST http://127.0.0.1:3000/api/printers \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Kitchen Printer",
    "model": "Netum 80-V-UL",
    "type": "physical",
    "connectionInfo": {
      "host": "192.168.1.100",
      "port": 9100
    }
  }'
```

### Example 4: WebSocket Connection (JavaScript)

```javascript
const ws = new WebSocket('ws://127.0.0.1:8765');

ws.onopen = () => {
  console.log('Connected to spool service');
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Event:', data.event, data.data);

  if (data.event === 'job:created') {
    console.log('New job:', data.data.id);
  }
};
```

---

## Job State Machine

Valid state transitions:

```
pending → approved → printing → completed
        ↓                       ↑
        rejected           failed (can retry)
```

- **pending**: Newly submitted, awaiting approval
- **approved**: Approved, ready to print
- **rejected**: Rejected, will not print (terminal)
- **printing**: Currently being sent to printer
- **completed**: Successfully printed (terminal)
- **failed**: Print failed (can retry from approved)

---

## Chain Printing

Jobs can be forwarded between spool services for multi-stage approval:

```
POS → Spool A (preview) → Spool B (manager approval) → Printer
```

Each service increments `chain_depth` and forwards using the `trace_id` for tracking.

**Configuration:**
Register upstream spool as printer with type `spool`:

```json
{
  "name": "Production Spool",
  "type": "spool",
  "connectionInfo": {
    "url": "http://production-spool:3000/api/jobs"
  }
}
```

When a job is printed to a spool printer, it's forwarded via HTTP POST.

---

## Rate Limiting

**Current Status:** Not implemented in Phase 1

Rate limiting is planned for production deployments.

---

## Versioning

API Version: `1.0.0`

Future versions will be indicated in the URL: `/api/v2/jobs`

---

## Support

For issues, questions, or feature requests:
- GitHub: https://github.com/cobyhausrath/esc-pos-preview-tools/issues
- Documentation: https://github.com/cobyhausrath/esc-pos-preview-tools/docs

---

**Last Updated:** 2025-11-10
**Session:** claude/implement-print-spool-roadmap-011CUyJsD2M6mzBwbFpY5wcA
