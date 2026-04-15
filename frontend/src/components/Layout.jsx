import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import api from "../api/client";

const navItems = [
  { to: "/", label: "Dashboard", icon: "DB" },
  { to: "/templates", label: "Templates", icon: "TP" },
  { to: "/projects", label: "Projects", icon: "PR" },
  { to: "/notifications", label: "Notifications", icon: "NT" },
  { to: "/ids", label: "IDS", icon: "ID" },
  { to: "/reports", label: "Reports", icon: "RP" },
  { to: "/users", label: "Users", icon: "US" }
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "light");
  const [density, setDensity] = useState(() => localStorage.getItem("density") || "comfortable");

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("density-compact", density === "compact");
    localStorage.setItem("density", density);
  }, [density]);

  const { data } = useQuery({
    queryKey: ["notifications-unread-count"],
    queryFn: async () => (await api.get("/notifications/unread-count")).data,
    refetchInterval: 15000
  });
  return (
    <div className="app-shell min-h-screen flex">
      <aside className="w-72 app-sidebar text-white p-5">
        <h1 className="text-2xl font-bold mb-8 tracking-tight">DiscoPain</h1>
        <nav className="flex flex-col gap-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `px-4 py-2.5 rounded-xl transition-all duration-200 ${
                  isActive
                    ? "bg-white/20 text-white shadow-lg shadow-black/20"
                    : "text-slate-200 hover:bg-white/10 hover:text-white"
                }`
              }
            >
              <span className="inline-flex items-center gap-2">
                <span className="nav-icon-chip">{item.icon}</span>
                <span>{item.label}</span>
              </span>
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="flex-1 app-main">
        <header className="app-header p-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <span className="font-medium text-slate-700">{user?.fullName}</span>
            <NavLink to="/notifications" className="text-sm border border-indigo-200 text-indigo-700 bg-indigo-50 rounded-full px-3 py-1">
              Notifications {data?.count ? `(${data.count})` : ""}
            </NavLink>
            <button
              className="text-xs border rounded-full px-3 py-1 bg-white/80"
              onClick={() => setTheme((v) => (v === "light" ? "dark" : "light"))}
            >
              {theme === "light" ? "Dark" : "Light"} Mode
            </button>
            <button
              className="text-xs border rounded-full px-3 py-1 bg-white/80"
              onClick={() => setDensity((v) => (v === "comfortable" ? "compact" : "comfortable"))}
            >
              {density === "comfortable" ? "Compact" : "Comfort"} Density
            </button>
          </div>
          <button className="px-4 py-2 rounded-xl bg-slate-900 text-white shadow-md hover:bg-slate-800 transition-colors" onClick={logout}>Logout</button>
        </header>
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
