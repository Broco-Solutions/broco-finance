import { KanbanScreen } from "@/components/screens/kanban-screen";
import { getKanbanBoard } from "@/server/services/kanban";

export const dynamic = "force-dynamic";

export default async function KanbanPage() {
  const board = await getKanbanBoard();
  return <KanbanScreen board={board} />;
}
