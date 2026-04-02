import classesCsv from "../csv/classes.csv?raw";
import { parseCsv } from "./csvParser";
import type { AbilityScoresDraft } from "../../types/draft";

interface ClassCsvRow {
  id: string;
  ability_priority: string;
}

const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8] as const;

const ABILITY_CODE_TO_KEY: Record<string, keyof AbilityScoresDraft> = {
  STR: "strength",
  DEX: "dexterity",
  CON: "constitution",
  INT: "intelligence",
  WIS: "wisdom",
  CHA: "charisma",
};

const classRows = parseCsv<ClassCsvRow>(classesCsv);

function createEmptyAbilityScores(): AbilityScoresDraft {
  return {
    strength: null,
    dexterity: null,
    constitution: null,
    intelligence: null,
    wisdom: null,
    charisma: null,
  };
}

export function getDefaultAbilitiesForClass(
  classId: string | null
): AbilityScoresDraft {
  const emptyAbilities = createEmptyAbilityScores();

  if (!classId) {
    return emptyAbilities;
  }

  const classRow = classRows.find((row) => row.id === classId);

  if (!classRow || !classRow.ability_priority) {
    return emptyAbilities;
  }

  const priorityCodes = classRow.ability_priority
    .split("|")
    .map((code) => code.trim())
    .filter(Boolean);

  const nextAbilities = createEmptyAbilityScores();

  priorityCodes.forEach((code, index) => {
    const abilityKey = ABILITY_CODE_TO_KEY[code];
    const score = STANDARD_ARRAY[index];

    if (!abilityKey || score === undefined) {
      return;
    }

    nextAbilities[abilityKey] = score;
  });

  return nextAbilities;
}