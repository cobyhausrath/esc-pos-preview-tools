# ESC-POS Print Spool Service - Prioritized Roadmap

**Goal:** Transform esc-pos-preview-tools from a client-side library into a production-ready print spool preview service with accept/reject/modify capabilities.

**Current State:** Excellent ESC/POS parser/renderer library with zero backend infrastructure

**Estimated Total Effort:** 245-350 hours (6-9 weeks full-time)

---

## 🎯 MVP (Minimum Viable Product) - Phase 1
**Goal:** Basic working print spool with preview and approval workflow
**Timeline:** 3-4 weeks
**Effort:** 120-150 hours

### Priority 1: Core Backend Server (Week 1)
**Effort:** 40-60 hours | **Value:** ⭐⭐⭐⭐⭐ CRITICAL

#### Tasks:
1. **Setup server infrastructure**
   - [ ] Create `server/` directory structure
   - [ ] Initialize Express.js server with TypeScript
   - [ ] Setup basic middleware (body-parser, CORS, logging)
   - [ ] Add environment configuration (.env, config management)
   - [ ] Create health check endpoint (`GET /health`)

2. **Basic API endpoints**
   - [ ] `POST /api/jobs` - Submit new print job (accept raw ESC/POS bytes or base64)
   - [ ] `GET /api/jobs` - List all jobs with filtering (pending/approved/rejected)
   - [ ] `GET /api/jobs/:id` - Get specific job details
   - [ ] `POST /api/jobs/:id/approve` - Approve job for printing
   - [ ] `POST /api/jobs/:id/reject` - Reject job

3. **Integration with existing parser**
   - [ ] Import CommandParser from existing src/
   - [ ] Parse incoming ESC/POS data on job submission
   - [ ] Generate HTML preview using HTMLRenderer
   - [ ] Store both raw bytes and parsed data

4. **Basic error handling**
   - [ ] Standardized error response format
   - [ ] Input validation middleware
   - [ ] 400/404/500 error handlers
   - [ ] Request logging (Winston or Pino)

**Deliverable:** Working HTTP API that can receive, store, and manage print jobs

---

### Priority 2: Simple Job Queue (Week 1-2)
**Effort:** 30-40 hours | **Value:** ⭐⭐⭐⭐⭐ CRITICAL

#### Tasks:
1. **In-memory queue (MVP, no Redis yet)**
   - [ ] Create JobQueue class with array-based storage
   - [ ] Job states: pending → approved/rejected → printing → completed/failed
   - [ ] Job model: id, timestamp, data, status, metadata
   - [ ] Queue operations: enqueue, dequeue, peek, filter by status

2. **Job lifecycle management**
   - [ ] State machine for job transitions
   - [ ] Validation rules (can't approve rejected jobs, etc.)
   - [ ] Job metadata: submitter, timestamps, approval user
   - [ ] Job history tracking (state change log)

3. **Basic persistence (JSON file for MVP)**
   - [ ] Serialize queue to disk on changes
   - [ ] Load queue from disk on startup
   - [ ] File locking for concurrent access
   - [ ] Auto-save every N seconds or on change

4. **Queue management API**
   - [ ] `GET /api/queue/pending` - Get pending jobs count
   - [ ] `GET /api/queue/stats` - Queue statistics
   - [ ] `DELETE /api/jobs/:id` - Cancel/remove job

**Deliverable:** Working job queue with state management and persistence

---

### Priority 3: Basic Printer Communication (Week 2-3)
**Effort:** 50-70 hours | **Value:** ⭐⭐⭐⭐⭐ CRITICAL

#### Tasks:
1. **TCP socket client for network printers**
   - [ ] Create PrinterManager class
   - [ ] TCP socket connection using Node.js `net` module
   - [ ] Printer registration (IP, port, name, model)
   - [ ] Send ESC/POS bytes to printer
   - [ ] Basic error handling (connection timeout, refused)

2. **Printer device registry**
   - [ ] Printer configuration schema (use existing printers.ts as base)
   - [ ] Store printer configs in JSON file (upgrade to DB later)
   - [ ] `GET /api/printers` - List registered printers
   - [ ] `POST /api/printers` - Register new printer
   - [ ] `DELETE /api/printers/:id` - Remove printer
   - [ ] `GET /api/printers/:id/status` - Check printer status

3. **Job printing workflow**
   - [ ] Auto-send approved jobs to printer
   - [ ] Job → Printer assignment (default or user-selected)
   - [ ] Print success/failure handling
   - [ ] Update job status after print attempt
   - [ ] Retry logic for failed prints (simple: 3 retries max)

4. **Printer status monitoring (basic)**
   - [ ] Ping/connection test
   - [ ] Last successful print timestamp
   - [ ] Simple online/offline status
   - [ ] Store status in printer config

**Deliverable:** Can send approved jobs to real ESC/POS printers over TCP

---

## 🚀 Phase 2: Enhanced Features
**Goal:** Add database, authentication, and web UI
**Timeline:** 2-3 weeks
**Effort:** 90-130 hours

### Priority 4: Database & Persistence (Week 4)
**Effort:** 20-30 hours | **Value:** ⭐⭐⭐⭐ HIGH

#### Tasks:
1. **Database setup (PostgreSQL recommended)**
   - [ ] Install and configure PostgreSQL
   - [ ] Create database schema
     - `jobs` table (id, created_at, status, raw_data, parsed_data, printer_id, user_id)
     - `printers` table (id, name, model, ip, port, status, config)
     - `job_history` table (job_id, timestamp, old_status, new_status, user_id, notes)
     - `users` table (id, username, email, role, created_at)
   - [ ] Database migrations system (node-pg-migrate or Prisma)

2. **ORM integration**
   - [ ] Choose ORM (Prisma recommended, or TypeORM)
   - [ ] Define models matching schema
   - [ ] Create database repositories/services
   - [ ] Replace in-memory queue with DB queries

3. **Job archiving**
   - [ ] Archive completed/rejected jobs after N days
   - [ ] Archive table or separate database
   - [ ] Cleanup script/cron job
   - [ ] Export archived jobs to files

**Deliverable:** Persistent storage with proper database

---

### Priority 5: Authentication & Authorization (Week 4-5)
**Effort:** 30-40 hours | **Value:** ⭐⭐⭐⭐ HIGH

#### Tasks:
1. **User authentication**
   - [ ] User registration endpoint
   - [ ] Login endpoint (JWT tokens)
   - [ ] Password hashing (bcrypt)
   - [ ] Token validation middleware
   - [ ] Refresh token support

2. **Role-based access control (RBAC)**
   - [ ] Roles: admin, operator, viewer, printer (API client)
   - [ ] Permissions matrix:
     - admin: all operations
     - operator: approve/reject/modify jobs
     - viewer: read-only access
     - printer: submit jobs only
   - [ ] Authorization middleware
   - [ ] API key support for printer clients

3. **Audit logging**
   - [ ] Log all job approvals/rejections with user ID
   - [ ] Log configuration changes
   - [ ] Log authentication events
   - [ ] Audit log API endpoint

**Deliverable:** Secure multi-user system with role-based access

---

### Priority 6: Web Dashboard UI (Week 5-6)
**Effort:** 40-60 hours | **Value:** ⭐⭐⭐⭐ HIGH

#### Tasks:
1. **Job queue dashboard**
   - [ ] Choose frontend framework (React/Vue/Svelte or vanilla)
   - [ ] Setup build system (Vite recommended)
   - [ ] Job list view (pending, approved, rejected tabs)
   - [ ] Job detail modal with preview
   - [ ] Integrate existing HTMLRenderer for preview
   - [ ] Approval/rejection buttons
   - [ ] Real-time updates via polling (WebSocket in Phase 3)

2. **Printer management UI**
   - [ ] Printer list view
   - [ ] Add/edit/delete printer forms
   - [ ] Printer status indicators
   - [ ] Test print button

3. **Job history viewer**
   - [ ] Searchable/filterable job history
   - [ ] Date range picker
   - [ ] Export to CSV
   - [ ] Job statistics (success rate, avg time, etc.)

4. **Configuration interface**
   - [ ] User management (admin only)
   - [ ] System settings
   - [ ] Queue settings (auto-print, retry count, etc.)

**Deliverable:** Full-featured web interface for job management

---

## 🎨 Phase 3: Production-Ready Features
**Goal:** Add real-time updates, advanced features, deployment
**Timeline:** 1-2 weeks
**Effort:** 65-100 hours

### Priority 7: Real-time Communication (Week 7)
**Effort:** 20-30 hours | **Value:** ⭐⭐⭐ MEDIUM

#### Tasks:
1. **WebSocket server**
   - [ ] Add Socket.IO or ws library
   - [ ] WebSocket authentication
   - [ ] Room-based subscriptions (by queue, printer, job)

2. **Real-time events**
   - [ ] `job:created` - New job submitted
   - [ ] `job:approved` - Job approved
   - [ ] `job:rejected` - Job rejected
   - [ ] `job:printing` - Job sent to printer
   - [ ] `job:completed` - Job printed successfully
   - [ ] `job:failed` - Print failed
   - [ ] `printer:status` - Printer status change

3. **Web UI integration**
   - [ ] WebSocket client in dashboard
   - [ ] Live job list updates
   - [ ] Toast notifications for events
   - [ ] Live printer status updates

**Deliverable:** Real-time dashboard updates without polling

---

### Priority 8: Advanced Job Modification (Week 7-8)
**Effort:** 25-35 hours | **Value:** ⭐⭐⭐ MEDIUM

#### Tasks:
1. **Job editing capabilities**
   - [ ] Parse ESC/POS → editable format (text, formatting)
   - [ ] In-browser editor for modifying receipt content
   - [ ] Regenerate ESC/POS from edited content
   - [ ] `POST /api/jobs/:id/modify` - Update job data
   - [ ] Track modifications in job history

2. **Receipt templates**
   - [ ] Template management system
   - [ ] Save common receipt formats as templates
   - [ ] Apply template to job
   - [ ] Variable substitution in templates

3. **Batch operations**
   - [ ] Approve/reject multiple jobs
   - [ ] Bulk modify (e.g., change all to specific printer)
   - [ ] Batch export

**Deliverable:** Can modify receipt content before printing

---

### Priority 9: Deployment & Operations (Week 8)
**Effort:** 20-30 hours | **Value:** ⭐⭐⭐ MEDIUM

#### Tasks:
1. **Docker containerization**
   - [ ] Create Dockerfile for server
   - [ ] Docker Compose with PostgreSQL + Redis
   - [ ] Environment variable configuration
   - [ ] Volume management for data persistence

2. **Production deployment**
   - [ ] Setup reverse proxy (Nginx)
   - [ ] SSL/TLS certificates (Let's Encrypt)
   - [ ] Process management (PM2 or systemd)
   - [ ] Log rotation
   - [ ] Backup scripts

3. **Monitoring & health checks**
   - [ ] Health check endpoints (liveness, readiness)
   - [ ] Metrics collection (Prometheus format)
   - [ ] Error tracking (Sentry or similar)
   - [ ] Performance monitoring

4. **Documentation**
   - [ ] Installation guide
   - [ ] Configuration reference
   - [ ] API documentation (OpenAPI/Swagger)
   - [ ] Troubleshooting guide

**Deliverable:** Production-ready deployment setup

---

## 🚀 Phase 4: Advanced Features (Future)
**Goal:** Enterprise features and scalability
**Timeline:** Ongoing
**Effort:** 50+ hours

### Priority 10: Advanced Features (As Needed)

#### High-Value Additions:
- [ ] **USB printer support** (node-printer, node-usb)
- [ ] **Printer auto-discovery** (mDNS/Bonjour, network scanning)
- [ ] **Job scheduling** (print at specific time)
- [ ] **Job priority levels** (urgent, normal, low)
- [ ] **Queue rules engine** (auto-approve based on criteria)
- [ ] **Multi-tenancy** (separate queues per organization)
- [ ] **Advanced reporting** (charts, analytics)
- [ ] **Email notifications** (job status updates)
- [ ] **SMS alerts** (printer failures)
- [ ] **Mobile app** (React Native or Flutter)

#### Scalability:
- [ ] **Redis job queue** (replace in-memory with Bull)
- [ ] **Load balancing** (multiple server instances)
- [ ] **Database connection pooling**
- [ ] **Caching layer** (Redis for hot data)
- [ ] **CDN for static assets**
- [ ] **Horizontal scaling** (stateless server design)

#### Security Enhancements:
- [ ] **OAuth2/SSO integration** (Google, Microsoft, Okta)
- [ ] **Two-factor authentication**
- [ ] **API rate limiting** (per user/IP)
- [ ] **IP whitelisting** for printer clients
- [ ] **Encrypted job data** (at rest and in transit)
- [ ] **Security audit logging**
- [ ] **Penetration testing**

---

## 📊 Effort & Value Matrix

| Phase | Priority | Tasks | Effort (hrs) | Value | Status |
|-------|----------|-------|--------------|-------|--------|
| **MVP** | | | | | |
| 1 | Core Backend | Server infrastructure, API | 40-60 | ⭐⭐⭐⭐⭐ | Not Started |
| 1 | Job Queue | Queue management, persistence | 30-40 | ⭐⭐⭐⭐⭐ | Not Started |
| 1 | Printer Comm | TCP client, device registry | 50-70 | ⭐⭐⭐⭐⭐ | Not Started |
| **Enhanced** | | | | | |
| 2 | Database | PostgreSQL, migrations | 20-30 | ⭐⭐⭐⭐ | Not Started |
| 2 | Auth/Authz | Users, roles, JWT | 30-40 | ⭐⭐⭐⭐ | Not Started |
| 2 | Web UI | Dashboard, job management | 40-60 | ⭐⭐⭐⭐ | Not Started |
| **Production** | | | | | |
| 3 | Real-time | WebSocket, live updates | 20-30 | ⭐⭐⭐ | Not Started |
| 3 | Job Modify | Edit jobs, templates | 25-35 | ⭐⭐⭐ | Not Started |
| 3 | Deployment | Docker, production setup | 20-30 | ⭐⭐⭐ | Not Started |
| **Advanced** | | | | | |
| 4 | Future | USB, scheduling, scaling | 50+ | ⭐⭐ | Not Started |

---

## 🏗️ Recommended Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                             │
├─────────────────────────────────────────────────────────────────┤
│  POS Systems  │  Web Dashboard  │  Mobile App  │  Admin Panel   │
│  (TCP/HTTP)   │  (WebSocket)    │  (Future)    │  (HTTP)        │
└────────┬──────────────┬──────────────┬─────────────┬────────────┘
         │              │              │             │
         └──────────────┴──────────────┴─────────────┘
                        │
                        ↓
┌─────────────────────────────────────────────────────────────────┐
│                      REVERSE PROXY (Nginx)                       │
│                   SSL Termination, Load Balancing                │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│                      APPLICATION LAYER                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Express.js API Server (Node.js)              │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │  REST API  │ WebSocket │  Auth Middleware │  Logging     │  │
│  └──────┬────────────┬────────────┬─────────────┬───────────┘  │
│         │            │            │             │               │
│         ↓            ↓            ↓             ↓               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐         │
│  │   Job    │ │  Printer │ │   User   │ │  Queue   │         │
│  │ Service  │ │  Manager │ │ Manager  │ │ Service  │         │
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
│  PostgreSQL │ │    Redis    │ │  File Store │
│   (Jobs,    │ │  (Queue,    │ │  (Backups,  │
│   Users,    │ │   Cache,    │ │   Exports)  │
│  Printers)  │ │   Session)  │ │             │
└─────────────┘ └─────────────┘ └─────────────┘
                       │
                       ↓
        ┌──────────────────────────────┐
        │     PRINTER LAYER            │
        ├──────────────────────────────┤
        │  ┌────────┐  ┌────────┐     │
        │  │ TCP/IP │  │  USB   │     │
        │  │Printer │  │Printer │     │
        │  └────────┘  └────────┘     │
        └──────────────────────────────┘
```

---

## 🎯 MVP Implementation Steps (Quick Start)

If you want to start immediately with minimal infrastructure:

### Week 1: MVP Backend
1. Create `server/` directory
2. Setup Express + TypeScript
3. Build REST API for jobs (submit, list, approve, reject)
4. In-memory job queue (array-based)
5. Integrate existing CommandParser

### Week 2: MVP Printer Communication
1. Build TCP socket client
2. Add printer registration (hardcode one printer to start)
3. Implement job → printer workflow
4. Test with real ESC/POS printer

### Week 3: MVP Web UI
1. Simple HTML page with vanilla JS (or React)
2. Fetch pending jobs from API
3. Show preview using existing HTMLRenderer
4. Add approve/reject buttons
5. Poll API every 2-3 seconds for updates

### Week 4: Basic Persistence
1. Add PostgreSQL
2. Migrate in-memory queue to database
3. Add basic authentication (hardcoded admin user)
4. Deploy to test server

**Result:** Working print spool service in 4 weeks!

---

## 📝 Key Technical Decisions

### Database Choice
**Recommended: PostgreSQL**
- Pros: Robust, ACID compliant, excellent for job queues, JSON support
- Alternatives: MySQL (similar), MongoDB (flexible schema), SQLite (simple)

### Queue System
**MVP: In-memory (array)**
**Production: Bull + Redis**
- Bull provides job queue, retry, scheduling, priorities
- Redis is fast, reliable, perfect for queues

### Authentication
**Recommended: JWT tokens**
- Stateless, scalable
- Can add refresh tokens later
- Consider OAuth2/OIDC for enterprise

### Frontend Framework
**Recommended: React or Vue**
- Alternatives: Svelte (smaller), vanilla JS (simpler)
- Use existing HTMLRenderer for preview

### Printer Communication
**Phase 1: TCP/IP only**
**Phase 2: Add USB**
- Most thermal printers support network printing
- USB is more complex (requires native bindings)

---

## 🚧 Current Gaps Summary

**What Exists:**
- ✅ ESC/POS parser (CommandParser)
- ✅ HTML renderer (HTMLRenderer)
- ✅ Printer device database
- ✅ Python verification tools
- ✅ Web editor (client-side)

**What's Missing (Everything Else!):**
- ❌ Backend server
- ❌ API endpoints
- ❌ Job queue
- ❌ Database
- ❌ Printer communication
- ❌ Authentication
- ❌ Web dashboard
- ❌ Real-time updates
- ❌ Job modification
- ❌ Production deployment

---

## 📚 Resources & References

### Recommended Libraries
- **Backend:** Express.js or Fastify
- **Database ORM:** Prisma or TypeORM
- **Queue:** Bull (Redis-backed)
- **Auth:** Passport.js or jsonwebtoken
- **WebSocket:** Socket.IO or ws
- **Logging:** Winston or Pino
- **Testing:** Jest or Vitest (already using Vitest)
- **Printer:** node-thermal-printer (high-level) or raw net module

### Learning Resources
- ESC/POS Command Reference: [Search online]
- Node.js TCP Sockets: https://nodejs.org/api/net.html
- Bull Queue: https://github.com/OptimalBits/bull
- Prisma ORM: https://www.prisma.io/
- Socket.IO: https://socket.io/

---

## 🎉 Success Criteria

### MVP Success (Phase 1):
- [ ] Can receive ESC/POS jobs via HTTP API
- [ ] Can preview jobs in web interface
- [ ] Can approve/reject jobs
- [ ] Approved jobs print to real printer
- [ ] Basic persistence (file or database)

### Production Success (Phase 3):
- [ ] Multi-user with authentication
- [ ] Real-time dashboard updates
- [ ] Can modify jobs before printing
- [ ] Supports multiple printers
- [ ] Production deployment ready
- [ ] Comprehensive logging and monitoring

### Enterprise Success (Phase 4):
- [ ] USB printer support
- [ ] Auto-discovery of printers
- [ ] Scheduled printing
- [ ] Multi-tenancy
- [ ] Advanced reporting
- [ ] Mobile app

---

## 🤝 Next Steps

### Immediate Actions:
1. **Review this roadmap** - Confirm priorities align with your goals
2. **Setup development environment** - Install PostgreSQL, Redis
3. **Create server/ directory** - Start backend scaffolding
4. **Start with MVP Phase 1** - Core backend server
5. **Test with real printer** - Identify target printer model early

### Questions to Answer:
- What printer models will you support initially?
- Single-user or multi-user from day 1?
- Self-hosted or cloud-hosted?
- What's your target timeline?
- Budget for infrastructure?

---

**Last Updated:** 2025-11-10
**Session:** claude/prioritize-next-level-tasks-011CUyFfD2A6jT6X9bWYLgqR
