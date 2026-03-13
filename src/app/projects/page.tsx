import { ProjectsScreen } from "@/components/screens/projects-screen";
import { listClients, listProjects } from "@/server/services/finance";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const [{ data: projects, demoMode }, { data: clients }] = await Promise.all([listProjects(), listClients(null)]);
  return <ProjectsScreen projects={projects} clients={clients} demoMode={demoMode} />;
}
