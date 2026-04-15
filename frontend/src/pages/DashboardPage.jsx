import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, Line, Pie } from "react-chartjs-2";
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip
} from "chart.js";
import api from "../api/client";
import StatusPill from "../components/StatusPill";

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

function MetricIcon({ tone = "indigo", children }) {
  return <span className={`metric-icon metric-icon-${tone}`}>{children}</span>;
}

export default function DashboardPage() {
  const [tierFilter, setTierFilter] = useState("All");
  const tierOptions = ["All", "Tier 1", "Tier 2", "Tier 3"];
  const [dateRange, setDateRange] = useState({ from: "", to: "" });
  const [selectedSection, setSelectedSection] = useState("totalProjects");
  const { data, dataUpdatedAt, refetch, isFetching } = useQuery({
    queryKey: ["dashboard", tierFilter, dateRange],
    queryFn: async () => (
      await api.get("/dashboards/summary", {
        params: {
          ...(tierFilter === "All" ? {} : { tier: tierFilter }),
          ...(dateRange.from ? { from: dateRange.from } : {}),
          ...(dateRange.to ? { to: dateRange.to } : {})
        }
      })
    ).data
  });
  const { data: drilldown, isLoading: drilldownLoading } = useQuery({
    queryKey: ["dashboard-drilldown", selectedSection, tierFilter, dateRange],
    queryFn: async () => (
      await api.get("/dashboards/drilldown", {
        params: {
          section: selectedSection,
          ...(tierFilter === "All" ? {} : { tier: tierFilter }),
          ...(dateRange.from ? { from: dateRange.from } : {}),
          ...(dateRange.to ? { to: dateRange.to } : {})
        }
      })
    ).data,
    enabled: Boolean(selectedSection)
  });
  const lastRefreshed = useMemo(() => (dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleString() : "-"), [dataUpdatedAt]);
  const totalProjects = data?.totalProjects || 0;
  const overdueTasks = data?.overdueTasks || 0;
  const blockedTasks = data?.blockedTasks || 0;
  const activeIds = data?.activeIds || 0;
  const completionRate = data?.completionRate || 0;
  const totalTasks = Object.values(data?.taskStatusDistribution || {}).reduce((sum, value) => sum + Number(value || 0), 0);
  const healthyPct = totalProjects ? Math.round(((data?.ragDistribution?.Green || 0) / totalProjects) * 100) : 0;
  const riskLevel = blockedTasks > 20 || overdueTasks > 60 ? "High Risk" : blockedTasks > 8 || overdueTasks > 20 ? "Medium Risk" : "Low Risk";

  const ragChartData = {
    labels: ["Green", "Amber", "Red"],
    datasets: [{ data: [data?.ragDistribution?.Green || 0, data?.ragDistribution?.Amber || 0, data?.ragDistribution?.Red || 0], backgroundColor: ["#22c55e", "#f59e0b", "#ef4444"] }]
  };
  const taskStatusData = {
    labels: ["Not Started", "In Progress", "Completed", "Blocked"],
    datasets: [{
      label: "Tasks",
      data: [
        data?.taskStatusDistribution?.["Not Started"] || 0,
        data?.taskStatusDistribution?.["In Progress"] || 0,
        data?.taskStatusDistribution?.Completed || 0,
        data?.taskStatusDistribution?.Blocked || 0
      ],
      backgroundColor: ["#94a3b8", "#3b82f6", "#22c55e", "#ef4444"]
    }]
  };
  const trendData = {
    labels: (data?.progressTrend || []).map((point) => point.date),
    datasets: [{
      label: "Projects Created",
      data: (data?.progressTrend || []).map((point) => point.createdProjects),
      borderColor: "#4f46e5",
      backgroundColor: "rgba(79,70,229,0.2)"
    }]
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow p-5 card-premium card-entrance dashboard-hero">
        <div className="flex flex-wrap gap-4 items-start justify-between">
          <div>
            <h2 className="text-2xl font-semibold">Executive Dashboard</h2>
            <p className="text-sm text-slate-500 mt-1">
              Live snapshot of onboarding health, delivery pace, and escalation risk.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {tierOptions.map((tier) => (
                <button
                  key={tier}
                  type="button"
                  className={`dashboard-filter-chip ${tierFilter === tier ? "dashboard-filter-chip-active" : ""}`}
                  onClick={() => setTierFilter(tier)}
                >
                  {tier === "All" ? "All Tiers" : tier}
                </button>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <input
                type="date"
                className="border rounded px-2 py-1"
                value={dateRange.from}
                onChange={(e) => setDateRange((prev) => ({ ...prev, from: e.target.value }))}
              />
              <span className="text-slate-500">to</span>
              <input
                type="date"
                className="border rounded px-2 py-1"
                value={dateRange.to}
                onChange={(e) => setDateRange((prev) => ({ ...prev, to: e.target.value }))}
              />
              <button type="button" className="text-indigo-600 hover:underline" onClick={() => setDateRange({ from: "", to: "" })}>
                Clear dates
              </button>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="text-xs text-slate-500">
              Last refreshed: {lastRefreshed}
              <button type="button" className="ml-2 text-indigo-600 hover:underline" onClick={() => refetch()}>
                {isFetching ? "Refreshing..." : "Refresh now"}
              </button>
            </div>
            <div className="flex items-center gap-2">
            <StatusPill value={riskLevel} type={riskLevel === "High Risk" ? "ids-severity" : riskLevel === "Medium Risk" ? "ids-status" : "task"} />
            <StatusPill value={`${healthyPct}% Green`} type={healthyPct >= 70 ? "task" : healthyPct >= 40 ? "ids-status" : "ids-severity"} />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-4 text-sm">
          <div className="dashboard-hero-stat">
            <div className="text-slate-500">Portfolio Size</div>
            <div className="font-semibold">{totalProjects} projects</div>
          </div>
          <div className="dashboard-hero-stat">
            <div className="text-slate-500">Task Coverage</div>
            <div className="font-semibold">{totalTasks} tracked tasks</div>
          </div>
          <div className="dashboard-hero-stat">
            <div className="text-slate-500">Execution Health</div>
            <div className="font-semibold">{completionRate}% completion</div>
          </div>
          <div className="dashboard-hero-stat">
            <div className="text-slate-500">Escalation Load</div>
            <div className="font-semibold">{activeIds} active IDS</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {[
          { key: "totalProjects", label: "Total Projects", icon: <MetricIcon tone="indigo">PR</MetricIcon> },
          { key: "overdueTasks", label: "Overdue Tasks", icon: <MetricIcon tone="amber">OD</MetricIcon> },
          { key: "blockedTasks", label: "Blocked Tasks", icon: <MetricIcon tone="red">BL</MetricIcon> },
          { key: "activeIds", label: "Active IDS", icon: <MetricIcon tone="blue">ID</MetricIcon> },
          { key: "completionRate", label: "Completion Rate", icon: <MetricIcon tone="green">CR</MetricIcon> }
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setSelectedSection(item.key)}
            className={`bg-white rounded-lg p-4 shadow card-premium card-entrance text-left dashboard-clickable-card ${selectedSection === item.key ? "dashboard-clickable-card-active" : ""}`}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm text-slate-500">{item.label}</p>
              {item.icon}
            </div>
            <p className="text-2xl font-semibold mt-2">{data?.[item.key] ?? 0}{item.key === "completionRate" ? "%" : ""}</p>
            {item.key === "overdueTasks" && <p className="text-xs text-slate-500 mt-1">{totalTasks ? `${Math.round((overdueTasks / totalTasks) * 100)}% of all tasks` : "No task data"}</p>}
            {item.key === "blockedTasks" && <p className="text-xs text-slate-500 mt-1">{totalTasks ? `${Math.round((blockedTasks / totalTasks) * 100)}% flow is blocked` : "No task data"}</p>}
            {item.key === "activeIds" && <p className="text-xs text-slate-500 mt-1">{totalProjects ? `${Math.round((activeIds / totalProjects) * 100)} IDS per 100 projects` : "No project data"}</p>}
            {item.key === "completionRate" && (
              <div className="mt-2 h-2 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full bg-indigo-600" style={{ width: `${Math.min(100, Math.max(0, completionRate))}%` }} />
              </div>
            )}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <button
          type="button"
          onClick={() => setSelectedSection("ragDistribution")}
          className={`bg-white p-6 rounded-lg shadow card-premium card-entrance dashboard-chart-card text-left dashboard-clickable-card ${selectedSection === "ragDistribution" ? "dashboard-clickable-card-active" : ""}`}
        >
          <h3 className="text-lg font-semibold mb-3">RAG Distribution</h3>
          <Pie data={ragChartData} />
        </button>
        <button
          type="button"
          onClick={() => setSelectedSection("taskStatus")}
          className={`bg-white p-6 rounded-lg shadow card-premium card-entrance dashboard-chart-card text-left dashboard-clickable-card ${selectedSection === "taskStatus" ? "dashboard-clickable-card-active" : ""}`}
        >
          <h3 className="text-lg font-semibold mb-3">Task Status</h3>
          <Bar data={taskStatusData} options={{ responsive: true, plugins: { legend: { display: false } } }} />
        </button>
        <button
          type="button"
          onClick={() => setSelectedSection("progressTrend")}
          className={`bg-white p-6 rounded-lg shadow card-premium card-entrance dashboard-chart-card text-left dashboard-clickable-card ${selectedSection === "progressTrend" ? "dashboard-clickable-card-active" : ""}`}
        >
          <h3 className="text-lg font-semibold mb-3">Progress Trend</h3>
          <Line data={trendData} options={{ responsive: true, plugins: { legend: { display: false } } }} />
        </button>
      </div>

      <div className="bg-white rounded-xl shadow p-4 card-premium card-entrance">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Drilldown: {selectedSection}</h3>
          <span className="text-xs text-slate-500">Click KPI cards/charts above to switch detail level.</span>
        </div>
        {drilldownLoading ? (
          <div className="text-sm text-slate-500">Loading drilldown...</div>
        ) : !drilldown?.rows?.length ? (
          <div className="text-sm text-slate-500">No data found for this selection.</div>
        ) : (
          <div className="overflow-auto max-h-[24rem]">
            <table className="w-full text-left">
              <thead className="bg-slate-100">
                <tr>
                  {Object.keys(drilldown.rows[0]).map((key) => (
                    <th key={key} className="p-2">{key}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {drilldown.rows.map((row, idx) => (
                  <tr key={row.id || idx} className="border-t">
                    {Object.keys(drilldown.rows[0]).map((key) => (
                      <td key={`${row.id || idx}-${key}`} className="p-2 text-sm">
                        {typeof row[key] === "object" && row[key] !== null ? JSON.stringify(row[key]) : String(row[key] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
