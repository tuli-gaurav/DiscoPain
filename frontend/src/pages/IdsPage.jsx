import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/client";
import NotificationPromptModal from "../components/NotificationPromptModal";
import StatusPill from "../components/StatusPill";
import BackButton from "../components/BackButton";
import { useToast } from "../context/ToastContext";

export default function IdsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [filters, setFilters] = useState({ status: "", severity: "", q: "" });
  const [form, setForm] = useState({
    projectId: "",
    title: "",
    description: "",
    type: "Issue",
    severity: "Medium",
    status: "Open",
    assigneeUserIds: [],
    linkedTaskIds: []
  });
  const [promptOpen, setPromptOpen] = useState(false);

  const { data: idsRows = [], isLoading: idsLoading, error: idsError } = useQuery({
    queryKey: ["ids", filters],
    queryFn: async () => (await api.get("/ids", { params: filters })).data
  });
  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => (await api.get("/projects")).data
  });
  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: async () => (await api.get("/users")).data
  });
  const { data: projectTasks = [] } = useQuery({
    queryKey: ["project-tasks-for-ids", form.projectId],
    queryFn: async () => (await api.get(`/projects/${form.projectId}/tasks`)).data,
    enabled: Boolean(form.projectId)
  });

  const createIds = useMutation({
    mutationFn: async (payload) => (await api.post(`/projects/${form.projectId}/ids`, payload)).data,
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["ids"] });
      showToast("IDS raised successfully", "success");
      navigate(`/ids/${created.id}`);
    },
    onError: (error) => {
      const message = error?.response?.data?.message || "Failed to raise IDS";
      showToast(message, "error", 3000);
    }
  });

  const selectedProject = useMemo(() => projects.find((p) => p.id === Number(form.projectId)), [projects, form.projectId]);
  const selectedAssignees = useMemo(
    () => users.filter((user) => form.assigneeUserIds.includes(user.id)),
    [users, form.assigneeUserIds]
  );
  const selectedLinkedTasks = useMemo(
    () => projectTasks.filter((task) => form.linkedTaskIds.includes(task.id)),
    [projectTasks, form.linkedTaskIds]
  );

  if (idsError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded p-4 text-sm text-red-700">
        Failed to load IDS records. Please refresh and check backend logs.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <BackButton />
      <div className="bg-white rounded-xl shadow p-6 card-premium card-entrance">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-2xl font-semibold">Raise IDS</h2>
            <p className="text-sm text-slate-500 mt-1">Capture issues/dependencies with proper ownership and traceable linked tasks.</p>
          </div>
          <StatusPill value="Escalation" type="ids-status" />
        </div>
        <div className="grid md:grid-cols-3 gap-3">
          <select className="border rounded px-3 py-2" value={form.projectId} onChange={(e) => setForm((v) => ({ ...v, projectId: e.target.value, linkedTaskIds: [] }))}>
            <option value="">Select project</option>
            {projects.map((project) => <option key={project.id} value={project.id}>{project.clientName}</option>)}
          </select>
          <input className="border rounded px-3 py-2" placeholder="IDS title" value={form.title} onChange={(e) => setForm((v) => ({ ...v, title: e.target.value }))} />
          <select className="border rounded px-3 py-2" value={form.type} onChange={(e) => setForm((v) => ({ ...v, type: e.target.value }))}>
            {["Issue", "Dependency", "Support"].map((type) => <option key={type}>{type}</option>)}
          </select>
          <textarea className="border rounded px-3 py-2 md:col-span-2" rows={2} placeholder="Description" value={form.description} onChange={(e) => setForm((v) => ({ ...v, description: e.target.value }))} />
          <select className="border rounded px-3 py-2" value={form.severity} onChange={(e) => setForm((v) => ({ ...v, severity: e.target.value }))}>
            {["Low", "Medium", "High", "Critical"].map((level) => <option key={level}>{level}</option>)}
          </select>
        </div>
        {selectedProject && (
          <div className="grid md:grid-cols-2 gap-3 mt-3">
            <div className="border rounded p-3 max-h-48 overflow-auto bg-slate-50/50">
              <div className="text-sm font-medium mb-2 flex items-center justify-between">
                <span>Assignees</span>
                <span className="text-xs text-slate-500">{form.assigneeUserIds.length} selected</span>
              </div>
              {users.map((user) => (
                <label key={user.id} className="block text-sm border rounded px-2 py-1.5 bg-white mb-1 hover:border-indigo-300 transition-colors">
                  <input
                    type="checkbox"
                    className="mr-2"
                    checked={form.assigneeUserIds.includes(user.id)}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        assigneeUserIds: e.target.checked ? [...prev.assigneeUserIds, user.id] : prev.assigneeUserIds.filter((id) => id !== user.id)
                      }))
                    }
                  />
                  {user.fullName}
                </label>
              ))}
            </div>
            <div className="border rounded p-3 max-h-48 overflow-auto bg-slate-50/50">
              <div className="text-sm font-medium mb-2 flex items-center justify-between">
                <span>Linked Tasks</span>
                <span className="text-xs text-slate-500">{form.linkedTaskIds.length} linked</span>
              </div>
              {projectTasks.map((task) => (
                <label key={task.id} className="block text-sm border rounded px-2 py-1.5 bg-white mb-1 hover:border-indigo-300 transition-colors">
                  <input
                    type="checkbox"
                    className="mr-2"
                    checked={form.linkedTaskIds.includes(task.id)}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        linkedTaskIds: e.target.checked ? [...prev.linkedTaskIds, task.id] : prev.linkedTaskIds.filter((id) => id !== task.id)
                      }))
                    }
                  />
                  {task.name}
                </label>
              ))}
            </div>
          </div>
        )}
        <button
          className="mt-4 bg-indigo-600 text-white rounded px-4 py-2 font-medium"
          disabled={!form.projectId || !form.title || !form.description}
          onClick={() => setPromptOpen(true)}
        >
          Raise IDS
        </button>
        {selectedProject && (
          <div className="grid md:grid-cols-2 gap-3 mt-4">
            <div className="border rounded-xl p-3 bg-slate-50/60">
              <div className="text-sm font-medium mb-2">Selected Assignees</div>
              <div className="flex flex-wrap gap-1.5">
                {selectedAssignees.map((user) => (
                  <span key={user.id} className="status-pill status-pill-blue">{user.fullName}</span>
                ))}
                {!selectedAssignees.length && <span className="text-xs text-slate-500">No assignees selected.</span>}
              </div>
            </div>
            <div className="border rounded-xl p-3 bg-slate-50/60">
              <div className="text-sm font-medium mb-2">Selected Linked Tasks</div>
              <div className="flex flex-wrap gap-1.5">
                {selectedLinkedTasks.map((task) => (
                  <span key={task.id} className="status-pill status-pill-slate">{task.name}</span>
                ))}
                {!selectedLinkedTasks.length && <span className="text-xs text-slate-500">No tasks linked.</span>}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow p-6 card-premium card-entrance">
        <h2 className="text-2xl font-semibold mb-4">IDS Records</h2>
        <div className="grid md:grid-cols-3 gap-2 mb-3">
          <input className="border rounded px-3 py-2" placeholder="Search title" value={filters.q} onChange={(e) => setFilters((v) => ({ ...v, q: e.target.value }))} />
          <select className="border rounded px-3 py-2" value={filters.status} onChange={(e) => setFilters((v) => ({ ...v, status: e.target.value }))}>
            <option value="">All statuses</option>
            {["Open", "In Progress", "Resolved", "Closed"].map((s) => <option key={s}>{s}</option>)}
          </select>
          <select className="border rounded px-3 py-2" value={filters.severity} onChange={(e) => setFilters((v) => ({ ...v, severity: e.target.value }))}>
            <option value="">All severities</option>
            {["Low", "Medium", "High", "Critical"].map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div className="space-y-2">
          {idsRows.map((row) => (
            <Link key={row.id} to={`/ids/${row.id}`} className="block border rounded p-3 card-premium hover:bg-slate-50">
              <div className="font-medium">{row.title}</div>
              <div className="text-sm text-slate-600 flex flex-wrap items-center gap-2">
                <span>{row.Project?.clientName}</span>
                <StatusPill value={row.type} />
                <StatusPill value={row.severity} type="ids-severity" />
                <StatusPill value={row.status} type="ids-status" />
              </div>
            </Link>
          ))}
          {!idsRows.length && !idsLoading && <div className="text-sm text-slate-500">No IDS records found.</div>}
          {idsLoading && <div className="text-sm text-slate-500">Loading IDS records...</div>}
        </div>
      </div>

      <NotificationPromptModal
        open={promptOpen}
        users={users}
        onCancel={() => setPromptOpen(false)}
        onConfirm={(selection) => {
          setPromptOpen(false);
          createIds.mutate({ ...form, ...selection });
        }}
      />
    </div>
  );
}
