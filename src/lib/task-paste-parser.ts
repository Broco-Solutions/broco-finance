export type PhaseDTO = { id: string; name: string };

export type ParsedRow = {
  name: string;
  phaseId: string | null;
  status: string | null;
  type: string | null;
  startDate: string | null;
  endDate: string | null;
};

export type ParseResult = {
  rows: ParsedRow[];
  errors: { line: number; message: string }[];
};

const STATUS_BY_LABEL: Record<string, string> = {
  "por hacer": "TODO",
  todo: "TODO",
  "en progreso": "IN_PROGRESS",
  "a revisar": "TO_REVIEW",
  bloqueado: "BLOCKED",
  hecho: "DONE",
  done: "DONE",
  in_progress: "IN_PROGRESS",
  to_review: "TO_REVIEW",
  blocked: "BLOCKED",
};

function normalizeStatus(input: string): string | null {
  const key = input.trim().toLowerCase();
  if (!key) return null;
  if (key in STATUS_BY_LABEL) return STATUS_BY_LABEL[key];
  const upper = key.toUpperCase();
  if (["TODO", "IN_PROGRESS", "TO_REVIEW", "BLOCKED", "DONE"].includes(upper)) return upper;
  return null;
}

function parseDate(input: string): string | null {
  const s = input.trim();
  if (!s) return null;
  // Try YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(s + "T00:00:00");
    return isNaN(d.getTime()) ? null : s;
  }
  // Try DD/MM/YYYY or DD-MM-YYYY
  const m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (m) {
    const dd = m[1].padStart(2, "0");
    const mm = m[2].padStart(2, "0");
    const yyyy = m[3];
    const iso = `${yyyy}-${mm}-${dd}`;
    const d = new Date(iso + "T00:00:00");
    return isNaN(d.getTime()) ? null : iso;
  }
  // Try Date parse fallback
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10);
  }
  return null;
}

export function parsePastedTasks(
  text: string,
  phases: PhaseDTO[],
  defaults: {
    phaseId: string | null;
    status: string;
    type: string;
    startDate: string;
    endDate: string;
    clientVisible: boolean;
  },
): ParseResult {
  const lines = text.split(/\r?\n/).map((l) => l.trimEnd());
  const rows: ParsedRow[] = [];
  const errors: { line: number; message: string }[] = [];

  // Build phase lookup case-insensitive
  const phaseByName = new Map<string, string>();
  for (const p of phases) {
    phaseByName.set(p.name.trim().toLowerCase(), p.id);
  }

  let filteredLines = lines.filter((l) => l.trim().length > 0);
  // If input is empty after trim, return empty
  if (filteredLines.length === 0) return { rows, errors };

  for (let i = 0; i < filteredLines.length; i++) {
    const lineNum = i + 1;
    const raw = filteredLines[i];
    // Split by tab for TSV
    const cols = raw.split("\t").map((c) => c.trim());

    let name: string | null = null;
    let phaseId: string | null = defaults.phaseId;
    let status: string | null = defaults.status;
    let type: string | null = defaults.type;
    let startDate: string | null = defaults.startDate;
    let endDate: string | null = defaults.endDate;

    if (cols.length === 1) {
      name = cols[0].trim();
      if (!name) {
        errors.push({ line: lineNum, message: "Nombre vacío." });
        continue;
      }
    } else {
      // TSV: expected order Tarea | Fase | Estado | Inicio | Fin | Tipo (optional)
      // Accept flexible: at least Tarea, rest optional
      name = cols[0]?.trim() || null;
      if (!name) {
        errors.push({ line: lineNum, message: "Falta nombre de tarea." });
        continue;
      }
      // Fase (col 1)
      if (cols.length > 1 && cols[1]) {
        const phaseName = cols[1].trim();
        if (phaseName.toLowerCase() === "sin fase" || phaseName === "" || phaseName === "-") {
          phaseId = null;
        } else {
          const found = phaseByName.get(phaseName.toLowerCase());
          if (!found) {
            errors.push({ line: lineNum, message: `Fase '${phaseName}' no encontrada.` });
            continue;
          }
          phaseId = found;
        }
      }
      // Estado (col 2)
      if (cols.length > 2 && cols[2]) {
        const normalized = normalizeStatus(cols[2]);
        if (!normalized) {
          errors.push({ line: lineNum, message: `Estado '${cols[2]}' inválido.` });
          continue;
        }
        status = normalized;
      }
      // Inicio (col 3)
      if (cols.length > 3 && cols[3]) {
        const parsed = parseDate(cols[3]);
        if (!parsed) {
          errors.push({ line: lineNum, message: `Fecha inicio '${cols[3]}' inválida.` });
          continue;
        }
        startDate = parsed;
      }
      // Fin (col 4)
      if (cols.length > 4 && cols[4]) {
        const parsed = parseDate(cols[4]);
        if (!parsed) {
          errors.push({ line: lineNum, message: `Fecha fin '${cols[4]}' inválida.` });
          continue;
        }
        endDate = parsed;
      }
      // Tipo (col 5) optional
      if (cols.length > 5 && cols[5]) {
        const t = cols[5].trim().toUpperCase();
        if (t === "TAREA" || t === "TASK") type = "TASK";
        else if (t === "HITO" || t === "MILESTONE") type = "MILESTONE";
        else {
          errors.push({ line: lineNum, message: `Tipo '${cols[5]}' inválido.` });
          continue;
        }
      }
    }

    if (!name) {
      errors.push({ line: lineNum, message: "Nombre requerido." });
      continue;
    }

    rows.push({
      name,
      phaseId,
      status,
      type,
      startDate,
      endDate,
    });
  }

  return { rows, errors };
}
