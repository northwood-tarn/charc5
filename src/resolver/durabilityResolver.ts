import classesCsv from "../data/csv/classes.csv?raw";
import { parseCsv } from "../data/loaders/csvParser";
import type { CharacterDraft } from "../types/draft";
import type { ResolvedCharacterSheet, DerivedValue } from "../types/sheet";

interface ClassDataRow {
  id: string;
  name: string;
  hit_die: string;
}

const classDataRows = parseCsv<ClassDataRow>(classesCsv);

function findClassDataRow(classId: string | null): ClassDataRow | undefined {
  return classDataRows.find((row) => row.id === classId);
}

function parseHitDieValue(value: string | null | undefined): number | null {
  const trimmed = (value ?? "").trim();

  if (!trimmed) {
    return null;
  }

  const match = trimmed.match(/d(\d+)$/i) ?? trimmed.match(/^(\d+)$/);
  if (!match) {
    return null;
  }

  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function getAverageHitDieGain(hitDieValue: number): number {
  return Math.floor(hitDieValue / 2) + 1;
}

export function resolveHitDice(
  draft: CharacterDraft
): ResolvedCharacterSheet["durability"]["hitDice"] {
  const classDataRow = findClassDataRow(draft.classId);
  const hitDieValue = parseHitDieValue(classDataRow?.hit_die);

  return {
    die: hitDieValue === null ? "" : `d${hitDieValue}`,
    total: draft.level,
    derivation:
      draft.level === null || hitDieValue === null
        ? []
        : [
            {
              label: "Hit die type",
              value: hitDieValue,
              source: "class hit die",
            },
            {
              label: "Hit dice total",
              value: draft.level,
              source: "character level",
            },
          ],
  };
}

export function resolveMaxHp(
  draft: CharacterDraft,
  abilities: ResolvedCharacterSheet["abilities"]
): DerivedValue {
  const classDataRow = findClassDataRow(draft.classId);
  const hitDieValue = parseHitDieValue(classDataRow?.hit_die);
  const level = draft.level;
  const conModifier = abilities.con?.modifier ?? null;

  if (
    hitDieValue === null ||
    level === null ||
    level < 1 ||
    conModifier === null
  ) {
    return {
      value: null,
      derivation: [],
    };
  }

  const firstLevelHp = hitDieValue + conModifier;
  const additionalLevels = level - 1;
  const averagePerLevel = getAverageHitDieGain(hitDieValue) + conModifier;
  const additionalHp = additionalLevels * averagePerLevel;

  return {
    value: firstLevelHp + additionalHp,
    derivation: [
      {
        label: "Level 1 hit points",
        value: firstLevelHp,
        source: `full d${hitDieValue} + Constitution modifier`,
      },
      {
        label: "Additional level hit points",
        value: additionalHp,
        source: `${additionalLevels} × (average d${hitDieValue} + Constitution modifier)`,
      },
    ],
  };
}

export function resolveDurabilityOutputs(
  draft: CharacterDraft,
  abilities: ResolvedCharacterSheet["abilities"]
): ResolvedCharacterSheet["durability"] {
  return {
    hitDice: resolveHitDice(draft),
    hpMax: resolveMaxHp(draft, abilities),
    defenses: {
      resistances: [],
      immunities: [],
      conditionImmunities: [],
    },
  };
}