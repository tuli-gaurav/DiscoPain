import { Sequelize, DataTypes } from "sequelize";
import { env } from "./env.js";

const { ssl, ...dbConn } = env.db;

export const sequelize = new Sequelize(dbConn.name, dbConn.user, dbConn.pass, {
  host: dbConn.host,
  port: dbConn.port,
  dialect: "mysql",
  timezone: "+00:00",
  logging: false,
  ...(ssl ? { dialectOptions: { ssl } } : {})
});

export const Role = sequelize.define("Role", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING(50), unique: true, allowNull: false }
}, { tableName: "roles", underscored: true });

export const User = sequelize.define("User", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  fullName: { type: DataTypes.STRING(120), allowNull: false, field: "full_name" },
  email: { type: DataTypes.STRING(160), unique: true, allowNull: false },
  passwordHash: { type: DataTypes.STRING(255), allowNull: false, field: "password_hash" },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true, field: "is_active" }
}, { tableName: "users", underscored: true });

export const UserRole = sequelize.define("UserRole", {}, { tableName: "user_roles", underscored: true });
User.belongsToMany(Role, { through: UserRole, foreignKey: "user_id" });
Role.belongsToMany(User, { through: UserRole, foreignKey: "role_id" });

export const Template = sequelize.define("Template", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING(120), allowNull: false },
  tier: { type: DataTypes.ENUM("Tier 1", "Tier 2", "Tier 3"), allowNull: false },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true, field: "is_active" }
}, { tableName: "templates", underscored: true });

export const TemplateTask = sequelize.define("TemplateTask", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING(160), allowNull: false },
  description: { type: DataTypes.TEXT },
  responsibilityOwner: { type: DataTypes.STRING(120), field: "responsibility_owner" },
  orderNo: { type: DataTypes.INTEGER, field: "order_no", defaultValue: 1 },
  defaultStatus: { type: DataTypes.STRING(30), field: "default_status", defaultValue: "Not Started" }
}, { tableName: "template_tasks", underscored: true });

Template.hasMany(TemplateTask, { foreignKey: "template_id", as: "tasks" });
TemplateTask.belongsTo(Template, { foreignKey: "template_id" });

export const Project = sequelize.define("Project", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  clientName: { type: DataTypes.STRING(180), allowNull: false, field: "client_name" },
  regions: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
  costInvolved: { type: DataTypes.DECIMAL(12, 2), field: "cost_involved", defaultValue: 0 },
  isCostInvolved: { type: DataTypes.BOOLEAN, field: "is_cost_involved", defaultValue: false },
  costValue: { type: DataTypes.DECIMAL(12, 2), field: "cost_value", allowNull: true },
  costApproved: { type: DataTypes.BOOLEAN, field: "cost_approved", allowNull: true },
  costApprovalDocument: { type: DataTypes.TEXT, field: "cost_approval_document", allowNull: true },
  clientType: {
    type: DataTypes.ENUM("Existing Client", "New Client", "POC"),
    field: "client_type",
    allowNull: false,
    defaultValue: "Existing Client"
  },
  projectStatus: {
    type: DataTypes.ENUM("Yet to Start", "In-Progress", "On Hold", "Cancelled"),
    field: "project_status",
    allowNull: false,
    defaultValue: "Yet to Start"
  },
  stakeholders: { type: DataTypes.JSON, allowNull: true, defaultValue: [] },
  pmoAssigned: { type: DataTypes.INTEGER, allowNull: true, field: "pmo_assigned" },
  projectOwner: { type: DataTypes.INTEGER, allowNull: true, field: "project_owner" },
  contributingTeam: { type: DataTypes.JSON, allowNull: true, defaultValue: [], field: "contributing_team" },
  tier: { type: DataTypes.ENUM("Tier 1", "Tier 2", "Tier 3"), allowNull: false },
  health: { type: DataTypes.ENUM("Green", "Amber", "Red"), defaultValue: "Green" },
  summary: { type: DataTypes.TEXT }
}, { tableName: "projects", underscored: true, paranoid: true });

export const ProjectTask = sequelize.define("ProjectTask", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING(160), allowNull: false },
  description: { type: DataTypes.TEXT },
  status: { type: DataTypes.ENUM("Not Started", "In Progress", "Completed", "Blocked"), defaultValue: "Not Started" },
  priority: { type: DataTypes.ENUM("Low", "Medium", "High", "Critical"), defaultValue: "Medium" },
  dueDate: { type: DataTypes.DATE, field: "due_date" },
  responsibilityOwner: { type: DataTypes.STRING(120), field: "responsibility_owner" }
}, { tableName: "project_tasks", underscored: true });

Project.hasMany(ProjectTask, { foreignKey: "project_id", as: "tasks" });
ProjectTask.belongsTo(Project, { foreignKey: "project_id" });

export const TaskNote = sequelize.define("TaskNote", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  content: { type: DataTypes.TEXT, allowNull: false },
  version: { type: DataTypes.INTEGER, defaultValue: 1 },
  createdBy: { type: DataTypes.INTEGER, allowNull: false, field: "created_by" },
  updatedBy: { type: DataTypes.INTEGER, allowNull: false, field: "updated_by" }
}, { tableName: "task_notes", underscored: true });
ProjectTask.hasMany(TaskNote, { foreignKey: "project_task_id", as: "notes" });

export const PmoComment = sequelize.define("PmoComment", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  comment: { type: DataTypes.TEXT, allowNull: false },
  updatedBy: { type: DataTypes.INTEGER, field: "updated_by" }
}, { tableName: "pmo_comments", underscored: true });
Project.hasMany(PmoComment, { foreignKey: "project_id", as: "pmoComments" });

export const Notification = sequelize.define("Notification", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  type: { type: DataTypes.STRING(80), allowNull: false },
  content: { type: DataTypes.TEXT, allowNull: false },
  projectId: { type: DataTypes.INTEGER, field: "project_id" },
  createdBy: { type: DataTypes.INTEGER, field: "created_by", allowNull: false },
  readAt: { type: DataTypes.DATE, field: "read_at" }
}, { tableName: "notifications", underscored: true });

export const IdsRecord = sequelize.define("IdsRecord", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  title: { type: DataTypes.STRING(160), allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: false },
  type: { type: DataTypes.ENUM("Issue", "Dependency", "Support"), allowNull: false },
  severity: { type: DataTypes.ENUM("Low", "Medium", "High", "Critical"), defaultValue: "Medium" },
  status: { type: DataTypes.ENUM("Open", "In Progress", "Resolved", "Closed"), defaultValue: "Open" },
  snapshot: { type: DataTypes.JSON, defaultValue: {} }
}, { tableName: "ids_records", underscored: true });
Project.hasMany(IdsRecord, { foreignKey: "project_id", as: "idsRecords" });

export const AuditLog = sequelize.define("AuditLog", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  entityType: { type: DataTypes.STRING(80), allowNull: false, field: "entity_type" },
  entityId: { type: DataTypes.INTEGER, allowNull: false, field: "entity_id" },
  action: { type: DataTypes.STRING(80), allowNull: false },
  metadata: { type: DataTypes.JSON, defaultValue: {} }
}, { tableName: "audit_logs", underscored: true });

export const RiskAssessment = sequelize.define("RiskAssessment", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  score: { type: DataTypes.INTEGER, allowNull: false },
  level: { type: DataTypes.ENUM("Low", "Medium", "High"), allowNull: false },
  reasons: { type: DataTypes.JSON, defaultValue: [] },
  recommendations: { type: DataTypes.JSON, defaultValue: [] }
}, { tableName: "risk_assessments", underscored: true });
Project.hasMany(RiskAssessment, { foreignKey: "project_id", as: "riskAssessments" });

export const ReminderLog = sequelize.define("ReminderLog", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  reminderId: { type: DataTypes.INTEGER, allowNull: false, field: "reminder_id" },
  reminderType: { type: DataTypes.STRING(80), field: "reminder_type" },
  sentToUserId: { type: DataTypes.INTEGER, allowNull: true, field: "sent_to_user_id" },
  details: { type: DataTypes.JSON, defaultValue: {} }
}, { tableName: "reminder_logs", underscored: true });

export const ProjectMember = sequelize.define("ProjectMember", {
  roleInProject: { type: DataTypes.STRING(80), allowNull: false, field: "role_in_project" }
}, { tableName: "project_members", underscored: true });

export const TaskAssignment = sequelize.define("TaskAssignment", {}, { tableName: "task_assignments", underscored: true });

export const TaskDependency = sequelize.define("TaskDependency", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true }
}, { tableName: "task_dependencies", underscored: true });

export const TaskNoteHistory = sequelize.define("TaskNoteHistory", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  content: { type: DataTypes.TEXT, allowNull: false },
  updatedBy: { type: DataTypes.INTEGER, allowNull: false, field: "updated_by" }
}, { tableName: "task_note_history", underscored: true });

export const PmoCommentHistory = sequelize.define("PmoCommentHistory", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  comment: { type: DataTypes.TEXT, allowNull: false },
  updatedBy: { type: DataTypes.INTEGER, allowNull: false, field: "updated_by" }
}, { tableName: "pmo_comment_history", underscored: true });

export const NotificationRecipient = sequelize.define("NotificationRecipient", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  readAt: { type: DataTypes.DATE, field: "read_at" }
}, { tableName: "notification_recipients", underscored: true });

export const IdsAssignee = sequelize.define("IdsAssignee", {}, { tableName: "ids_assignees", underscored: true });
export const IdsTaskLink = sequelize.define("IdsTaskLink", {}, { tableName: "ids_task_links", underscored: true });

export const Reminder = sequelize.define("Reminder", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  projectId: { type: DataTypes.INTEGER, allowNull: false, field: "project_id" },
  targetUserId: { type: DataTypes.INTEGER, allowNull: false, field: "target_user_id" },
  reminderType: { type: DataTypes.STRING(80), allowNull: false, field: "reminder_type" },
  intervalMinutes: { type: DataTypes.INTEGER, allowNull: false, field: "interval_minutes", defaultValue: 1440 },
  isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: "is_active" },
  lastRunAt: { type: DataTypes.DATE, field: "last_run_at" }
}, { tableName: "reminders", underscored: true });

Project.belongsToMany(User, { through: ProjectMember, foreignKey: "project_id", otherKey: "user_id", as: "members" });
User.belongsToMany(Project, { through: ProjectMember, foreignKey: "user_id", otherKey: "project_id", as: "projects" });

ProjectTask.belongsToMany(User, { through: TaskAssignment, foreignKey: "project_task_id", otherKey: "user_id", as: "assignees" });
User.belongsToMany(ProjectTask, { through: TaskAssignment, foreignKey: "user_id", otherKey: "project_task_id", as: "assignedTasks" });

ProjectTask.belongsToMany(ProjectTask, {
  through: TaskDependency,
  foreignKey: "task_id",
  otherKey: "depends_on_task_id",
  as: "dependencies"
});

TaskNote.belongsTo(ProjectTask, { foreignKey: "project_task_id" });
TaskNote.belongsTo(User, { foreignKey: "created_by" });
TaskNote.belongsTo(User, { foreignKey: "updated_by" });
TaskNote.hasMany(TaskNoteHistory, { foreignKey: "task_note_id", as: "history" });
TaskNoteHistory.belongsTo(TaskNote, { foreignKey: "task_note_id" });
TaskNoteHistory.belongsTo(User, { foreignKey: "updated_by" });

PmoComment.belongsTo(Project, { foreignKey: "project_id" });
PmoComment.belongsTo(User, { foreignKey: "user_id" });
PmoComment.hasMany(PmoCommentHistory, { foreignKey: "pmo_comment_id", as: "history" });
PmoCommentHistory.belongsTo(PmoComment, { foreignKey: "pmo_comment_id" });
PmoCommentHistory.belongsTo(User, { foreignKey: "updated_by" });

Notification.belongsTo(User, { foreignKey: "created_by" });
Notification.belongsTo(Project, { foreignKey: "project_id" });
Notification.hasMany(NotificationRecipient, { foreignKey: "notification_id", as: "recipients" });
NotificationRecipient.belongsTo(Notification, { foreignKey: "notification_id" });
NotificationRecipient.belongsTo(User, { foreignKey: "user_id" });

IdsRecord.belongsTo(Project, { foreignKey: "project_id" });
IdsRecord.belongsTo(User, { foreignKey: "raised_by" });
IdsRecord.belongsToMany(User, { through: IdsAssignee, foreignKey: "ids_record_id", otherKey: "user_id", as: "assignees" });
User.belongsToMany(IdsRecord, { through: IdsAssignee, foreignKey: "user_id", otherKey: "ids_record_id", as: "idsAssignments" });
IdsRecord.belongsToMany(ProjectTask, { through: IdsTaskLink, foreignKey: "ids_record_id", otherKey: "project_task_id", as: "linkedTasks" });
ProjectTask.belongsToMany(IdsRecord, { through: IdsTaskLink, foreignKey: "project_task_id", otherKey: "ids_record_id", as: "idsLinks" });

AuditLog.belongsTo(User, { foreignKey: "user_id" });
RiskAssessment.belongsTo(Project, { foreignKey: "project_id" });
Reminder.belongsTo(Project, { foreignKey: "project_id" });
Reminder.belongsTo(User, { foreignKey: "target_user_id" });
ReminderLog.belongsTo(Reminder, { foreignKey: "reminder_id" });
