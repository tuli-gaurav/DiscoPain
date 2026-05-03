import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import api from "../api/client";
import StatusPill from "../components/StatusPill";
import BackButton from "../components/BackButton";
import { getApiErrorMessage } from "../utils/apiErrorMessage";

function IconOpen() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6" />
    </svg>
  );
}

function IconSpark() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3l1.09 4.26L17 8l-3.91 1.74L12 14l-1.09-4.26L7 8l3.91-1.74L12 3zM19 15l.54 2.11L21 18l-1.46.89L19 21l-.54-2.11L17 18l1.46-.89L19 15zM5 15l.54 2.11L7 18l-1.46.89L5 21l-.54-2.11L3 18l1.46-.89L5 15z" />
    </svg>
  );
}

function TierMixBars({ byTier = {}, total }) {
  const order = ["Tier 1", "Tier 2", "Tier 3"];
  return (
    <div className="space-y-2.5 mt-1">
      {order.map((t) => {
        const n = byTier[t] || 0;
        const pct = total ? Math.round((n / total) * 100) : 0;
        return (
          <div key={t}>
            <div className="flex justify-between text-[11px] font-medium text-slate-500 dark:text-slate-400">
              <span>{t}</span>
              <span>{n}</span>
            </div>
            <div className="projects-micro-bar">
              <span style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function ProjectsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [sortBy, setSortBy] = useState("updatedAt");
  const [sortDir, setSortDir] = useState("DESC");

  const { data: analytics, isLoading: analyticsLoading, isError: analyticsError, error: analyticsErr, refetch: refetchAnalytics } = useQuery({
    queryKey: ["projects", "analytics"],
    queryFn: async () => (await api.get("/projects/analytics")).data
  });

  const { data, isError, error, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["projects", "paged", page, limit, sortBy, sortDir],
    queryFn: async () => (
      await api.get("/projects", {
        params: {
          paged: true,
          page,
          limit,
          sortBy,
          sortDir
        }
      })
    ).data
  });
  const projects = data?.rows || [];
  const totalPages = data?.totalPages || 1;
  const total = data?.total || 0;

  const sortIndicator = useMemo(
    () => (field) => (sortBy !== field ? "" : sortDir === "ASC" ? " ▲" : " ▼"),
    [sortBy, sortDir]
  );

  const onSort = (field) => {
    setPage(1);
    if (sortBy === field) {
      setSortDir((prev) => (prev === "ASC" ? "DESC" : "ASC"));
      return;
    }
    setSortBy(field);
    setSortDir("ASC");
  };

  const removeProject = useMutation({
    mutationFn: async (projectId) => api.delete(`/projects/${projectId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["projects"] })
  });

  const onDeleteProject = (projectId, clientName) => {
    const confirmed = window.confirm(`Delete project "${clientName}"? This will hide it from modules.`);
    if (!confirmed) return;
    removeProject.mutate(projectId);
  };

  const portfolioTotal = analytics?.total ?? total;
  const rag = analytics?.byHealth || {};
  const green = rag.Green || 0;
  const amber = rag.Amber || 0;
  const red = rag.Red || 0;
  const ragSum = green + amber + red || 1;
  const ragWidths = {
    green: (green / ragSum) * 100,
    amber: (amber / ragSum) * 100,
    red: (red / ragSum) * 100
  };

  const statusPreview = useMemo(() => {
    const entries = Object.entries(analytics?.byStatus || {}).sort((a, b) => b[1] - a[1]);
    return entries.slice(0, 4);
  }, [analytics?.byStatus]);

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-wrap items-center gap-3">
        <BackButton />
      </div>

      {isError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 card-premium">
          <strong className="font-semibold">Projects could not load.</strong>{" "}
          {getApiErrorMessage(error)}
          <button type="button" className="ml-2 text-indigo-700 underline font-medium" onClick={() => refetch()}>
            Retry
          </button>
        </div>
      )}

      <section className="projects-hero rounded-2xl p-6 md:p-8 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
        <div className="space-y-3 max-w-xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-indigo-100/90 flex items-center gap-2">
            <span className="inline-flex opacity-90" aria-hidden><IconSpark /></span>
            Portfolio
          </p>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white">Projects</h2>
          <p className="text-sm text-indigo-100/85 leading-relaxed">
            Live onboarding portfolio with health signals, tier mix, and lifecycle status—explore the grid below or open a client workspace.
          </p>
        </div>
        <Link className="projects-hero-action shrink-0 self-start lg:self-auto" to="/projects/new">
          <span className="text-lg leading-none">+</span>
          Create project
        </Link>
      </section>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 projects-stat-grid">
        <article className="projects-stat-card card-premium">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Total portfolio</p>
              <p className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white mt-1 tabular-nums">
                {analyticsLoading ? "…" : analyticsError ? "—" : portfolioTotal}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">All active client onboarding records</p>
            </div>
            <span className="metric-icon metric-icon-indigo shrink-0">Σ</span>
          </div>
          {analyticsError && (
            <button type="button" className="mt-2 text-xs text-indigo-600 dark:text-indigo-300 underline" onClick={() => refetchAnalytics()}>
              Analytics unavailable — retry
            </button>
          )}
        </article>

        <article className="projects-stat-card card-premium">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Health (RAG)</p>
              {analyticsLoading ? (
                <p className="text-sm text-slate-400 mt-4">Loading distribution…</p>
              ) : analyticsError ? (
                <p className="text-sm text-red-600 dark:text-red-300 mt-2">{getApiErrorMessage(analyticsErr)}</p>
              ) : (
                <>
                  <div className="projects-rag-track" title={`Green ${green}, Amber ${amber}, Red ${red}`}>
                    <div className="projects-rag-green" style={{ width: `${ragWidths.green}%` }} />
                    <div className="projects-rag-amber" style={{ width: `${ragWidths.amber}%` }} />
                    <div className="projects-rag-red" style={{ width: `${ragWidths.red}%` }} />
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2.5 text-[11px] font-medium">
                    <span className="text-emerald-700 dark:text-emerald-300">G {green}</span>
                    <span className="text-amber-700 dark:text-amber-300">A {amber}</span>
                    <span className="text-red-700 dark:text-red-300">R {red}</span>
                  </div>
                </>
              )}
            </div>
            <span className="metric-icon metric-icon-green shrink-0">◆</span>
          </div>
        </article>

        <article className="projects-stat-card card-premium">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Tier mix</p>
              {analyticsLoading ? (
                <p className="text-sm text-slate-400 mt-4">Loading tiers…</p>
              ) : analyticsError ? (
                <p className="text-sm text-slate-400 mt-2">—</p>
              ) : (
                <TierMixBars byTier={analytics?.byTier} total={portfolioTotal} />
              )}
            </div>
            <span className="metric-icon metric-icon-blue shrink-0">T</span>
          </div>
        </article>

        <article className="projects-stat-card card-premium">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Lifecycle status</p>
              {analyticsLoading ? (
                <p className="text-sm text-slate-400 mt-4">Loading statuses…</p>
              ) : analyticsError ? (
                <p className="text-sm text-slate-400 mt-2">—</p>
              ) : (
                <div className="flex flex-wrap gap-2 mt-3">
                  {statusPreview.length === 0 ? (
                    <span className="text-xs text-slate-400">No status data</span>
                  ) : (
                    statusPreview.map(([label, count]) => (
                      <span
                        key={label}
                        className="inline-flex items-center gap-1 rounded-full border border-slate-200 dark:border-slate-600 bg-slate-50/90 dark:bg-slate-800/80 px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-200"
                      >
                        {label}
                        <span className="tabular-nums text-indigo-600 dark:text-indigo-300">{count}</span>
                      </span>
                    ))
                  )}
                </div>
              )}
            </div>
            <span className="metric-icon metric-icon-amber shrink-0">◎</span>
          </div>
        </article>
      </div>

      <div className="projects-table-shell card-entrance overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[760px]">
            <thead>
              <tr>
                <th className="cursor-pointer select-none" onClick={() => onSort("clientName")}>
                  Client{sortIndicator("clientName")}
                </th>
                <th className="cursor-pointer select-none w-[120px]" onClick={() => onSort("tier")}>
                  Tier{sortIndicator("tier")}
                </th>
                <th className="cursor-pointer select-none w-[110px]" onClick={() => onSort("health")}>
                  Health{sortIndicator("health")}
                </th>
                <th className="cursor-pointer select-none min-w-[130px]" onClick={() => onSort("projectStatus")}>
                  Status{sortIndicator("projectStatus")}
                </th>
                <th className="w-[76px] text-center">Open</th>
                <th className="w-[76px] text-center">Remove</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td className="p-4 text-sm text-slate-500" colSpan={6}>
                    {isFetching ? "Loading projects…" : "Loading…"}
                  </td>
                </tr>
              )}
              {!isLoading && projects.map((p) => (
                <tr key={p.id} className="group">
                  <td className="projects-page-client">{p.clientName}</td>
                  <td><StatusPill value={p.tier} type="default" /></td>
                  <td><StatusPill value={p.health} type="health" /></td>
                  <td><StatusPill value={p.projectStatus || "Yet to Start"} type="project-status" /></td>
                  <td className="text-center">
                    <Link className="projects-icon-btn" to={`/projects/${p.id}`} title={`Open ${p.clientName}`}>
                      <IconOpen />
                      <span className="sr-only">Open project</span>
                    </Link>
                  </td>
                  <td className="text-center">
                    <button
                      type="button"
                      className="projects-icon-btn projects-icon-btn-danger"
                      title={`Delete ${p.clientName}`}
                      onClick={() => onDeleteProject(p.id, p.clientName)}
                      disabled={removeProject.isPending}
                    >
                      <IconTrash />
                      <span className="sr-only">Delete project</span>
                    </button>
                  </td>
                </tr>
              ))}
              {!isLoading && !isError && !projects.length && (
                <tr>
                  <td className="p-4 text-sm text-slate-500" colSpan={6}>No projects available yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="projects-pagination">
        <div className="text-sm text-slate-600 dark:text-slate-300">
          Showing page <span className="font-semibold text-slate-800 dark:text-slate-100">{page}</span> of{" "}
          <span className="font-semibold">{totalPages}</span>
          <span className="text-slate-400 dark:text-slate-500 mx-1">·</span>
          <span className="tabular-nums">{total}</span> total projects
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-200 disabled:opacity-45 hover:border-indigo-300 hover:text-indigo-700 dark:hover:border-indigo-500 dark:hover:text-indigo-200 transition-colors"
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={page <= 1}
          >
            Previous
          </button>
          <button
            type="button"
            className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-200 disabled:opacity-45 hover:border-indigo-300 hover:text-indigo-700 dark:hover:border-indigo-500 dark:hover:text-indigo-200 transition-colors"
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={page >= totalPages}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
