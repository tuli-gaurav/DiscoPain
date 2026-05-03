import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import api from "../api/client";
import BackButton from "../components/BackButton";

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
      isCostInvolved: "no",
      costValue: "",
      costApproved: "",
      costApprovalDocument: "",
      clientType: "Existing Client",
      projectStatus: "Yet to Start",
      summary: ""
    }
  });
  const selectedTier = watch("tier");
  const isCostInvolved = watch("isCostInvolved");
  const costApproved = watch("costApproved");
  const templateOptions = templates.filter((t) => t.tier === selectedTier && t.isActive);

  const onSubmit = async (values) => {
    const templateId = Number(values.templateId);
    const costFlag = values.isCostInvolved === "yes";
    const approvedFlag = costFlag && values.costApproved ? values.costApproved === "yes" : null;
    const payload = {
      clientName: values.clientName,
      regions: values.regions.split(",").map((r) => r.trim()).filter(Boolean),
      stakeholders: values.stakeholders.split(",").map((item) => item.trim()).filter(Boolean),
      contributingTeam: values.contributingTeam.split(",").map((item) => item.trim()).filter(Boolean),
      // Keep legacy field for backward compatibility while using richer fields.
      costInvolved: costFlag ? Number(values.costValue || 0) : 0,
      isCostInvolved: costFlag,
      costValue: costFlag ? Number(values.costValue || 0) : null,
      costApproved: approvedFlag,
      costApprovalDocument: costFlag && approvedFlag ? values.costApprovalDocument || null : null,
      clientType: values.clientType,
      projectStatus: values.projectStatus,
      tier: values.tier,
      health: values.health,
      summary: values.summary
    };
    const { data } = await api.post("/projects", { ...payload, templateId });
    navigate(`/projects/${data.id}`);
  };

  return (
    <div className="space-y-4">
      <BackButton />
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
        <select className="border rounded px-3 py-2" {...register("clientType", { required: true })}>
          {["Existing Client", "New Client", "POC"].map((type) => <option key={type}>{type}</option>)}
        </select>
        <select className="border rounded px-3 py-2" {...register("projectStatus", { required: true })}>
          {["Yet to Start", "In-Progress", "On Hold", "Cancelled"].map((status) => <option key={status}>{status}</option>)}
        </select>
        <select className="border rounded px-3 py-2" {...register("isCostInvolved", { required: true })}>
          <option value="no">Cost involved: No</option>
          <option value="yes">Cost involved: Yes</option>
        </select>
        {isCostInvolved === "yes" && (
          <>
            <input
              className="border rounded px-3 py-2"
              type="number"
              step="0.01"
              placeholder="Cost value"
              {...register("costValue", { required: true, min: 0 })}
            />
            <select className="border rounded px-3 py-2" {...register("costApproved", { required: true })}>
              <option value="">Cost approval status</option>
              <option value="yes">Approved</option>
              <option value="no">Not Approved</option>
            </select>
            {costApproved === "no" && (
              <div className="md:col-span-2 text-sm text-red-600">
                Cost is not approved. Please resolve approval before onboarding execution.
              </div>
            )}
            {costApproved === "yes" && (
              <input
                className="border rounded px-3 py-2 md:col-span-2"
                placeholder="Approval document link / reference"
                {...register("costApprovalDocument", { required: true })}
              />
            )}
          </>
        )}
        <textarea className="border rounded px-3 py-2 md:col-span-2" rows={4} placeholder="Project summary" {...register("summary")} />
        <button className="bg-indigo-600 text-white rounded px-4 py-2 md:col-span-2">Create Project</button>
        </form>
      </div>
    </div>
  );
}
