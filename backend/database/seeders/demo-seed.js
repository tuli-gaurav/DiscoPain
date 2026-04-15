import bcrypt from "bcryptjs";
import {
  sequelize,
  Role,
  User,
  Template,
  TemplateTask,
  Project,
  ProjectTask,
  ProjectMember,
  IdsRecord,
  IdsAssignee,
  IdsTaskLink,
  PmoComment,
  PmoCommentHistory,
  TaskDependency,
  TaskNote,
  TaskNoteHistory,
  RiskAssessment,
  Reminder,
  ReminderLog,
  Notification,
  NotificationRecipient,
  AuditLog
} from "../../src/config/db.js";

async function upsertRole(name) {
  const [role] = await Role.findOrCreate({ where: { name } });
  return role;
}

async function run() {
  await sequelize.authenticate();
  await sequelize.sync({ alter: true });

  const roles = await Promise.all([
    upsertRole("PMO Admin"),
    upsertRole("Project Owner"),
    upsertRole("Team Member"),
    upsertRole("Stakeholder")
  ]);

  const users = await Promise.all([
    User.findOrCreate({
      where: { email: "admin@discopain.local" },
      defaults: { fullName: "Priya PMO", passwordHash: await bcrypt.hash("Password123!", 10) }
    }),
    User.findOrCreate({
      where: { email: "owner@discopain.local" },
      defaults: { fullName: "Omar Owner", passwordHash: await bcrypt.hash("Password123!", 10) }
    }),
    User.findOrCreate({
      where: { email: "member@discopain.local" },
      defaults: { fullName: "Mina Member", passwordHash: await bcrypt.hash("Password123!", 10) }
    }),
    User.findOrCreate({
      where: { email: "stakeholder@discopain.local" },
      defaults: { fullName: "Sam Stakeholder", passwordHash: await bcrypt.hash("Password123!", 10) }
    })
  ]);

  const [admin, owner, member, stakeholder] = users.map((u) => u[0]);
  await admin.addRole(roles[0]);
  await owner.addRole(roles[1]);
  await member.addRole(roles[2]);
  await stakeholder.addRole(roles[3]);

  for (const tier of ["Tier 1", "Tier 2", "Tier 3"]) {
    const [template] = await Template.findOrCreate({ where: { name: `${tier} Standard`, tier } });
    const existing = await TemplateTask.count({ where: { template_id: template.id } });
    if (!existing) {
      await TemplateTask.bulkCreate([
        { template_id: template.id, name: `${tier} Kickoff`, orderNo: 1, defaultStatus: "Not Started", responsibilityOwner: "PMO" },
        { template_id: template.id, name: `${tier} Data Validation`, orderNo: 2, defaultStatus: "Not Started", responsibilityOwner: "Project Owner" },
        { template_id: template.id, name: `${tier} Handover`, orderNo: 3, defaultStatus: "Not Started", responsibilityOwner: "Team Member" }
      ]);
    }
  }

  const [tier1Template] = await Template.findAll({ where: { tier: "Tier 1" }, limit: 1 });
  const [tier2Template] = await Template.findAll({ where: { tier: "Tier 2" }, limit: 1 });
  const [tier3Template] = await Template.findAll({ where: { tier: "Tier 3" }, limit: 1 });

  async function seedTasksFromTemplate(project, template, mode) {
    const taskCount = await ProjectTask.count({ where: { project_id: project.id } });
    if (taskCount || !template) return;
    const templateTasks = await TemplateTask.findAll({ where: { template_id: template.id }, order: [["orderNo", "ASC"]] });
    await ProjectTask.bulkCreate(
      templateTasks.map((task, idx) => {
        const overdueDate = new Date(Date.now() - (idx + 1) * 24 * 60 * 60 * 1000);
        const futureDate = new Date(Date.now() + (idx + 2) * 24 * 60 * 60 * 1000);
        const status = mode === "high-risk"
          ? (idx === 0 ? "Blocked" : idx === 1 ? "In Progress" : "Not Started")
          : mode === "stable"
            ? (idx === 0 ? "Completed" : "In Progress")
            : (idx === 0 ? "In Progress" : "Not Started");
        return {
          project_id: project.id,
          name: task.name,
          description: task.description || "Seeded from template",
          responsibilityOwner: task.responsibilityOwner,
          status,
          priority: idx === 1 ? "High" : "Medium",
          dueDate: mode === "high-risk" ? overdueDate : futureDate
        };
      })
    );
  }
  const tiers = ["Tier 1", "Tier 2", "Tier 3"];
  const regionsOptions = [
    ["EMEA", "NA"],
    ["APAC"],
    ["EU"],
    ["LATAM"],
    ["MEA", "NA"]
  ];
  const healthByIndex = ["Green", "Amber", "Red"];

  const projects = [];
  for (let i = 1; i <= 50; i += 1) {
    const tier = tiers[(i - 1) % tiers.length];
    const health = healthByIndex[(i - 1) % healthByIndex.length];
    const [project] = await Project.findOrCreate({
      where: { clientName: `Demo Client ${String(i).padStart(2, "0")}` },
      defaults: {
        regions: regionsOptions[(i - 1) % regionsOptions.length],
        costInvolved: 20000 + i * 3500,
        stakeholders: [`Stakeholder ${i}`, `Business Lead ${i}`],
        pmoAssigned: admin.id,
        projectOwner: owner.id,
        contributingTeam: [`Team ${((i - 1) % 5) + 1}`, "Integration"],
        tier,
        health,
        summary: `Seeded project ${i} for QA validation across modules.`
      }
    });
    projects.push(project);
  }

  for (const project of projects) {
    await ProjectMember.findOrCreate({ where: { project_id: project.id, user_id: admin.id }, defaults: { roleInProject: "PMO Admin" } });
    await ProjectMember.findOrCreate({ where: { project_id: project.id, user_id: owner.id }, defaults: { roleInProject: "Project Owner" } });
    await ProjectMember.findOrCreate({ where: { project_id: project.id, user_id: member.id }, defaults: { roleInProject: "Contributor" } });
    await ProjectMember.findOrCreate({ where: { project_id: project.id, user_id: stakeholder.id }, defaults: { roleInProject: "Stakeholder" } });
  }

  for (let i = 0; i < projects.length; i += 1) {
    const project = projects[i];
    const mode = i % 4 === 0 ? "high-risk" : i % 4 === 1 ? "normal" : "stable";
    const template = project.tier === "Tier 1" ? tier1Template : project.tier === "Tier 2" ? tier2Template : tier3Template;
    await seedTasksFromTemplate(project, template, mode);
  }

  for (let i = 0; i < projects.length; i += 1) {
    const project = projects[i];
    const tasks = await ProjectTask.findAll({ where: { project_id: project.id }, order: [["id", "ASC"]] });
    if (tasks.length >= 2) {
      await TaskDependency.findOrCreate({ where: { task_id: tasks[1].id, depends_on_task_id: tasks[0].id } });
    }
    if (tasks[0]) {
      const [note] = await TaskNote.findOrCreate({
        where: { project_task_id: tasks[0].id, content: `Kickoff note for ${project.clientName}` },
        defaults: { version: 1, createdBy: member.id, updatedBy: member.id }
      });
      await TaskNoteHistory.findOrCreate({
        where: { task_note_id: note.id, content: `Initial version for ${project.clientName}`, updatedBy: member.id }
      });
    }

    const [pmo] = await PmoComment.findOrCreate({
      where: { project_id: project.id, comment: `PMO review for ${project.clientName}` },
      defaults: { user_id: admin.id, updatedBy: admin.id }
    });
    await PmoCommentHistory.findOrCreate({
      where: { pmo_comment_id: pmo.id, comment: `First PMO checkpoint for ${project.clientName}`, updatedBy: admin.id }
    });

    if (i % 2 === 0) {
      const [ids] = await IdsRecord.findOrCreate({
        where: { project_id: project.id, title: `IDS Escalation ${project.clientName}` },
        defaults: {
          description: `Seeded IDS for ${project.clientName}`,
          type: i % 3 === 0 ? "Dependency" : "Issue",
          severity: i % 5 === 0 ? "Critical" : "High",
          raised_by: admin.id,
          status: i % 4 === 0 ? "In Progress" : "Open"
        }
      });
      await IdsAssignee.findOrCreate({ where: { ids_record_id: ids.id, user_id: owner.id } });
      await IdsAssignee.findOrCreate({ where: { ids_record_id: ids.id, user_id: member.id } });
      if (tasks[0]) await IdsTaskLink.findOrCreate({ where: { ids_record_id: ids.id, project_task_id: tasks[0].id } });
    }

    const score = project.health === "Red" ? 82 : project.health === "Amber" ? 58 : 22;
    const level = score >= 70 ? "High" : score >= 40 ? "Medium" : "Low";
    await RiskAssessment.findOrCreate({
      where: { project_id: project.id, score, level },
      defaults: {
        reasons: level === "High" ? ["Multiple overdue tasks", "Active IDS"] : level === "Medium" ? ["Some delayed execution"] : ["Healthy delivery pace"],
        recommendations: level === "High"
          ? ["Escalate governance and unblock dependencies."]
          : level === "Medium"
            ? ["Re-check milestones and owners weekly."]
            : ["Maintain current governance cadence."]
      }
    });

    const [reminder] = await Reminder.findOrCreate({
      where: { projectId: project.id, targetUserId: owner.id, reminderType: i % 3 === 0 ? "OVERDUE" : "DUE_SOON" },
      defaults: { intervalMinutes: i % 3 === 0 ? 360 : 720, isActive: true }
    });
    await ReminderLog.findOrCreate({
      where: { reminderId: reminder.id, reminderType: reminder.reminderType, sentToUserId: owner.id },
      defaults: {
        details: {
          projectId: project.id,
          summary: `Seeded reminder event for ${project.clientName}`,
          generatedAt: new Date().toISOString()
        }
      }
    });

    const [notification] = await Notification.findOrCreate({
      where: {
        type: "PROJECT_UPDATED",
        content: `Project details updated for ${project.clientName}`,
        projectId: project.id,
        createdBy: admin.id
      }
    });
    await NotificationRecipient.findOrCreate({ where: { notification_id: notification.id, user_id: owner.id } });
    await NotificationRecipient.findOrCreate({ where: { notification_id: notification.id, user_id: member.id } });

    await AuditLog.findOrCreate({
      where: { user_id: admin.id, entityType: "project", entityId: project.id, action: "seed_bootstrap_project" },
      defaults: { metadata: { note: "Seeded demo project baseline", project_id: project.id } }
    });
  }

  console.log("Demo seed completed.");
  await sequelize.close();
}

run().catch(async (err) => {
  console.error("Demo seed failed:", err);
  await sequelize.close();
  process.exit(1);
});
