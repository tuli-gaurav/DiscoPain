export default function StatusPill({ value, type = "default" }) {
  const normalized = String(value || "").toLowerCase();
  let cls = "status-pill status-pill-default";

  if (type === "health") {
    if (normalized.includes("green")) cls = "status-pill status-pill-green";
    else if (normalized.includes("amber")) cls = "status-pill status-pill-amber";
    else if (normalized.includes("red")) cls = "status-pill status-pill-red";
  } else if (type === "task") {
    if (normalized.includes("completed")) cls = "status-pill status-pill-green";
    else if (normalized.includes("in progress")) cls = "status-pill status-pill-blue";
    else if (normalized.includes("blocked")) cls = "status-pill status-pill-red";
    else cls = "status-pill status-pill-slate";
  } else if (type === "ids-severity") {
    if (normalized.includes("critical")) cls = "status-pill status-pill-red";
    else if (normalized.includes("high")) cls = "status-pill status-pill-amber";
    else if (normalized.includes("medium")) cls = "status-pill status-pill-blue";
    else cls = "status-pill status-pill-slate";
  } else if (type === "ids-status") {
    if (normalized.includes("closed") || normalized.includes("resolved")) cls = "status-pill status-pill-green";
    else if (normalized.includes("in progress")) cls = "status-pill status-pill-blue";
    else cls = "status-pill status-pill-amber";
  } else if (type === "project-status") {
    if (normalized.includes("in-progress")) cls = "status-pill status-pill-blue";
    else if (normalized.includes("on hold")) cls = "status-pill status-pill-amber";
    else if (normalized.includes("cancelled")) cls = "status-pill status-pill-red";
    else cls = "status-pill status-pill-slate";
  }

  return <span className={cls}>{value || "-"}</span>;
}
