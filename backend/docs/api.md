# API Documentation (Scaffold)

Base URL: `http://localhost:4000/api`

## Auth
- `POST /auth/login` -> login with `email` and `password`

## Users
- `GET /users` -> list users with roles (for assignment/notification targeting)

## Templates
- `GET /templates` -> list templates with filters (`tier`, `isActive`, `q`)
- `GET /templates/:id` -> get single template with ordered tasks
- `POST /templates` (PMO Admin) -> create template and optional tasks
- `PATCH /templates/:id` (PMO Admin) -> update template metadata
- `PATCH /templates/:id/deactivate` (PMO Admin) -> deactivate template
- `POST /templates/:id/duplicate` (PMO Admin) -> duplicate template + tasks
- `POST /templates/:id/tasks` (PMO Admin) -> add template task
- `PATCH /templates/:id/tasks/:taskId` (PMO Admin) -> update template task
- `DELETE /templates/:id/tasks/:taskId` (PMO Admin) -> remove template task
- `PATCH /templates/:id/tasks/reorder` (PMO Admin) -> reorder task sequence

## Projects
- `GET /projects` -> list projects with `tier`, `health`, `q` filters
- `POST /projects` (PMO Admin, Project Owner) -> create client project from template
- `PATCH /projects/:id` (PMO Admin, Project Owner) -> update project details
- `GET /projects/:id` -> get project details, tasks, PMO comments, IDS records
- `GET /projects/:id/tasks` -> filterable task list (`status`, `priority`, `q`, `dueFrom`, `dueTo`)
- `GET /projects/:id/activity` -> project-level activity timeline

## Tasks
- `POST /projects/:id/tasks` -> add task to project
- `PATCH /tasks/:id` -> update task status/assignee/priority/due date
- `DELETE /tasks/:id` -> delete task and clean dependency links
- `POST /projects/:id/tasks/:taskId/dependencies` -> add dependency (`dependsOnTaskId`)
- `DELETE /projects/:id/tasks/:taskId/dependencies/:dependsOnTaskId` -> remove dependency
- `GET /tasks/:id/activity` -> task-level activity timeline

## Task Notes
- `GET /tasks/:id/notes` -> list task notes with version history
- `POST /tasks/:id/notes` -> create task note
- `PATCH /tasks/:id/notes/:noteId` -> update task note and store history snapshot

## PMO Comments
- `POST /projects/:id/pmo-comments` (PMO Admin) -> add PMO comment
- `PATCH /projects/:id/pmo-comments/:commentId` (PMO Admin) -> edit PMO comment with history snapshot
- `GET /projects/:id/pmo-comments/history` -> list PMO comments with edit history

## IDS
- `GET /ids` -> IDS list with filters (`status`, `severity`, `type`, `projectId`, `q`)
- `GET /ids/:id` -> IDS detail with assignees, linked tasks, project snapshot
- `POST /projects/:id/ids` -> raise IDS
- `PATCH /ids/:id` -> update IDS status/details/assignees/linked tasks

## Risk
- `GET /projects/:id/risk` -> compute and store risk assessment snapshot
- `GET /projects/:id/risk/history` -> recent stored risk snapshots

## Reminders
- `GET /projects/:id/reminders` -> list reminder configurations for project
- `POST /projects/:id/reminders` -> create reminder configuration
- `PATCH /projects/:id/reminders/:reminderId` -> update reminder configuration
- `DELETE /projects/:id/reminders/:reminderId` -> delete reminder configuration
- `GET /projects/:id/reminder-logs` -> reminder execution/send logs for project

## Dashboards
- `GET /dashboards/summary` -> KPI cards + chart datasets (RAG, task status, trends, tier/region splits)

## Reports
- `GET /reports/overview` -> filterable summary with workload and distribution metrics (`tier`, `region`, `pmoAssigned`, `projectOwner`, `health`, `from`, `to`)

## Notifications
- `GET /notifications` -> user notification inbox
- `GET /notifications/unread-count` -> unread count for header/badge
- `PATCH /notifications/:id/read` -> mark notification as read

## Notification Payload Pattern
- Save/update endpoints that support notifications accept:
  - `notifyMode`: `all` | `specific` | `none`
  - `notifyUserIds`: `number[]` (required when mode is `specific`)

## Audit
- `GET /audit-logs` -> paginated filterable audit entries (`entityType`, `userId`, `projectId`, `taskId`, `from`, `to`, `page`, `limit`)
