import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../api/client";
import StatusPill from "../components/StatusPill";

const tiers = ["Tier 1", "Tier 2", "Tier 3"];
const defaultTask = { name: "", description: "", responsibilityOwner: "", defaultStatus: "Not Started" };

function MetricIcon({ tone = "indigo", children }) {
  return <span className={`metric-icon metric-icon-${tone}`}>{children}</span>;
}

export default function TemplatesPage() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({ tier: "", isActive: "true", q: "" });
  const [selectedId, setSelectedId] = useState(null);
  const [draftTask, setDraftTask] = useState(defaultTask);
  const [newTemplate, setNewTemplate] = useState({ name: "", tier: "Tier 1" });

  const { data: templates = [] } = useQuery({
    queryKey: ["templates", filters],
    queryFn: async () => (await api.get("/templates", { params: { ...filters, isActive: filters.isActive } })).data
  });

  const selected = useMemo(() => templates.find((t) => t.id === selectedId) || templates[0], [templates, selectedId]);
  const sortedSelectedTasks = useMemo(
    () => ([...(selected?.tasks || [])].sort((a, b) => a.orderNo - b.orderNo)),
    [selected?.tasks]
  );

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["templates"] });

  const createTemplate = useMutation({
    mutationFn: async () => (await api.post("/templates", { ...newTemplate, tasks: [] })).data,
    onSuccess: (created) => {
      setSelectedId(created.id);
      setNewTemplate({ name: "", tier: "Tier 1" });
      refresh();
    }
  });

  const updateTemplate = useMutation({
    mutationFn: async (payload) => (await api.patch(`/templates/${selected.id}`, payload)).data,
    onSuccess: refresh
  });

  const deactivateTemplate = useMutation({
    mutationFn: async () => (await api.patch(`/templates/${selected.id}/deactivate`)).data,
    onSuccess: refresh
  });

  const duplicateTemplate = useMutation({
    mutationFn: async () => (await api.post(`/templates/${selected.id}/duplicate`)).data,
    onSuccess: (created) => {
      setSelectedId(created.id);
      refresh();
    }
  });

  const createTask = useMutation({
    mutationFn: async () => (await api.post(`/templates/${selected.id}/tasks`, draftTask)).data,
    onSuccess: () => {
      setDraftTask(defaultTask);
      refresh();
    }
  });

  const updateTask = useMutation({
    mutationFn: async ({ taskId, payload }) => (await api.patch(`/templates/${selected.id}/tasks/${taskId}`, payload)).data,
    onSuccess: refresh
  });

  const deleteTask = useMutation({
    mutationFn: async (taskId) => api.delete(`/templates/${selected.id}/tasks/${taskId}`),
    onSuccess: refresh
  });

  const reorderTasks = useMutation({
    mutationFn: async (tasks) =>
      (await api.patch(`/templates/${selected.id}/tasks/reorder`, { items: tasks.map((task, idx) => ({ taskId: task.id, orderNo: idx + 1 })) })).data,
    onSuccess: refresh
  });

  const moveTask = (taskId, direction) => {
    if (!sortedSelectedTasks.length) return;
    const currentIndex = sortedSelectedTasks.findIndex((task) => task.id === taskId);
    if (currentIndex === -1) return;
    const targetIndex = currentIndex + direction;
    if (targetIndex < 0 || targetIndex >= sortedSelectedTasks.length) return;

    const copy = [...sortedSelectedTasks];
    const tmp = copy[currentIndex];
    copy[currentIndex] = copy[targetIndex];
    copy[targetIndex] = tmp;

    // Optimistic local reorder for snappier UI feedback.
    queryClient.setQueryData(["templates", filters], (prev = []) =>
      prev.map((template) =>
        template.id === selected.id
          ? {
            ...template,
            tasks: copy.map((task, idx) => ({ ...task, orderNo: idx + 1 }))
          }
          : template
      )
    );

    reorderTasks.mutate(copy);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <section className="bg-white rounded-xl shadow p-4 lg:col-span-1 card-premium card-entrance">
        <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
          <MetricIcon tone="indigo">TP</MetricIcon>
          Templates
        </h2>
        <div className="space-y-2 mb-4">
          <input
            className="w-full border rounded px-3 py-2"
            placeholder="Search template name"
            value={filters.q}
            onChange={(e) => setFilters((v) => ({ ...v, q: e.target.value }))}
          />
          <select className="w-full border rounded px-3 py-2" value={filters.tier} onChange={(e) => setFilters((v) => ({ ...v, tier: e.target.value }))}>
            <option value="">All tiers</option>
            {tiers.map((tier) => <option key={tier} value={tier}>{tier}</option>)}
          </select>
          <select
            className="w-full border rounded px-3 py-2"
            value={filters.isActive}
            onChange={(e) => setFilters((v) => ({ ...v, isActive: e.target.value }))}
          >
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>

        <div className="space-y-2 max-h-[28rem] overflow-auto">
          {templates.map((template) => (
            <button
              key={template.id}
              onClick={() => setSelectedId(template.id)}
              className={`w-full text-left border rounded p-3 card-premium ${selected?.id === template.id ? "border-indigo-500 bg-indigo-50" : "hover:bg-slate-50"}`}
            >
              <div className="font-medium">{template.name}</div>
              <div className="text-xs text-slate-500 flex items-center gap-2 mt-1">
                <StatusPill value={template.tier} />
                <StatusPill value={template.isActive ? "Active" : "Inactive"} type={template.isActive ? "task" : "ids-status"} />
              </div>
            </button>
          ))}
        </div>

        <div className="border-t mt-4 pt-4 space-y-2">
          <h3 className="font-semibold">Create Template</h3>
          <input className="w-full border rounded px-3 py-2" placeholder="Template name" value={newTemplate.name} onChange={(e) => setNewTemplate((v) => ({ ...v, name: e.target.value }))} />
          <select className="w-full border rounded px-3 py-2" value={newTemplate.tier} onChange={(e) => setNewTemplate((v) => ({ ...v, tier: e.target.value }))}>
            {tiers.map((tier) => <option key={tier}>{tier}</option>)}
          </select>
          <button className="w-full bg-indigo-600 text-white rounded px-3 py-2" onClick={() => createTemplate.mutate()} disabled={!newTemplate.name.trim()}>
            Create
          </button>
        </div>
      </section>

      <section className="bg-white rounded-xl shadow p-4 lg:col-span-2 card-premium card-entrance">
        {!selected ? (
          <div className="text-slate-500">Select a template to edit.</div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <MetricIcon tone="blue">ED</MetricIcon>
                Template Editor
              </h2>
              <div className="flex gap-2">
                <button className="border rounded px-3 py-1.5" onClick={() => duplicateTemplate.mutate()}>Duplicate</button>
                <button className="border rounded px-3 py-1.5 text-red-600" onClick={() => deactivateTemplate.mutate()} disabled={!selected.isActive}>
                  Deactivate
                </button>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-3 mb-6">
              <input
                className="border rounded px-3 py-2"
                value={selected.name}
                onChange={(e) => {
                  setSelectedId(selected.id);
                  queryClient.setQueryData(["templates", filters], templates.map((t) => (t.id === selected.id ? { ...t, name: e.target.value } : t)));
                }}
              />
              <select
                className="border rounded px-3 py-2"
                value={selected.tier}
                onChange={(e) => {
                  setSelectedId(selected.id);
                  queryClient.setQueryData(["templates", filters], templates.map((t) => (t.id === selected.id ? { ...t, tier: e.target.value } : t)));
                }}
              >
                {tiers.map((tier) => <option key={tier}>{tier}</option>)}
              </select>
            </div>
            <button className="mb-6 bg-slate-900 text-white rounded px-4 py-2" onClick={() => updateTemplate.mutate({ name: selected.name, tier: selected.tier })}>
              Save Template
            </button>

            <h3 className="font-semibold mb-2">Template Tasks</h3>
            <div className="space-y-2 mb-4">
              {sortedSelectedTasks.map((task, index) => (
                  <div key={task.id} className="border rounded p-3 card-premium">
                    <div className="grid md:grid-cols-4 gap-2">
                      <input className="border rounded px-2 py-1" defaultValue={task.name} onBlur={(e) => updateTask.mutate({ taskId: task.id, payload: { name: e.target.value } })} />
                      <input
                        className="border rounded px-2 py-1"
                        defaultValue={task.responsibilityOwner || ""}
                        placeholder="Responsibility owner"
                        onBlur={(e) => updateTask.mutate({ taskId: task.id, payload: { responsibilityOwner: e.target.value } })}
                      />
                      <select className="border rounded px-2 py-1" defaultValue={task.defaultStatus} onChange={(e) => updateTask.mutate({ taskId: task.id, payload: { defaultStatus: e.target.value } })}>
                        {["Not Started", "In Progress", "Completed", "Blocked"].map((status) => <option key={status}>{status}</option>)}
                      </select>
                      <div className="flex gap-2 justify-end">
                        <button type="button" className="border rounded px-2" onClick={() => moveTask(task.id, -1)} disabled={index === 0 || reorderTasks.isPending}>Up</button>
                        <button type="button" className="border rounded px-2" onClick={() => moveTask(task.id, 1)} disabled={index === sortedSelectedTasks.length - 1 || reorderTasks.isPending}>Down</button>
                        <button type="button" className="border rounded px-2 text-red-600" onClick={() => deleteTask.mutate(task.id)}>Delete</button>
                      </div>
                    </div>
                    <textarea
                      className="w-full border rounded px-2 py-1 mt-2"
                      rows={2}
                      defaultValue={task.description || ""}
                      placeholder="Description"
                      onBlur={(e) => updateTask.mutate({ taskId: task.id, payload: { description: e.target.value } })}
                    />
                  </div>
                ))}
            </div>

            <div className="border-t pt-4">
              <h4 className="font-semibold mb-2">Add Task</h4>
              <div className="grid md:grid-cols-4 gap-2">
                <input className="border rounded px-3 py-2" placeholder="Task name" value={draftTask.name} onChange={(e) => setDraftTask((v) => ({ ...v, name: e.target.value }))} />
                <input
                  className="border rounded px-3 py-2"
                  placeholder="Responsibility owner"
                  value={draftTask.responsibilityOwner}
                  onChange={(e) => setDraftTask((v) => ({ ...v, responsibilityOwner: e.target.value }))}
                />
                <select className="border rounded px-3 py-2" value={draftTask.defaultStatus} onChange={(e) => setDraftTask((v) => ({ ...v, defaultStatus: e.target.value }))}>
                  {["Not Started", "In Progress", "Completed", "Blocked"].map((status) => <option key={status}>{status}</option>)}
                </select>
                <button className="bg-indigo-600 text-white rounded px-3 py-2" onClick={() => createTask.mutate()} disabled={!draftTask.name.trim()}>
                  Add
                </button>
              </div>
              <textarea
                className="w-full border rounded px-3 py-2 mt-2"
                rows={2}
                placeholder="Task description"
                value={draftTask.description}
                onChange={(e) => setDraftTask((v) => ({ ...v, description: e.target.value }))}
              />
            </div>
          </>
        )}
      </section>
    </div>
  );
}
