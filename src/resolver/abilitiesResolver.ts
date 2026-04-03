import type { CharacterDraft } from "../types/draft";
import type { ResolvedCharacterSheet } from "../types/sheet";

type AbilityKey = keyof CharacterDraft["abilities"];

type AbilityValue = number | { [key: string]: unknown } | null | undefined;

const abilityKeyMap: Record<AbilityKey, keyof ResolvedCharacterSheet["abilities"]> = {
  strength: "str",
  dexterity: "dex",
  constitution: "con",
  intelligence: "int",
  wisdom: "wis",
  charisma: "cha",
};

function computeModifier(score: number | null): number | null {
  if (score === null) return null;
  return Math.floor((score - 10) / 2);
}

function readAbilityScore(value: AbilityValue): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
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

  return candidate !== null && Number.isFinite(candidate) ? candidate : null;
}

function readNumericBonus(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function getBackgroundAbilityChoiceBonus(
  draft: CharacterDraft,
  key: AbilityKey
): number {
  const selections = (draft as CharacterDraft & {
    featureSelections?: Record<string, string[] | undefined>;
  }).featureSelections;

  const chosen = selections?.background_ability_score_choice;
  if (!Array.isArray(chosen) || chosen.length === 0) {
    return 0;
  }

  const normalizedKey = key.toLowerCase();

  return chosen.reduce((total, entry) => {
    return entry?.toLowerCase() === normalizedKey ? total + 1 : total;
  }, 0);
}

function getBackgroundAbilityBonus(
  draft: CharacterDraft,
  key: AbilityKey
): number {
  const maybeDraft = draft as CharacterDraft & {
    backgroundAbilityBonuses?: Partial<Record<AbilityKey, number>>;
    abilityBonuses?: {
      background?: Partial<Record<AbilityKey, number>>;
    };
  };

  return (
    readNumericBonus(maybeDraft.backgroundAbilityBonuses?.[key]) +
    readNumericBonus(maybeDraft.abilityBonuses?.background?.[key]) +
    getBackgroundAbilityChoiceBonus(draft, key)
  );
}

export function resolveAbilities(
  draft: CharacterDraft
): ResolvedCharacterSheet["abilities"] {
  const result = {
    str: { score: null, modifier: null },
    dex: { score: null, modifier: null },
    con: { score: null, modifier: null },
    int: { score: null, modifier: null },
    wis: { score: null, modifier: null },
    cha: { score: null, modifier: null },
  };

  (Object.keys(draft.abilities) as AbilityKey[]).forEach((key) => {
    const baseScore = readAbilityScore(draft.abilities[key] as AbilityValue);
    const uncappedScore =
      baseScore === null ? null : baseScore + getBackgroundAbilityBonus(draft, key);
    const score = uncappedScore === null ? null : Math.min(uncappedScore, 20);
    const targetKey = abilityKeyMap[key];

    result[targetKey] = {
      score,
      modifier: computeModifier(score),
    };
  });

  return result;
}

export function resolveInitiative(
  abilities: ResolvedCharacterSheet["abilities"]
): number | null {
  return abilities.dex.modifier ?? null;
}

export function resolveProficiencyBonus(level: number | null): number | null {
  if (level === null) return null;
  return 2 + Math.floor((level - 1) / 4);
}