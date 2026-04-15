CREATE DATABASE IF NOT EXISTS discopain CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE discopain;

CREATE TABLE roles (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(50) NOT NULL UNIQUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE user_roles (
  user_id INT NOT NULL,
  role_id INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, role_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (role_id) REFERENCES roles(id)
);

CREATE TABLE templates (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  tier ENUM('Tier 1', 'Tier 2', 'Tier 3') NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE template_tasks (
  id INT PRIMARY KEY AUTO_INCREMENT,
  template_id INT NOT NULL,
  name VARCHAR(160) NOT NULL,
  description TEXT NULL,
  responsibility_owner VARCHAR(120) NULL,
  order_no INT NOT NULL DEFAULT 1,
  default_status VARCHAR(30) NOT NULL DEFAULT 'Not Started',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (template_id) REFERENCES templates(id)
);

CREATE TABLE projects (
  id INT PRIMARY KEY AUTO_INCREMENT,
  client_name VARCHAR(180) NOT NULL,
  regions JSON NOT NULL,
  cost_involved DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  stakeholders JSON NULL,
  pmo_assigned INT NULL,
  project_owner INT NULL,
  contributing_team JSON NULL,
  tier ENUM('Tier 1', 'Tier 2', 'Tier 3') NOT NULL,
  health ENUM('Green', 'Amber', 'Red') NOT NULL DEFAULT 'Green',
  summary TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  FOREIGN KEY (pmo_assigned) REFERENCES users(id),
  FOREIGN KEY (project_owner) REFERENCES users(id),
  INDEX idx_projects_tier (tier),
  INDEX idx_projects_health (health)
);

CREATE TABLE project_members (
  project_id INT NOT NULL,
  user_id INT NOT NULL,
  role_in_project VARCHAR(80) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (project_id, user_id),
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE project_tasks (
  id INT PRIMARY KEY AUTO_INCREMENT,
  project_id INT NOT NULL,
  name VARCHAR(160) NOT NULL,
  description TEXT NULL,
  responsibility_owner VARCHAR(120) NULL,
  status ENUM('Not Started', 'In Progress', 'Completed', 'Blocked') NOT NULL DEFAULT 'Not Started',
  due_date DATETIME NULL,
  priority ENUM('Low', 'Medium', 'High', 'Critical') NOT NULL DEFAULT 'Medium',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id),
  INDEX idx_project_tasks_project (project_id),
  INDEX idx_project_tasks_status (status),
  INDEX idx_project_tasks_due_date (due_date)
);

CREATE TABLE task_assignments (
  project_task_id INT NOT NULL,
  user_id INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (project_task_id, user_id),
  FOREIGN KEY (project_task_id) REFERENCES project_tasks(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE task_dependencies (
  id INT PRIMARY KEY AUTO_INCREMENT,
  task_id INT NOT NULL,
  depends_on_task_id INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES project_tasks(id),
  FOREIGN KEY (depends_on_task_id) REFERENCES project_tasks(id),
  UNIQUE KEY uq_task_dependency (task_id, depends_on_task_id)
);

CREATE TABLE task_notes (
  id INT PRIMARY KEY AUTO_INCREMENT,
  project_task_id INT NOT NULL,
  content TEXT NOT NULL,
  version INT NOT NULL DEFAULT 1,
  created_by INT NOT NULL,
  updated_by INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (project_task_id) REFERENCES project_tasks(id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (updated_by) REFERENCES users(id)
);

CREATE TABLE task_note_history (
  id INT PRIMARY KEY AUTO_INCREMENT,
  task_note_id INT NOT NULL,
  content TEXT NOT NULL,
  updated_by INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_note_id) REFERENCES task_notes(id),
  FOREIGN KEY (updated_by) REFERENCES users(id)
);

CREATE TABLE pmo_comments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  project_id INT NOT NULL,
  user_id INT NOT NULL,
  comment TEXT NOT NULL,
  updated_by INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (updated_by) REFERENCES users(id)
);

CREATE TABLE pmo_comment_history (
  id INT PRIMARY KEY AUTO_INCREMENT,
  pmo_comment_id INT NOT NULL,
  comment TEXT NOT NULL,
  updated_by INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (pmo_comment_id) REFERENCES pmo_comments(id),
  FOREIGN KEY (updated_by) REFERENCES users(id)
);

CREATE TABLE notifications (
  id INT PRIMARY KEY AUTO_INCREMENT,
  project_id INT NULL,
  type VARCHAR(80) NOT NULL,
  content TEXT NOT NULL,
  created_by INT NOT NULL,
  read_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE notification_recipients (
  id INT PRIMARY KEY AUTO_INCREMENT,
  notification_id INT NOT NULL,
  user_id INT NOT NULL,
  read_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (notification_id) REFERENCES notifications(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE KEY uq_notification_recipient (notification_id, user_id)
);

CREATE TABLE ids_records (
  id INT PRIMARY KEY AUTO_INCREMENT,
  project_id INT NOT NULL,
  title VARCHAR(160) NOT NULL,
  description TEXT NOT NULL,
  type ENUM('Issue', 'Dependency', 'Support') NOT NULL,
  severity ENUM('Low', 'Medium', 'High', 'Critical') NOT NULL DEFAULT 'Medium',
  raised_by INT NOT NULL,
  snapshot JSON NULL,
  status ENUM('Open', 'In Progress', 'Resolved', 'Closed') NOT NULL DEFAULT 'Open',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (raised_by) REFERENCES users(id),
  INDEX idx_ids_status (status)
);

CREATE TABLE ids_assignees (
  ids_record_id INT NOT NULL,
  user_id INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (ids_record_id, user_id),
  FOREIGN KEY (ids_record_id) REFERENCES ids_records(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE audit_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id INT NOT NULL,
  action VARCHAR(80) NOT NULL,
  metadata JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_audit_entity (entity_type, entity_id),
  INDEX idx_audit_created_at (created_at)
);

CREATE TABLE reminders (
  id INT PRIMARY KEY AUTO_INCREMENT,
  project_id INT NOT NULL,
  target_user_id INT NOT NULL,
  reminder_type VARCHAR(80) NOT NULL,
  interval_minutes INT NOT NULL DEFAULT 1440,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  last_run_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (target_user_id) REFERENCES users(id)
);

CREATE TABLE reminder_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  reminder_id INT NOT NULL,
  reminder_type VARCHAR(80) NOT NULL,
  details JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (reminder_id) REFERENCES reminders(id)
);

CREATE TABLE risk_assessments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  project_id INT NOT NULL,
  score INT NOT NULL,
  level ENUM('Low', 'Medium', 'High') NOT NULL,
  reasons JSON NULL,
  recommendations JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id),
  INDEX idx_risk_project_created (project_id, created_at)
);
