

import spellsCsv from "../csv/spells.csv?raw";


export interface SpellCsvRow {
  spell_id: string;
  name: string;
  level: string;
  School: string;
  actionType: string;
  duration: string;
  range: string;
  components: string;
  description: string;
  concentration: string;
  ritual: string;
  classes: string;
}

export interface SpellRecord {
  id: string;
  name: string;
  level: number;
  school: string;
  actionType: string;
  duration: string;
  range: string;
  components: string;
  description: string;
  concentration: boolean;
  ritual: boolean;
  classes: string[];
}


function parseQuotedCsv(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentCell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      currentRow.push(currentCell);
      currentCell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }

      currentRow.push(currentCell);
      const hasContent = currentRow.some((cell) => cell.length > 0);
      if (hasContent) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentCell = "";
      continue;
    }

    currentCell += char;
  }

  currentRow.push(currentCell);
  const hasTrailingContent = currentRow.some((cell) => cell.length > 0);
  if (hasTrailingContent) {
    rows.push(currentRow);
  }

  return rows;
}

function parseSpellRows(text: string): SpellCsvRow[] {
  const rows = parseQuotedCsv(text);

  if (rows.length === 0) {
    return [];
  }

  const header = rows[0];

  return rows.slice(1).map((row, rowIndex) => {
    const record = Object.fromEntries(
      header.map((key, columnIndex) => [key, row[columnIndex] ?? ""])
    ) as SpellCsvRow;

    if (!record.spell_id) {
      throw new Error(`Missing spell_id in spells.csv row ${rowIndex + 2}`);
    }

    return record;
  });
}

const spellRows = parseSpellRows(spellsCsv);

function parseLevel(value: string): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid spell level: ${value}`);
  }

  return parsed;
}

function parseBoolean(value: string): boolean {
  if (!value) {
    return false;
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === "true" || normalized === "yes" || normalized === "1") {
    return true;
  }

  if (normalized === "false" || normalized === "no" || normalized === "0" || normalized === "") {
    return false;
  }

  // Fail soft instead of crashing the app
  console.warn(`Unexpected boolean value in spells.csv: ${value}`);
  return false;
}

function splitPipeDelimited(value: string | null | undefined): string[] {
  if (!value) {
    return [];
  }

  return value
    .split("|")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .filter((entry) => entry.toLowerCase() !== "artificer");
}

const spells: SpellRecord[] = spellRows.map((row) => ({
  id: row.spell_id,
  name: row.name,
  level: parseLevel(row.level),
  school: row.School,
  actionType: row.actionType,
  duration: row.duration,
  range: row.range,
  components: row.components,
  description: row.description,
  concentration: parseBoolean(row.concentration),
  ritual: parseBoolean(row.ritual),
  classes: splitPipeDelimited(row.classes),
}));

const spellMap = new Map(spells.map((spell) => [spell.id, spell] as const));

export function getSpells(): SpellRecord[] {
  return spells;
}

export function getSpellById(spellId: string): SpellRecord | null {
  return spellMap.get(spellId) ?? null;
}