import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import api from "../api/client";

const tiers = ["Tier 1", "Tier 2", "Tier 3"];

export default function CreateProjectPage() {
  const navigate = useNavigate();
  const { data: templates = [] } = useQuery({
    queryKey: ["templates"],
    queryFn: async () => (await api.get("/templates")).data
  });
  const { register, handleSubmit, watch } = useForm({
    defaultValues: {
      clientName: "",
      regions: "NA",
      stakeholders: "",
      contributingTeam: "",
      tier: "Tier 1",
      health: "Green",
      costInvolved: 0,
      summary: ""
    }
  });
  const selectedTier = watch("tier");
  const templateOptions = templates.filter((t) => t.tier === selectedTier && t.isActive);

  const onSubmit = async (values) => {
    const templateId = Number(values.templateId);
    const payload = {
      clientName: values.clientName,
      regions: values.regions.split(",").map((r) => r.trim()).filter(Boolean),
      stakeholders: values.stakeholders.split(",").map((item) => item.trim()).filter(Boolean),
      contributingTeam: values.contributingTeam.split(",").map((item) => item.trim()).filter(Boolean),
      costInvolved: Number(values.costInvolved),
      tier: values.tier,
      health: values.health,
      summary: values.summary
    };
    const { data } = await api.post("/projects", { ...payload, templateId });
    navigate(`/projects/${data.id}`);
  };

  return (
    <div className="bg-white rounded-xl shadow p-6 max-w-3xl">
      <h2 className="text-2xl font-semibold mb-4">Create Client Project</h2>
      <form className="grid grid-cols-1 md:grid-cols-2 gap-4" onSubmit={handleSubmit(onSubmit)}>
        <input className="border rounded px-3 py-2" placeholder="Client name" {...register("clientName", { required: true })} />
        <input className="border rounded px-3 py-2" placeholder="Regions (comma separated)" {...register("regions", { required: true })} />
        <input className="border rounded px-3 py-2" placeholder="Stakeholders (comma separated)" {...register("stakeholders")} />
        <input className="border rounded px-3 py-2" placeholder="Contributing team (comma separated)" {...register("contributingTeam")} />
        <select className="border rounded px-3 py-2" {...register("tier")}>
          {tiers.map((tier) => <option key={tier}>{tier}</option>)}
        </select>
        <select className="border rounded px-3 py-2" {...register("templateId", { required: true })}>
          <option value="">Select template</option>
          {templateOptions.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select className="border rounded px-3 py-2" {...register("health")}>
          {["Green", "Amber", "Red"].map((h) => <option key={h}>{h}</option>)}
        </select>
        <input className="border rounded px-3 py-2" type="number" step="0.01" placeholder="Cost involved" {...register("costInvolved")} />
        <textarea className="border rounded px-3 py-2 md:col-span-2" rows={4} placeholder="Project summary" {...register("summary")} />
        <button className="bg-indigo-600 text-white rounded px-4 py-2 md:col-span-2">Create Project</button>
      </form>
    </div>
  );
}
