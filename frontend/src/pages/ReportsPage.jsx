import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar } from "react-chartjs-2";
import { BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, Tooltip } from "chart.js";
import api from "../api/client";
import BackButton from "../components/BackButton";
import { useToast } from "../context/ToastContext";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

function MetricIcon({ tone = "indigo", children }) {
  return <span className={`metric-icon metric-icon-${tone}`}>{children}</span>;
}

export default function ReportsPage() {
  const { showToast } = useToast();
  const [filters, setFilters] = useState({
    tier: "",
    region: "",
    pmoAssigned: "",
    projectOwner: "",
    health: "",
    from: "",
    to: ""
  });
  const { data: users = [] } = useQuery({ queryKey: ["users"], queryFn: async () => (await api.get("/users")).data });
  const { data: report } = useQuery({
    queryKey: ["reports-overview", filters],
    queryFn: async () => (await api.get("/reports/overview", { params: filters })).data
  });

  const tierData = {
    labels: Object.keys(report?.projectsByTier || {}),
    datasets: [{ label: "Projects by Tier", data: Object.values(report?.projectsByTier || {}), backgroundColor: "#4f46e5" }]
  };
  const workloadData = {
    labels: Object.keys(report?.workload || {}),
    datasets: [{ label: "Resource Workload", data: Object.values(report?.workload || {}), backgroundColor: "#0ea5e9" }]
  };

  return (
    <div className="space-y-4">
      <BackButton />
      <div className="bg-white rounded-xl shadow p-6 card-premium card-entrance">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h2 className="text-2xl font-semibold">Reports</h2>
          <button
            type="button"
            className="border rounded px-3 py-1.5 text-sm"
            onClick={() => {
              setFilters({
                tier: "",
                region: "",
                pmoAssigned: "",
                projectOwner: "",
                health: "",
                from: "",
                to: ""
              });
              showToast("Report filters reset", "info");
            }}
          >
            Reset Filters
          </button>
        </div>
        <div className="grid md:grid-cols-4 gap-2">
          <select className="border rounded px-3 py-2" value={filters.tier} onChange={(e) => setFilters((v) => ({ ...v, tier: e.target.value }))}>
            <option value="">All tiers</option>
            {["Tier 1", "Tier 2", "Tier 3"].map((tier) => <option key={tier}>{tier}</option>)}
          </select>
          <input className="border rounded px-3 py-2" placeholder="Region (e.g. EMEA)" value={filters.region} onChange={(e) => setFilters((v) => ({ ...v, region: e.target.value }))} />
          <select className="border rounded px-3 py-2" value={filters.pmoAssigned} onChange={(e) => setFilters((v) => ({ ...v, pmoAssigned: e.target.value }))}>
            <option value="">All PMO</option>
            {users.map((user) => <option key={user.id} value={user.id}>{user.fullName}</option>)}
          </select>
          <select className="border rounded px-3 py-2" value={filters.projectOwner} onChange={(e) => setFilters((v) => ({ ...v, projectOwner: e.target.value }))}>
            <option value="">All owners</option>
            {users.map((user) => <option key={user.id} value={user.id}>{user.fullName}</option>)}
          </select>
          <select className="border rounded px-3 py-2" value={filters.health} onChange={(e) => setFilters((v) => ({ ...v, health: e.target.value }))}>
            <option value="">All health</option>
            {["Green", "Amber", "Red"].map((health) => <option key={health}>{health}</option>)}
          </select>
          <input className="border rounded px-3 py-2" type="date" value={filters.from} onChange={(e) => setFilters((v) => ({ ...v, from: e.target.value }))} />
          <input className="border rounded px-3 py-2" type="date" value={filters.to} onChange={(e) => setFilters((v) => ({ ...v, to: e.target.value }))} />
        </div>
      </div>

      <div className="grid md:grid-cols-4 gap-3">
        {[
          ["totalProjects", "Total Projects", report?.totalProjects || 0, "indigo", "PR"],
          ["completionRate", "Completion Rate", `${report?.completionRate || 0}%`, "green", "CR"],
          ["blockedTasks", "Blocked Tasks", report?.blockedTasks || 0, "red", "BL"],
          ["activeIds", "Active IDS", report?.activeIds || 0, "blue", "ID"]
        ].map(([key, label, value, tone, abbrev]) => (
          <div key={key} className="bg-white rounded-xl shadow p-4 card-premium card-entrance">
            <div className="flex items-start justify-between gap-2">
              <div className="text-sm text-slate-500">{label}</div>
              <MetricIcon tone={tone}>{abbrev}</MetricIcon>
            </div>
            <div className="text-2xl font-semibold">{value}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl shadow p-6 card-premium card-entrance">
          <h3 className="text-lg font-semibold mb-2">Projects by Tier</h3>
          <Bar data={tierData} options={{ plugins: { legend: { display: false } } }} />
        </div>
        <div className="bg-white rounded-xl shadow p-6 card-premium card-entrance">
          <h3 className="text-lg font-semibold mb-2">Resource Workload</h3>
          <Bar data={workloadData} options={{ plugins: { legend: { display: false } } }} />
        </div>
      </div>
    </div>
  );
}
