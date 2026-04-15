import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { body, validationResult } from "express-validator";
import { Op } from "sequelize";
import {
  sequelize, User, Role, ProjectMember, Template, TemplateTask, Project, ProjectTask, TaskDependency, TaskNote, TaskNoteHistory, PmoComment, PmoCommentHistory, IdsRecord, IdsAssignee, IdsTaskLink, Reminder, ReminderLog, AuditLog, RiskAssessment, NotificationRecipient, Notification
} from "../config/db.js";
import { authRequired, permit } from "../middleware/auth.js";
import { env } from "../config/env.js";
import { writeAudit } from "../services/audit.service.js";
import { createNotification } from "../services/notification.service.js";
import { calculateRisk } from "../services/risk.service.js";

const router = express.Router();
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function normalizeToArray(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // Fall through to comma-separated parsing.
    }
    return value.split(",").map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

async function resolveNotificationUserIds(projectId, actorUserId, { notifyMode, notifyUserIds = [] } = {}) {
  if (!notifyMode || notifyMode === "none") return [];
  if (notifyMode === "specific") return [...new Set((notifyUserIds || []).map(Number).filter(Boolean))];
  if (notifyMode !== "all") return [];

  const project = await Project.findByPk(projectId, { attributes: ["id", "pmoAssigned", "projectOwner"] });
  if (!project) return [];
  const members = await ProjectMember.findAll({ where: { project_id: projectId }, attributes: ["user_id"] });
  const ids = [
    ...members.map((member) => Number(member.user_id)),
    project.pmoAssigned ? Number(project.pmoAssigned) : null,
    project.projectOwner ? Number(project.projectOwner) : null
  ].filter(Boolean);
  return [...new Set(ids)].filter((id) => id !== Number(actorUserId));
}

async function buildProjectSnapshot(projectId) {
  const project = await Project.findByPk(projectId);
  if (!project) return {};
  const latestPmoComment = await PmoComment.findOne({
    where: { project_id: projectId },
    order: [["updatedAt", "DESC"]]
  });
  return {
    project: {
      id: project.id,
      clientName: project.clientName,
      tier: project.tier,
      health: project.health,
      summary: project.summary
    },
    pmoComment: latestPmoComment?.comment || null
  };
}

router.post("/auth/login", [body("email").isEmail(), body("password").isLength({ min: 6 })], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { email, password } = req.body;
  const user = await User.findOne({ where: { email }, include: Role });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) return res.status(401).json({ message: "Invalid credentials" });
  const roles = user.Roles.map((r) => r.name);
  const token = jwt.sign({ sub: user.id, roles, email: user.email }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
  return res.json({ token, user: { id: user.id, fullName: user.fullName, email: user.email, roles } });
});

router.get("/users", authRequired, async (_req, res) => {
  const users = await User.findAll({
    attributes: ["id", "fullName", "email"],
    include: [{ model: Role, attributes: ["id", "name"] }],
    order: [["fullName", "ASC"]]
  });
  res.json(users);
});

router.get("/templates", authRequired, async (req, res) => {
  const { tier, isActive, q } = req.query;
  const where = {};
  if (tier) where.tier = tier;
  if (typeof isActive !== "undefined") where.isActive = isActive === "true";
  if (q) where.name = { [Op.like]: `%${q}%` };
  const templates = await Template.findAll({
    where,
    include: [{ model: TemplateTask, as: "tasks" }],
    order: [["updatedAt", "DESC"], [{ model: TemplateTask, as: "tasks" }, "orderNo", "ASC"]]
  });
  res.json(templates);
});

router.get("/templates/:id", authRequired, async (req, res) => {
  const template = await Template.findByPk(req.params.id, {
    include: [{ model: TemplateTask, as: "tasks" }],
    order: [[{ model: TemplateTask, as: "tasks" }, "orderNo", "ASC"]]
  });
  if (!template) return res.status(404).json({ message: "Template not found" });
  res.json(template);
});

router.post("/templates", authRequired, permit("PMO Admin"), [body("name").notEmpty(), body("tier").isIn(["Tier 1", "Tier 2", "Tier 3"])], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { name, tier, isActive = true, tasks = [] } = req.body;
  const existing = await Template.findOne({ where: { name, tier } });
  if (existing) return res.status(409).json({ message: "Template name already exists for this tier" });
  const template = await Template.create({ name, tier, isActive });
  if (Array.isArray(tasks) && tasks.length) {
    await TemplateTask.bulkCreate(tasks.map((task, idx) => ({
      template_id: template.id,
      name: task.name,
      description: task.description || null,
      responsibilityOwner: task.responsibilityOwner || null,
      orderNo: task.orderNo || idx + 1,
      defaultStatus: task.defaultStatus || "Not Started"
    })));
  }
  const hydrated = await Template.findByPk(template.id, { include: [{ model: TemplateTask, as: "tasks" }] });
  await writeAudit({ userId: req.user.sub, entityType: "template", entityId: template.id, action: "created", metadata: { tier } });
  res.status(201).json(hydrated);
});

router.patch("/templates/:id", authRequired, permit("PMO Admin"), async (req, res) => {
  const template = await Template.findByPk(req.params.id);
  if (!template) return res.status(404).json({ message: "Template not found" });
  const { name, tier, isActive } = req.body;
  if (name || tier) {
    const duplicate = await Template.findOne({
      where: {
        name: name ?? template.name,
        tier: tier ?? template.tier,
        id: { [Op.ne]: template.id }
      }
    });
    if (duplicate) return res.status(409).json({ message: "Template name already exists for this tier" });
  }
  await template.update({ ...(typeof name !== "undefined" ? { name } : {}), ...(typeof tier !== "undefined" ? { tier } : {}), ...(typeof isActive !== "undefined" ? { isActive } : {}) });
  await writeAudit({ userId: req.user.sub, entityType: "template", entityId: template.id, action: "updated", metadata: req.body });
  const hydrated = await Template.findByPk(template.id, { include: [{ model: TemplateTask, as: "tasks" }] });
  res.json(hydrated);
});

router.patch("/templates/:id/deactivate", authRequired, permit("PMO Admin"), async (req, res) => {
  const template = await Template.findByPk(req.params.id);
  if (!template) return res.status(404).json({ message: "Template not found" });
  await template.update({ isActive: false });
  await writeAudit({ userId: req.user.sub, entityType: "template", entityId: template.id, action: "deactivated" });
  res.json(template);
});

router.post("/templates/:id/duplicate", authRequired, permit("PMO Admin"), async (req, res) => {
  const source = await Template.findByPk(req.params.id, { include: [{ model: TemplateTask, as: "tasks" }] });
  if (!source) return res.status(404).json({ message: "Template not found" });
  let copyName = `${source.name} (Copy)`;
  let i = 2;
  // Ensure unique copy name per tier.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const exists = await Template.findOne({ where: { name: copyName, tier: source.tier } });
    if (!exists) break;
    copyName = `${source.name} (Copy ${i})`;
    i += 1;
  }
  const duplicated = await Template.create({ name: copyName, tier: source.tier, isActive: true });
  if (source.tasks?.length) {
    await TemplateTask.bulkCreate(source.tasks.map((task) => ({
      template_id: duplicated.id,
      name: task.name,
      description: task.description,
      responsibilityOwner: task.responsibilityOwner,
      orderNo: task.orderNo,
      defaultStatus: task.defaultStatus
    })));
  }
  await writeAudit({ userId: req.user.sub, entityType: "template", entityId: duplicated.id, action: "duplicated", metadata: { sourceTemplateId: source.id } });
  const hydrated = await Template.findByPk(duplicated.id, { include: [{ model: TemplateTask, as: "tasks" }] });
  res.status(201).json(hydrated);
});

router.post("/templates/:id/tasks", authRequired, permit("PMO Admin"), async (req, res) => {
  const template = await Template.findByPk(req.params.id);
  if (!template) return res.status(404).json({ message: "Template not found" });
  const maxOrder = await TemplateTask.max("orderNo", { where: { template_id: template.id } });
  const created = await TemplateTask.create({
    template_id: template.id,
    name: req.body.name,
    description: req.body.description || null,
    responsibilityOwner: req.body.responsibilityOwner || null,
    defaultStatus: req.body.defaultStatus || "Not Started",
    orderNo: req.body.orderNo || (Number.isFinite(maxOrder) ? maxOrder + 1 : 1)
  });
  await writeAudit({ userId: req.user.sub, entityType: "template_task", entityId: created.id, action: "created", metadata: { templateId: template.id } });
  res.status(201).json(created);
});

router.patch("/templates/:id/tasks/:taskId", authRequired, permit("PMO Admin"), async (req, res) => {
  const task = await TemplateTask.findOne({ where: { id: req.params.taskId, template_id: req.params.id } });
  if (!task) return res.status(404).json({ message: "Template task not found" });
  await task.update(req.body);
  await writeAudit({ userId: req.user.sub, entityType: "template_task", entityId: task.id, action: "updated", metadata: req.body });
  res.json(task);
});

router.delete("/templates/:id/tasks/:taskId", authRequired, permit("PMO Admin"), async (req, res) => {
  const task = await TemplateTask.findOne({ where: { id: req.params.taskId, template_id: req.params.id } });
  if (!task) return res.status(404).json({ message: "Template task not found" });
  await task.destroy();
  await writeAudit({ userId: req.user.sub, entityType: "template_task", entityId: Number(req.params.taskId), action: "deleted", metadata: { templateId: Number(req.params.id) } });
  res.status(204).send();
});

router.patch("/templates/:id/tasks/reorder", authRequired, permit("PMO Admin"), async (req, res) => {
  const { items = [] } = req.body;
  if (!Array.isArray(items) || !items.length) return res.status(400).json({ message: "items array is required" });
  const template = await Template.findByPk(req.params.id);
  if (!template) return res.status(404).json({ message: "Template not found" });
  const taskIds = items.map((item) => Number(item.taskId));
  const tasks = await TemplateTask.findAll({ where: { template_id: template.id, id: taskIds } });
  if (tasks.length !== items.length) return res.status(400).json({ message: "One or more tasks do not belong to this template" });
  await sequelize.transaction(async (tx) => {
    for (const item of items) {
      await TemplateTask.update({ orderNo: Number(item.orderNo) }, { where: { id: Number(item.taskId), template_id: template.id }, transaction: tx });
    }
  });
  await writeAudit({ userId: req.user.sub, entityType: "template", entityId: template.id, action: "tasks_reordered" });
  const refreshed = await Template.findByPk(template.id, { include: [{ model: TemplateTask, as: "tasks" }] });
  res.json(refreshed);
});

router.post("/projects", authRequired, permit("PMO Admin", "Project Owner"), asyncHandler(async (req, res) => {
  const { templateId, ...projectPayload } = req.body;
  const project = await Project.create(projectPayload);
  const template = await Template.findByPk(templateId, { include: [{ model: TemplateTask, as: "tasks" }] });
  if (template?.tasks?.length) {
    await ProjectTask.bulkCreate(template.tasks.map((t) => ({
      project_id: project.id,
      name: t.name,
      description: t.description,
      responsibilityOwner: t.responsibilityOwner,
      status: t.defaultStatus
    })));
  }
  await writeAudit({ userId: req.user.sub, entityType: "project", entityId: project.id, action: "created", metadata: { templateId } });
  res.status(201).json(project);
}));

router.patch("/projects/:id", authRequired, permit("PMO Admin", "Project Owner"), asyncHandler(async (req, res) => {
  const project = await Project.findByPk(req.params.id);
  if (!project) return res.status(404).json({ message: "Project not found" });
  await project.update(req.body);
  await writeAudit({ userId: req.user.sub, entityType: "project", entityId: project.id, action: "updated", metadata: req.body });
  const notifyIds = await resolveNotificationUserIds(project.id, req.user.sub, req.body);
  if (notifyIds.length) {
    await createNotification({
      type: "PROJECT_UPDATED",
      content: `Project details updated for ${project.clientName}`,
      projectId: project.id,
      actorUserId: req.user.sub,
      userIds: notifyIds
    });
  }
  res.json(project);
}));

router.get("/projects", authRequired, async (req, res) => {
  const { tier, health, q } = req.query;
  const where = {};
  if (tier) where.tier = tier;
  if (health) where.health = health;
  if (q) where.clientName = { [Op.like]: `%${q}%` };
  const projects = await Project.findAll({ where, order: [["updatedAt", "DESC"]] });
  res.json(projects);
});

router.get("/projects/:id", authRequired, asyncHandler(async (req, res) => {
  const project = await Project.findByPk(req.params.id, {
    include: [
      { model: ProjectTask, as: "tasks" },
      { model: PmoComment, as: "pmoComments" }
    ]
  });
  if (!project) return res.status(404).json({ message: "Project not found" });

  let idsRecords = [];
  try {
    idsRecords = await IdsRecord.findAll({
      where: { project_id: Number(req.params.id) },
      include: [
        { model: User, as: "assignees", attributes: ["id", "fullName", "email"] },
        { model: ProjectTask, as: "linkedTasks", attributes: ["id", "name", "status", "priority"] }
      ],
      order: [["updatedAt", "DESC"]]
    });
  } catch (err) {
    // Keep project details available even if IDS graph has schema/data mismatch.
    console.warn("Non-fatal IDS load error for project details:", err?.message || err);
    idsRecords = [];
  }

  res.json({
    ...project.toJSON(),
    idsRecords
  });
}));

router.get("/projects/:id/tasks", authRequired, asyncHandler(async (req, res) => {
  const { status, priority, q, dueFrom, dueTo } = req.query;
  const where = { project_id: req.params.id };
  if (status) where.status = status;
  if (priority) where.priority = priority;
  if (q) where.name = { [Op.like]: `%${q}%` };
  if (dueFrom || dueTo) where.dueDate = { ...(dueFrom ? { [Op.gte]: new Date(dueFrom) } : {}), ...(dueTo ? { [Op.lte]: new Date(dueTo) } : {}) };
  const tasks = await ProjectTask.findAll({ where, order: [["updatedAt", "DESC"]] });
  const taskIds = tasks.map((task) => task.id);
  const dependencies = taskIds.length
    ? await TaskDependency.findAll({ where: { task_id: taskIds } })
    : [];
  const dependsOnSet = new Set(dependencies.map((dep) => dep.depends_on_task_id));
  const dependedTaskStatuses = dependsOnSet.size
    ? await ProjectTask.findAll({ where: { id: [...dependsOnSet] }, attributes: ["id", "status"] })
    : [];
  const statusMap = Object.fromEntries(dependedTaskStatuses.map((row) => [row.id, row.status]));
  const withDependencyFlags = tasks.map((task) => {
    const taskDeps = dependencies.filter((dep) => dep.task_id === task.id);
    const blockedByDependency = taskDeps.some((dep) => statusMap[dep.depends_on_task_id] !== "Completed");
    return { ...task.toJSON(), dependencies: taskDeps, blockedByDependency };
  });
  res.json(withDependencyFlags);
}));

router.patch("/tasks/:id", authRequired, asyncHandler(async (req, res) => {
  const task = await ProjectTask.findByPk(req.params.id);
  if (!task) return res.status(404).json({ message: "Task not found" });
  const before = task.toJSON();
  await task.update(req.body);
  const fieldActions = [];
  if (typeof req.body.status !== "undefined" && req.body.status !== before.status) fieldActions.push("status_changed");
  if (typeof req.body.dueDate !== "undefined" && String(req.body.dueDate) !== String(before.dueDate)) fieldActions.push("due_date_changed");
  if (typeof req.body.responsibilityOwner !== "undefined" && req.body.responsibilityOwner !== before.responsibilityOwner) fieldActions.push("assignment_changed");
  for (const action of fieldActions) {
    await writeAudit({
      userId: req.user.sub,
      entityType: "task",
      entityId: task.id,
      action,
      metadata: { before, after: task.toJSON(), project_id: task.project_id }
    });
  }
  await writeAudit({
    userId: req.user.sub,
    entityType: "task",
    entityId: task.id,
    action: "updated",
    metadata: { ...req.body, project_id: task.project_id }
  });
  const notifyIds = await resolveNotificationUserIds(task.project_id, req.user.sub, req.body);
  if (notifyIds.length) {
    await createNotification({
      type: "TASK_UPDATED",
      content: `Task "${task.name}" updated`,
      projectId: task.project_id,
      actorUserId: req.user.sub,
      userIds: notifyIds
    });
  }
  res.json(task);
}));

router.delete("/tasks/:id", authRequired, asyncHandler(async (req, res) => {
  const task = await ProjectTask.findByPk(req.params.id);
  if (!task) return res.status(404).json({ message: "Task not found" });
  const projectId = task.project_id;
  await TaskDependency.destroy({
    where: {
      [Op.or]: [{ task_id: task.id }, { depends_on_task_id: task.id }]
    }
  });
  await task.destroy();
  await writeAudit({
    userId: req.user.sub,
    entityType: "task",
    entityId: Number(req.params.id),
    action: "deleted",
    metadata: { project_id: projectId }
  });
  res.status(204).send();
}));

router.post("/projects/:id/tasks", authRequired, asyncHandler(async (req, res) => {
  const created = await ProjectTask.create({ ...req.body, project_id: req.params.id });
  await writeAudit({
    userId: req.user.sub,
    entityType: "task",
    entityId: created.id,
    action: "created",
    metadata: { ...req.body, project_id: Number(req.params.id) }
  });
  const notifyIds = await resolveNotificationUserIds(Number(req.params.id), req.user.sub, req.body);
  if (notifyIds.length) {
    await createNotification({
      type: "TASK_CREATED",
      content: `Task "${created.name}" added`,
      projectId: Number(req.params.id),
      actorUserId: req.user.sub,
      userIds: notifyIds
    });
  }
  res.status(201).json(created);
}));

router.post("/projects/:id/tasks/:taskId/dependencies", authRequired, asyncHandler(async (req, res) => {
  const task = await ProjectTask.findOne({ where: { id: req.params.taskId, project_id: req.params.id } });
  if (!task) return res.status(404).json({ message: "Task not found" });
  const dependencyTask = await ProjectTask.findOne({ where: { id: req.body.dependsOnTaskId, project_id: req.params.id } });
  if (!dependencyTask) return res.status(400).json({ message: "Dependency task must be in same project" });
  const [dependency] = await TaskDependency.findOrCreate({
    where: { task_id: Number(req.params.taskId), depends_on_task_id: Number(req.body.dependsOnTaskId) }
  });
  await writeAudit({
    userId: req.user.sub,
    entityType: "task",
    entityId: Number(req.params.taskId),
    action: "dependency_added",
    metadata: { dependsOnTaskId: Number(req.body.dependsOnTaskId) }
  });
  const notifyIds = await resolveNotificationUserIds(Number(req.params.id), req.user.sub, req.body);
  if (notifyIds.length) {
    await createNotification({
      type: "TASK_DEPENDENCY",
      content: `Dependency added to task "${task.name}"`,
      projectId: Number(req.params.id),
      actorUserId: req.user.sub,
      userIds: notifyIds
    });
  }
  res.status(201).json(dependency);
}));

router.delete("/projects/:id/tasks/:taskId/dependencies/:dependsOnTaskId", authRequired, asyncHandler(async (req, res) => {
  const deleted = await TaskDependency.destroy({
    where: { task_id: Number(req.params.taskId), depends_on_task_id: Number(req.params.dependsOnTaskId) }
  });
  if (!deleted) return res.status(404).json({ message: "Dependency not found" });
  await writeAudit({
    userId: req.user.sub,
    entityType: "task",
    entityId: Number(req.params.taskId),
    action: "dependency_removed",
    metadata: { dependsOnTaskId: Number(req.params.dependsOnTaskId) }
  });
  res.status(204).send();
}));

router.get("/tasks/:id/notes", authRequired, async (req, res) => {
  const task = await ProjectTask.findByPk(req.params.id);
  if (!task) return res.status(404).json({ message: "Task not found" });
  const notes = await TaskNote.findAll({
    where: { project_task_id: task.id },
    include: [{ model: TaskNoteHistory, as: "history" }],
    order: [["updatedAt", "DESC"], [{ model: TaskNoteHistory, as: "history" }, "createdAt", "DESC"]]
  });
  res.json(notes);
});

router.post("/tasks/:id/notes", authRequired, asyncHandler(async (req, res) => {
  const task = await ProjectTask.findByPk(req.params.id);
  if (!task) return res.status(404).json({ message: "Task not found" });
  const note = await TaskNote.create({
    project_task_id: task.id,
    content: req.body.content,
    version: 1,
    createdBy: req.user.sub,
    updatedBy: req.user.sub
  });
  await writeAudit({
    userId: req.user.sub,
    entityType: "task_note",
    entityId: note.id,
    action: "created",
    metadata: { taskId: task.id, project_id: task.project_id }
  });
  const notifyIds = await resolveNotificationUserIds(task.project_id, req.user.sub, req.body);
  if (notifyIds.length) {
    await createNotification({
      type: "TASK_NOTE",
      content: `New note added on task "${task.name}"`,
      projectId: task.project_id,
      actorUserId: req.user.sub,
      userIds: notifyIds
    });
  }
  res.status(201).json(note);
}));

router.patch("/tasks/:id/notes/:noteId", authRequired, asyncHandler(async (req, res) => {
  const task = await ProjectTask.findByPk(req.params.id);
  if (!task) return res.status(404).json({ message: "Task not found" });
  const note = await TaskNote.findOne({ where: { id: req.params.noteId, project_task_id: task.id } });
  if (!note) return res.status(404).json({ message: "Task note not found" });
  await TaskNoteHistory.create({
    task_note_id: note.id,
    content: note.content,
    updatedBy: req.user.sub
  });
  await note.update({
    content: req.body.content,
    version: note.version + 1,
    updatedBy: req.user.sub
  });
  await writeAudit({
    userId: req.user.sub,
    entityType: "task_note",
    entityId: note.id,
    action: "updated",
    metadata: { taskId: task.id, project_id: task.project_id, version: note.version }
  });
  const notifyIds = await resolveNotificationUserIds(task.project_id, req.user.sub, req.body);
  if (notifyIds.length) {
    await createNotification({
      type: "TASK_NOTE",
      content: `Task note updated on "${task.name}"`,
      projectId: task.project_id,
      actorUserId: req.user.sub,
      userIds: notifyIds
    });
  }
  res.json(note);
}));

router.get("/tasks/:id/activity", authRequired, async (req, res) => {
  const rows = await AuditLog.findAll({ order: [["createdAt", "DESC"]], limit: 300 });
  const filtered = rows.filter((row) =>
    (row.entityType === "task" && row.entityId === Number(req.params.id))
    || (row.entityType === "task_note" && row.metadata?.taskId === Number(req.params.id))
  );
  res.json(filtered.slice(0, 100));
});

router.get("/projects/:id/activity", authRequired, asyncHandler(async (req, res) => {
  const { userId, entityType, taskId, from, to, limit = 100 } = req.query;
  const where = {};
  if (userId) where.user_id = Number(userId);
  if (entityType) where.entityType = entityType;
  if (taskId) where.entityId = Number(taskId);
  if (from || to) where.createdAt = { ...(from ? { [Op.gte]: new Date(from) } : {}), ...(to ? { [Op.lte]: new Date(to) } : {}) };
  const rows = await AuditLog.findAll({ where, order: [["createdAt", "DESC"]], limit: Number(limit) });
  const filtered = rows.filter((row) => {
    if (row.entityType === "project" && row.entityId === Number(req.params.id)) return true;
    if (row.entityType === "task" && row.metadata?.project_id === Number(req.params.id)) return true;
    if (row.entityType === "task" && !row.metadata?.project_id) return true;
    return false;
  });
  res.json(filtered);
}));

router.post("/projects/:id/pmo-comments", authRequired, permit("PMO Admin"), asyncHandler(async (req, res) => {
  const comment = await PmoComment.create({
    project_id: req.params.id,
    user_id: req.user.sub,
    comment: req.body.comment,
    updatedBy: req.user.sub
  });
  const notifyIds = await resolveNotificationUserIds(Number(req.params.id), req.user.sub, req.body);
  if (notifyIds.length) {
    await createNotification({
      type: "PMO_COMMENT",
      content: `PMO comment updated for project ${req.params.id}`,
      projectId: Number(req.params.id),
      actorUserId: req.user.sub,
      userIds: notifyIds
    });
  }
  await writeAudit({ userId: req.user.sub, entityType: "project", entityId: Number(req.params.id), action: "pmo_comment_added" });
  res.status(201).json(comment);
}));

router.patch("/projects/:id/pmo-comments/:commentId", authRequired, permit("PMO Admin"), asyncHandler(async (req, res) => {
  const comment = await PmoComment.findOne({ where: { id: req.params.commentId, project_id: req.params.id } });
  if (!comment) return res.status(404).json({ message: "PMO comment not found" });
  await PmoCommentHistory.create({
    pmo_comment_id: comment.id,
    comment: comment.comment,
    updatedBy: req.user.sub
  });
  await comment.update({ comment: req.body.comment, updatedBy: req.user.sub });
  await writeAudit({
    userId: req.user.sub,
    entityType: "project",
    entityId: Number(req.params.id),
    action: "pmo_comment_updated",
    metadata: { commentId: comment.id }
  });
  const notifyIds = await resolveNotificationUserIds(Number(req.params.id), req.user.sub, req.body);
  if (notifyIds.length) {
    await createNotification({
      type: "PMO_COMMENT",
      content: `PMO comment edited for project ${req.params.id}`,
      projectId: Number(req.params.id),
      actorUserId: req.user.sub,
      userIds: notifyIds
    });
  }
  res.json(comment);
}));

router.get("/projects/:id/pmo-comments/history", authRequired, async (req, res) => {
  const comments = await PmoComment.findAll({
    where: { project_id: req.params.id },
    include: [{ model: PmoCommentHistory, as: "history" }],
    order: [["updatedAt", "DESC"], [{ model: PmoCommentHistory, as: "history" }, "createdAt", "DESC"]]
  });
  res.json(comments);
});

router.get("/ids", authRequired, asyncHandler(async (req, res) => {
  const { status, severity, type, projectId, q } = req.query;
  const where = {};
  if (status) where.status = status;
  if (severity) where.severity = severity;
  if (type) where.type = type;
  if (projectId) where.project_id = Number(projectId);
  if (q) where.title = { [Op.like]: `%${q}%` };
  const rows = await IdsRecord.findAll({
    where,
    include: [
      { model: Project, attributes: ["id", "clientName", "tier", "health"] },
      { model: User, as: "assignees", attributes: ["id", "fullName", "email"] },
      { model: ProjectTask, as: "linkedTasks", attributes: ["id", "name", "status", "priority"] }
    ],
    order: [["updatedAt", "DESC"]]
  });
  res.json(rows);
}));

router.get("/ids/:id", authRequired, asyncHandler(async (req, res) => {
  const row = await IdsRecord.findByPk(req.params.id, {
    include: [
      { model: Project, attributes: ["id", "clientName", "tier", "health", "summary"] },
      { model: User, as: "assignees", attributes: ["id", "fullName", "email"] },
      { model: ProjectTask, as: "linkedTasks", attributes: ["id", "name", "status", "priority"] }
    ]
  });
  if (!row) return res.status(404).json({ message: "IDS record not found" });
  res.json(row);
}));

router.post("/projects/:id/ids", authRequired, asyncHandler(async (req, res) => {
  const { assigneeUserIds = [], linkedTaskIds = [], ...payload } = req.body;
  const snapshot = { ...(await buildProjectSnapshot(Number(req.params.id))), ...(payload.snapshot || {}) };
  const ids = await IdsRecord.create({ ...payload, snapshot, project_id: req.params.id, raised_by: req.user.sub });
  if (Array.isArray(assigneeUserIds) && assigneeUserIds.length) {
    await IdsAssignee.bulkCreate(
      [...new Set(assigneeUserIds.map(Number))].map((userId) => ({ ids_record_id: ids.id, user_id: userId }))
    );
  }
  if (Array.isArray(linkedTaskIds) && linkedTaskIds.length) {
    const validTasks = await ProjectTask.findAll({ where: { id: linkedTaskIds.map(Number), project_id: Number(req.params.id) }, attributes: ["id"] });
    if (validTasks.length) {
      await IdsTaskLink.bulkCreate(validTasks.map((task) => ({ ids_record_id: ids.id, project_task_id: task.id })));
    }
  }
  await writeAudit({ userId: req.user.sub, entityType: "ids", entityId: ids.id, action: "created" });
  const notifyIds = await resolveNotificationUserIds(Number(req.params.id), req.user.sub, req.body);
  if (notifyIds.length) {
    await createNotification({
      type: "IDS_RAISED",
      content: `IDS raised: ${ids.title}`,
      projectId: Number(req.params.id),
      actorUserId: req.user.sub,
      userIds: notifyIds
    });
  }
  const hydrated = await IdsRecord.findByPk(ids.id, {
    include: [
      { model: Project, attributes: ["id", "clientName", "tier", "health"] },
      { model: User, as: "assignees", attributes: ["id", "fullName", "email"] },
      { model: ProjectTask, as: "linkedTasks", attributes: ["id", "name", "status", "priority"] }
    ]
  });
  res.status(201).json(hydrated);
}));

router.patch("/ids/:id", authRequired, asyncHandler(async (req, res) => {
  const ids = await IdsRecord.findByPk(req.params.id);
  if (!ids) return res.status(404).json({ message: "IDS record not found" });
  const { assigneeUserIds, linkedTaskIds, ...payload } = req.body;
  await ids.update(payload);
  if (Array.isArray(assigneeUserIds)) {
    await IdsAssignee.destroy({ where: { ids_record_id: ids.id } });
    if (assigneeUserIds.length) {
      await IdsAssignee.bulkCreate(
        [...new Set(assigneeUserIds.map(Number))].map((userId) => ({ ids_record_id: ids.id, user_id: userId }))
      );
    }
  }
  if (Array.isArray(linkedTaskIds)) {
    await IdsTaskLink.destroy({ where: { ids_record_id: ids.id } });
    if (linkedTaskIds.length) {
      const validTasks = await ProjectTask.findAll({ where: { id: linkedTaskIds.map(Number), project_id: ids.project_id }, attributes: ["id"] });
      if (validTasks.length) {
        await IdsTaskLink.bulkCreate(validTasks.map((task) => ({ ids_record_id: ids.id, project_task_id: task.id })));
      }
    }
  }
  await writeAudit({ userId: req.user.sub, entityType: "ids", entityId: ids.id, action: "updated", metadata: payload });
  const notifyIds = await resolveNotificationUserIds(ids.project_id, req.user.sub, req.body);
  if (notifyIds.length) {
    await createNotification({
      type: "IDS_UPDATED",
      content: `IDS updated: ${ids.title}`,
      projectId: ids.project_id,
      actorUserId: req.user.sub,
      userIds: notifyIds
    });
  }
  const hydrated = await IdsRecord.findByPk(ids.id, {
    include: [
      { model: Project, attributes: ["id", "clientName", "tier", "health"] },
      { model: User, as: "assignees", attributes: ["id", "fullName", "email"] },
      { model: ProjectTask, as: "linkedTasks", attributes: ["id", "name", "status", "priority"] }
    ]
  });
  res.json(hydrated);
}));

router.get("/projects/:id/risk", authRequired, asyncHandler(async (req, res) => {
  const tasks = await ProjectTask.findAll({ where: { project_id: req.params.id } });
  const now = new Date();
  const overdueTasks = tasks.filter((t) => t.dueDate && new Date(t.dueDate) < now && t.status !== "Completed").length;
  const blockedTasks = tasks.filter((t) => t.status === "Blocked").length;
  const dependencyRows = await TaskDependency.findAll({ where: { task_id: tasks.map((task) => task.id) } });
  const dependencyTaskIds = [...new Set(dependencyRows.map((row) => row.depends_on_task_id))];
  const dependencyTasks = dependencyTaskIds.length ? await ProjectTask.findAll({ where: { id: dependencyTaskIds }, attributes: ["id", "status"] }) : [];
  const dependencyStatusMap = Object.fromEntries(dependencyTasks.map((task) => [task.id, task.status]));
  const unresolvedDependencies = dependencyRows.filter((row) => dependencyStatusMap[row.depends_on_task_id] !== "Completed").length;
  const recentProjectAudit = await AuditLog.findAll({
    where: { entityType: "project", entityId: Number(req.params.id) },
    order: [["createdAt", "DESC"]],
    limit: 25
  });
  const staleDays = recentProjectAudit.length
    ? Math.floor((now.getTime() - new Date(recentProjectAudit[0].createdAt).getTime()) / (1000 * 60 * 60 * 24))
    : 999;
  const statusFlips = recentProjectAudit.filter((row) => row.action === "updated" && row.metadata?.health).length;
  const dueDateChanges = await AuditLog.count({
    where: { entityType: "task", action: "due_date_changed", createdAt: { [Op.gte]: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) } }
  });
  const snapshot = calculateRisk({
    overdueTasks,
    blockedTasks,
    unresolvedDependencies,
    idsCount: await IdsRecord.count({ where: { project_id: req.params.id, status: { [Op.in]: ["Open", "In Progress"] } } }),
    staleDays,
    statusFlips,
    repeatedTaskDelays: dueDateChanges
  });
  const created = await RiskAssessment.create({
    ...snapshot,
    project_id: req.params.id,
    reasons: snapshot.reasons,
    recommendations: snapshot.recommendations
  });
  res.json(created);
}));

router.get("/projects/:id/risk/history", authRequired, asyncHandler(async (req, res) => {
  const rows = await RiskAssessment.findAll({
    where: { project_id: req.params.id },
    order: [["createdAt", "DESC"]],
    limit: Number(req.query.limit || 30)
  });
  res.json(rows);
}));

router.get("/projects/:id/reminders", authRequired, asyncHandler(async (req, res) => {
  const rows = await Reminder.findAll({
    where: { project_id: req.params.id },
    include: [{ model: User, attributes: ["id", "fullName", "email"] }],
    order: [["updatedAt", "DESC"]]
  });
  res.json(rows);
}));

router.post("/projects/:id/reminders", authRequired, asyncHandler(async (req, res) => {
  const created = await Reminder.create({
    projectId: Number(req.params.id),
    targetUserId: Number(req.body.targetUserId),
    reminderType: req.body.reminderType,
    intervalMinutes: Number(req.body.intervalMinutes || 1440),
    isActive: typeof req.body.isActive === "boolean" ? req.body.isActive : true
  });
  await writeAudit({
    userId: req.user.sub,
    entityType: "reminder",
    entityId: created.id,
    action: "created",
    metadata: { project_id: Number(req.params.id) }
  });
  res.status(201).json(created);
}));

router.patch("/projects/:id/reminders/:reminderId", authRequired, asyncHandler(async (req, res) => {
  const reminder = await Reminder.findOne({ where: { id: req.params.reminderId, project_id: req.params.id } });
  if (!reminder) return res.status(404).json({ message: "Reminder not found" });
  await reminder.update({
    ...(typeof req.body.targetUserId !== "undefined" ? { targetUserId: Number(req.body.targetUserId) } : {}),
    ...(typeof req.body.reminderType !== "undefined" ? { reminderType: req.body.reminderType } : {}),
    ...(typeof req.body.intervalMinutes !== "undefined" ? { intervalMinutes: Number(req.body.intervalMinutes) } : {}),
    ...(typeof req.body.isActive !== "undefined" ? { isActive: !!req.body.isActive } : {})
  });
  await writeAudit({
    userId: req.user.sub,
    entityType: "reminder",
    entityId: reminder.id,
    action: "updated",
    metadata: { project_id: Number(req.params.id), ...req.body }
  });
  res.json(reminder);
}));

router.delete("/projects/:id/reminders/:reminderId", authRequired, asyncHandler(async (req, res) => {
  const deleted = await Reminder.destroy({ where: { id: req.params.reminderId, project_id: req.params.id } });
  if (!deleted) return res.status(404).json({ message: "Reminder not found" });
  await writeAudit({
    userId: req.user.sub,
    entityType: "reminder",
    entityId: Number(req.params.reminderId),
    action: "deleted",
    metadata: { project_id: Number(req.params.id) }
  });
  res.status(204).send();
}));

router.get("/projects/:id/reminder-logs", authRequired, asyncHandler(async (req, res) => {
  const reminderIds = (await Reminder.findAll({ where: { project_id: req.params.id }, attributes: ["id"] })).map((row) => row.id);
  if (!reminderIds.length) return res.json([]);
  const logs = await ReminderLog.findAll({
    where: { reminder_id: reminderIds },
    order: [["createdAt", "DESC"]],
    limit: Number(req.query.limit || 100)
  });
  res.json(logs);
}));

router.get("/dashboards/summary", authRequired, asyncHandler(async (req, res) => {
  const { tier, from, to } = req.query;
  const projectWhere = {};
  if (tier) projectWhere.tier = tier;
  if (from || to) {
    projectWhere.createdAt = {
      ...(from ? { [Op.gte]: new Date(from) } : {}),
      ...(to ? { [Op.lte]: new Date(to) } : {})
    };
  }
  const [projects, tasks] = await Promise.all([
    Project.findAll({ where: projectWhere, attributes: ["id", "tier", "health", "createdAt", "regions"] }),
    ProjectTask.findAll({ attributes: ["id", "status", "dueDate", "project_id"] })
  ]);
  const filteredProjectIds = projects.map((project) => project.id);
  const filteredTasks = filteredProjectIds.length
    ? tasks.filter((task) => filteredProjectIds.includes(task.project_id))
    : [];
  const filteredActiveIds = filteredProjectIds.length
    ? await IdsRecord.count({
      where: {
        project_id: filteredProjectIds,
        status: { [Op.in]: ["Open", "In Progress"] }
      }
    })
    : 0;
  const now = new Date();
  const totalProjects = projects.length;
  const overdueTasks = filteredTasks.filter((task) => task.dueDate && new Date(task.dueDate) < now && task.status !== "Completed").length;
  const blockedTasks = filteredTasks.filter((task) => task.status === "Blocked").length;
  const completedTasks = filteredTasks.filter((task) => task.status === "Completed").length;
  const completionRate = filteredTasks.length ? Math.round((completedTasks / filteredTasks.length) * 100) : 0;

  const projectsByTier = { "Tier 1": 0, "Tier 2": 0, "Tier 3": 0 };
  const ragDistribution = { Green: 0, Amber: 0, Red: 0 };
  const projectsByRegion = {};
  for (const project of projects) {
    projectsByTier[project.tier] = (projectsByTier[project.tier] || 0) + 1;
    ragDistribution[project.health] = (ragDistribution[project.health] || 0) + 1;
    normalizeToArray(project.regions).forEach((region) => {
      projectsByRegion[region] = (projectsByRegion[region] || 0) + 1;
    });
  }

  const taskStatusDistribution = { "Not Started": 0, "In Progress": 0, Completed: 0, Blocked: 0 };
  for (const task of filteredTasks) taskStatusDistribution[task.status] = (taskStatusDistribution[task.status] || 0) + 1;

  const trendMap = {};
  projects.forEach((project) => {
    const key = new Date(project.createdAt).toISOString().slice(0, 10);
    trendMap[key] = (trendMap[key] || 0) + 1;
  });
  const progressTrend = Object.entries(trendMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-14)
    .map(([date, createdProjects]) => ({ date, createdProjects }));

  res.json({
    totalProjects,
    overdueTasks,
    blockedTasks,
    activeIds: filteredActiveIds,
    completionRate,
    projectsByTier,
    ragDistribution,
    taskStatusDistribution,
    projectsByRegion,
    progressTrend
  });
}));

router.get("/dashboards/drilldown", authRequired, asyncHandler(async (req, res) => {
  const { section, tier, from, to } = req.query;
  if (!section) return res.status(400).json({ message: "section is required" });

  const projectWhere = {};
  if (tier) projectWhere.tier = tier;
  if (from || to) {
    projectWhere.createdAt = {
      ...(from ? { [Op.gte]: new Date(from) } : {}),
      ...(to ? { [Op.lte]: new Date(to) } : {})
    };
  }

  const projects = await Project.findAll({
    where: projectWhere,
    attributes: ["id", "clientName", "tier", "health", "createdAt", "updatedAt"],
    order: [["updatedAt", "DESC"]]
  });
  const projectIds = projects.map((project) => project.id);
  if (!projectIds.length) return res.json({ section, rows: [] });

  if (section === "totalProjects") {
    return res.json({ section, rows: projects });
  }

  if (section === "overdueTasks") {
    const now = new Date();
    const rows = await ProjectTask.findAll({
      where: {
        project_id: projectIds,
        status: { [Op.ne]: "Completed" },
        dueDate: { [Op.lt]: now }
      },
      attributes: ["id", "project_id", "name", "status", "priority", "dueDate", "responsibilityOwner"],
      order: [["dueDate", "ASC"]],
      limit: 200
    });
    return res.json({ section, rows });
  }

  if (section === "blockedTasks") {
    const rows = await ProjectTask.findAll({
      where: { project_id: projectIds, status: "Blocked" },
      attributes: ["id", "project_id", "name", "status", "priority", "dueDate", "responsibilityOwner"],
      order: [["updatedAt", "DESC"]],
      limit: 200
    });
    return res.json({ section, rows });
  }

  if (section === "activeIds") {
    const rows = await IdsRecord.findAll({
      where: { project_id: projectIds, status: { [Op.in]: ["Open", "In Progress"] } },
      include: [{ model: Project, attributes: ["id", "clientName", "tier", "health"] }],
      attributes: ["id", "project_id", "title", "type", "severity", "status", "updatedAt"],
      order: [["updatedAt", "DESC"]],
      limit: 200
    });
    return res.json({ section, rows });
  }

  if (section === "completionRate" || section === "taskStatus") {
    const rows = await ProjectTask.findAll({
      where: { project_id: projectIds },
      attributes: ["id", "project_id", "name", "status", "priority", "dueDate", "responsibilityOwner"],
      order: [["updatedAt", "DESC"]],
      limit: 250
    });
    return res.json({ section, rows });
  }

  if (section === "ragDistribution") {
    const rows = await Project.findAll({
      where: projectWhere,
      attributes: ["id", "clientName", "tier", "health", "updatedAt"],
      order: [["updatedAt", "DESC"]],
      limit: 250
    });
    return res.json({ section, rows });
  }

  if (section === "progressTrend") {
    const rows = await Project.findAll({
      where: projectWhere,
      attributes: ["id", "clientName", "tier", "health", "createdAt"],
      order: [["createdAt", "DESC"]],
      limit: 250
    });
    return res.json({ section, rows });
  }

  return res.status(400).json({ message: "Unsupported section" });
}));

router.get("/reports/overview", authRequired, asyncHandler(async (req, res) => {
  const { tier, region, pmoAssigned, projectOwner, health, from, to } = req.query;
  const projectWhere = {};
  if (tier) projectWhere.tier = tier;
  if (health) projectWhere.health = health;
  if (pmoAssigned) projectWhere.pmoAssigned = Number(pmoAssigned);
  if (projectOwner) projectWhere.projectOwner = Number(projectOwner);
  if (from || to) projectWhere.createdAt = { ...(from ? { [Op.gte]: new Date(from) } : {}), ...(to ? { [Op.lte]: new Date(to) } : {}) };

  let projects = await Project.findAll({ where: projectWhere, attributes: ["id", "tier", "health", "regions"] });
  if (region) projects = projects.filter((project) => normalizeToArray(project.regions).includes(region));
  const projectIds = projects.map((project) => project.id);

  const [tasks, ids] = await Promise.all([
    projectIds.length ? ProjectTask.findAll({ where: { project_id: projectIds }, attributes: ["status", "project_id", "responsibilityOwner"] }) : [],
    projectIds.length ? IdsRecord.findAll({ where: { project_id: projectIds }, attributes: ["status", "severity"] }) : []
  ]);

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((task) => task.status === "Completed").length;
  const blockedTasks = tasks.filter((task) => task.status === "Blocked").length;
  const overdueTasks = tasks.filter((task) => task.status !== "Completed").length;
  const activeIds = ids.filter((row) => ["Open", "In Progress"].includes(row.status)).length;

  const workload = {};
  tasks.forEach((task) => {
    const key = task.responsibilityOwner || "Unassigned";
    workload[key] = (workload[key] || 0) + 1;
  });

  res.json({
    totalProjects: projects.length,
    totalTasks,
    completedTasks,
    completionRate: totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0,
    blockedTasks,
    overdueTasks,
    activeIds,
    projectsByTier: projects.reduce((acc, project) => ({ ...acc, [project.tier]: (acc[project.tier] || 0) + 1 }), {}),
    projectsByHealth: projects.reduce((acc, project) => ({ ...acc, [project.health]: (acc[project.health] || 0) + 1 }), {}),
    workload
  });
}));

router.get("/audit-logs", authRequired, asyncHandler(async (req, res) => {
  const { entityType, userId, projectId, taskId, from, to, page = 1, limit = 20 } = req.query;
  const where = {};
  if (entityType) where.entityType = entityType;
  if (userId) where.user_id = userId;
  if (from || to) where.createdAt = { ...(from ? { [Op.gte]: new Date(from) } : {}), ...(to ? { [Op.lte]: new Date(to) } : {}) };
  const rows = await AuditLog.findAll({
    where,
    include: [{ model: User, attributes: ["id", "fullName", "email"] }],
    offset: (page - 1) * limit,
    limit: Number(limit),
    order: [["createdAt", "DESC"]]
  });
  const filtered = rows.filter((row) => {
    if (projectId && Number(projectId) !== row.entityId && Number(projectId) !== row.metadata?.project_id) return false;
    if (taskId && Number(taskId) !== row.entityId && Number(taskId) !== row.metadata?.taskId) return false;
    return true;
  });
  res.json(filtered);
}));

router.get("/notifications", authRequired, asyncHandler(async (req, res) => {
  const rows = await NotificationRecipient.findAll({
    where: { user_id: req.user.sub },
    include: [{ model: Notification }],
    order: [["createdAt", "DESC"]]
  });
  res.json(rows);
}));

router.get("/notifications/unread-count", authRequired, async (req, res) => {
  const count = await NotificationRecipient.count({ where: { user_id: req.user.sub, readAt: null } });
  res.json({ count });
});

router.patch("/notifications/:id/read", authRequired, async (req, res) => {
  const row = await NotificationRecipient.findByPk(req.params.id);
  if (!row) return res.status(404).json({ message: "Notification recipient record not found" });
  if (row.user_id !== req.user.sub) return res.status(403).json({ message: "Forbidden" });
  await row.update({ readAt: new Date() });
  res.json(row);
});

export default router;
