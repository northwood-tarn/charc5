import classesCsv from "../data/csv/classes.csv?raw";
import skillsCsv from "../data/csv/skills.csv?raw";
import { parseCsv } from "../data/loaders/csvParser";
import type { CharacterDraft } from "../types/draft";
import type { ResolvedCharacterSheet } from "../types/sheet";

interface ClassDataRow {
  id: string;
  name: string;
  hit_die: string;
  save_profs: string;
  default_skills: string;
  spellcasting_ability: string;
}

interface SkillRow {
  skill_id: string;
  skill_name: string;
  ability_id: string;
  ability_name: string;
}

type AbilityId = keyof ResolvedCharacterSheet["savingThrows"];

const classDataRows = parseCsv<ClassDataRow>(classesCsv);
const skillRows = parseCsv<SkillRow>(skillsCsv);

function splitDelimitedValues(value: string | null | undefined): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(/[|,]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizeLookupKey(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
}

function findClassDataRow(classId: string | null): ClassDataRow | undefined {
  return classDataRows.find((row) => row.id === classId);
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

function toSkillId(value: string): string | null {
  const normalized = normalizeLookupKey(value);
  const directMatch = skillRows.find((row) => row.skill_id === normalized);

  if (directMatch) {
    return directMatch.skill_id;
  }

  const nameMatch = skillRows.find(
    (row) => normalizeLookupKey(row.skill_name) === normalized
  );

  return nameMatch?.skill_id ?? null;
}

export function getClassSavingThrowProficiencies(
  classId: string | null
): AbilityId[] {
  const classRecord = findClassDataRow(classId);

  return splitDelimitedValues(classRecord?.save_profs).flatMap((value) => {
    const abilityId = toAbilityId(value);
    return abilityId ? [abilityId] : [];
  });
}

export function getClassDefaultSkillIds(classId: string | null): string[] {
  const classRecord = findClassDataRow(classId);

  return splitDelimitedValues(classRecord?.default_skills).flatMap((value) => {
    const skillId = toSkillId(value);
    return skillId ? [skillId] : [];
  });
}

function mergeUniqueStrings(existing: string[], incoming: string[]): string[] {
  return Array.from(new Set([...existing, ...incoming]));
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string");
}

function getDraftSkillIds(draft: CharacterDraft): string[] {
  const maybeDraft = draft as CharacterDraft & {
    skillProficiencies?: string[];
  };

  return asStringArray(maybeDraft.skillProficiencies).flatMap((value) => {
    const skillId = toSkillId(value);
    return skillId ? [skillId] : [];
  });
}

function getDraftToolProficiencies(draft: CharacterDraft): string[] {
  const maybeDraft = draft as CharacterDraft & {
    toolProficiencies?: string[];
  };

  return asStringArray(maybeDraft.toolProficiencies).map((value) => value.trim()).filter(Boolean);
}

export function applyDraftProficienciesToSheet(
  sheet: ResolvedCharacterSheet,
  draft: CharacterDraft
): void {
  sheet.proficiencies.skills = mergeUniqueStrings(
    sheet.proficiencies.skills,
    getDraftSkillIds(draft)
  );

  sheet.proficiencies.tools = mergeUniqueStrings(
    sheet.proficiencies.tools,
    getDraftToolProficiencies(draft)
  );
}

export function applyDerivedEffectsToProficiencies(
  sheet: ResolvedCharacterSheet
): void {
  for (const feature of sheet.features) {
    const featureDerivedValues = feature.derivedEffects?.values ?? {};

    sheet.proficiencies.armor = mergeUniqueStrings(
      sheet.proficiencies.armor,
      asStringArray(featureDerivedValues["armor_proficiencies"])
    );

    sheet.proficiencies.weapons = mergeUniqueStrings(
      sheet.proficiencies.weapons,
      asStringArray(featureDerivedValues["weapon_proficiencies"])
    );

    sheet.proficiencies.tools = mergeUniqueStrings(
      sheet.proficiencies.tools,
      asStringArray(featureDerivedValues["tool_proficiencies"])
    );

    sheet.proficiencies.skills = mergeUniqueStrings(
      sheet.proficiencies.skills,
      asStringArray(featureDerivedValues["skill_proficiencies"])
    );

    for (const option of feature.selectedOptions ?? []) {
      const optionDerivedEffects = option.derivedEffects?.values ?? {};

      sheet.proficiencies.armor = mergeUniqueStrings(
        sheet.proficiencies.armor,
        asStringArray(optionDerivedEffects["armor_proficiencies"])
      );

      sheet.proficiencies.weapons = mergeUniqueStrings(
        sheet.proficiencies.weapons,
        asStringArray(optionDerivedEffects["weapon_proficiencies"])
      );

      sheet.proficiencies.tools = mergeUniqueStrings(
        sheet.proficiencies.tools,
        asStringArray(optionDerivedEffects["tool_proficiencies"])
      );

      sheet.proficiencies.skills = mergeUniqueStrings(
        sheet.proficiencies.skills,
        asStringArray(optionDerivedEffects["skill_proficiencies"])
      );
    }
  }
}

export function resolveSavingThrows(
  draft: CharacterDraft,
  abilities: ResolvedCharacterSheet["abilities"],
  proficiencyBonus: number | null
): ResolvedCharacterSheet["savingThrows"] {
  const proficientSaves = new Set(getClassSavingThrowProficiencies(draft.classId));
  const abilityIds: AbilityId[] = ["str", "dex", "con", "int", "wis", "cha"];

  return Object.fromEntries(
    abilityIds.map((ability) => {
      const abilityModifier = abilities[ability]?.modifier ?? null;
      const isProficient = proficientSaves.has(ability);
      const proficiencyModifier =
        isProficient && proficiencyBonus !== null ? proficiencyBonus : 0;

      return [
        ability,
        {
          ability,
          proficiency: isProficient ? "proficient" : "none",
          totalModifier:
            abilityModifier === null
              ? null
              : abilityModifier + proficiencyModifier,
          derivation:
            abilityModifier === null
              ? []
              : [
                  {
                    label: "Ability modifier",
                    value: abilityModifier,
                    source: `${ability}`,
                  },
                  ...(isProficient && proficiencyBonus !== null
                    ? [
                        {
                          label: "Proficiency bonus",
                          value: proficiencyBonus,
                          source: "proficiency bonus from character level",
                        },
                      ]
                    : []),
                ],
        },
      ];
    })
  ) as ResolvedCharacterSheet["savingThrows"];
}

export function resolveSkills(
  draft: CharacterDraft,
  abilities: ResolvedCharacterSheet["abilities"],
  proficiencies: ResolvedCharacterSheet["proficiencies"],
  proficiencyBonus: number | null
): ResolvedCharacterSheet["skills"] {
  const classDefaultSkillIds = getClassDefaultSkillIds(draft.classId);
  const draftSkillIds = getDraftSkillIds(draft);
  const proficientSkills = new Set([
    ...proficiencies.skills,
    ...classDefaultSkillIds,
    ...draftSkillIds,
  ]);

  return Object.fromEntries(
    skillRows.map((skill) => {
      const skillId = skill.skill_id;
      const abilityId = toAbilityId(skill.ability_id) ?? "int";
      const abilityModifier = abilities[abilityId]?.modifier ?? null;
      const isProficient = proficientSkills.has(skillId);
      const proficiencyModifier =
        isProficient && proficiencyBonus !== null ? proficiencyBonus : 0;

      return [
        skillId,
        {
          skill: skillId,
          ability: abilityId,
          proficiency: isProficient ? "proficient" : "none",
          totalModifier:
            abilityModifier === null
              ? null
              : abilityModifier + proficiencyModifier,
          derivation:
            abilityModifier === null
              ? []
              : [
                  {
                    label: "Ability modifier",
                    value: abilityModifier,
                    source: abilityId,
                  },
                  ...(isProficient && proficiencyBonus !== null
                    ? [
                        {
                          label: "Proficiency bonus",
                          value: proficiencyBonus,
                          source: "proficiency bonus from character level",
                        },
                      ]
                    : []),
                ],
        },
      ];
    })
  ) as ResolvedCharacterSheet["skills"];
}