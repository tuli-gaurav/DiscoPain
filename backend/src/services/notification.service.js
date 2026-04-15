import { Notification, NotificationRecipient } from "../config/db.js";
import { emitToUser } from "./socket.service.js";

export async function createNotification({ type, content, projectId = null, actorUserId, userIds = [] }) {
  const notification = await Notification.create({
    type,
    content,
    projectId,
    createdBy: actorUserId
  });
  if (userIds.length) {
    const recipients = await NotificationRecipient.bulkCreate(
      userIds.map((userId) => ({ notification_id: notification.id, user_id: userId }))
    );
    for (const recipient of recipients) {
      emitToUser(recipient.user_id, "notification:new", {
        id: recipient.id,
        notificationId: notification.id,
        type,
        content,
        projectId,
        createdAt: notification.createdAt
      });
    }
  }
  return notification;
}
