import { getFeats } from "../data/loaders/featsLoader";
import { getClassById } from "../data/loaders/classLoader";
import skillsCsv from "../data/csv/skills.csv?raw";
import toolsCsv from "../data/csv/tools.csv?raw";
import weaponsCsv from "../data/csv/weapons.csv?raw";
import spellsCsv from "../data/csv/spells.csv?raw";
import type { CharacterDraft, ResolvedCharacterSheet } from "../engine/types";
import { resolveFeatSlots, type FeatSlot } from "./featSlotResolver";
import { parseCsv } from "../data/loaders/csvParser";
import {
  resolveChoiceOptionsFromPool,
  type SkillRow,
  type ToolRow,
  type WeaponRow,
} from "../data/loaders/choiceOptionLoader";

import type {
  ChoiceCountValue,
  NormalizedChoiceBlock,
  NormalizedFeat,
  NormalizedSpellGrant,
} from "../engine/contracts/dataContracts";


type ChoiceOption = {
  id: string;
  label: string;
};

type SpellRow = {
  spell_id?: string;
  id?: string;
  spell_name?: string;
  name?: string;
  level?: string | number;
  school?: string;
  School?: string;
  ritual?: string;
};

type FeatChoiceConfig = NormalizedChoiceBlock & {
  per_choice_max?: number;
  allow_same_choice_twice?: boolean;
  score_cap?: number;
  upgrade_if_proficient?: boolean;
  require_proficiency?: true;
  reassignable_after_long_rest?: boolean;
};

type SpellGrantConfig = NormalizedSpellGrant & {
  ritual_only?: boolean;
};

type SavingThrowChoiceConfig = FeatChoiceConfig & {
  excludeExistingProficiencies?: boolean;
  exclude_existing_proficiencies?: boolean;
};

type ResolvedFeatureOutput = ResolvedCharacterSheet["features"][number];
type FeatSelectionEntry = {
  slotId: string;
  featId: string;
  levelGained: number;
};


type DraftWithOptionalFeats = CharacterDraft & {
  featIds?: string[];
  selectedFeatIds?: string[];
  feats?: Array<string | { featId?: string; feat_id?: string; id?: string }>;
  featSelections?: Record<string, string | null | undefined>;
};

type DraftWithFeatureSelections = CharacterDraft & {
  featureSelections?: Record<string, string[] | undefined>;
};



const featDefinitions = getFeats() as NormalizedFeat[];
function getFeatId(feat: NormalizedFeat): string {
  return feat.id;
}

function getFeatNotes(feat: NormalizedFeat): string {
  return feat.notes ?? "";
}

function getFeatEffects(feat: NormalizedFeat): Record<string, unknown> {
  return (feat.effects ?? {}) as Record<string, unknown>;
}

function getEffectChoiceConfig(
  effects: Record<string, unknown>,
  camelKey: string,
  snakeKey: string
): FeatChoiceConfig | undefined {
  return (effects[camelKey] ?? effects[snakeKey]) as FeatChoiceConfig | undefined;
}

function getEffectSpellGrants(effects: Record<string, unknown>): SpellGrantConfig[] {
  return ((effects.spellGrants ?? effects.spell_grants) as SpellGrantConfig[] | undefined) ?? [];
}


const skillRows = parseCsv<SkillRow>(skillsCsv);
const toolRows = parseCsv<ToolRow>(toolsCsv);
const weaponRows = parseCsv<WeaponRow>(weaponsCsv);
const spellRows = parseCsv<SpellRow>(spellsCsv);
const knownSkillIds = new Set(skillRows.map((row) => row.skill_id).filter((value): value is string => typeof value === "string" && value.length > 0));

function getProficiencyBonus(level: number): number {
  if (level >= 17) return 6;
  if (level >= 13) return 5;
  if (level >= 9) return 4;
  if (level >= 5) return 3;
  return 2;
}

function resolveCountValue(value: ChoiceCountValue | undefined, level: number): number | null {
  if (typeof value === "number") {
    return value;
  }

  if (value === "PB") {
    return getProficiencyBonus(level);
  }

  return null;
}

function titleCaseAbility(ability: string): string {
  const upper = ability.toUpperCase();
  const map: Record<string, string> = {
    STR: "Strength",
    DEX: "Dexterity",
    CON: "Constitution",
    INT: "Intelligence",
    WIS: "Wisdom",
    CHA: "Charisma",
  };

  return map[upper] ?? upper;
}

function toChoiceOptions(options: string[] | undefined): Array<{ id: string; label: string }> {
  if (!options || options.length === 0) {
    return [];
  }

  return options.map((option) => ({
    id: option,
    label: titleCaseAbility(option),
  }));
}

function getToolPoolOptions(pool: string): ChoiceOption[] {
  if (pool === "tools") {
    return toolRows.map((tool) => ({
      id: tool.tool_id,
      label: tool.tool_name,
    }));
  }

  if (pool === "musical_instruments") {
    return toolRows
      .filter((tool) => tool.tool_type === "instrument")
      .map((tool) => ({
        id: tool.tool_id,
        label: tool.tool_name,
      }));
  }

  return [];
}

function resolveChoiceOptionsForPools(config: FeatChoiceConfig | undefined): ChoiceOption[] {
  if (!config) {
    return [];
  }

  const rawPools = config.pools ?? (config.pool ? [config.pool] : []);
  const seen = new Set<string>();
  const results: ChoiceOption[] = [];

  for (const pool of rawPools) {
    const normalizedPool = pool === "weapons" ? "simple_or_martial_weapon_kinds" : pool;

    const resolved =
      pool === "tools" || pool === "musical_instruments"
        ? getToolPoolOptions(pool)
        : resolveChoiceOptionsFromPool(normalizedPool, {
            weapons: weaponRows,
            skills: skillRows,
            tools: toolRows,
          }).map((option) => ({
            id: option.id,
            label: option.label,
          }));

    for (const option of resolved) {
      if (seen.has(option.id)) {
        continue;
      }
      seen.add(option.id);
      results.push(option);
    }
  }

  return results;
}

function normalizeSpellLevel(value: string | number | undefined): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function isTruthyFlag(value: string | undefined): boolean {
  const normalized = (value ?? "").trim().toLowerCase();
  return normalized === "true" || normalized === "yes" || normalized === "1" || normalized === "ritual";
}

function normalizeSchoolName(value: string | undefined): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[-_\s]+/g, " ");
}

function getSpellChoiceOptions(grant: SpellGrantConfig): ChoiceOption[] {
  const seen = new Set<string>();
  const targetLevel = grant.level ?? null;
  const normalizedSchools = (grant.schools ?? []).map((school) => normalizeSchoolName(school));

  return spellRows
    .filter((spell) => {
      const spellId = spell.spell_id ?? spell.id ?? "";
      const spellName = spell.spell_name ?? spell.name ?? "";
      if (!spellId || !spellName) {
        return false;
      }

      const level = normalizeSpellLevel(spell.level);
      if (targetLevel !== null && level !== targetLevel) {
        return false;
      }

      if (normalizedSchools.length > 0) {
        const school = normalizeSchoolName(spell.school ?? spell.School);
        if (!normalizedSchools.includes(school)) {
          return false;
        }
      }

      if ((grant.ritualOnly ?? grant.ritual_only) && !isTruthyFlag(spell.ritual)) {
        return false;
      }

      return true;
    })
    .sort((a, b) => {
      const aName = a.spell_name ?? a.name ?? "";
      const bName = b.spell_name ?? b.name ?? "";
      return aName.localeCompare(bName);
    })
    .flatMap((spell) => {
      const id = spell.spell_id ?? spell.id ?? "";
      const label = spell.spell_name ?? spell.name ?? "";
      if (!id || !label || seen.has(id)) {
        return [];
      }
      seen.add(id);
      return [{ id, label }];
    });
}

function normalizePoolNames(config: FeatChoiceConfig | undefined): string[] | null {
  if (!config) {
    return null;
  }

  const rawPools = config.pools ?? (config.pool ? [config.pool] : []);

  if (rawPools.length === 0) {
    return null;
  }

  return rawPools.map((pool) => {
    if (pool === "weapons") {
      return "simple_or_martial_weapon_kinds";
    }

    return pool;
  });
}

function normalizeAbilityChoiceId(value: string | undefined): string {
  const normalized = (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/saving throws?/g, "")
    .replace(/saves?/g, "")
    .replace(/[-_\s]+/g, "")
    .trim();

  const map: Record<string, string> = {
    strength: "str",
    dexterity: "dex",
    constitution: "con",
    intelligence: "int",
    wisdom: "wis",
    charisma: "cha",
    str: "str",
    dex: "dex",
    con: "con",
    int: "int",
    wis: "wis",
    cha: "cha",
  };

  return map[normalized] ?? normalized;
}

function getAbilityChoiceOptions(options: string[] | undefined): ChoiceOption[] {
  return toChoiceOptions(options).map((option) => ({
    id: option.id,
    label: option.label,
  }));
}

function getExistingSavingThrowProficiencies(draft: CharacterDraft): Set<string> {
  const classRecord = getClassById(draft.classId);
  const savingThrows = classRecord?.savingThrowProficiencies ?? [];
  return new Set(
    savingThrows
      .map((entry) => normalizeAbilityChoiceId(entry))
      .filter((entry) => entry.length > 0)
  );
}

function filterSavingThrowChoiceOptions(
  draft: CharacterDraft,
  config: SavingThrowChoiceConfig
): ChoiceOption[] {
  const baseOptions = getAbilityChoiceOptions(config.options);

  const excludeExisting =
    config.excludeExistingProficiencies !== false &&
    config.exclude_existing_proficiencies !== false;

  if (!excludeExisting) {
    return baseOptions;
  }

  const existing = getExistingSavingThrowProficiencies(draft);
  return baseOptions.filter((option) => {
    const normalized = normalizeAbilityChoiceId(option.id);
    return normalized.length > 0 && !existing.has(normalized);
  });
}

function getExistingSkillProficiencies(draft: CharacterDraft): Set<string> {
  const selectedSkillIds = new Set<string>();

  const addSkill = (value: unknown) => {
    if (typeof value !== "string") {
      return;
    }

    const normalized = value.trim().toLowerCase();
    if (!normalized || !knownSkillIds.has(normalized)) {
      return;
    }

    selectedSkillIds.add(normalized);
  };

  const addFromArray = (value: unknown) => {
    if (!Array.isArray(value)) {
      return;
    }

    value.forEach((entry) => addSkill(entry));
  };

  const typedDraft = draft as CharacterDraft & {
    skillProficiencies?: string[];
    proficientSkills?: string[];
    selectedSkillIds?: string[];
    classSkillProficiencies?: string[];
    backgroundSkillProficiencies?: string[];
    speciesSkillProficiencies?: string[];
    skillSelections?: string[];
  };

  addFromArray(typedDraft.skillProficiencies);
  addFromArray(typedDraft.proficientSkills);
  addFromArray(typedDraft.selectedSkillIds);
  addFromArray(typedDraft.classSkillProficiencies);
  addFromArray(typedDraft.backgroundSkillProficiencies);
  addFromArray(typedDraft.speciesSkillProficiencies);
  addFromArray(typedDraft.skillSelections);

  const featureSelections = (draft as DraftWithFeatureSelections).featureSelections ?? {};
  Object.values(featureSelections).forEach((selections) => {
    if (!Array.isArray(selections)) {
      return;
    }

    selections.forEach((entry) => addSkill(entry));
  });

  return selectedSkillIds;
}

function filterSkillChoiceOptions(
  draft: CharacterDraft,
  config: FeatChoiceConfig
): ChoiceOption[] {
  const explicitOptions = toChoiceOptions(config.options);
  const pooledOptions = resolveChoiceOptionsForPools(config);
  const baseOptions = explicitOptions.length > 0 ? explicitOptions : pooledOptions;

  const excludeExisting =
    (config as FeatChoiceConfig & {
      excludeExistingProficiencies?: boolean;
      exclude_existing_proficiencies?: boolean;
    }).excludeExistingProficiencies === true ||
    (config as FeatChoiceConfig & {
      excludeExistingProficiencies?: boolean;
      exclude_existing_proficiencies?: boolean;
    }).exclude_existing_proficiencies === true;

  if (!excludeExisting) {
    return baseOptions;
  }

  const existing = getExistingSkillProficiencies(draft);
  return baseOptions.filter((option) => !existing.has(option.id.trim().toLowerCase()));
}

function filterExpertiseChoiceOptions(
  draft: CharacterDraft,
  config: FeatChoiceConfig
): ChoiceOption[] {
  const explicitOptions = toChoiceOptions(config.options);
  const pooledOptions = resolveChoiceOptionsForPools(config);
  const baseOptions = explicitOptions.length > 0 ? explicitOptions : pooledOptions;
  const existing = getExistingSkillProficiencies(draft);

  return baseOptions.filter((option) => existing.has(option.id.trim().toLowerCase()));
}

function buildBaseFeatOutput(
  feat: NormalizedFeat,
  level: number,
  slot: FeatSelectionEntry
): ResolvedFeatureOutput {
  return {
    featureId: getFeatId(feat),
    featureName: feat.name,
    sourceType: "feat" as ResolvedFeatureOutput["sourceType"],
    sourceId: getFeatId(feat),
    sourceName: feat.name,
    levelGained: slot.levelGained,
    description: getFeatNotes(feat),
    derivedEffects: feat.effects ?? null,
    effects: feat.effects ?? null,
    selectionKey: slot.slotId,
    choiceKind: null,
    choiceCount: null,
    choicePool: null,
    choiceOptions: [],
    selections: [],
    featureStack: null,
    stackRole: null,
    parentFeatureId: null,
  } as ResolvedFeatureOutput;
}

function buildChoiceOutput(
  feat: NormalizedFeat,
  level: number,
  slot: FeatSelectionEntry,
  suffix: string,
  label: string,
  choiceKind: string,
  config: FeatChoiceConfig,
  draft: CharacterDraft,
  explicitOptions?: Array<{ id: string; label: string }>
): ResolvedFeatureOutput {
  const baseOptions = explicitOptions ?? resolveChoiceOptionsForPools(config);
  const featureId = `${slot.slotId}__${getFeatId(feat)}__${suffix}`;
  const currentSelections =
    ((draft as DraftWithFeatureSelections).featureSelections ?? {})[featureId] ?? [];

  const resolvedExplicitOptions = [...baseOptions];
  currentSelections.forEach((selection) => {
    if (resolvedExplicitOptions.some((option) => option.id === selection)) {
      return;
    }

    const fallbackLabel = selection
      .split(/[_\s-]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");

    resolvedExplicitOptions.push({
      id: selection,
      label: fallbackLabel,
    });
  });
  const count = resolveCountValue(config.count, level);
  const choicePool = normalizePoolNames(config);

  return {
    featureId,
    featureName: `${feat.name} — ${label}`,
    sourceType: "feat" as ResolvedFeatureOutput["sourceType"],
    sourceId: getFeatId(feat),
    sourceName: feat.name,
    levelGained: slot.levelGained,
    description: getFeatNotes(feat),
    derivedEffects: null,
    effects: {
      feat_effect_key: suffix,
      ...(config.points !== undefined ? { points: config.points } : {}),
      ...((config.perChoiceMax ?? config.per_choice_max) !== undefined
        ? { per_choice_max: config.perChoiceMax ?? config.per_choice_max }
        : {}),
      ...((config.allowSameChoiceTwice ?? config.allow_same_choice_twice) !== undefined
        ? { allow_same_choice_twice: config.allowSameChoiceTwice ?? config.allow_same_choice_twice }
        : {}),
      ...((config.scoreCap ?? config.score_cap) !== undefined
        ? { score_cap: config.scoreCap ?? config.score_cap }
        : {}),
      ...((config.upgradeIfProficient ?? config.upgrade_if_proficient) !== undefined
        ? { upgrade_if_proficient: config.upgradeIfProficient ?? config.upgrade_if_proficient }
        : {}),
      ...((config.requireProficiency ?? config.require_proficiency) !== undefined
        ? { require_proficiency: config.requireProficiency ?? config.require_proficiency }
        : {}),
      ...((config.reassignableAfterLongRest ?? config.reassignable_after_long_rest) !== undefined
        ? {
            reassignable_after_long_rest:
              config.reassignableAfterLongRest ?? config.reassignable_after_long_rest,
          }
        : {}),
    },
    selectionKey: featureId,
    choiceKind,
    choiceCount: count,
    choicePool,
    choiceOptions: resolvedExplicitOptions,
    selections: [],
    featureStack: null,
    stackRole: null,
    parentFeatureId: getFeatId(feat),
  } as ResolvedFeatureOutput;
}

function buildSpellGrantOutputs(
  feat: NormalizedFeat,
  level: number,
  slot: FeatSelectionEntry
): ResolvedFeatureOutput[] {
  const spellGrants = getEffectSpellGrants(getFeatEffects(feat));

  return spellGrants.flatMap((grant, index) => {
    if (grant.kind === "fixed") {
      return [
        {
          featureId: `${slot.slotId}__${getFeatId(feat)}__spell_grant_${index + 1}`,
          featureName: `${feat.name} — Spell Grant ${index + 1}`,
          sourceType: "feat" as ResolvedFeatureOutput["sourceType"],
          sourceId: getFeatId(feat),
          sourceName: feat.name,
          levelGained: slot.levelGained,
          description: getFeatNotes(feat),
          derivedEffects: null,
          effects: { spell_grants: [grant] },
          selectionKey: `${slot.slotId}__${getFeatId(feat)}__spell_grant_${index + 1}`,
          choiceKind: null,
          choiceCount: null,
          choicePool: null,
          choiceOptions: [],
          selections: [],
          featureStack: null,
          stackRole: null,
          parentFeatureId: getFeatId(feat),
        } as ResolvedFeatureOutput,
      ];
    }

    return [
      {
        featureId: `${slot.slotId}__${getFeatId(feat)}__spell_choice_${index + 1}`,
        featureName: `${feat.name} — Spell Choice ${index + 1}`,
        sourceType: "feat" as ResolvedFeatureOutput["sourceType"],
        sourceId: getFeatId(feat),
        sourceName: feat.name,
        levelGained: slot.levelGained,
        description: getFeatNotes(feat),
        derivedEffects: null,
        effects: {
          spell_choice: {
            level: grant.level ?? null,
            schools: grant.schools ?? null,
            ritual_only: grant.ritualOnly ?? grant.ritual_only ?? false,
          },
        },
        selectionKey: `${slot.slotId}__${getFeatId(feat)}__spell_choice_${index + 1}`,
        choiceKind: "spell_choice",
        choiceCount: resolveCountValue(grant.count, level),
        choicePool: null,
        choiceOptions: getSpellChoiceOptions(grant),
        selections: [],
        featureStack: null,
        stackRole: null,
        parentFeatureId: getFeatId(feat),
      } as ResolvedFeatureOutput,
    ];
  });
}

function buildFeatChoiceOutputs(
  feat: NormalizedFeat,
  level: number,
  slot: FeatSelectionEntry,
  draft: CharacterDraft
): ResolvedFeatureOutput[] {
  const effects = getFeatEffects(feat);
  const outputs: ResolvedFeatureOutput[] = [];

  const savingThrowChoices = getEffectChoiceConfig(
    effects,
    "savingThrowChoices",
    "saving_throw_choices"
  ) as SavingThrowChoiceConfig | undefined;

  const abilityScoreChoices = getEffectChoiceConfig(effects, "abilityScoreChoices", "ability_score_choices");
  if (
    abilityScoreChoices &&
    !savingThrowChoices &&
    !(
      resolveCountValue(abilityScoreChoices.count, level) === 1 &&
      (abilityScoreChoices.options?.length ?? 0) === 1
    )
  ) {
    const abilityChoiceConfig = abilityScoreChoices;
    const explicitAbilityOptions = toChoiceOptions(abilityChoiceConfig.options);
    const repeatCount = resolveCountValue(abilityChoiceConfig.count, level) ?? 1;

    for (let index = 0; index < repeatCount; index += 1) {
      outputs.push(
        buildChoiceOutput(
          feat,
          level,
          slot,
          `ability_score_choices_${index + 1}`,
          `Ability Score Choice ${index + 1}`,
          "ability_score_choice",
          {
            ...abilityChoiceConfig,
            count: 1,
          },
          draft,
          explicitAbilityOptions
        )
      );
    }
  }

  const spellcastingAbilityChoice = getEffectChoiceConfig(
    effects,
    "spellcastingAbilityChoice",
    "spellcasting_ability_choice"
  );
  if (spellcastingAbilityChoice) {
    outputs.push(
      buildChoiceOutput(
        feat,
        level,
        slot,
        "spellcasting_ability_choice",
        "Spellcasting Ability",
        "mode_choice",
        spellcastingAbilityChoice,
        draft,
        toChoiceOptions(spellcastingAbilityChoice.options)
      )
    );
  }

  const damageTypeChoice = getEffectChoiceConfig(effects, "damageTypeChoice", "damage_type_choice");
  if (damageTypeChoice) {
    outputs.push(
      buildChoiceOutput(
        feat,
        level,
        slot,
        "damage_type_choice",
        "Element Choice",
        "mode_choice",
        damageTypeChoice,
        draft,
        toChoiceOptions(damageTypeChoice.options)
      )
    );
  }

  const toolChoices = getEffectChoiceConfig(effects, "toolChoices", "tool_choices");
  if (toolChoices) {
    outputs.push(
      buildChoiceOutput(
        feat,
        level,
        slot,
        "tool_choices",
        "Tool Proficiency",
        "tool_proficiency",
        toolChoices,
        draft
      )
    );
  }

  const proficiencyChoices = getEffectChoiceConfig(effects, "proficiencyChoices", "proficiency_choices");
  if (proficiencyChoices) {
    outputs.push(
      buildChoiceOutput(
        feat,
        level,
        slot,
        "proficiency_choices",
        "Proficiency Choice",
        "proficiency_choice",
        proficiencyChoices,
        draft,
        filterSkillChoiceOptions(draft, proficiencyChoices)
      )
    );
  }

  const expertiseChoices = getEffectChoiceConfig(effects, "expertiseChoices", "expertise_choices");
  if (expertiseChoices) {
    outputs.push(
      buildChoiceOutput(
        feat,
        level,
        slot,
        "expertise_choices",
        "Expertise Choice",
        "expertise_choice",
        expertiseChoices,
        draft,
        filterExpertiseChoiceOptions(draft, expertiseChoices)
      )
    );
  }

  const skillTrainingChoices = getEffectChoiceConfig(
    effects,
    "skillTrainingChoices",
    "skill_training_choices"
  );
  if (skillTrainingChoices) {
    outputs.push(
      buildChoiceOutput(
        feat,
        level,
        slot,
        "skill_training_choices",
        "Skill Training",
        "skill_proficiency",
        skillTrainingChoices,
        draft,
        toChoiceOptions(skillTrainingChoices.options)
      )
    );
  }

  if (savingThrowChoices) {
    outputs.push(
      buildChoiceOutput(
        feat,
        level,
        slot,
        "saving_throw_choices",
        "Saving Throw Proficiency",
        "saving_throw_proficiency",
        savingThrowChoices,
        draft,
        filterSavingThrowChoiceOptions(draft, savingThrowChoices)
      )
    );
  }

  const weaponMasteryChoices = getEffectChoiceConfig(
    effects,
    "weaponMasteryChoices",
    "weapon_mastery_choices"
  );
  if (weaponMasteryChoices) {
    outputs.push(
      buildChoiceOutput(
        feat,
        level,
        slot,
        "weapon_mastery_choices",
        "Weapon Mastery",
        "weapon_mastery",
        weaponMasteryChoices,
        draft
      )
    );
  }

  outputs.push(...buildSpellGrantOutputs(feat, level, slot));

  return outputs;
}

function isFeatTypeAllowed(feat: NormalizedFeat, slot: FeatSlot): boolean {
  if (slot.featTypeAllowed === "Epic Boon") {
    return feat.type === "Epic Boon";
  }

  if (slot.featTypeAllowed === "General") {
    return feat.type === "General" || feat.type === "Origin";
  }

  return feat.type === "Origin";
}

function extractSelectedFeatEntries(draft: CharacterDraft): FeatSelectionEntry[] {
  const typedDraft = draft as DraftWithOptionalFeats;
  const slots = resolveFeatSlots(draft);
  const entries: FeatSelectionEntry[] = [];

  for (const slot of slots) {
    const selectedFeatId = typedDraft.featSelections?.[slot.slotId] ?? null;

    if (!selectedFeatId || typeof selectedFeatId !== "string") {
      continue;
    }

    const feat = getFeatDefinitionById(selectedFeatId);
    if (!feat) {
      continue;
    }

    if (!isFeatTypeAllowed(feat, slot)) {
      continue;
    }

    entries.push({
      slotId: slot.slotId,
      featId: selectedFeatId,
      levelGained: slot.levelGained,
    });
  }

  return entries;
}

export function getAvailableFeatsForSlot(
  draft: CharacterDraft,
  slotId: string
): NormalizedFeat[] {
  const slot = resolveFeatSlots(draft).find((entry) => entry.slotId === slotId);

  if (!slot) {
    return [];
  }

  return featDefinitions.filter((feat) => isFeatTypeAllowed(feat, slot));
}

export function getFeatDefinitions(): NormalizedFeat[] {
  return featDefinitions;
}


export function getFeatDefinitionById(featId: string): NormalizedFeat | null {
  return featDefinitions.find((feat) => feat.id === featId) ?? null;
}

function applyDraftSelectionsToFeatOutputs(
  draft: CharacterDraft,
  features: ResolvedCharacterSheet["features"]
): ResolvedCharacterSheet["features"] {
  const featureSelections = (draft as DraftWithFeatureSelections).featureSelections ?? {};

  return features.map((feature) => {
    const selectionKey = feature.selectionKey ?? feature.featureId;
    const selections = selectionKey ? featureSelections[selectionKey] ?? [] : [];

    return {
      ...feature,
      selections,
    };
  }) as ResolvedCharacterSheet["features"];
}

export function resolveFeatOutputsFromIds(
  featIds: string[],
  draft: CharacterDraft
): ResolvedCharacterSheet["features"] {
  const level = draft.level ?? 1;

  const resolved = featIds.flatMap((featId, index) => {
    const feat = getFeatDefinitionById(featId);

    if (!feat) {
      return [];
    }

    const slot: FeatSelectionEntry = {
      slotId: `legacy_feat_${index + 1}`,
      featId,
      levelGained: level,
    };

    return [buildBaseFeatOutput(feat, level, slot), ...buildFeatChoiceOutputs(feat, level, slot, draft)];
  }) as ResolvedCharacterSheet["features"];

  return applyDraftSelectionsToFeatOutputs(draft, resolved);
}

export function resolveFeatOutputs(
  draft: CharacterDraft
): ResolvedCharacterSheet["features"] {
  const level = draft.level ?? 1;
  const selectedEntries = extractSelectedFeatEntries(draft);

  if (selectedEntries.length > 0) {
    const resolved = selectedEntries.flatMap((entry) => {
      const feat = getFeatDefinitionById(entry.featId);

      if (!feat) {
        return [];
      }

      return [buildBaseFeatOutput(feat, level, entry), ...buildFeatChoiceOutputs(feat, level, entry, draft)];
    }) as ResolvedCharacterSheet["features"];

    return applyDraftSelectionsToFeatOutputs(draft, resolved);
  }

  return resolveFeatOutputsFromIds([], draft);
}