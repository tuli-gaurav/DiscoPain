import http from "http";
import { Server } from "socket.io";
import bcrypt from "bcryptjs";
import app from "./app.js";
import { env } from "./config/env.js";
import { sequelize, Role, User, Template, TemplateTask } from "./config/db.js";
import { startReminderJob } from "./jobs/reminder.job.js";
import { setIo } from "./services/socket.service.js";

async function seedMinimumData() {
  const roleNames = ["PMO Admin", "Project Owner", "Team Member", "Stakeholder"];
  for (const name of roleNames) await Role.findOrCreate({ where: { name } });

  const [admin] = await User.findOrCreate({
    where: { email: "admin@discopain.local" },
    defaults: { fullName: "PMO Admin", passwordHash: await bcrypt.hash("Password123!", 10) }
  });
  const adminRole = await Role.findOne({ where: { name: "PMO Admin" } });
  await admin.addRole(adminRole);

  for (const tier of ["Tier 1", "Tier 2", "Tier 3"]) {
    const [template] = await Template.findOrCreate({ where: { name: `${tier} Default`, tier } });
    const count = await TemplateTask.count({ where: { template_id: template.id } });
    if (!count) {
      await TemplateTask.bulkCreate([
        { template_id: template.id, name: "Kickoff", orderNo: 1, defaultStatus: "Not Started", responsibilityOwner: "PMO" },
        { template_id: template.id, name: "Data Collection", orderNo: 2, defaultStatus: "Not Started", responsibilityOwner: "Project Owner" },
        { template_id: template.id, name: "Handover", orderNo: 3, defaultStatus: "Not Started", responsibilityOwner: "Team Member" }
      ]);
    }
  }
}

async function bootstrap() {
  await sequelize.authenticate();
  await sequelize.sync({ alter: true });
  await seedMinimumData();
  startReminderJob();

  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: env.clientUrl } });
  setIo(io);
  io.on("connection", (socket) => {
    socket.on("join-user", (userId) => socket.join(`user:${userId}`));
    socket.on("join-project", (projectId) => socket.join(`project:${projectId}`));
  });

  server.listen(env.port, () => {
    console.log(`API running on http://localhost:${env.port}`);
  });
}

bootstrap().catch((err) => {
  console.error("Server bootstrap failed", err);
  process.exit(1);
});
