import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import api from "../api/client";
import NotificationPromptModal from "../components/NotificationPromptModal";
import StatusPill from "../components/StatusPill";

export default function IdsDetailPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const [promptOpen, setPromptOpen] = useState(false);
  const [pendingPayload, setPendingPayload] = useState(null);

  const { data: row, isLoading, error } = useQuery({
    queryKey: ["ids-detail", id],
    queryFn: async () => (await api.get(`/ids/${id}`)).data
  });
  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: async () => (await api.get("/users")).data
  });

  const updateIds = useMutation({
    mutationFn: async (payload) => (await api.patch(`/ids/${id}`, payload)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ids"] });
      queryClient.invalidateQueries({ queryKey: ["ids-detail", id] });
    }
  });

  if (isLoading) return <div>Loading IDS...</div>;
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded p-4 text-sm text-red-700">
        Failed to load IDS details. Please refresh and check backend logs.
      </div>
    );
  }
  if (!row) return <div>IDS not found.</div>;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow p-6">
        <h2 className="text-2xl font-semibold">{row.title}</h2>
        <p className="text-slate-600 mt-1">{row.description}</p>
        <div className="grid md:grid-cols-4 gap-3 mt-4 text-sm">
          <div><span className="text-slate-500">Project:</span> {row.Project?.clientName}</div>
          <div><span className="text-slate-500">Type:</span> <StatusPill value={row.type} /></div>
          <div><span className="text-slate-500">Severity:</span> <StatusPill value={row.severity} type="ids-severity" /></div>
          <div><span className="text-slate-500">Status:</span> <StatusPill value={row.status} type="ids-status" /></div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="text-lg font-semibold mb-3">Assignments</h3>
          <div className="space-y-1 text-sm">
            {(row.assignees || []).map((assignee) => <div key={assignee.id}>{assignee.fullName}</div>)}
            {!row.assignees?.length && <div className="text-slate-500">No assignees.</div>}
          </div>
          <button
            className="mt-3 border rounded px-3 py-1.5"
            onClick={() => {
              const nextStatus = row.status === "Open" ? "In Progress" : row.status === "In Progress" ? "Resolved" : "Closed";
              setPendingPayload({ status: nextStatus });
              setPromptOpen(true);
            }}
          >
            Advance Status
          </button>
        </div>

        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="text-lg font-semibold mb-3">Linked Tasks</h3>
          <div className="space-y-2">
            {(row.linkedTasks || []).map((task) => (
              <div key={task.id} className="border rounded p-2 text-sm">
                <div className="font-medium">{task.name}</div>
                <div className="text-slate-500 flex items-center gap-2 mt-1">
                  <StatusPill value={task.status} type="task" />
                  <StatusPill value={task.priority} type="ids-severity" />
                </div>
              </div>
            ))}
            {!row.linkedTasks?.length && <div className="text-slate-500 text-sm">No linked tasks.</div>}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow p-6">
        <h3 className="text-lg font-semibold mb-3">Project Snapshot at Raise Time</h3>
        <pre className="bg-slate-50 border rounded p-3 text-xs overflow-auto">{JSON.stringify(row.snapshot || {}, null, 2)}</pre>
      </div>

      <NotificationPromptModal
        open={promptOpen}
        users={users}
        onCancel={() => {
          setPromptOpen(false);
          setPendingPayload(null);
        }}
        onConfirm={(selection) => {
          setPromptOpen(false);
          updateIds.mutate({ ...(pendingPayload || {}), ...selection });
          setPendingPayload(null);
        }}
      />
    </div>
  );
}
