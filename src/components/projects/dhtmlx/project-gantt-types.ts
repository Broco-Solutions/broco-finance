export type PhaseDTO = {
  id: string;
  name: string;
  position: number;
};

export type TaskDTO = {
  id: string;
  phaseId: string | null;
  name: string;
  description: string | null;
  type: "TASK" | "MILESTONE";
  startDate: string;
  endDate: string;
  status: "TODO" | "IN_PROGRESS" | "TO_REVIEW" | "BLOCKED" | "DONE";
  position: number;
  clientVisible?: boolean;
};