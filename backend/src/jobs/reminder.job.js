import cron from "node-cron";
import { Op } from "sequelize";
import { Project, ProjectTask, Reminder, ReminderLog } from "../config/db.js";
import { createNotification } from "../services/notification.service.js";

export function startReminderJob() {
  cron.schedule("*/10 * * * *", async () => {
    const now = new Date();
    const reminders = await Reminder.findAll({ where: { isActive: true } });
    for (const reminder of reminders) {
      const lastRun = reminder.lastRunAt ? new Date(reminder.lastRunAt) : null;
      const dueForRun = !lastRun || (now.getTime() - lastRun.getTime()) >= reminder.intervalMinutes * 60 * 1000;
      if (!dueForRun) continue;

      const project = await Project.findByPk(reminder.projectId, { attributes: ["id", "clientName", "updatedAt"] });
      if (!project) continue;

      let shouldSend = false;
      let summary = "";
      if (reminder.reminderType === "DUE_SOON") {
        const soon = new Date(now.getTime() + 48 * 60 * 60 * 1000);
        const count = await ProjectTask.count({
          where: {
            project_id: reminder.projectId,
            dueDate: { [Op.between]: [now, soon] },
            status: { [Op.ne]: "Completed" }
          }
        });
        shouldSend = count > 0;
        summary = `${count} upcoming task(s) due within 48h`;
      } else if (reminder.reminderType === "OVERDUE") {
        const count = await ProjectTask.count({
          where: {
            project_id: reminder.projectId,
            dueDate: { [Op.lt]: now },
            status: { [Op.ne]: "Completed" }
          }
        });
        shouldSend = count > 0;
        summary = `${count} overdue task(s)`;
      } else if (reminder.reminderType === "INACTIVE_PROJECT") {
        const staleHours = (now.getTime() - new Date(project.updatedAt).getTime()) / (1000 * 60 * 60);
        shouldSend = staleHours >= 72;
        summary = `project has been inactive for ${Math.floor(staleHours)} hour(s)`;
      }

      if (shouldSend) {
        await createNotification({
          type: "REMINDER",
          content: `${project.clientName}: ${summary}`,
          projectId: reminder.projectId,
          actorUserId: reminder.targetUserId,
          userIds: [reminder.targetUserId]
        });
        await ReminderLog.create({
          reminderId: reminder.id,
          reminderType: reminder.reminderType,
          sentToUserId: reminder.targetUserId,
          details: { projectId: reminder.projectId, summary, generatedAt: now.toISOString() }
        });
      }
      await reminder.update({ lastRunAt: now });
    }
  }, { timezone: "UTC" });
}
