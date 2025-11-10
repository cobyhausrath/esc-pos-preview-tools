# ESC-POS Print Spool Service - Updated Roadmap (v2)

**Goal:** Transform esc-pos-preview-tools into a production-ready print spool preview service with accept/reject/modify capabilities.

**Date:** 2025-11-10
**Previous Analysis:** See PRINT_SPOOL_ROADMAP.md (initial assessment)
**Update Context:** Reviewed PR #3 which implements substantial printing infrastructure

---

## 🎯 Current State Analysis (Post-PR #3)

### ✅ What Already Exists (Much More Than Expected!)

#### 1. Core Parsing & Rendering ✅ PRODUCTION-READY
- **CommandParser** - Parses 9 ESC/POS command types
- **HTMLRenderer** - Renders with thermal printer styling
- **18 TypeScript tests** - All passing
- **Sample files** - minimal.bin, formatting.bin, receipt.bin
- **GitHub Pages deployment** - CI/CD active

#### 2. Printer Communication ✅ IMPLEMENTED (PR #3)
- **escpos-send CLI tool** (`bin/escpos-send.js`)
  - TCP socket client for network printers
  - Printer database with named printers (Netum 80-V-UL)
  - Stdin piping support
  - Timeout handling (5s)
  - Exit codes: 0 (success), 2 (file not found), 3 (timeout)
  - Usage: `escpos-send 192.168.1.100 9100 receipt.bin`

- **printer-bridge WebSocket server** (`bin/printer-bridge.js`)
  - WebSocket-to-TCP bridge
  - Listens on ws://127.0.0.1:8765
  - JSON protocol for printer commands
  - Health check endpoint (/health)
  - Localhost-only binding for security

#### 3. Web UI Capabilities ✅ PARTIALLY IMPLEMENTED (PR #3)
- **HEX View panel** in web editor
  - Collapsible binary inspector
  - 16 bytes per line with offset
  - ASCII representation
  - Command statistics

- **Browser-based printer controls**
  - Printer selection dropdown
  - Connection status indicator
  - WebSocket client for printer bridge
  - Real-time preview with existing HTMLRenderer

#### 4. Python Verification System ✅ COMPLETE
- **EscPosVerifier** - Bidirectional ESC/POS ↔ python-escpos converter
- **escpos_cli.py** - CLI tool for conversion
- **18 Python tests** - All passing
- **Web editor** (web/editor.html) - Pyodide-based in-browser Python execution

---

## 🔄 Architecture Innovation: Chain Printing for Verification

**User's Insight:** "A powerful verification methodology (lacking a real virtual printer) can be to 'print' onwards from one instance of our service to another"

This is brilliant! Instead of needing a printer simulator, we can chain spool services:

```
┌──────────────┐
│  POS System  │
└──────┬───────┘
       │ ESC/POS bytes
       ↓
┌──────────────────────┐
│ Spool Service #1     │
│ (Preview & Approve)  │
│  - Parse bytes       │
│  - Show preview      │
│  - User approves     │
└──────┬───────────────┘
       │ Approved job
       ↓
┌──────────────────────┐
│ Spool Service #2     │  ← Verification Mode
│ (Testing/Staging)    │
│  - Re-parse bytes    │
│  - Log differences   │
│  - Final verification│
└──────┬───────────────┘
       │ Final approval
       ↓
┌──────────────┐
│ Real Printer │
└──────────────┘
```

### Benefits:
1. **No printer simulator needed** - Each service acts as verification step
2. **Production-realistic testing** - Same code path as production
3. **Multi-stage approval** - Preview → Manager Review → Final Print
4. **A/B testing** - Send same job to multiple services for comparison
5. **Audit trail** - Track job through entire pipeline

### Implementation:
- Each spool service can be configured as a "forwarder"
- Add endpoint: `POST /api/printers` with type: "spool" (another service) or "physical" (real printer)
- Chain services by setting upstream service URL as "printer"

---

## 📊 Gap Analysis Update

### ✅ Already Implemented (From PR #3)
- ✅ TCP printer communication (escpos-send)
- ✅ WebSocket bridge (printer-bridge)
- ✅ Printer device registry (hardcoded in PRINTERS object)
- ✅ Basic web UI for printer interaction
- ✅ HEX view for debugging
- ✅ Named printer support
- ✅ Stdin piping for CLI
- ✅ Health check endpoint

### ❌ Still Missing for Full Spool Service
- ❌ **Job queue with state management** (pending/approved/rejected)
- ❌ **Job persistence** (database or file storage)
- ❌ **REST API for job management** (submit, approve, reject, list)
- ❌ **Authentication/authorization** (multi-user support)
- ❌ **Web dashboard for approval workflow** (job list, preview, actions)
- ❌ **Job modification capabilities** (edit before print)
- ❌ **Job history and audit logs**
- ❌ **Real-time job status updates** (WebSocket notifications)
- ❌ **Configurable printer registry** (database, not hardcoded)

---

## 🎯 Updated Prioritized Roadmap

### Phase 1: MVP Spool Service (2-3 weeks, 80-120 hours) ⭐⭐⭐⭐⭐

**Goal:** Basic working spool with approval workflow, building on PR #3 infrastructure

#### Priority 1A: Job Queue & Storage (Week 1)
**Effort:** 25-35 hours | **Status:** NEW | **Value:** ⭐⭐⭐⭐⭐ CRITICAL

**Use SQLite instead of PostgreSQL** (user preference):

**Tasks:**
1. **Setup SQLite database**
   - [ ] Create `server/db/` directory
   - [ ] Define schema with better-sqlite3 or Knex.js
   - [ ] Tables:
     - `jobs` - id, created_at, status, raw_data (BLOB), parsed_json, printer_name, user, notes
     - `printers` - id, name, model, type (physical/spool), connection_info (JSON), enabled
     - `job_history` - id, job_id, timestamp, old_status, new_status, user, notes
     - `users` - id, username, password_hash, role, created_at (for Phase 2)
   - [ ] Migration system (simple .sql files)
   - [ ] Create initial migration

2. **Job data model & queue**
   - [ ] Job states: `pending`, `approved`, `rejected`, `printing`, `completed`, `failed`
   - [ ] State transition validation (FSM)
   - [ ] Job CRUD operations (create, read, update, delete)
   - [ ] Queue operations: list by status, filter, sort by date
   - [ ] Auto-cleanup: delete completed jobs after N days

3. **Persistence layer**
   - [ ] JobRepository class (CRUD + queries)
   - [ ] PrinterRepository class
   - [ ] Transaction support for state changes
   - [ ] Connection pooling (single writer for SQLite)

**Why SQLite:**
- ✅ Zero configuration (no separate server)
- ✅ Single file database (easy backup/restore)
- ✅ Perfect for single-instance spool service
- ✅ Sufficient performance for typical print volumes
- ✅ Can upgrade to PostgreSQL later if needed

**Deliverable:** Persistent job storage with SQLite

---

#### Priority 1B: REST API Server (Week 1-2)
**Effort:** 30-40 hours | **Status:** PARTIAL | **Value:** ⭐⭐⭐⭐⭐ CRITICAL

**Leverage existing printer-bridge.js as foundation**

**Tasks:**
1. **Expand printer-bridge into full API server**
   - [ ] Rename/refactor: `server/api-server.js`
   - [ ] Keep WebSocket server (already implemented)
   - [ ] Add Express HTTP server alongside WebSocket
   - [ ] Integrate SQLite database
   - [ ] Add middleware: body-parser, CORS, logging (Winston/Pino)

2. **Job management API endpoints**
   - [ ] `POST /api/jobs` - Submit new job
     - Accept raw bytes (base64) or file upload
     - Parse ESC/POS using existing CommandParser
     - Generate preview HTML using HTMLRenderer
     - Store in database with status=pending
     - Return job ID and preview

   - [ ] `GET /api/jobs` - List jobs
     - Query params: status, date_from, date_to, printer
     - Pagination support
     - Return job list with metadata

   - [ ] `GET /api/jobs/:id` - Get job details
     - Return full job data + preview HTML

   - [ ] `POST /api/jobs/:id/approve` - Approve job
     - Validate state transition (pending → approved)
     - Update status in database
     - Trigger printing (if auto-print enabled)
     - Emit WebSocket event

   - [ ] `POST /api/jobs/:id/reject` - Reject job
     - Add rejection reason in body
     - Update status in database
     - Store reason in job_history
     - Emit WebSocket event

   - [ ] `DELETE /api/jobs/:id` - Cancel/delete job
     - Only if pending or rejected
     - Soft delete (mark as deleted)

3. **Printer management API** (expand existing)
   - [ ] `GET /api/printers` - List configured printers
     - Return all from database (not hardcoded)

   - [ ] `POST /api/printers` - Register new printer
     - Support types: physical (TCP), spool (URL), usb (future)
     - Validate connection on registration
     - Store in database

   - [ ] `GET /api/printers/:id` - Get printer details
   - [ ] `PUT /api/printers/:id` - Update printer
   - [ ] `DELETE /api/printers/:id` - Remove printer
   - [ ] `POST /api/printers/:id/test` - Test printer connection

4. **Job printing workflow** (expand existing sendToSocket)
   - [ ] Print job automatically on approval (configurable)
   - [ ] Or manually trigger: `POST /api/jobs/:id/print`
   - [ ] Support printer types:
     - Physical: Use existing TCP socket code
     - Spool: HTTP POST to another spool service (chain printing!)
   - [ ] Update job status: approved → printing → completed/failed
   - [ ] Retry logic: 3 attempts with exponential backoff
   - [ ] Store print result in job_history

5. **Health & monitoring**
   - [ ] `GET /health` - Already exists, expand with database check
   - [ ] `GET /api/stats` - Queue statistics (pending count, etc.)
   - [ ] `GET /api/version` - API version info

**Deliverable:** Full REST API for job and printer management

---

#### Priority 1C: Web Dashboard UI (Week 2-3)
**Effort:** 35-45 hours | **Status:** PARTIAL | **Value:** ⭐⭐⭐⭐⭐ CRITICAL

**Build on existing web/editor.html foundation**

**Tasks:**
1. **Job queue dashboard** (new page: `web/dashboard.html`)
   - [ ] Use vanilla JS or lightweight framework (Alpine.js, Petite-Vue)
   - [ ] Job list view with tabs:
     - Pending (needs approval)
     - Approved (waiting to print / printing)
     - Completed
     - Rejected
   - [ ] Each job card shows:
     - Job ID, timestamp
     - Preview thumbnail (use existing HTMLRenderer)
     - Printer name
     - Action buttons (Approve / Reject / View)

2. **Job detail modal**
   - [ ] Full-size preview (reuse HTMLRenderer from existing code)
   - [ ] HEX view (reuse from editor.html)
   - [ ] Job metadata (submitted by, timestamp, etc.)
   - [ ] Action buttons:
     - Approve (if pending)
     - Reject (if pending) - with reason text field
     - Print (if approved and not auto-print)
     - Download raw bytes
     - View history

3. **Real-time updates** (expand existing WebSocket)
   - [ ] Subscribe to job events via WebSocket
   - [ ] Events:
     - `job:created` - New job submitted
     - `job:approved` - Job approved
     - `job:rejected` - Job rejected
     - `job:printing` - Job sent to printer
     - `job:completed` - Print succeeded
     - `job:failed` - Print failed
   - [ ] Update UI in real-time (no polling needed)
   - [ ] Toast notifications for events

4. **Printer management UI**
   - [ ] Printer list view
   - [ ] Add printer form (name, type, IP, port)
   - [ ] Test connection button
   - [ ] Enable/disable toggle
   - [ ] Status indicators (online/offline)

5. **Configuration page**
   - [ ] Auto-print toggle (approve → print immediately)
   - [ ] Default printer selection
   - [ ] Job retention period (days)
   - [ ] Other settings

**Deliverable:** Full web dashboard for job approval workflow

---

### Phase 2: Enhanced Features (1-2 weeks, 50-70 hours) ⭐⭐⭐⭐

#### Priority 2A: Job Modification (Week 4)
**Effort:** 25-35 hours | **Value:** ⭐⭐⭐⭐ HIGH

**Leverage existing Python verification system**

**Tasks:**
1. **Integrate Python verifier into API**
   - [ ] Add endpoint: `POST /api/jobs/:id/to-python`
     - Parse job bytes using EscPosVerifier
     - Generate python-escpos code
     - Return editable code

   - [ ] Add endpoint: `POST /api/jobs/:id/modify`
     - Accept modified python-escpos code
     - Execute with EscPosVerifier (validate=True for security)
     - Generate new ESC/POS bytes
     - Update job with modified bytes
     - Mark as "modified" in metadata
     - Store original + modified in job_history

2. **Modification UI** (expand editor.html)
   - [ ] "Edit Job" button in job detail modal
   - [ ] Loads existing web/editor.html in iframe or modal
   - [ ] Pre-populate with generated python-escpos code
   - [ ] Live preview while editing
   - [ ] Save modified job back to queue
   - [ ] Show "modified" badge on job cards

3. **Receipt templates**
   - [ ] New table: `templates` - id, name, code, description
   - [ ] API: CRUD for templates
   - [ ] UI: Template library in editor
   - [ ] Apply template to new job
   - [ ] Variable substitution (e.g., {{date}}, {{total}})

**Deliverable:** Can modify receipts before printing

---

#### Priority 2B: Authentication & Multi-User (Week 4-5)
**Effort:** 25-35 hours | **Value:** ⭐⭐⭐⭐ HIGH (if multi-user needed)

**Tasks:**
1. **User authentication**
   - [ ] JWT token-based auth
   - [ ] Login endpoint: `POST /api/auth/login`
   - [ ] Register endpoint: `POST /api/auth/register` (admin only)
   - [ ] Logout endpoint: `POST /api/auth/logout`
   - [ ] Token validation middleware
   - [ ] Session management (store sessions in SQLite)

2. **Role-based access control (RBAC)**
   - [ ] Roles: admin, operator, viewer, api_client
   - [ ] Permissions:
     - admin: all operations
     - operator: approve/reject/modify jobs
     - viewer: read-only access
     - api_client: submit jobs only (for POS systems)
   - [ ] Authorization middleware
   - [ ] API key support (for api_client role)

3. **User management UI**
   - [ ] User list (admin only)
   - [ ] Add/edit user form
   - [ ] Role assignment
   - [ ] API key generation

4. **Audit logging**
   - [ ] Log all job actions with user ID
   - [ ] Log configuration changes
   - [ ] Log authentication events
   - [ ] View audit log (admin only)

**Note:** Can defer to Phase 3 if single-user is acceptable for MVP

**Deliverable:** Secure multi-user system

---

### Phase 3: Production-Ready (1-2 weeks, 40-60 hours) ⭐⭐⭐

#### Priority 3A: Chain Printing & Service-to-Service (Week 5-6)
**Effort:** 20-30 hours | **Value:** ⭐⭐⭐⭐⭐ HIGH (innovative verification!)

**Implement the chain printing concept**

**Tasks:**
1. **Spool printer type**
   - [ ] Extend printer types: physical, spool, usb
   - [ ] For type=spool, store upstream URL
   - [ ] Example: `http://spool-staging.local:3000/api/jobs`

2. **Service-to-service API**
   - [ ] When printing to type=spool:
     - POST job to upstream spool service
     - Include metadata: chain_depth, origin, trace_id
     - Receive upstream job ID
     - Store upstream job ID in metadata

   - [ ] Add headers for tracing:
     - X-Spool-Chain-Depth: 1, 2, 3...
     - X-Spool-Origin: <original-service-id>
     - X-Spool-Trace-ID: <uuid>

   - [ ] Max chain depth validation (prevent infinite loops)

3. **Verification dashboard**
   - [ ] Show chain path for each job
   - [ ] Compare parse results across services
   - [ ] Highlight any differences
   - [ ] Visual chain diagram

4. **Testing setup**
   - [ ] Docker Compose with 3 services:
     - spool-dev (port 3000)
     - spool-staging (port 3001)
     - spool-prod (port 3002)
   - [ ] Example workflow:
     ```bash
     # Submit to dev
     curl -X POST http://localhost:3000/api/jobs \
       -F "file=@receipt.bin" \
       -F "printer=staging-spool"

     # Dev forwards to staging
     # Staging forwards to prod
     # Prod sends to physical printer
     ```

**Deliverable:** Multi-stage approval pipeline with service chaining

---

#### Priority 3B: Deployment & Operations (Week 6)
**Effort:** 20-30 hours | **Value:** ⭐⭐⭐ MEDIUM

**Tasks:**
1. **Docker containerization**
   - [ ] Dockerfile for API server
   - [ ] Multi-stage build (dev + production)
   - [ ] Docker Compose for full stack
     - API server
     - SQLite volume mount (or use external DB)
   - [ ] Environment variables for configuration

2. **Production setup**
   - [ ] Reverse proxy config (Nginx)
   - [ ] SSL/TLS certificates (Let's Encrypt)
   - [ ] Process management (PM2 or systemd)
   - [ ] Log rotation (Winston transports)
   - [ ] Backup scripts for SQLite database

3. **Monitoring**
   - [ ] Prometheus metrics endpoint
   - [ ] Grafana dashboard (optional)
   - [ ] Error tracking (Sentry or similar)
   - [ ] Health check endpoint (expand existing)

4. **Documentation**
   - [ ] Installation guide
   - [ ] Configuration reference
   - [ ] API documentation (OpenAPI/Swagger)
   - [ ] Troubleshooting guide
   - [ ] Chain printing setup guide

**Deliverable:** Production-ready deployment

---

### Phase 4: Advanced Features (Future) ⭐⭐

#### High-Value Additions (As Needed)

**Command Coverage Expansion:**
- [ ] **Graphics/Logos** (ESC *, GS v) - HIGH PRIORITY
- [ ] **Barcodes** (GS k) - HIGH PRIORITY
- [ ] **QR Codes** (GS ( k) - MEDIUM PRIORITY
- [ ] **International characters** (codepages) - MEDIUM

**Printer Support:**
- [ ] **USB printers** (node-printer, node-usb)
- [ ] **Auto-discovery** (mDNS/Bonjour)
- [ ] **Printer pooling** (round-robin, load balancing)

**Advanced Queue Features:**
- [ ] **Job scheduling** (print at specific time)
- [ ] **Priority levels** (urgent, normal, low)
- [ ] **Batch operations** (approve multiple, bulk modify)
- [ ] **Rules engine** (auto-approve based on criteria)

**Enterprise Features:**
- [ ] **Multi-tenancy** (separate queues per organization)
- [ ] **Advanced reporting** (charts, analytics, trends)
- [ ] **Email/SMS notifications**
- [ ] **Mobile app** (React Native or PWA)

---

## 🏗️ Recommended Architecture (Updated)

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                             │
├─────────────────────────────────────────────────────────────────┤
│  POS Systems  │  Web Dashboard  │  Mobile App  │  Admin Panel   │
│  (HTTP API)   │  (WebSocket)    │  (Future)    │  (HTTP)        │
└────────┬──────────────┬──────────────┬─────────────┬────────────┘
         │              │              │             │
         └──────────────┴──────────────┴─────────────┘
                        │
                        ↓
┌─────────────────────────────────────────────────────────────────┐
│                      API SERVER (Node.js)                        │
│                   ALREADY STARTED IN PR #3!                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │           Express HTTP Server + WebSocket               │  │
│  │              (expand printer-bridge.js)                  │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │  REST API  │ WebSocket │  Job Queue │  Print Manager    │  │
│  │  (NEW)     │ (EXISTS)  │  (NEW)     │  (EXISTS)         │  │
│  └──────┬────────────┬────────────┬─────────────┬───────────┘  │
│         │            │            │             │               │
│         ↓            ↓            ↓             ↓               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐         │
│  │   Job    │ │  Printer │ │  Python  │ │   HEX    │         │
│  │  Service │ │  Manager │ │ Verifier │ │  Viewer  │         │
│  │  (NEW)   │ │ (EXISTS) │ │ (EXISTS) │ │ (EXISTS) │         │
│  └──────┬───┘ └──────┬───┘ └──────┬───┘ └──────┬───┘         │
│         │            │            │             │               │
│         └────────────┴────────────┴─────────────┘               │
│                      │                                           │
└──────────────────────┼───────────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
        ↓              ↓              ↓
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│   SQLite    │ │  File Store │ │   Upstream  │
│   (NEW)     │ │  (Backups)  │ │    Spool    │
│             │ │             │ │  (Chain!)   │
│  - jobs     │ │             │ │             │
│  - printers │ │             │ │             │
│  - history  │ │             │ │             │
│  - users    │ │             │ │             │
└─────────────┘ └─────────────┘ └─────────────┘
                       │
                       ↓
        ┌──────────────────────────────┐
        │     PRINTER LAYER            │
        ├──────────────────────────────┤
        │  ┌────────┐  ┌────────┐     │
        │  │ TCP/IP │  │  USB   │     │
        │  │Printer │  │Printer │     │
        │  │(EXISTS)│  │(FUTURE)│     │
        │  └────────┘  └────────┘     │
        └──────────────────────────────┘
```

**KEY INSIGHT:** Much of the infrastructure already exists from PR #3!
- ✅ WebSocket server (printer-bridge.js)
- ✅ TCP printer communication (escpos-send.js)
- ✅ Printer registry concept (PRINTERS object)
- ✅ Web UI foundation (editor.html)
- ✅ Python verification (EscPosVerifier)

**What's left:** Add job queue, REST API, database, and web dashboard!

---

## 📝 Updated Effort Estimates

| Phase | Priority | Component | Effort (hrs) | Value | Status | Notes |
|-------|----------|-----------|--------------|-------|--------|-------|
| **MVP** | | | | | | |
| 1A | ⭐⭐⭐⭐⭐ | Job Queue + SQLite | 25-35 | CRITICAL | NEW | Simpler than PostgreSQL |
| 1B | ⭐⭐⭐⭐⭐ | REST API Server | 30-40 | CRITICAL | EXPAND | Build on printer-bridge.js |
| 1C | ⭐⭐⭐⭐⭐ | Web Dashboard | 35-45 | CRITICAL | EXPAND | Build on editor.html |
| **Enhanced** | | | | | | |
| 2A | ⭐⭐⭐⭐ | Job Modification | 25-35 | HIGH | INTEGRATE | Use existing verifier |
| 2B | ⭐⭐⭐⭐ | Auth/Multi-user | 25-35 | HIGH | NEW | Optional for MVP |
| **Production** | | | | | | |
| 3A | ⭐⭐⭐⭐⭐ | Chain Printing | 20-30 | HIGH | NEW | Innovative verification! |
| 3B | ⭐⭐⭐ | Deployment | 20-30 | MEDIUM | NEW | Docker, monitoring |
| **Advanced** | | | | | | |
| 4 | ⭐⭐ | Future | 50+ | LOW | NEW | As needed |

**TOTAL MVP (Phase 1):** 90-120 hours (DOWN from 120-150!)
**TOTAL Full Featured (Phase 1-3):** 160-230 hours (DOWN from 245-350!)

**Reduction reason:** Substantial printer infrastructure already exists in PR #3!

---

## 🚀 Quick Start (Leveraging PR #3)

### Week 1: Setup Foundation
```bash
# 1. Merge PR #3 (if not already)
git checkout main
git merge --no-ff pr-3-branch

# 2. Install dependencies
yarn install

# 3. Test existing CLI tools
node bin/escpos-send.js --help
node bin/printer-bridge.js --help

# 4. Start printer bridge (test existing infra)
node bin/printer-bridge.js
# Opens on ws://127.0.0.1:8765

# 5. Test printer communication
echo -ne '\x1B\x40Hello\x0A\x1D\x56\x00' | \
  node bin/escpos-send.js 192.168.1.100 9100
```

### Week 1-2: Add Job Queue
```bash
# 1. Setup SQLite
mkdir -p server/db
yarn add better-sqlite3

# 2. Create schema (server/db/schema.sql)
# 3. Create JobRepository (server/repositories/JobRepository.js)
# 4. Create migration system
# 5. Test CRUD operations
```

### Week 2: Build REST API
```bash
# 1. Refactor printer-bridge.js → server/api-server.js
# 2. Add Express HTTP server
# 3. Implement job endpoints (POST, GET, PUT, DELETE)
# 4. Integrate CommandParser and HTMLRenderer
# 5. Add job approval/rejection
# 6. Test with curl/Postman
```

### Week 3: Create Web Dashboard
```bash
# 1. Create web/dashboard.html
# 2. Reuse HTMLRenderer from existing code
# 3. Reuse HEX viewer from editor.html
# 4. Add WebSocket client (reuse from editor.html)
# 5. Build job list UI
# 6. Build job detail modal
# 7. Test end-to-end workflow
```

### Week 4: Test Chain Printing
```bash
# 1. Add spool printer type
# 2. Configure Service A → Service B → Printer
# 3. Submit job to Service A
# 4. Verify forwarding to Service B
# 5. Verify final print
# 6. Check audit trail across services
```

---

## 💡 Key Architectural Decisions

### 1. Database: SQLite (User Preference) ✅
**Rationale:**
- ✅ Zero configuration
- ✅ Single file, easy backup
- ✅ Perfect for single-instance spool
- ✅ Sufficient performance (<1000 jobs/day)
- ✅ Can upgrade to PostgreSQL if needed
- ⚠️ Limitation: Single writer (fine for spool service)

**Migration path to PostgreSQL:**
- Keep repository abstraction
- Swap better-sqlite3 → pg
- Update connection handling
- No application logic changes needed

### 2. Expand Existing printer-bridge.js ✅
**Rationale:**
- ✅ Already has WebSocket server
- ✅ Already has TCP socket client
- ✅ Already has printer registry concept
- ✅ Already has health endpoint
- ✅ Proven to work
- ➕ Add Express HTTP alongside WebSocket
- ➕ Add database integration
- ➕ Add job queue logic

**Alternative considered:** Start from scratch
- ❌ Would duplicate existing code
- ❌ More work
- ❌ Lose proven printer communication

### 3. Chain Printing for Verification ✅ INNOVATIVE
**Rationale:**
- ✅ No printer simulator needed
- ✅ Production-realistic testing
- ✅ Multi-stage approval
- ✅ A/B testing capability
- ✅ Complete audit trail
- ✅ Simple to implement (HTTP POST)
- ✅ Scales horizontally

**Use cases:**
1. **Dev → Staging → Production**
2. **Preview → Manager Approval → Final**
3. **Primary → Backup** (redundancy)
4. **Splitter:** One input → Multiple outputs (for testing)

### 4. Keep Python Verification Separate ✅
**Rationale:**
- ✅ Already works well
- ✅ Pyodide overhead unnecessary for main flow
- ✅ Use only when modification needed
- ✅ API endpoint for on-demand conversion
- ✅ Reuse existing web/editor.html

**Integration points:**
- Job detail modal: "Edit" button → Opens editor
- API: POST /api/jobs/:id/to-python
- API: POST /api/jobs/:id/modify

---

## 🎯 Success Criteria

### MVP Success (Phase 1):
- [ ] Can submit ESC/POS jobs via HTTP API
- [ ] Jobs stored in SQLite database
- [ ] Can preview jobs in web dashboard (using existing HTMLRenderer)
- [ ] Can approve/reject jobs
- [ ] Approved jobs automatically forward to configured printer
- [ ] Printer can be: physical (TCP) or spool (another service)
- [ ] Real-time UI updates via WebSocket
- [ ] HEX view for debugging
- [ ] Works with existing escpos-send and printer-bridge tools

### Phase 2 Success:
- [ ] Can modify jobs before printing (using Python verifier)
- [ ] Multi-user with authentication (if needed)
- [ ] Template library

### Phase 3 Success:
- [ ] Chain printing works (service → service → printer)
- [ ] Docker deployment ready
- [ ] Production monitoring
- [ ] Complete API documentation

---

## 🤔 Implementation Questions

### Clarifications Needed:

1. **Timeline:**
   - MVP in 2-3 weeks acceptable?
   - Or need faster minimal version (1 week)?

2. **Authentication:**
   - Single-user (simpler) or multi-user from start?
   - API keys for POS systems needed immediately?

3. **Printer setup:**
   - How many printers to support initially?
   - Netum 80-V-UL only? Or others?
   - USB support needed in Phase 1?

4. **Chain printing:**
   - How many stages in typical workflow?
   - Dev → Staging → Prod? Or simpler?

5. **Job retention:**
   - Keep completed jobs for how long?
   - Archive strategy?

6. **Auto-print:**
   - Approved jobs print immediately? Or manual trigger?

---

## 📚 Resources & Next Steps

### Key Files to Reference (From PR #3):
- `bin/escpos-send.js` - TCP printer client
- `bin/printer-bridge.js` - WebSocket bridge
- `web/editor.html` - HEX viewer, WebSocket client, HTMLRenderer integration
- `src/parser/CommandParser.ts` - ESC/POS parser
- `src/renderer/HTMLRenderer.ts` - Preview renderer
- `python/escpos_verifier.py` - Python verification

### Recommended Libraries:
- **Database:** better-sqlite3 (fast, simple) or Knex.js (query builder)
- **HTTP Server:** Express.js (already in package.json!)
- **WebSocket:** ws (already in package.json and used in printer-bridge!)
- **Auth:** jsonwebtoken, bcryptjs
- **Logging:** Winston or Pino
- **Validation:** joi or zod

### Immediate Next Steps:

1. **✅ Merge PR #3** (if not already merged)
2. **🧪 Test existing infrastructure**
   - Run printer-bridge.js
   - Test escpos-send.js with real printer
   - Verify web/editor.html works
3. **📝 Finalize requirements**
   - Answer implementation questions above
   - Confirm MVP scope
4. **🚀 Start Phase 1A** (Job Queue + SQLite)
   - Create database schema
   - Implement JobRepository
   - Write tests

---

**Ready to start implementation?** 🚀

The foundation from PR #3 is excellent! We're much closer than the initial roadmap suggested.

**Estimated time to working MVP: 2-3 weeks** (down from 4 weeks in v1!)

---

**Last Updated:** 2025-11-10
**Session:** claude/prioritize-next-level-tasks-011CUyFfD2A6jT6X9bWYLgqR
**Previous Version:** PRINT_SPOOL_ROADMAP.md (initial assessment, pre-PR#3)
