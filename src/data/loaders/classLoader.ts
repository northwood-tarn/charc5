import classesCsv from "../csv/classes.csv?raw";
import { parseCsv } from "./csvParser";
import type { NormalizedClass } from "../../engine/contracts/dataContracts";

export interface ClassOption {
  id: string;
  name: string;
}

interface ClassCsvRow {
  id: string;
  name: string;
  armorProficiencies?: string;
  armor_proficiencies?: string;
  armorTraining?: string;
  armor_training?: string;
  weaponProficiencies?: string;
  weapon_proficiencies?: string;
  weaponTraining?: string;
  weapon_training?: string;
  toolProficiencies?: string;
  tool_proficiencies?: string;
  savingThrowProficiencies?: string;
  saving_throw_proficiencies?: string;
  skillChoicesCount?: string;
  skill_choices_count?: string;
  skillChoicesOptions?: string;
  skill_choices_options?: string;
}

const classRows = parseCsv<ClassCsvRow>(classesCsv);

function splitPipeList(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  return value
    .split("|")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function firstDefinedString(...values: Array<string | undefined>): string | undefined {
  return values.find((value) => typeof value === "string" && value.trim().length > 0);
}

function parseInteger(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeClassRow(row: ClassCsvRow): NormalizedClass {
  const armorSource = firstDefinedString(
    row.armorProficiencies,
    row.armor_proficiencies,
    row.armorTraining,
    row.armor_training
  );

  const weaponSource = firstDefinedString(
    row.weaponProficiencies,
    row.weapon_proficiencies,
    row.weaponTraining,
    row.weapon_training
  );

  const toolSource = firstDefinedString(
    row.toolProficiencies,
    row.tool_proficiencies
  );

  const savingThrowSource = firstDefinedString(
    row.savingThrowProficiencies,
    row.saving_throw_proficiencies
  );

  const skillChoiceCount = parseInteger(
    firstDefinedString(row.skillChoicesCount, row.skill_choices_count)
  );

  const skillChoiceOptions = splitPipeList(
    firstDefinedString(row.skillChoicesOptions, row.skill_choices_options)
  );

  return {
    id: row.id,
    name: row.name,
    armorProficiencies: splitPipeList(armorSource),
    weaponProficiencies: splitPipeList(weaponSource),
    toolProficiencies: splitPipeList(toolSource),
    savingThrowProficiencies: splitPipeList(savingThrowSource),
    skillChoices:
      typeof skillChoiceCount === "number" && skillChoiceOptions.length > 0
        ? {
            count: skillChoiceCount,
            options: skillChoiceOptions,
          }
        : null,
  };
}

const normalizedClasses: NormalizedClass[] = classRows.map(normalizeClassRow);

export function getClasses(): NormalizedClass[] {
  return normalizedClasses;
}

export function getClassOptions(): ClassOption[] {
  return normalizedClasses.map((row) => ({
    id: row.id,
    name: row.name,
  }));
}

export function getClassById(id: string | null | undefined): NormalizedClass | null {
  if (!id) {
    return null;
  }

  return normalizedClasses.find((row) => row.id === id) ?? null;
}