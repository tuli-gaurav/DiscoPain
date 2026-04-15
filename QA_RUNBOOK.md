# QA Runbook

This runbook defines a repeatable end-to-end manual verification process for DiscoPain before release.

## 1) Preconditions

- MySQL is running.
- Required DB/schema is created (`backend/database/schema.sql`).
- Environment files are configured:
  - `backend/.env`
  - `frontend/.env`
- Ports are available:
  - Backend: `4000`
  - Frontend: `5173`

## 2) Bootstrapping

### Backend

```bash
cd backend
npm install
node database/seeders/demo-seed.js
npm run dev
```

Expected:
- backend starts without crash
- `http://localhost:4000/health` returns `{ status: "ok", ... }`

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Expected:
- frontend starts without crash
- app opens on `http://localhost:5173`

## 3) Test Accounts

- `admin@discopain.local` / `Password123!`
- `owner@discopain.local` / `Password123!`
- `member@discopain.local` / `Password123!`
- `stakeholder@discopain.local` / `Password123!`

## 4) Core Smoke Checks

1. Login with admin account.
2. Open each primary page:
   - Dashboard
   - Templates
   - Projects
   - Notifications
   - IDS
   - Reports
   - Audit
3. Confirm no page-level crash/errors.

## 5) Module Verification Checklist

## Authentication / RBAC

- Login succeeds with valid credentials.
- Invalid credentials are rejected.
- Protected routes redirect/block when logged out.

## Templates

- Create template.
- Add/edit/delete template tasks.
- Reorder tasks.
- Duplicate template.
- Deactivate template.
- Confirm deactivated template is not selectable for new project creation.

## Project Creation

- Create project with:
  - client name
  - tier/template
  - regions
  - stakeholders
  - contributing team
  - status/summary
- Confirm template tasks are copied into project tasks.

## Task Management

- Filter tasks by status/priority/search.
- Update task status.
- Add dependency.
- Verify blocked-by-dependency indicator.
- Add task.
- Delete task.

## Task Notes + History

- Add task note.
- Edit task note.
- Confirm note version increments.
- Confirm previous content appears in note history.
- Confirm task activity timeline updates.

## PMO Comments + History

- Add PMO comment.
- Edit PMO comment.
- Confirm prior versions appear in PMO comment history.

## Notifications Workflow

For save actions (task update, task note, PMO comment, IDS update):
- prompt appears with:
  - all users
  - specific users
  - none
- notifications created accordingly.

Validate Notifications page:
- list renders
- unread count visible in header
- mark-as-read updates state

Realtime check (recommended):
- open second browser session/user
- perform save action from first session
- verify second session receives notification update

## IDS

- Raise IDS from project flow:
  - assign users
  - link tasks
  - choose type/severity
- Confirm IDS list filters work.
- Open IDS detail:
  - assignees shown
  - linked tasks shown
  - project snapshot shown
- Update IDS status/details and verify changes persist.

## Audit Logs

- Open Audit page.
- Filter by entity/user/project/task/date.
- Confirm rows update and metadata payload is visible.

## Dashboard

- KPI cards show non-zero seeded values.
- Charts render:
  - RAG pie
  - task status bar
  - progress trend line

## Reports

- Apply filters (tier/region/owner/health/date).
- Confirm KPI and charts change based on filter.
- Validate workload chart populates.

## Risk

- Open project detail risk panel.
- Confirm score/level/reasons/recommendations shown.
- Confirm risk history list shows prior snapshots.

## Reminders

- Create reminder config (target user/type/interval).
- Toggle reminder active/inactive.
- Delete reminder.
- Confirm reminder logs appear after scheduler run window.

## 6) API Spot Checks (Optional)

Using Postman/curl:
- `GET /api/health`
- `GET /api/dashboards/summary`
- `GET /api/reports/overview`
- `GET /api/audit-logs`
- `GET /api/ids`
- `GET /api/notifications`

Expected:
- valid JSON response
- no unhandled server errors

## 7) Release Sign-off

Mark each area:
- [ ] Auth/RBAC
- [ ] Templates
- [ ] Projects/Tasks/Dependencies
- [ ] Notes + PMO History
- [ ] Notifications + Realtime
- [ ] IDS
- [ ] Audit
- [ ] Dashboard/Reports
- [ ] Risk
- [ ] Reminders

Release recommendation:
- [ ] Pass
- [ ] Pass with known issues (documented)
- [ ] Blocked

## 8) Known Risk Areas

- Reminder scheduler requires elapsed runtime to validate execution.
- Realtime behavior is best validated with two concurrent client sessions.
- Full migration-based upgrade testing is pending (currently schema sync + seed flow).
