import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useParams } from "react-router-dom";
import api from "../api/client";
import NotificationPromptModal from "../components/NotificationPromptModal";
import StatusPill from "../components/StatusPill";

function HealthBadge({ health }) {
  return <StatusPill value={health} type="health" />;
}

function normalizeToArray(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // If value isn't JSON, treat it as comma separated fallback.
    }
    return value.split(",").map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

export default function ProjectDetailsPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset } = useForm({ defaultValues: { comment: "" } });
  const { register: registerPmoEdit } = useForm();
  const { register: registerTask, handleSubmit: handleTaskSubmit, reset: resetTask } = useForm({
    defaultValues: { name: "", description: "", priority: "Medium", status: "Not Started", dueDate: "" }
  });
  const { register: registerNote, handleSubmit: handleNoteSubmit, reset: resetNote } = useForm({ defaultValues: { content: "" } });
  const { register: registerReminder, handleSubmit: handleReminderSubmit, reset: resetReminder } = useForm({
    defaultValues: { targetUserId: "", reminderType: "DUE_SOON", intervalMinutes: 1440 }
  });
  const [taskFilters, setTaskFilters] = useState({ status: "", priority: "", q: "" });
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [notifyModalOpen, setNotifyModalOpen] = useState(false);
  const [notifyCallback, setNotifyCallback] = useState(null);

  const { data: project, isLoading: projectLoading, error: projectError } = useQuery({
    queryKey: ["project", id],
    queryFn: async () => (await api.get(`/projects/${id}`)).data,
    retry: 1
  });
  const { data: tasks = [] } = useQuery({
    queryKey: ["project-tasks", id, taskFilters],
    queryFn: async () => (await api.get(`/projects/${id}/tasks`, { params: taskFilters })).data
  });
  const { data: activity = [] } = useQuery({
    queryKey: ["project-activity", id],
    queryFn: async () => (await api.get(`/projects/${id}/activity`)).data
  });
  const { data: risk } = useQuery({
    queryKey: ["risk", id],
    queryFn: async () => (await api.get(`/projects/${id}/risk`)).data
  });
  const { data: riskHistory = [] } = useQuery({
    queryKey: ["risk-history", id],
    queryFn: async () => (await api.get(`/projects/${id}/risk/history`)).data
  });
  const { data: taskNotes = [] } = useQuery({
    queryKey: ["task-notes", selectedTaskId],
    queryFn: async () => (await api.get(`/tasks/${selectedTaskId}/notes`)).data,
    enabled: Boolean(selectedTaskId)
  });
  const { data: taskActivity = [] } = useQuery({
    queryKey: ["task-activity", selectedTaskId],
    queryFn: async () => (await api.get(`/tasks/${selectedTaskId}/activity`)).data,
    enabled: Boolean(selectedTaskId)
  });
  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: async () => (await api.get("/users")).data
  });
  const { data: pmoCommentsWithHistory = [] } = useQuery({
    queryKey: ["pmo-comments-history", id],
    queryFn: async () => (await api.get(`/projects/${id}/pmo-comments/history`)).data
  });
  const { data: reminders = [] } = useQuery({
    queryKey: ["project-reminders", id],
    queryFn: async () => (await api.get(`/projects/${id}/reminders`)).data
  });
  const { data: reminderLogs = [] } = useQuery({
    queryKey: ["project-reminder-logs", id],
    queryFn: async () => (await api.get(`/projects/${id}/reminder-logs`)).data
  });

  const addComment = useMutation({
    mutationFn: async (payload) => (await api.post(`/projects/${id}/pmo-comments`, payload)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", id] });
      reset();
    }
  });
  const updatePmoComment = useMutation({
    mutationFn: async ({ commentId, comment }) => (await api.patch(`/projects/${id}/pmo-comments/${commentId}`, { comment })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", id] });
      queryClient.invalidateQueries({ queryKey: ["project-activity", id] });
      queryClient.invalidateQueries({ queryKey: ["pmo-comments-history", id] });
    }
  });
  const addTask = useMutation({
    mutationFn: async (payload) => (await api.post(`/projects/${id}/tasks`, payload)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", id] });
      queryClient.invalidateQueries({ queryKey: ["project-tasks", id] });
      queryClient.invalidateQueries({ queryKey: ["project-activity", id] });
      resetTask();
    }
  });
  const updateTask = useMutation({
    mutationFn: async ({ taskId, payload }) => (await api.patch(`/tasks/${taskId}`, payload)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", id] });
      queryClient.invalidateQueries({ queryKey: ["project-tasks", id] });
      queryClient.invalidateQueries({ queryKey: ["project-activity", id] });
    }
  });
  const addDependency = useMutation({
    mutationFn: async ({ taskId, ...payload }) =>
      (await api.post(`/projects/${id}/tasks/${taskId}/dependencies`, payload)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["project-tasks", id] })
  });
  const deleteTask = useMutation({
    mutationFn: async (taskId) => api.delete(`/tasks/${taskId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", id] });
      queryClient.invalidateQueries({ queryKey: ["project-tasks", id] });
      queryClient.invalidateQueries({ queryKey: ["project-activity", id] });
      setSelectedTaskId(null);
    }
  });
  const addTaskNote = useMutation({
    mutationFn: async ({ taskId, ...payload }) => (await api.post(`/tasks/${taskId}/notes`, payload)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-notes", selectedTaskId] });
      queryClient.invalidateQueries({ queryKey: ["task-activity", selectedTaskId] });
      resetNote();
    }
  });
  const updateTaskNote = useMutation({
    mutationFn: async ({ taskId, noteId, ...payload }) => (await api.patch(`/tasks/${taskId}/notes/${noteId}`, payload)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-notes", selectedTaskId] });
      queryClient.invalidateQueries({ queryKey: ["task-activity", selectedTaskId] });
    }
  });
  const createReminder = useMutation({
    mutationFn: async (payload) => (await api.post(`/projects/${id}/reminders`, payload)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-reminders", id] });
      resetReminder();
    }
  });
  const toggleReminder = useMutation({
    mutationFn: async ({ reminderId, isActive }) => (await api.patch(`/projects/${id}/reminders/${reminderId}`, { isActive })).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["project-reminders", id] })
  });
  const deleteReminder = useMutation({
    mutationFn: async (reminderId) => api.delete(`/projects/${id}/reminders/${reminderId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["project-reminders", id] })
  });

  const requestNotificationChoice = (callback) => {
    setNotifyCallback(() => callback);
    setNotifyModalOpen(true);
  };
  const onComment = (values) => {
    requestNotificationChoice((notifyPayload) => addComment.mutate({ comment: values.comment, ...notifyPayload }));
  };
  const onTaskCreate = (values) => {
    requestNotificationChoice((notifyPayload) => addTask.mutate({ ...values, ...notifyPayload }));
  };
  const onTaskNote = (values) => {
    if (!selectedTaskId) return;
    requestNotificationChoice((notifyPayload) => addTaskNote.mutate({ taskId: selectedTaskId, content: values.content, ...notifyPayload }));
  };
  const onCreateReminder = (values) => createReminder.mutate({ ...values, targetUserId: Number(values.targetUserId), intervalMinutes: Number(values.intervalMinutes) });
  const allTasks = useMemo(() => project?.tasks || [], [project]);

  if (projectLoading) return <div>Loading project...</div>;
  if (projectError) {
    const apiMessage = projectError?.response?.data?.message || projectError?.message || "Unknown error";
    return (
      <div className="bg-red-50 border border-red-200 rounded p-4 text-sm text-red-700">
        Failed to load project details: {apiMessage}
      </div>
    );
  }
  if (!project) return <div>Project not found.</div>;
  const regions = normalizeToArray(project.regions);
  const stakeholders = normalizeToArray(project.stakeholders);
  const contributingTeam = normalizeToArray(project.contributingTeam);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow p-6">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-semibold">{project.clientName}</h2>
            <p className="text-slate-500">Tier: {project.tier}</p>
          </div>
          <HealthBadge health={project.health} />
        </div>
        <p className="mt-4 text-slate-700">{project.summary || "No summary provided."}</p>
        <div className="grid md:grid-cols-3 gap-3 mt-4 text-sm">
          <div><span className="text-slate-500">Regions:</span> {regions.join(", ") || "-"}</div>
          <div><span className="text-slate-500">Stakeholders:</span> {stakeholders.join(", ") || "-"}</div>
          <div><span className="text-slate-500">Contributors:</span> {contributingTeam.join(", ") || "-"}</div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="text-lg font-semibold mb-3">Task Board</h3>
          <div className="grid md:grid-cols-3 gap-2 mb-3">
            <input className="border rounded px-3 py-2" placeholder="Search task" value={taskFilters.q} onChange={(e) => setTaskFilters((v) => ({ ...v, q: e.target.value }))} />
            <select className="border rounded px-3 py-2" value={taskFilters.status} onChange={(e) => setTaskFilters((v) => ({ ...v, status: e.target.value }))}>
              <option value="">All statuses</option>
              {["Not Started", "In Progress", "Completed", "Blocked"].map((status) => <option key={status}>{status}</option>)}
            </select>
            <select className="border rounded px-3 py-2" value={taskFilters.priority} onChange={(e) => setTaskFilters((v) => ({ ...v, priority: e.target.value }))}>
              <option value="">All priorities</option>
              {["Low", "Medium", "High", "Critical"].map((priority) => <option key={priority}>{priority}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            {tasks.map((task) => (
              <div
                key={task.id}
                className={`border rounded p-3 cursor-pointer ${selectedTaskId === task.id ? "border-indigo-500 bg-indigo-50" : "hover:bg-slate-50"}`}
                onClick={() => setSelectedTaskId(task.id)}
              >
                <div className="flex justify-between gap-2 items-center">
                  <div>
                    <div className="font-medium">{task.name}</div>
                    <div className="text-sm text-slate-500 flex items-center gap-2 mt-1">
                      <StatusPill value={task.status} type="task" />
                      <StatusPill value={task.priority} type="ids-severity" />
                    </div>
                    {task.blockedByDependency && <div className="text-xs text-red-600 mt-1">Blocked by incomplete dependencies</div>}
                  </div>
                  <div className="flex gap-2">
                    <select
                      className="border rounded px-2 py-1 text-sm"
                      value={task.status}
                      onChange={(e) => requestNotificationChoice((notifyPayload) => updateTask.mutate({ taskId: task.id, payload: { status: e.target.value, ...notifyPayload } }))}
                    >
                      {["Not Started", "In Progress", "Completed", "Blocked"].map((status) => <option key={status}>{status}</option>)}
                    </select>
                    <select
                      className="border rounded px-2 py-1 text-sm"
                      onChange={(e) => {
                        if (!e.target.value) return;
                        requestNotificationChoice((notifyPayload) =>
                          addDependency.mutate({ taskId: task.id, dependsOnTaskId: Number(e.target.value), ...notifyPayload })
                        );
                      }}
                    >
                      <option value="">Add dependency</option>
                      {allTasks.filter((candidate) => candidate.id !== task.id).map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}
                    </select>
                    <button className="border rounded px-2 py-1 text-sm" onClick={() => setSelectedTaskId(task.id)}>Notes</button>
                    <button className="border rounded px-2 py-1 text-sm text-red-600" onClick={() => deleteTask.mutate(task.id)}>Delete</button>
                  </div>
                </div>
                {selectedTaskId === task.id && (
                  <div className="mt-3 pt-3 border-t text-sm space-y-1">
                    <div><span className="text-slate-500">Due date:</span> {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "-"}</div>
                    <div><span className="text-slate-500">Description:</span> {task.description || "-"}</div>
                    <div><span className="text-slate-500">Dependencies:</span> {task.dependencies?.length || 0}</div>
                    <details className="mt-2">
                      <summary className="cursor-pointer text-sm font-medium text-indigo-700">Notes (collapse/expand)</summary>
                      <div className="mt-2 space-y-2">
                        <form className="flex gap-2" onSubmit={handleNoteSubmit(onTaskNote)}>
                          <input className="flex-1 border rounded px-3 py-2" placeholder="Add note" {...registerNote("content", { required: true })} />
                          <button className="bg-indigo-600 text-white rounded px-3">Add</button>
                        </form>
                        <div className="space-y-2 max-h-48 overflow-auto">
                          {taskNotes.map((note) => (
                            <div key={note.id} className="border rounded p-2 text-xs bg-white">
                              <textarea
                                className="w-full border rounded px-2 py-1"
                                defaultValue={note.content}
                                onBlur={(e) => {
                                  if (e.target.value === note.content) return;
                                  requestNotificationChoice((notifyPayload) =>
                                    updateTaskNote.mutate({ taskId: task.id, noteId: note.id, content: e.target.value, ...notifyPayload })
                                  );
                                }}
                              />
                              <div className="text-slate-500 mt-1">Version {note.version}</div>
                              {!!note.history?.length && (
                                <details className="mt-1">
                                  <summary className="cursor-pointer text-slate-600">History ({note.history.length})</summary>
                                  <div className="mt-1 space-y-1">
                                    {note.history.map((hist) => (
                                      <div key={hist.id} className="bg-slate-50 border rounded p-2">{hist.content}</div>
                                    ))}
                                  </div>
                                </details>
                              )}
                            </div>
                          ))}
                          {!taskNotes.length && <div className="text-slate-500">No notes yet.</div>}
                        </div>
                      </div>
                    </details>
                    <details>
                      <summary className="cursor-pointer text-sm font-medium text-indigo-700">Task Timeline (collapse/expand)</summary>
                      <div className="mt-2 space-y-2 max-h-48 overflow-auto">
                        {taskActivity.map((item) => (
                          <div key={item.id} className="border rounded p-2 text-xs bg-white">
                            <div className="font-medium">{item.entityType} • {item.action}</div>
                            <div className="text-slate-500">{new Date(item.createdAt).toLocaleString()}</div>
                          </div>
                        ))}
                        {!taskActivity.length && <div className="text-slate-500">No task activity yet.</div>}
                      </div>
                    </details>
                  </div>
                )}
              </div>
            ))}
          </div>
          <form className="border-t mt-4 pt-4 grid md:grid-cols-5 gap-2" onSubmit={handleTaskSubmit(onTaskCreate)}>
            <input className="border rounded px-2 py-1" placeholder="Task name" {...registerTask("name", { required: true })} />
            <input className="border rounded px-2 py-1" placeholder="Description" {...registerTask("description")} />
            <select className="border rounded px-2 py-1" {...registerTask("priority")}>
              {["Low", "Medium", "High", "Critical"].map((priority) => <option key={priority}>{priority}</option>)}
            </select>
            <input className="border rounded px-2 py-1" type="date" {...registerTask("dueDate")} />
            <button className="bg-indigo-600 text-white rounded px-3 py-1">Add Task</button>
          </form>
        </div>

        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="text-lg font-semibold mb-3">Risk Insight</h3>
          <p className="text-3xl font-bold">{risk?.score ?? 0}</p>
          <p className="text-slate-600">Level: {risk?.level ?? "Low"}</p>
          <ul className="mt-3 text-sm text-slate-600 list-disc ml-5">
            {(risk?.reasons || []).map((reason) => <li key={reason}>{reason}</li>)}
          </ul>
          <h4 className="font-medium mt-4">Recommended Actions</h4>
          <ul className="mt-2 text-sm text-slate-600 list-disc ml-5">
            {(risk?.recommendations || []).map((item) => <li key={item}>{item}</li>)}
          </ul>
          <h4 className="font-medium mt-4">Recent Risk Snapshots</h4>
          <div className="space-y-2 max-h-40 overflow-auto">
            {riskHistory.slice(0, 5).map((row) => (
              <div key={row.id} className="border rounded p-2 text-sm">
                <div className="font-medium">{row.level} ({row.score})</div>
                <div className="text-slate-500">{new Date(row.createdAt).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow p-6">
        <h3 className="text-lg font-semibold mb-3">Project Activity Timeline</h3>
        <div className="space-y-2 max-h-72 overflow-auto">
          {activity.map((item) => (
            <div key={item.id} className="border rounded p-3 text-sm">
              <div className="font-medium">{item.entityType} • {item.action}</div>
              <div className="text-slate-500">{new Date(item.createdAt).toLocaleString()}</div>
            </div>
          ))}
          {!activity.length && <div className="text-sm text-slate-500">No activity yet.</div>}
        </div>
      </div>


      <div className="bg-white rounded-xl shadow p-6">
        <h3 className="text-lg font-semibold mb-3">PMO Comments</h3>
        <form onSubmit={handleSubmit(onComment)} className="flex gap-2">
          <input className="flex-1 border rounded px-3 py-2" placeholder="Add PMO comment" {...register("comment", { required: true })} />
          <button className="bg-indigo-600 text-white rounded px-4">Save</button>
        </form>
        <div className="mt-4 space-y-3">
          {pmoCommentsWithHistory.map((comment) => (
            <div key={comment.id} className="border rounded p-3 text-sm">
              <textarea
                className="w-full border rounded px-2 py-1"
                defaultValue={comment.comment}
                {...registerPmoEdit(`pmo-${comment.id}`)}
                onBlur={(e) => {
                  if (e.target.value !== comment.comment) {
                    updatePmoComment.mutate({ commentId: comment.id, comment: e.target.value });
                  }
                }}
              />
              <div className="text-xs text-slate-500 mt-1">{new Date(comment.updatedAt).toLocaleString()}</div>
              {!!comment.history?.length && (
                <details className="mt-2">
                  <summary className="text-xs text-slate-600 cursor-pointer">PMO comment history ({comment.history.length})</summary>
                  <div className="mt-2 space-y-1">
                    {comment.history.map((hist) => (
                      <div key={hist.id} className="bg-slate-50 border rounded p-2 text-xs">
                        <div>{hist.comment}</div>
                        <div className="text-slate-500 mt-1">{new Date(hist.createdAt).toLocaleString()}</div>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="bg-white rounded-xl shadow p-6">
        <h3 className="text-lg font-semibold mb-3">Automated Reminders</h3>
        <form className="grid md:grid-cols-4 gap-2 mb-4" onSubmit={handleReminderSubmit(onCreateReminder)}>
          <select className="border rounded px-3 py-2" {...registerReminder("targetUserId", { required: true })}>
            <option value="">Target user</option>
            {users.map((user) => <option key={user.id} value={user.id}>{user.fullName}</option>)}
          </select>
          <select className="border rounded px-3 py-2" {...registerReminder("reminderType")}>
            {["DUE_SOON", "OVERDUE", "INACTIVE_PROJECT"].map((type) => <option key={type}>{type}</option>)}
          </select>
          <input className="border rounded px-3 py-2" type="number" min="10" step="10" placeholder="Interval minutes" {...registerReminder("intervalMinutes")} />
          <button className="bg-indigo-600 text-white rounded px-3 py-2">Add Reminder</button>
        </form>
        <div className="space-y-2">
          {reminders.map((reminder) => (
            <div key={reminder.id} className="border rounded p-3 text-sm flex justify-between items-center">
              <div>
                <div className="font-medium">{reminder.reminderType}</div>
                <div className="text-slate-500">Every {reminder.intervalMinutes} min • {reminder.User?.fullName || `User #${reminder.targetUserId}`}</div>
              </div>
              <div className="flex gap-2">
                <button className="border rounded px-2 py-1" onClick={() => toggleReminder.mutate({ reminderId: reminder.id, isActive: !reminder.isActive })}>
                  {reminder.isActive ? "Disable" : "Enable"}
                </button>
                <button className="border rounded px-2 py-1 text-red-600" onClick={() => deleteReminder.mutate(reminder.id)}>Delete</button>
              </div>
            </div>
          ))}
          {!reminders.length && <div className="text-sm text-slate-500">No reminders configured.</div>}
        </div>
        <h4 className="font-medium mt-4 mb-2">Reminder Logs</h4>
        <div className="space-y-2 max-h-48 overflow-auto">
          {reminderLogs.map((log) => (
            <div key={log.id} className="border rounded p-2 text-xs">
              <div className="font-medium">{log.reminderType}</div>
              <div>{new Date(log.createdAt).toLocaleString()}</div>
              <div className="text-slate-600">{log.details?.summary}</div>
            </div>
          ))}
          {!reminderLogs.length && <div className="text-xs text-slate-500">No reminder logs yet.</div>}
        </div>
      </div>
      <NotificationPromptModal
        open={notifyModalOpen}
        users={users}
        onCancel={() => {
          setNotifyModalOpen(false);
          setNotifyCallback(null);
        }}
        onConfirm={(selection) => {
          setNotifyModalOpen(false);
          if (notifyCallback) notifyCallback(selection);
          setNotifyCallback(null);
        }}
      />
    </div>
  );
}
