import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "../api/client";

export default function AuditPage() {
  const [filters, setFilters] = useState({
    entityType: "",
    userId: "",
    projectId: "",
    taskId: "",
    from: "",
    to: "",
    page: 1,
    limit: 50
  });
  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: async () => (await api.get("/users")).data
  });
  const { data: rows = [] } = useQuery({
    queryKey: ["audit-logs", filters],
    queryFn: async () => (await api.get("/audit-logs", { params: filters })).data
  });

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow p-6">
        <h2 className="text-2xl font-semibold mb-3">Audit Timeline</h2>
        <div className="grid md:grid-cols-4 gap-2">
          <select className="border rounded px-3 py-2" value={filters.entityType} onChange={(e) => setFilters((v) => ({ ...v, entityType: e.target.value }))}>
            <option value="">All entities</option>
            {["project", "task", "task_note", "ids", "template", "template_task"].map((entity) => <option key={entity}>{entity}</option>)}
          </select>
          <select className="border rounded px-3 py-2" value={filters.userId} onChange={(e) => setFilters((v) => ({ ...v, userId: e.target.value }))}>
            <option value="">All users</option>
            {users.map((user) => <option key={user.id} value={user.id}>{user.fullName}</option>)}
          </select>
          <input className="border rounded px-3 py-2" placeholder="Project ID" value={filters.projectId} onChange={(e) => setFilters((v) => ({ ...v, projectId: e.target.value }))} />
          <input className="border rounded px-3 py-2" placeholder="Task ID" value={filters.taskId} onChange={(e) => setFilters((v) => ({ ...v, taskId: e.target.value }))} />
          <input className="border rounded px-3 py-2" type="date" value={filters.from} onChange={(e) => setFilters((v) => ({ ...v, from: e.target.value }))} />
          <input className="border rounded px-3 py-2" type="date" value={filters.to} onChange={(e) => setFilters((v) => ({ ...v, to: e.target.value }))} />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow p-6">
        <div className="space-y-2 max-h-[40rem] overflow-auto">
          {rows.map((row) => (
            <div key={row.id} className="border rounded p-3 text-sm">
              <div className="font-medium">{row.entityType} • {row.action}</div>
              <div className="text-slate-500">{row.User?.fullName || `User #${row.user_id}`} • {new Date(row.createdAt).toLocaleString()}</div>
              {!!Object.keys(row.metadata || {}).length && (
                <pre className="mt-2 bg-slate-50 border rounded p-2 text-xs overflow-auto">{JSON.stringify(row.metadata, null, 2)}</pre>
              )}
            </div>
          ))}
          {!rows.length && <div className="text-sm text-slate-500">No audit records for selected filters.</div>}
        </div>
      </div>
    </div>
  );
}
