import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import api from "../api/client";
import StatusPill from "../components/StatusPill";

function MetricIcon({ tone = "indigo", children }) {
  return <span className={`metric-icon metric-icon-${tone}`}>{children}</span>;
}

export default function ProjectsPage() {
  const { data: projects = [] } = useQuery({ queryKey: ["projects"], queryFn: async () => (await api.get("/projects")).data });
  return (
    <div className="space-y-4">
      <div className="flex justify-between mb-4">
        <h2 className="text-2xl font-semibold flex items-center gap-2">
          <MetricIcon tone="indigo">PR</MetricIcon>
          Projects
        </h2>
        <Link className="px-3 py-2 rounded bg-indigo-600 text-white" to="/projects/new">Create Project</Link>
      </div>
      <div className="bg-white rounded-lg shadow overflow-hidden card-premium card-entrance">
        <table className="w-full text-left">
          <thead className="bg-slate-100"><tr><th className="p-3">Client</th><th>Tier</th><th>Health</th><th className="p-3">View</th></tr></thead>
          <tbody>
            {projects.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="p-3">{p.clientName}</td>
                <td><StatusPill value={p.tier} type="default" /></td>
                <td><StatusPill value={p.health} type="health" /></td>
                <td className="p-3"><Link className="text-indigo-600" to={`/projects/${p.id}`}>Open</Link></td>
              </tr>
            ))}
            {!projects.length && (
              <tr>
                <td className="p-4 text-sm text-slate-500" colSpan={4}>No projects available yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
