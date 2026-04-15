# DiscoPain - Client Onboarding Project Management System

## Purpose
DiscoPain is an internal full-stack platform for PMO teams to onboard and track client projects using reusable Tier 1/Tier 2/Tier 3 templates. It centralizes role-based operations, project/task governance, PMO health oversight, IDS escalations, auditability, reporting dashboards, reminder automation, and AI-style risk scoring.

## Tech Stack
- Frontend: React + Vite + React Query + React Hook Form + Tailwind + Chart.js
- Backend: Node.js + Express + Sequelize + Socket.io + node-cron
- Database: MySQL
- Auth: JWT

## Folder Structure
```text
DiscoPain/
  backend/
    src/
      app.js
      server.js
      config/
        env.js
        db.js
      jobs/
        reminder.job.js
      middleware/
        auth.js
      routes/
        index.js
      services/
        audit.service.js
        notification.service.js
        risk.service.js
    database/
      schema.sql
      seeders/
        demo-seed.js
    docs/
      api.md
    .env.example
    package.json
  frontend/
    src/
      api/client.js
      components/Layout.jsx
      context/AuthContext.jsx
      pages/
        LoginPage.jsx
        DashboardPage.jsx
        TemplatesPage.jsx
        ProjectsPage.jsx
        CreateProjectPage.jsx
        ProjectDetailsPage.jsx
        NotificationsPage.jsx
        IdsPage.jsx
        IdsDetailPage.jsx
        ReportsPage.jsx
        AuditPage.jsx
      App.jsx
      main.jsx
      styles.css
    index.html
    vite.config.js
    tailwind.config.js
    postcss.config.js
    .env.example
    package.json
  .gitignore
  README.md
```

## Milestone Progress
### Milestone 1 (Completed in this iteration)
1. Complete backend/frontend scaffold with production-style separation
2. Expanded MySQL schema to include all core entities requested
3. Expanded Sequelize model layer and key associations for RBAC, templates, projects, tasks, notifications, IDS, audit, reminders, and risk
4. Added runnable demo seeder with users, tier templates, sample project/tasks, and IDS
5. Implemented project list/create/detail frontend flow with PMO comments and risk insight widgets
6. Added additional REST coverage (`GET /projects`, `POST /projects/:id/tasks`, notification inbox/read routes)

### Implemented Modules
1. JWT auth + role-based access (`PMO Admin`, `Project Owner`, `Team Member`, `Stakeholder`)
2. Tier template management (CRUD, duplicate, deactivate, reorder tasks)
3. Client project creation from tier template copy
4. Task management (CRUD, filters, dependencies, notes, note version history)
5. PMO comments with preserved edit history
6. Notifications workflow (all/specific/none target prompt, inbox, unread/read, Socket.io emit path)
7. IDS module (raise, list/detail, linked tasks, assignees, snapshot context, updates)
8. Centralized audit logging and timeline filters
9. Dashboard and reports with chart-ready metrics
10. Rule-based risk scoring with historical snapshots
11. Automated reminders (config APIs, scheduler loop, logs)
12. Rich demo seed data across templates, projects, tasks, IDS, notes, comments, reminders, notifications

## Setup Guide
### 1) Prerequisites
- Node.js 20+
- MySQL 8+

### 2) Database
1. Create and initialize schema:
   - Run SQL in `backend/database/schema.sql`
2. Ensure MySQL credentials are available.

### 3) Backend
```bash
cd backend
cp .env.example .env
npm install
# optional explicit demo seed:
node database/seeders/demo-seed.js
npm run dev
```
Default seeded login:
- Email: `admin@discopain.local`
- Password: `Password123!`

Additional seeded users:
- `owner@discopain.local` / `Password123!`
- `member@discopain.local` / `Password123!`
- `stakeholder@discopain.local` / `Password123!`

### 4) Frontend
```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

### 5) Open App
- Frontend: [http://localhost:5173](http://localhost:5173)
- Backend health: [http://localhost:4000/health](http://localhost:4000/health)

## REST API Coverage
See `backend/docs/api.md` for the current route list and request targets.

## Product Notes
- Template tasks are copied into project tasks at creation time (not live-linked).
- UTC is used in backend timestamps.
- Architecture is intentionally modular so each scaffolded module can be promoted into dedicated controllers/services and richer tables/migrations without breaking contracts.

## Future Enhancements
- Add full migration/seed pipeline per table (`sequelize-cli` migration files)
- Implement complete note versioning tables and dependency graph APIs
- Complete notification modal flow (all users vs selected users) with Socket.io rooms
- Expand reports page with full filter stack and trend lines from historical snapshots
- Add email/push adapters and user-level notification preferences
- Replace/augment rule-based risk scoring with ML model inference service
- Add comprehensive test suites (unit/integration/e2e) and CI/CD pipeline
