import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { io } from "socket.io-client";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import StatusPill from "../components/StatusPill";

function MetricIcon({ tone = "indigo", children }) {
  return <span className={`metric-icon metric-icon-${tone}`}>{children}</span>;
}

export default function NotificationsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => (await api.get("/notifications")).data
  });

  useEffect(() => {
    if (!user?.id) return undefined;
    const socket = io((import.meta.env.VITE_API_URL || "http://localhost:4000/api").replace("/api", ""));
    socket.emit("join-user", user.id);
    socket.on("notification:new", () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications-unread-count"] });
    });
    return () => socket.disconnect();
  }, [queryClient, user?.id]);

  const markRead = useMutation({
    mutationFn: async (recipientId) => (await api.patch(`/notifications/${recipientId}/read`)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications-unread-count"] });
    }
  });
  const unreadCount = notifications.filter((row) => !row.readAt).length;

  return (
    <div className="bg-white rounded-xl shadow p-6 card-premium card-entrance">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-semibold flex items-center gap-2">
          <MetricIcon tone="blue">NT</MetricIcon>
          Notifications
        </h2>
        <StatusPill value={`${unreadCount} unread`} type={unreadCount ? "ids-status" : "task"} />
      </div>
      <div className="space-y-3">
        {notifications.map((row) => (
          <div key={row.id} className={`border rounded p-3 card-premium ${row.readAt ? "bg-white" : "bg-indigo-50 border-indigo-200"}`}>
            <div className="flex justify-between gap-3">
              <div>
                <div className="font-medium flex items-center gap-2">
                  {row.Notification?.type}
                  <StatusPill value={row.readAt ? "Read" : "New"} type={row.readAt ? "task" : "ids-status"} />
                </div>
                <div className="text-sm text-slate-700">{row.Notification?.content}</div>
                <div className="text-xs text-slate-500 mt-1">{new Date(row.createdAt).toLocaleString()}</div>
              </div>
              {!row.readAt && (
                <button className="border rounded px-2 py-1 text-sm" onClick={() => markRead.mutate(row.id)}>
                  Mark read
                </button>
              )}
            </div>
          </div>
        ))}
        {!notifications.length && <div className="text-sm text-slate-500">No notifications yet.</div>}
      </div>
    </div>
  );
}
