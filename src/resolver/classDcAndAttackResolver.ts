import type { CharacterDraft } from "../types/draft";
import type { ResolvedCharacterSheet, DerivedValue } from "../types/sheet";
import classesCsv from "../data/csv/classes.csv?raw";
import { parseCsv } from "../data/loaders/csvParser";
import {
  getClassFeatures,
  type ClassFeatureRecord as LoadedClassFeatureRecord,
  type FeatureAbilityId,
  type FeatureFormulaId,
} from "../data/loaders/classFeaturesLoader";

interface ClassDataRow {
  id: string;
  name: string;
  hit_die: string;
  save_profs: string;
  default_skills: string;
  spellcasting_ability: string;
}

type AbilityId = keyof ResolvedCharacterSheet["abilities"];

const classDataRows = parseCsv<ClassDataRow>(classesCsv);
const loadedClassFeatures = getClassFeatures();

function normalizeLookupKey(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
}

function splitDelimitedValues(value: string | null | undefined): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(/[|,]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function toAbilityId(value: string): AbilityId | null {
  const normalized = normalizeLookupKey(value);

  switch (normalized) {
    case "str":
    case "strength":
      return "str";
    case "dex":
    case "dexterity":
      return "dex";
    case "con":
    case "constitution":
      return "con";
    case "int":
    case "intelligence":
      return "int";
    case "wis":
    case "wisdom":
      return "wis";
    case "cha":
    case "charisma":
      return "cha";
    default:
      return null;
  }
}

function findClassDataRow(classId: string | null): ClassDataRow | undefined {
  return classDataRows.find((row) => row.id === classId);
}

export function getClassSpellcastingAbility(classId: string | null): AbilityId | null {
  const classRecord = findClassDataRow(classId);
  return toAbilityId(classRecord?.spellcasting_ability ?? "");
}

function getApplicableClassFeatures(
  draft: CharacterDraft
): LoadedClassFeatureRecord[] {
  if (!draft.classId || draft.level === null) {
    return [];
  }

  return loadedClassFeatures.filter((feature) => {
    if (feature.classId !== draft.classId) {
      return false;
    }

    if (feature.level > draft.level) {
      return false;
    }

    return (
      feature.subclassId === "core" ||
      feature.subclassId === draft.subclassId
    );
  });
}

function resolveFeatureAbility(
  abilityId: FeatureAbilityId | null,
  draft: CharacterDraft,
  abilities: ResolvedCharacterSheet["abilities"]
): AbilityId | null {
  if (abilityId === null) {
    return null;
  }

  if (abilityId === "spellcasting") {
    return getClassSpellcastingAbility(draft.classId);
  }

  if (abilityId === "str_or_dex_choice") {
    const selection = draft.featureSelections["str_or_dex_choice"]?.[0];

    if (selection === "str" || selection === "dex") {
      return selection;
    }

    const strModifier = abilities.str?.modifier ?? null;
    const dexModifier = abilities.dex?.modifier ?? null;

    if (strModifier === null && dexModifier === null) {
      return null;
    }

    if (strModifier === null) {
      return "dex";
    }

    if (dexModifier === null) {
      return "str";
    }

    return strModifier >= dexModifier ? "str" : "dex";
  }

  return abilityId;
}

function resolveFeatureFormulaValue(
  formulaId: FeatureFormulaId | null,
  abilityModifier: number | null,
  proficiencyBonus: number | null
): number | null {
  if (
    formulaId === null ||
    abilityModifier === null ||
    proficiencyBonus === null
  ) {
    return null;
  }

  if (formulaId === "pb_plus_ability_mod") {
    return proficiencyBonus + abilityModifier;
  }

  if (formulaId === "8_plus_pb_plus_ability_mod") {
    return 8 + proficiencyBonus + abilityModifier;
  }

  return null;
}

function createAttackDerivation(
  ability: AbilityId,
  abilityModifier: number,
  proficiencyBonus: number
): DerivedValue["derivation"] {
  return [
    {
      label: "Ability modifier",
      value: abilityModifier,
      source: ability,
    },
    {
      label: "Proficiency bonus",
      value: proficiencyBonus,
      source: "character level",
    },
  ];
}

function createSaveDcDerivation(
  ability: AbilityId,
  abilityModifier: number,
  proficiencyBonus: number
): DerivedValue["derivation"] {
  return [
    {
      label: "Base save DC",
      value: 8,
      source: "save DC formula",
    },
    {
      label: "Ability modifier",
      value: abilityModifier,
      source: ability,
    },
    {
      label: "Proficiency bonus",
      value: proficiencyBonus,
      source: "character level",
    },
  ];
}

function getFeatureEntryKind(
  feature: LoadedClassFeatureRecord
): "spellcasting" | "focus" | "maneuver" | "psionic" | "feature" {
  if (feature.name === "Spellcasting") {
    return "spellcasting";
  }

  if (feature.name === "Monk’s Focus") {
    return "focus";
  }

  if (feature.name === "Combat Superiority") {
    return "maneuver";
  }

  if (feature.name === "Psionic Power") {
    return "psionic";
  }

  return "feature";
}

function getFeatureEntrySourceId(feature: LoadedClassFeatureRecord): string {
  const kind = getFeatureEntryKind(feature);

  if (kind === "spellcasting") {
    return feature.subclassId === "core" ? feature.classId : feature.subclassId;
  }

  return `${feature.subclassId === "core" ? feature.classId : feature.subclassId}:${normalizeLookupKey(feature.name)}`;
}

function getFeatureEntrySourceName(feature: LoadedClassFeatureRecord): string {
  return feature.name;
}

function getAttackTypeForFeature(feature: LoadedClassFeatureRecord): string {
  const kind = getFeatureEntryKind(feature);

  switch (kind) {
    case "spellcasting":
      return "spellcasting";
    case "focus":
      return "focus";
    case "maneuver":
      return "maneuver";
    case "psionic":
      return "psionic";
    default:
      return "feature";
  }
}

function getDcTypeForFeature(feature: LoadedClassFeatureRecord): string {
  const kind = getFeatureEntryKind(feature);

  switch (kind) {
    case "spellcasting":
      return "spellcasting";
    case "focus":
      return "focus";
    case "maneuver":
      return "maneuver";
    case "psionic":
      return "psionic";
    default:
      return "feature";
  }
}

export function resolveClassDcAndAttack(
  draft: CharacterDraft,
  abilities: ResolvedCharacterSheet["abilities"],
  proficiencyBonus: number | null
): ResolvedCharacterSheet["classDcAndAttack"] {
  if (proficiencyBonus === null) {
    return {
      attackBonuses: [],
      saveDcs: [],
    };
  }

  const applicableFeatures = getApplicableClassFeatures(draft);

  const attackBonuses = applicableFeatures.flatMap((feature) => {
    const resolvedAbility = resolveFeatureAbility(
      feature.attackBonusAbility,
      draft,
      abilities
    );
    const abilityModifier =
      resolvedAbility === null ? null : abilities[resolvedAbility]?.modifier ?? null;
    const value = resolveFeatureFormulaValue(
      feature.attackBonusFormula,
      abilityModifier,
      proficiencyBonus
    );

    if (
      feature.attackBonusFormula === null ||
      resolvedAbility === null ||
      abilityModifier === null ||
      value === null
    ) {
      return [];
    }

    return [
      {
        sourceId: getFeatureEntrySourceId(feature),
        sourceName: getFeatureEntrySourceName(feature),
        attackType: getAttackTypeForFeature(feature),
        ability: resolvedAbility,
        value,
        derivation: createAttackDerivation(
          resolvedAbility,
          abilityModifier,
          proficiencyBonus
        ),
      },
    ];
  });

  const saveDcs = applicableFeatures.flatMap((feature) => {
    const resolvedAbility = resolveFeatureAbility(
      feature.saveDcAbility,
      draft,
      abilities
    );
    const abilityModifier =
      resolvedAbility === null ? null : abilities[resolvedAbility]?.modifier ?? null;
    const value = resolveFeatureFormulaValue(
      feature.saveDcFormula,
      abilityModifier,
      proficiencyBonus
    );

    if (
      feature.saveDcFormula === null ||
      resolvedAbility === null ||
      abilityModifier === null ||
      value === null
    ) {
      return [];
    }

    return [
      {
        sourceId: getFeatureEntrySourceId(feature),
        sourceName: getFeatureEntrySourceName(feature),
        dcType: getDcTypeForFeature(feature),
        ability: resolvedAbility,
        value,
        derivation: createSaveDcDerivation(
          resolvedAbility,
          abilityModifier,
          proficiencyBonus
        ),
      },
    ];
  });

  return {
    attackBonuses,
    saveDcs,
  };
}