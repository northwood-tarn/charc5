import classFeaturesCsv from "../csv/classFeatures.csv?raw";
import { parseCsv } from "./csvParser";

export type FeatureFormulaId =
  | "pb_plus_ability_mod"
  | "8_plus_pb_plus_ability_mod";

export type FeatureAbilityId =
  | "str"
  | "dex"
  | "con"
  | "int"
  | "wis"
  | "cha"
  | "spellcasting"
  | "str_or_dex_choice";

export interface ClassFeatureRow {
  class_id: string;
  subclass_id: string;
  class: string;
  subclass: string;
  level: string;
  name: string;
  description: string;
  grants_spell_id: string;
  grants_spell_ids?: string;
  granted_spell_ids?: string;
  attack_bonus_ability: string;
  attack_bonus_formula: string;
  save_dc_ability: string;
  save_dc_formula: string;
}

export interface ClassFeatureRecord {
  featureId: string;
  classId: string;
  subclassId: string;
  className: string;
  subclassName: string;
  sourceType: "class";
  sourceId: string;
  sourceName: string;
  level: number;
  name: string;
  description: string;
  grantedSpellIds: string[];
  attackBonusAbility: FeatureAbilityId | null;
  attackBonusFormula: FeatureFormulaId | null;
  saveDcAbility: FeatureAbilityId | null;
  saveDcFormula: FeatureFormulaId | null;
}

const classFeatureRows = parseCsv<ClassFeatureRow>(classFeaturesCsv);

function splitPipeDelimited(value: string | null | undefined): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(/[\|,;]/) // support pipe, comma, and semicolon delimiters
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

function parseLevel(value: string): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid class feature level: ${value}`);
  }

  return parsed;
}

function normalizeLookupKey(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
}

function isFeatureAbilityId(value: string): value is FeatureAbilityId {
  return (
    value === "str" ||
    value === "dex" ||
    value === "con" ||
    value === "int" ||
    value === "wis" ||
    value === "cha" ||
    value === "spellcasting" ||
    value === "str_or_dex_choice"
  );
}

function isFeatureFormulaId(value: string): value is FeatureFormulaId {
  return (
    value === "pb_plus_ability_mod" ||
    value === "8_plus_pb_plus_ability_mod"
  );
}

function normalizeAbility(
  value: string | null | undefined
): FeatureAbilityId | null {
  const trimmed = (value ?? "").trim();

  if (!trimmed) {
    return null;
  }

  if (!isFeatureAbilityId(trimmed)) {
    throw new Error(`Invalid class feature ability id: ${trimmed}`);
  }

  return trimmed;
}

function normalizeFormula(
  value: string | null | undefined
): FeatureFormulaId | null {
  const trimmed = (value ?? "").trim();

  if (!trimmed) {
    return null;
  }

  if (!isFeatureFormulaId(trimmed)) {
    throw new Error(`Invalid class feature formula id: ${trimmed}`);
  }

  return trimmed;
}

function getSourceId(subclassId: string, classId: string): string {
  return subclassId === "core" ? classId : subclassId;
}

function getSourceName(subclassName: string, className: string): string {
  return subclassName === "Core" ? className : subclassName;
}

const classFeatures: ClassFeatureRecord[] = classFeatureRows.map((row) => {
  const level = parseLevel(row.level);
  const sourceId = getSourceId(row.subclass_id, row.class_id);
  const sourceName = getSourceName(row.subclass, row.class);

  const rawGranted =
    (row as any).grants_spell_id ??
    (row as any).grants_spell_ids ??
    (row as any).granted_spell_ids ??
    "";

  return {
    featureId: `${row.class_id}:${row.subclass_id}:${level}:${normalizeLookupKey(row.name)}`,
    classId: row.class_id,
    subclassId: row.subclass_id,
    className: row.class,
    subclassName: row.subclass,
    sourceType: "class",
    sourceId,
    sourceName,
    level,
    name: row.name,
    description: row.description,
    grantedSpellIds: splitPipeDelimited(rawGranted),
    attackBonusAbility: normalizeAbility(row.attack_bonus_ability),
    attackBonusFormula: normalizeFormula(row.attack_bonus_formula),
    saveDcAbility: normalizeAbility(row.save_dc_ability),
    saveDcFormula: normalizeFormula(row.save_dc_formula),
  };
});

export function getClassFeatures(): ClassFeatureRecord[] {
  return classFeatures;
}