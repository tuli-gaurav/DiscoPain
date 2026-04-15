import { Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import Layout from "./components/Layout";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import ProjectsPage from "./pages/ProjectsPage";
import CreateProjectPage from "./pages/CreateProjectPage";
import ProjectDetailsPage from "./pages/ProjectDetailsPage";
import TemplatesPage from "./pages/TemplatesPage";
import NotificationsPage from "./pages/NotificationsPage";
import IdsPage from "./pages/IdsPage";
import IdsDetailPage from "./pages/IdsDetailPage";
import ReportsPage from "./pages/ReportsPage";
import AuditPage from "./pages/AuditPage";

function Placeholder({ title }) {
  return <div className="bg-white rounded-lg p-6 shadow">{title} page scaffolded.</div>;
}

function Protected() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/templates" element={<TemplatesPage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/projects/new" element={<CreateProjectPage />} />
        <Route path="/projects/:id" element={<ProjectDetailsPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/ids" element={<IdsPage />} />
        <Route path="/ids/:id" element={<IdsDetailPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/users" element={<Placeholder title="User Management" />} />
        <Route path="/audit" element={<AuditPage />} />
      </Routes>
    </Layout>
  );
}

export default function App() {
  const { user } = useAuth();
  if (!user) return <LoginPage />;
  return <Protected />;
}
