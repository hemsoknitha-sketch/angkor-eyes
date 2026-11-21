import { useEffect, useState } from "react";
import type { Agent } from "../lib/types";
import { api } from "../lib/api";
import Roster from "../components/Roster";
import AddAgentForm from "../components/AddAgentForm";
import { ListSkeleton } from "../components/LoadingSkeletons";

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const load = () => api.listAgents().then((a) => { setAgents(a); setLoading(false); });
  useEffect(() => { load(); }, []);
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">🤖 ភ្នាក់ងារ · Agents</h1>
      <AddAgentForm onCreated={load} />
      {loading ? <ListSkeleton /> : <Roster agents={agents} onChange={load} />}
    </div>
  );
}
