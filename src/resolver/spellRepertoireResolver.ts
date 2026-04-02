import type { CharacterDraft } from "../types/draft";
import type { JsonFeatureRecord } from "./spellSelectionResolver";

export interface SpellRepertoireResult {
  total: number;
}

function getAbilityModifier(score: number | null | undefined): number {
  if (score == null || !Number.isFinite(score)) return 0;
  return Math.floor((score - 10) / 2);
}

function getAbilityScoreFromUnknown(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return raw;
  }

  if (raw && typeof raw === "object") {
    const record = raw as Record<string, unknown>;

    const candidate =
      typeof record.score === "number"
        ? record.score
        : typeof record.value === "number"
          ? record.value
          : typeof record.total === "number"
            ? record.total
            : typeof record.base === "number"
              ? record.base
              : typeof record.final === "number"
                ? record.final
                : typeof record.finalScore === "number"
                  ? record.finalScore
                  : typeof record.current === "number"
                    ? record.current
                    : null;

    if (candidate !== null && Number.isFinite(candidate)) {
      return candidate;
    }
  }

  return null;
}

function getAbilityModifierFromUnknown(raw: unknown): number | null {
  if (raw && typeof raw === "object") {
    const record = raw as Record<string, unknown>;

    const candidate =
      typeof record.modifier === "number"
        ? record.modifier
        : typeof record.mod === "number"
          ? record.mod
          : null;

    if (candidate !== null && Number.isFinite(candidate)) {
      return candidate;
    }
  }

  return null;
}

function getAbilityScoreFromDraft(
  draft: CharacterDraft,
  ability: string
): number | null {
  const abilities = draft.abilities as Record<string, unknown> | undefined;

  if (!abilities) {
    return null;
  }

  const normalized = ability.trim().toLowerCase();
  const aliases: Record<string, string[]> = {
    str: ["str", "strength", "STR", "Strength"],
    dex: ["dex", "dexterity", "DEX", "Dexterity"],
    con: ["con", "constitution", "CON", "Constitution"],
    int: ["int", "intelligence", "INT", "Intelligence"],
    wis: ["wis", "wisdom", "WIS", "Wisdom"],
    cha: ["cha", "charisma", "CHA", "Charisma"],
  };

  const keysToTry = aliases[normalized] ?? [
    ability,
    normalized,
    ability.toUpperCase(),
  ];

  for (const key of keysToTry) {
    const score = getAbilityScoreFromUnknown(abilities[key]);
    if (score !== null) {
      return score;
    }
  }

  return null;
}

function getScalingValueAtLevel(
  scaling: Array<{ level: number; value: string }> | undefined,
  level: number | null
): number {
  if (!scaling || level == null) return 0;

  const sorted = [...scaling].sort((a, b) => a.level - b.level);
  let current: string | null = null;

  for (const row of sorted) {
    if (row.level <= level) {
      current = row.value;
    } else {
      break;
    }
  }

  if (!current) return 0;

  const parsed = Number(String(current).split("|")[0]);
  return Number.isFinite(parsed) ? parsed : 0;
}

function resolveFromScaling(
  feature: JsonFeatureRecord,
  level: number | null
): number {
  const resources = feature.resource?.resources ?? [];

  const entry = resources.find((r) => r.resource_id === "spell_repertoire");

  if (!entry) return 0;

  return getScalingValueAtLevel(entry.scaling, level);
}

function resolveFromFormula(
  feature: JsonFeatureRecord,
  draft: CharacterDraft
): number {
  const resources = feature.resource?.resources ?? [];

  const entry = resources.find((r) => r.resource_id === "spell_repertoire");

  if (!entry) return 0;

  const value = (entry as any).value;

  if (!value || typeof value !== "object") return 0;
  if (value.formula !== "ability_modifier_plus_level") return 0;

  const ability = value.ability;
  if (!ability) return 0;

  const abilities = draft.abilities as Record<string, unknown> | undefined;
  const normalized = ability.trim().toLowerCase();
  const aliases: Record<string, string[]> = {
    str: ["str", "strength", "STR", "Strength"],
    dex: ["dex", "dexterity", "DEX", "Dexterity"],
    con: ["con", "constitution", "CON", "Constitution"],
    int: ["int", "intelligence", "INT", "Intelligence"],
    wis: ["wis", "wisdom", "WIS", "Wisdom"],
    cha: ["cha", "charisma", "CHA", "Charisma"],
  };
  const keysToTry = aliases[normalized] ?? [
    ability,
    normalized,
    ability.toUpperCase(),
  ];

  let mod: number | null = null;

  if (abilities) {
    for (const key of keysToTry) {
      const directModifier = getAbilityModifierFromUnknown(abilities[key]);
      if (directModifier !== null) {
        mod = directModifier;
        break;
      }
    }
  }

  if (mod === null) {
    const abilityScore = getAbilityScoreFromDraft(draft, ability);
    mod = getAbilityModifier(abilityScore);
  }

  return Math.max(1, (draft.level ?? 0) + mod);
}

export function resolveSpellRepertoire(args: {
  draft: CharacterDraft;
  featureRecords: Array<{ feature: JsonFeatureRecord }>;
}): SpellRepertoireResult {
  const { draft, featureRecords } = args;

  if (draft.level == null) {
    return { total: 0 };
  }

  for (const { feature } of featureRecords) {
    const scalingValue = resolveFromScaling(feature, draft.level);
    if (scalingValue > 0) {
      return { total: scalingValue };
    }

    const formulaValue = resolveFromFormula(feature, draft);
    if (formulaValue > 0) {
      return { total: formulaValue };
    }
  }

  return { total: 0 };
}