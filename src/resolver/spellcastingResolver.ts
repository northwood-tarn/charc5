import spellProgressionCsv from "../data/csv/spellProgression.csv?raw";
import { parseCsv } from "../data/loaders/csvParser";
import type { CharacterDraft } from "../types/draft";
import type { ResolvedCharacterSheet } from "../types/sheet";
import { getClassSpellcastingAbility } from "./classDcAndAttackResolver";
import {
  resolveStructuredKnownSpells,
  resolveStructuredPreparedSpells,
} from "./spellListResolver";

interface SpellProgressionRow {
  class: string;
  class_id: string;
  subclass: string;
  subclass_id: string;
  level: string;
  max_spell_level: string;
  slot_1: string;
  slot_2: string;
  slot_3: string;
  slot_4: string;
  slot_5: string;
  slot_6: string;
  slot_7: string;
  slot_8: string;
  slot_9: string;
  pact_slot_level: string;
  pact_slots: string;
}

const spellProgressionRows = parseCsv<SpellProgressionRow>(spellProgressionCsv);

function parseNullableNumber(value: string | null | undefined): number | null {
  const trimmed = (value ?? "").trim();

  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function getSpellProgressionRow(
  draft: CharacterDraft
): SpellProgressionRow | null {
  if (!draft.classId || draft.level === null) {
    return null;
  }

  const exactSubclassRow = spellProgressionRows.find((row) => {
    const rowLevel = parseNullableNumber(row.level);

    return (
      row.class_id === draft.classId &&
      row.subclass_id === (draft.subclassId ?? "") &&
      rowLevel === draft.level
    );
  });

  if (exactSubclassRow) {
    return exactSubclassRow;
  }

  const exactGenericRow = spellProgressionRows.find((row) => {
    const rowLevel = parseNullableNumber(row.level);

    return (
      row.class_id === draft.classId &&
      !row.subclass_id &&
      rowLevel === draft.level
    );
  });

  return exactGenericRow ?? null;
}

export function resolveSpellSlotsByLevel(
  draft: CharacterDraft
): ResolvedCharacterSheet["spellcasting"]["spellSlotsByLevel"] {
  const row = getSpellProgressionRow(draft);

  if (!row) {
    return [];
  }

  const sourceLabel = row.subclass_id ? row.subclass : row.class;

  const slotEntries = [
    { spellLevel: 1, slotsTotal: parseNullableNumber(row.slot_1) },
    { spellLevel: 2, slotsTotal: parseNullableNumber(row.slot_2) },
    { spellLevel: 3, slotsTotal: parseNullableNumber(row.slot_3) },
    { spellLevel: 4, slotsTotal: parseNullableNumber(row.slot_4) },
    { spellLevel: 5, slotsTotal: parseNullableNumber(row.slot_5) },
    { spellLevel: 6, slotsTotal: parseNullableNumber(row.slot_6) },
    { spellLevel: 7, slotsTotal: parseNullableNumber(row.slot_7) },
    { spellLevel: 8, slotsTotal: parseNullableNumber(row.slot_8) },
    { spellLevel: 9, slotsTotal: parseNullableNumber(row.slot_9) },
  ]
    .filter((entry) => entry.slotsTotal !== null && entry.slotsTotal > 0)
    .map((entry) => ({
      spellLevel: entry.spellLevel,
      slotsTotal: entry.slotsTotal,
      source: `${sourceLabel} spell progression`,
    }));

  const pactSlotLevel = parseNullableNumber(row.pact_slot_level);
  const pactSlots = parseNullableNumber(row.pact_slots);

  const pactEntries =
    pactSlotLevel !== null && pactSlots !== null && pactSlots > 0
      ? [
          {
            spellLevel: pactSlotLevel,
            slotsTotal: pactSlots,
            source: `${sourceLabel} pact magic`,
          },
        ]
      : [];

  return [...slotEntries, ...pactEntries].sort(
    (a, b) => a.spellLevel - b.spellLevel
  );
}

export function resolvePreparedSpellLimit(
  draft: CharacterDraft,
  abilities: ResolvedCharacterSheet["abilities"]
): number | null {
  if (!draft.classId || draft.level === null) {
    return null;
  }

  const preparedCasterClassIds = new Set([
    "cleric",
    "druid",
    "paladin",
    "wizard",
  ]);

  if (!preparedCasterClassIds.has(draft.classId)) {
    return null;
  }

  const spellcastingAbility = getClassSpellcastingAbility(draft.classId);
  const abilityModifier =
    spellcastingAbility === null
      ? null
      : abilities[spellcastingAbility]?.modifier ?? null;

  if (abilityModifier === null) {
    return null;
  }

  return Math.max(1, draft.level + abilityModifier);
}

export function resolveSpellcastingSummary(args: {
  draft: CharacterDraft;
  abilities: ResolvedCharacterSheet["abilities"];
  classDcAndAttack: ResolvedCharacterSheet["classDcAndAttack"];
  className: string;
  subclassName: string;
  applicableClassFeatures: Array<{
    classId: string;
    subclassId: string;
    name: string;
    grantedSpellIds: string[];
  }>;
}): ResolvedCharacterSheet["spellcasting"] {
  const {
    draft,
    abilities,
    classDcAndAttack,
    className,
    subclassName,
    applicableClassFeatures,
  } = args;

  const spellcastingAbility = getClassSpellcastingAbility(draft.classId);

  const spellAttackEntry = classDcAndAttack.attackBonuses.find(
    (entry) =>
      entry.attackType === "spellcasting" &&
      entry.ability === spellcastingAbility
  );

  const spellSaveDcEntry = classDcAndAttack.saveDcs.find(
    (entry) =>
      entry.dcType === "spellcasting" &&
      entry.ability === spellcastingAbility
  );

  const csvFeatureSpellSources = applicableClassFeatures.map((feature) => ({
    sourceType: "feature" as const,
    sourceId: feature.subclassId === "core" ? feature.classId : feature.subclassId,
    sourceName: feature.name,
    grantedSpellIds: feature.grantedSpellIds,
    isAlwaysPrepared: true,
    countsAgainstLimit: false,
  }));

  return {
    spellcastingAbility,
    spellSaveDc: spellSaveDcEntry?.value ?? null,
    spellAttackBonus: spellAttackEntry?.value ?? null,
    preparedSpellLimit: resolvePreparedSpellLimit(draft, abilities),
    spellSlotsByLevel: resolveSpellSlotsByLevel(draft),
    knownSpells: resolveStructuredKnownSpells(draft, className, subclassName),
    preparedSpells: resolveStructuredPreparedSpells({
      draft,
      className,
      subclassName,
      csvFeatureSpellSources,
    }),
  };
}