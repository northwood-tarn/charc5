

import backgroundsCsv from "../csv/backgrounds.csv?raw";
import { parseCsv } from "./csvParser";

interface BackgroundCsvRow {
  id: string;
  name: string;
  feat: string;
  asi_options: string;
  skill_profs: string;
  tool_prof: string;
}

export interface BackgroundRecord {
  id: string;
  name: string;
  feat: string;
  asiOptions: string[];
  skillProficiencies: string[];
  toolProficiency: string;
}

function splitPipeDelimited(value: string | null | undefined): string[] {
  return (value ?? "")
    .split("|")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

const backgroundRows = parseCsv<BackgroundCsvRow>(backgroundsCsv);

const backgrounds: BackgroundRecord[] = backgroundRows.map((row, rowIndex) => {
  if (!row.id) {
    throw new Error(`Missing id in backgrounds.csv row ${rowIndex + 2}`);
  }

  if (!row.name) {
    throw new Error(`Missing name in backgrounds.csv row ${rowIndex + 2}`);
  }

  return {
    id: row.id,
    name: row.name,
    feat: row.feat?.trim() ?? "",
asiOptions: splitPipeDelimited(row.asi_options)
  .map((entry) => {
    switch (entry.toUpperCase()) {
      case "STR": return "strength";
      case "DEX": return "dexterity";
      case "CON": return "constitution";
      case "INT": return "intelligence";
      case "WIS": return "wisdom";
      case "CHA": return "charisma";
      default: return null;
    }
  })
  .filter((entry): entry is string => Boolean(entry)),    skillProficiencies: splitPipeDelimited(row.skill_profs),
    toolProficiency: row.tool_prof?.trim() ?? "",
  };
});

export function getBackgrounds(): BackgroundRecord[] {
  return backgrounds;
}

export function getBackgroundById(id: string | null | undefined): BackgroundRecord | null {
  if (!id) {
    return null;
  }

  return backgrounds.find((background) => background.id === id) ?? null;
}