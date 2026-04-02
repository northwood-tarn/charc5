import type { CharacterDraft } from "../types/draft";
import type { ResolvedCharacterSheet } from "../types/sheet";
import type {
  NormalizedClass,
  NormalizedFeatEffects,
  NormalizedGrantedSpellcasting,
} from "../engine/contracts/dataContracts";
import spellsCsv from "../data/csv/spells.csv?raw";

import { getBackgrounds } from "../data/loaders/backgroundsLoader";
import { lineages } from "../data/lineages";
import { species } from "../data/species";
import { getClasses } from "../data/loaders/classLoader";
import { getSubclasses } from "../data/loaders/subclassLoader";
import { getClassFeatures } from "../data/loaders/classFeaturesLoader";
import { resolveFeatureOutputs } from "./featureResolver";
import { resolveFeatOutputs } from "./featResolver";
import {
  resolveAbilities,
  resolveInitiative,
  resolveProficiencyBonus,
} from "./abilitiesResolver";
import { resolveDurabilityOutputs } from "./durabilityResolver";
import {
  applyDerivedEffectsToProficiencies,
  applyDraftProficienciesToSheet,
  resolveSavingThrows,
  resolveSkills,
} from "./proficienciesResolver";
import { resolveClassDcAndAttack } from "./classDcAndAttackResolver";
import { resolveSpellcastingSummary } from "./spellcastingResolver";
import {
  getJsonFeatureSpellGrantSources,
  getSelectedOptionSpellGrantSources,
  resolveStructuredKnownSpells,
  resolveStructuredPreparedSpells,
} from "./spellListResolver";
import { resolveSpellSelectionState } from "./spellSelectionResolver";

const classes = getClasses();
const subclasses = getSubclasses();
const backgrounds = getBackgrounds();
const classFeatures = getClassFeatures();

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function buildSpellNameMap(raw: string): Record<string, string> {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length < 2) {
    return {};
  }

  const headers = parseCsvLine(lines[0]);
  const idIndex = headers.findIndex((header) => header === "spell_id");
  const nameIndex = headers.findIndex((header) => header === "name");

  if (idIndex === -1 || nameIndex === -1) {
    return {};
  }

  return lines.slice(1).reduce<Record<string, string>>((map, line) => {
    const values = parseCsvLine(line);
    const spellId = values[idIndex] ?? "";
    const spellName = values[nameIndex] ?? "";

    if (spellId && spellName) {
      map[spellId] = spellName;
    }

    return map;
  }, {});
}

const spellNameById = buildSpellNameMap(spellsCsv);

function findNameById(
  records: Array<{ id: string; name: string }>,
  id: string | null
): string {
  if (!id) {
    return "";
  }

  return records.find((record) => record.id === id)?.name ?? "";
}

function getApplicableCsvClassFeaturesForDraft(draft: CharacterDraft) {
  if (!draft.classId || draft.level === null) {
    return [];
  }

  return classFeatures.filter((feature) => {
    if (feature.classId !== draft.classId) {
      return false;
    }

    if (feature.level > draft.level) {
      return false;
    }

    return (
      feature.subclassId === "core" ||
      feature.subclassId === (draft.subclassId ?? "")
    );
  });
}

function resolveSpellListOutputs(args: {
  draft: CharacterDraft;
  features: ResolvedCharacterSheet["features"];
  className: string;
  subclassName: string;
  csvClassFeatures: ReturnType<typeof getApplicableCsvClassFeaturesForDraft>;
}) {
  const { draft, features, className, subclassName, csvClassFeatures } = args;

  const mappedFeatures = features.map((feature) => ({
    featureId: feature.featureId,
    featureName: feature.featureName,
    sourceType: feature.sourceType,
    sourceId: feature.sourceId,
    sourceName: feature.sourceName,
    selections: feature.selections,
    choiceOptions: feature.choiceOptions,
    derivedEffects: feature.derivedEffects ?? undefined,
    effects: feature.effects ?? undefined,
  }));

  const csvFeatureSpellSources = csvClassFeatures.map((feature) => ({
    sourceType: "feature" as const,
    sourceId: feature.sourceId,
    sourceName: feature.name,
    grantedSpellIds: feature.grantedSpellIds,
    isAlwaysPrepared: true,
    countsAgainstLimit: false,
  }));

  const jsonFeatureSpellSources = getJsonFeatureSpellGrantSources(mappedFeatures);
  const selectedOptionSpellSources = getSelectedOptionSpellGrantSources(mappedFeatures);

  return {
    knownSpells: resolveStructuredKnownSpells(draft, className, subclassName),
    preparedSpells: resolveStructuredPreparedSpells({
      draft,
      className,
      subclassName,
      csvFeatureSpellSources,
      jsonFeatureSpellSources,
      selectedOptionSpellSources,
    }),
  };
}

function pushUniqueString(target: string[], value: string) {
  if (!value) {
    return;
  }

  if (!target.includes(value)) {
    target.push(value);
  }
}

function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
  }

  if (typeof value === "string" && value.length > 0) {
    return [value];
  }

  return [];
}

function applyClassProficienciesToSheet(sheet: ResolvedCharacterSheet, draft: CharacterDraft) {
  const classRecord = classes.find((entry) => entry.id === draft.classId) as
    | NormalizedClass
    | undefined;

  if (!classRecord) {
    return;
  }

  classRecord.armorProficiencies.forEach((entry) => {
    pushUniqueString(sheet.proficiencies.armor, entry);
  });

  classRecord.weaponProficiencies.forEach((entry) => {
    pushUniqueString(sheet.proficiencies.weapons, entry);
  });

  classRecord.toolProficiencies.forEach((entry) => {
    pushUniqueString(sheet.proficiencies.tools, entry);
  });
}

function applyPassivePerceptionToSheet(sheet: ResolvedCharacterSheet) {
  const perceptionSkill = sheet.skills["perception"];
  const perceptionModifier = perceptionSkill?.totalModifier ?? null;

  if (perceptionModifier === null) {
    return;
  }

  sheet.combatBasics.passivePerception = {
    value: 10 + perceptionModifier,
    derivation: [
      {
        label: "Base",
        value: 10,
        source: "passive perception",
      },
      {
        label: "Perception modifier",
        value: perceptionModifier,
        source: "perception",
      },
    ],
  };
}

function applyInitiativeToSheet(sheet: ResolvedCharacterSheet) {
  const initiativeValue = resolveInitiative(sheet.abilities);
  sheet.combatBasics.initiative = {
    value: initiativeValue,
    derivation:
      initiativeValue === null
        ? []
        : [
            {
              label: "Dexterity modifier",
              value: initiativeValue,
              source: "dex",
            },
          ],
  };
}

function applyPrimarySpeedToSheet(sheet: ResolvedCharacterSheet) {
  const combatBasics = sheet.combatBasics as ResolvedCharacterSheet["combatBasics"] & {
    speed?: {
      value: number | string | null;
      derivation: Array<{ label: string; value: number | string; source: string }>;
    };
  };

  const speeds = Array.isArray(sheet.combatBasics.speeds) ? sheet.combatBasics.speeds : [];
  const primarySpeed =
    speeds.find((entry) => entry.type === "walk") ??
    speeds[0] ??
    null;

  if (!primarySpeed) {
    combatBasics.speed = {
      value: null,
      derivation: [],
    };
    return;
  }

  combatBasics.speed = {
    value: primarySpeed.value ?? null,
    derivation: [
      {
        label: `${primarySpeed.type} speed`,
        value: primarySpeed.value ?? "",
        source: primarySpeed.source ?? primarySpeed.type,
      },
    ],
  };
}

function applySkillAdjustment(args: {
  sheet: ResolvedCharacterSheet;
  skillId: string;
  targetProficiency: "proficient" | "expertise" | "proficient_or_expertise";
  sourceName: string;
}) {
  const { sheet, skillId, targetProficiency, sourceName } = args;
  const skills = sheet.skills as Record<string, {
    proficiency?: string | null;
    totalModifier?: number | null;
    derivation?: Array<{ label: string; value: number; source: string }>;
  }>;

  const skill = skills[skillId];
  if (!skill) {
    return;
  }

  const pb = sheet.combatBasics.proficiencyBonus.value ?? 0;
  const current = skill.proficiency ?? "none";

  let delta = 0;
  let nextProficiency = current;

  if (targetProficiency === "proficient") {
    if (current === "none") {
      delta = pb;
      nextProficiency = "proficient";
    }
  } else if (targetProficiency === "expertise") {
    if (current === "none") {
      delta = pb * 2;
      nextProficiency = "expertise";
    } else if (current === "proficient") {
      delta = pb;
      nextProficiency = "expertise";
    }
  } else {
    if (current === "none") {
      delta = pb;
      nextProficiency = "proficient";
    } else if (current === "proficient") {
      delta = pb;
      nextProficiency = "expertise";
    }
  }

  if (delta === 0 && nextProficiency === current) {
    return;
  }

  skill.proficiency = nextProficiency;
  skill.totalModifier = (skill.totalModifier ?? 0) + delta;
  skill.derivation = [
    ...(skill.derivation ?? []),
    {
      label:
        targetProficiency === "expertise"
          ? "Feat expertise"
          : targetProficiency === "proficient_or_expertise"
            ? "Feat proficiency/expertise"
            : "Feat proficiency",
      value: delta,
      source: sourceName,
    },
  ];

  pushUniqueString(sheet.proficiencies.skills, skillId);
}

function applySavingThrowAdjustment(args: {
  sheet: ResolvedCharacterSheet;
  abilityId: string;
  sourceName: string;
}) {
  const { sheet, abilityId, sourceName } = args;
  const abilityKey = normalizeAbilityKey(abilityId);

  if (!abilityKey) {
    return;
  }

  const savingThrow = sheet.savingThrows[abilityKey];
  if (!savingThrow) {
    return;
  }

  if (savingThrow.proficiency === "proficient" || savingThrow.proficiency === "expertise") {
    return;
  }

  const pb = sheet.combatBasics.proficiencyBonus.value ?? 0;
  savingThrow.proficiency = "proficient";
  savingThrow.totalModifier = (savingThrow.totalModifier ?? 0) + pb;
  savingThrow.derivation = [
    ...(savingThrow.derivation ?? []),
    {
      label: "Feat saving throw proficiency",
      value: pb,
      source: sourceName,
    },
  ];
}

function applyAbilityScoreFeatAdjustments(sheet: ResolvedCharacterSheet) {
  const features = sheet.features as Array<{
    sourceType: string;
    sourceId?: string;
    sourceName: string;
    choiceKind: string | null;
    selections: string[];
    choiceOptions?: Array<{ id: string; label: string }>;
    effects?: NormalizedFeatEffects | Record<string, unknown> | null;
    derivedEffects?: NormalizedFeatEffects | Record<string, unknown> | null;
  }>;

  const totals: Partial<Record<keyof ResolvedCharacterSheet["abilities"], number>> = {};
  const sources: Partial<Record<keyof ResolvedCharacterSheet["abilities"], string[]>> = {};

  const featFeatures = features.filter((feature) => feature.sourceType === "feat");
  const sourceIdsDrivenBySavingThrowChoice = new Set(
    featFeatures
      .filter((feature) => feature.choiceKind === "saving_throw_proficiency")
      .map((feature) => feature.sourceId)
      .filter((value): value is string => typeof value === "string" && value.length > 0)
  );

  const sourceIdsWithExplicitAbilityChoice = new Set(
    featFeatures
      .filter((feature) => feature.choiceKind === "ability_score_choice")
      .map((feature) => feature.sourceId)
      .filter((value): value is string => typeof value === "string" && value.length > 0)
  );

  const baseFeatFeatures = featFeatures.filter(
    (feature) =>
      !feature.choiceKind &&
      typeof feature.sourceId === "string" &&
      feature.sourceId.length > 0
  );

  featFeatures
    .filter((feature) => {
      if (feature.choiceKind === "saving_throw_proficiency") {
        return true;
      }

      if (feature.choiceKind !== "ability_score_choice") {
        return false;
      }

      return !(
        feature.sourceId &&
        sourceIdsDrivenBySavingThrowChoice.has(feature.sourceId)
      );
    })
    .forEach((feature) => {
      const selections = Array.isArray(feature.selections) ? feature.selections : [];
      const effectiveSelections =
        selections.length > 0
          ? selections
          : feature.choiceOptions && feature.choiceOptions.length === 1
            ? [feature.choiceOptions[0].id]
            : [];

      effectiveSelections.forEach((selection) => {
        const abilityKey = normalizeAbilityKey(selection);
        if (!abilityKey) {
          return;
        }

        totals[abilityKey] = (totals[abilityKey] ?? 0) + 1;
        sources[abilityKey] = [...(sources[abilityKey] ?? []), feature.sourceName];
      });
    });

  baseFeatFeatures.forEach((feature) => {
    if (!feature.sourceId) {
      return;
    }

    if (sourceIdsDrivenBySavingThrowChoice.has(feature.sourceId)) {
      return;
    }

    if (sourceIdsWithExplicitAbilityChoice.has(feature.sourceId)) {
      return;
    }

    const mergedEffects = {
      ...((feature.derivedEffects ?? {}) as Record<string, unknown>),
      ...((feature.effects ?? {}) as Record<string, unknown>),
    } as NormalizedFeatEffects & Record<string, unknown>;

    const abilityScoreChoices =
      mergedEffects.abilityScoreChoices ??
      ((mergedEffects.ability_score_choices as Record<string, unknown> | undefined) ?? undefined);

    const options = Array.isArray(abilityScoreChoices?.options)
      ? abilityScoreChoices.options.filter(
          (value): value is string => typeof value === "string" && value.length > 0
        )
      : [];

    const count =
      typeof abilityScoreChoices?.count === "number"
        ? abilityScoreChoices.count
        : typeof (abilityScoreChoices as { count?: unknown } | undefined)?.count === "number"
          ? ((abilityScoreChoices as { count?: number }).count ?? 0)
          : 0;

    if (count !== 1 || options.length !== 1) {
      return;
    }

    const abilityKey = normalizeAbilityKey(options[0]);
    if (!abilityKey) {
      return;
    }

    totals[abilityKey] = (totals[abilityKey] ?? 0) + 1;
    sources[abilityKey] = [...(sources[abilityKey] ?? []), feature.sourceName];
  });

  (Object.keys(totals) as Array<keyof ResolvedCharacterSheet["abilities"]>).forEach((abilityKey) => {
    const bonus = totals[abilityKey] ?? 0;
    if (bonus <= 0) {
      return;
    }

    const ability = sheet.abilities[abilityKey];
    const currentScore = ability.score ?? 0;
    const nextScore = currentScore + bonus;
    const nextModifier = Math.floor((nextScore - 10) / 2);
    const modifierDelta = nextModifier - (ability.modifier ?? 0);

    ability.score = nextScore;
    ability.modifier = nextModifier;
    ability.scoreDerivation = [
      ...(ability.scoreDerivation ?? []),
      {
        label: "Feat ability increase",
        value: bonus,
        source: (sources[abilityKey] ?? []).join(", "),
      },
    ];

    if (modifierDelta !== 0) {
      ability.modifierDerivation = [
        ...(ability.modifierDerivation ?? []),
        {
          label: "Feat ability increase",
          value: modifierDelta,
          source: (sources[abilityKey] ?? []).join(", "),
        },
      ];
    }
  });
}

function appendUniqueSpellEntries(target: unknown[], additions: unknown[]) {
  const seen = new Set(
    target.flatMap((entry) => {
      if (!entry || typeof entry !== "object") {
        return [];
      }

      const spellId = (entry as { spellId?: string; id?: string }).spellId ?? (entry as { spellId?: string; id?: string }).id;
      return spellId ? [spellId] : [];
    })
  );

  additions.forEach((entry) => {
    if (!entry || typeof entry !== "object") {
      return;
    }

    const spellId = (entry as { spellId?: string; id?: string }).spellId ?? (entry as { spellId?: string; id?: string }).id;
    if (!spellId || seen.has(spellId)) {
      return;
    }

    seen.add(spellId);
    target.push(entry);
  });
}

function normalizeAbilityKey(
  value: string | null | undefined
): keyof ResolvedCharacterSheet["abilities"] | null {
  const abilityMap: Record<string, keyof ResolvedCharacterSheet["abilities"]> = {
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

  return value ? abilityMap[value] ?? null : null;
}

function applyFeatEffectPayloads(sheet: ResolvedCharacterSheet) {
  const features = sheet.features as Array<{
    featureId: string;
    sourceType: string;
    sourceId: string;
    sourceName: string;
    choiceKind: string | null;
    selections: string[];
    effects?: NormalizedFeatEffects | Record<string, unknown> | null;
    derivedEffects?: NormalizedFeatEffects | Record<string, unknown> | null;
  }>;

  const featFeatures = features.filter((feature) => feature.sourceType === "feat");
  const baseFeatFeatures = featFeatures.filter(
    (feature) => !feature.featureId.includes("__")
  );

  baseFeatFeatures.forEach((feature) => {
    const relatedFeatures = featFeatures.filter(
      (f) => f.sourceId === feature.sourceId
    );

    const effects: NormalizedFeatEffects & Record<string, unknown> = relatedFeatures.reduce(
      (acc, f) => ({
        ...acc,
        ...((f.derivedEffects ?? {}) as Record<string, unknown>),
        ...((f.effects ?? {}) as Record<string, unknown>),
      }),
      {} as Record<string, unknown>
    );

    const armorTrainingGrants = normalizeStringArray(
      effects.armorTrainingGrants ?? (effects as Record<string, unknown>).armor_training_grants
    );

    armorTrainingGrants.forEach((grant) => {
      pushUniqueString(sheet.proficiencies.armor, grant);
    });

    const weaponTrainingGrants = normalizeStringArray(
      effects.weaponTrainingGrants ?? (effects as Record<string, unknown>).weapon_training_grants
    );

    weaponTrainingGrants.forEach((grant) => {
      pushUniqueString(sheet.proficiencies.weapons, grant);
    });

    // --- BEGIN: Speed bonus payload handling ---
    const speedBonus =
      (effects.speedBonus as { type?: string; value?: number } | undefined) ??
      ((effects as Record<string, unknown>).speed_bonus as { type?: string; value?: number } | undefined);

    if (
      speedBonus &&
      typeof speedBonus.value === "number" &&
      Number.isFinite(speedBonus.value)
    ) {
      const speedType = speedBonus.type ?? "walk";
      const existingSpeed = sheet.combatBasics.speeds.find((entry) => entry.type === speedType);

      if (existingSpeed) {
        existingSpeed.value = (existingSpeed.value ?? 0) + speedBonus.value;
      } else {
        sheet.combatBasics.speeds.push({
          type: speedType,
          value: speedBonus.value,
          source: feature.sourceName,
        });
      }
    }
    // --- END: Speed bonus payload handling ---

    const hitPointBonus =
      effects.hitPointBonus ??
      ((effects as Record<string, unknown>).hit_point_bonus as { per_level?: number } | undefined);
    const hitPointBonusPerLevel =
      typeof hitPointBonus?.perLevel === "number"
        ? hitPointBonus.perLevel
        : typeof (hitPointBonus as { per_level?: number } | undefined)?.per_level === "number"
          ? (hitPointBonus as { per_level?: number }).per_level
          : undefined;

    if (typeof hitPointBonusPerLevel === "number" && hitPointBonusPerLevel > 0) {
      const level = sheet.identity.level ?? 0;
      const bonus = level * hitPointBonusPerLevel;

      if (bonus > 0) {
        sheet.durability.hpMax.value = (sheet.durability.hpMax.value ?? 0) + bonus;
        sheet.durability.hpMax.derivation = [
          ...sheet.durability.hpMax.derivation,
          {
            label: "Feat hit point bonus",
            value: bonus,
            source: feature.sourceName,
          },
        ];
      }
    }

    const grantedSpellcasting =
      (effects.grantedSpellcasting as NormalizedGrantedSpellcasting | undefined) ??
      ((effects as Record<string, unknown>).granted_spellcasting as NormalizedGrantedSpellcasting | undefined);

    const spellGrants = Array.isArray(effects.spellGrants)
      ? effects.spellGrants
      : Array.isArray((effects as Record<string, unknown>).spell_grants)
        ? ((effects as Record<string, unknown>).spell_grants as unknown[])
        : [];

    const inferredGrantedSpellcasting =
      !grantedSpellcasting &&
      spellGrants.length > 0 &&
      sheet.spellcasting.spellSaveDc == null &&
      sheet.spellcasting.spellAttackBonus == null
        ? {
            ability_choice_effect: "ability_score_choices_1",
            spell_save_dc: { base: 8, include_proficiency_bonus: true },
            spell_attack_bonus: { include_proficiency_bonus: true },
          }
        : undefined;

    const spellcastingEffect = grantedSpellcasting ?? inferredGrantedSpellcasting;

    if (spellcastingEffect) {
      const abilityChoiceEffect =
        spellcastingEffect.abilityChoiceEffect ??
        (spellcastingEffect as { ability_choice_effect?: string }).ability_choice_effect ??
        null;
      const matchingAbilityChoice = abilityChoiceEffect
        ? featFeatures.find(
            (candidate) =>
              candidate.sourceId === feature.sourceId &&
              candidate.featureId.includes(`__${abilityChoiceEffect}`)
          )
        : null;

      const selectedAbility = matchingAbilityChoice?.selections?.[0] ?? null;
      const abilityKey = normalizeAbilityKey(selectedAbility);

      if (abilityKey) {
        const abilityModifier = sheet.abilities[abilityKey]?.modifier ?? null;
        const proficiencyBonus = sheet.combatBasics.proficiencyBonus.value ?? 0;

        if (abilityModifier !== null) {
          const saveDc =
            spellcastingEffect.spellSaveDc ??
            (spellcastingEffect as {
              spell_save_dc?: { base?: number; include_proficiency_bonus?: boolean };
            }).spell_save_dc;
          const spellAttack =
            spellcastingEffect.spellAttackBonus ??
            (spellcastingEffect as {
              spell_attack_bonus?: { include_proficiency_bonus?: boolean };
            }).spell_attack_bonus;

          const saveDcBase = saveDc?.base ?? 8;
          const saveDcPb = saveDc?.includeProficiencyBonus ?? saveDc?.include_proficiency_bonus
            ? proficiencyBonus
            : 0;
          const attackPb =
            spellAttack?.includeProficiencyBonus ?? spellAttack?.include_proficiency_bonus
              ? proficiencyBonus
              : 0;

          sheet.spellcasting.spellcastingAbility = abilityKey;
          sheet.spellcasting.spellSaveDc = saveDcBase + saveDcPb + abilityModifier;
          sheet.spellcasting.spellAttackBonus = attackPb + abilityModifier;
        }
      }
    }
  });
}

function applyFeatCarryoverToSheet(sheet: ResolvedCharacterSheet) {
  const features = sheet.features as Array<{
    featureId: string;
    sourceType: string;
    sourceId: string;
    sourceName: string;
    featureName: string;
    choiceKind: string | null;
    selections: string[];
    effects?: Record<string, unknown> | null;
  }>;

  const featFeatures = features.filter((feature) => feature.sourceType === "feat");

  featFeatures.forEach((feature) => {
    const selections = Array.isArray(feature.selections) ? feature.selections : [];

    if (feature.choiceKind === "skill_proficiency") {
      const upgradeIfProficient =
        !!feature.effects &&
        typeof feature.effects === "object" &&
        (feature.effects as Record<string, unknown>).upgrade_if_proficient === true;

      selections.forEach((skillId) => {
        applySkillAdjustment({
          sheet,
          skillId,
          targetProficiency: upgradeIfProficient ? "proficient_or_expertise" : "proficient",
          sourceName: feature.sourceName,
        });
      });
      return;
    }

    if (feature.choiceKind === "expertise_choice") {
      selections.forEach((skillId) => {
        applySkillAdjustment({
          sheet,
          skillId,
          targetProficiency: "expertise",
          sourceName: feature.sourceName,
        });
      });
      return;
    }

    if (feature.choiceKind === "saving_throw_proficiency") {
      selections.forEach((abilityId) => {
        applySavingThrowAdjustment({
          sheet,
          abilityId,
          sourceName: feature.sourceName,
        });
      });
      return;
    }

    if (feature.choiceKind === "tool_proficiency") {
      selections.forEach((toolId) => pushUniqueString(sheet.proficiencies.tools, toolId));
      return;
    }

    if (feature.choiceKind === "proficiency_choice") {
      selections.forEach((selectionId) => {
        if (selectionId in (sheet.skills as Record<string, unknown>)) {
          applySkillAdjustment({
            sheet,
            skillId: selectionId,
            targetProficiency: "proficient",
            sourceName: feature.sourceName,
          });
          return;
        }

        pushUniqueString(sheet.proficiencies.tools, selectionId);
      });
    }
  });

  const featSpellSelections = featFeatures
    .filter((feature) => feature.choiceKind === "spell_choice")
    .flatMap((feature) =>
      (feature.selections ?? []).map((spellId) => ({
        spellId,
        spellName: spellNameById[spellId] ?? spellId,
        sourceType: "feat" as const,
        sourceId: feature.sourceId,
        sourceName: feature.sourceName,
        isAlwaysPrepared: true,
        countsAgainstLimit: false,
      }))
    );

  if (featSpellSelections.length > 0) {
    appendUniqueSpellEntries(sheet.spellcasting.knownSpells as unknown[], featSpellSelections);
    appendUniqueSpellEntries(sheet.spellcasting.preparedSpells as unknown[], featSpellSelections);
  }
}

function createEmptyResolvedCharacterSheet(): ResolvedCharacterSheet {
  return {
    identity: {
      characterName: "",
      classId: null,
      className: "",
      subclassId: null,
      subclassName: "",
      level: null,
      speciesId: null,
      speciesName: "",
      lineageId: null,
      lineageName: "",
      backgroundId: null,
      backgroundName: "",
    },
    abilities: {
      str: { ability: "str", score: null, modifier: null, scoreDerivation: [], modifierDerivation: [] },
      dex: { ability: "dex", score: null, modifier: null, scoreDerivation: [], modifierDerivation: [] },
      con: { ability: "con", score: null, modifier: null, scoreDerivation: [], modifierDerivation: [] },
      int: { ability: "int", score: null, modifier: null, scoreDerivation: [], modifierDerivation: [] },
      wis: { ability: "wis", score: null, modifier: null, scoreDerivation: [], modifierDerivation: [] },
      cha: { ability: "cha", score: null, modifier: null, scoreDerivation: [], modifierDerivation: [] },
    },
    combatBasics: {
      proficiencyBonus: { value: null, derivation: [] },
      initiative: { value: null, derivation: [] },
      armorClass: { value: null, derivation: [] },
      speeds: [],
      senses: [],
      passivePerception: { value: null, derivation: [] },
    },
    durability: {
      hpMax: { value: null, derivation: [] },
      hitDice: { die: "", total: null, derivation: [] },
      defenses: {
        resistances: [],
        immunities: [],
        conditionImmunities: [],
      },
    },
    savingThrows: {
      str: { ability: "str", proficiency: "none", totalModifier: null, derivation: [] },
      dex: { ability: "dex", proficiency: "none", totalModifier: null, derivation: [] },
      con: { ability: "con", proficiency: "none", totalModifier: null, derivation: [] },
      int: { ability: "int", proficiency: "none", totalModifier: null, derivation: [] },
      wis: { ability: "wis", proficiency: "none", totalModifier: null, derivation: [] },
      cha: { ability: "cha", proficiency: "none", totalModifier: null, derivation: [] },
    },
    skills: {} as ResolvedCharacterSheet["skills"],
    proficiencies: {
      armor: [],
      weapons: [],
      tools: [],
      skills: [],
    },
    languages: [],
    classDcAndAttack: {
      attackBonuses: [],
      saveDcs: [],
    },
    attacks: {
      entries: [],
    },
    resources: [],
    features: [],
    spellSlots: [],
    spellcasting: {
      spellcastingAbility: null,
      spellSaveDc: null,
      spellAttackBonus: null,
      preparedSpellLimit: null,
      spellSlotsByLevel: [],
      knownSpells: [],
      preparedSpells: [],
    },
    equipment: {
      items: [],
    },
  };
}

export function resolveCharacterSheet(
  draft: CharacterDraft
): ResolvedCharacterSheet {
  const sheet = createEmptyResolvedCharacterSheet();

  sheet.identity = {
    characterName: draft.characterName,
    classId: draft.classId,
    className: findNameById(classes, draft.classId),
    subclassId: draft.subclassId,
    subclassName: findNameById(subclasses, draft.subclassId),
    level: draft.level,
    speciesId: draft.speciesId,
    speciesName: findNameById(species, draft.speciesId),
    lineageId: draft.lineageId,
    lineageName: findNameById(lineages, draft.lineageId),
    backgroundId: draft.backgroundId,
    backgroundName: findNameById(backgrounds, draft.backgroundId),
  };

  sheet.abilities = resolveAbilities(draft);

  const proficiencyBonusValue = resolveProficiencyBonus(draft.level);
  sheet.combatBasics.proficiencyBonus = {
    value: proficiencyBonusValue,
    derivation:
      proficiencyBonusValue === null
        ? []
        : [
            {
              label: "Proficiency bonus",
              value: proficiencyBonusValue,
              source: "character level",
            },
          ],
  };

  applyInitiativeToSheet(sheet);

  sheet.durability = resolveDurabilityOutputs(draft, sheet.abilities);

  const classAndSpeciesFeatures = resolveFeatureOutputs(draft);
  const featFeatures = resolveFeatOutputs(draft);
  sheet.features = [...classAndSpeciesFeatures, ...featFeatures];

  applyDerivedEffectsToProficiencies(sheet);
  applyDraftProficienciesToSheet(sheet, draft);
  applyClassProficienciesToSheet(sheet, draft);

  sheet.savingThrows = resolveSavingThrows(
    draft,
    sheet.abilities,
    proficiencyBonusValue
  );

  sheet.skills = resolveSkills(
    draft,
    sheet.abilities,
    sheet.proficiencies,
    proficiencyBonusValue
  );

  sheet.classDcAndAttack = resolveClassDcAndAttack(
    draft,
    sheet.abilities,
    proficiencyBonusValue
  );

  const csvClassFeatures = getApplicableCsvClassFeaturesForDraft(draft);
  const spellListOutputs = resolveSpellListOutputs({
    draft,
    features: sheet.features,
    className: sheet.identity.className,
    subclassName: sheet.identity.subclassName,
    csvClassFeatures,
  });

  sheet.spellcasting = resolveSpellcastingSummary({
    draft,
    abilities: sheet.abilities,
    classDcAndAttack: sheet.classDcAndAttack,
    className: sheet.identity.className,
    subclassName: sheet.identity.subclassName,
    applicableClassFeatures: csvClassFeatures.map(
      (feature) => ({
        classId: feature.classId,
        subclassId: feature.subclassId,
        name: feature.name,
        grantedSpellIds: feature.grantedSpellIds,
      })
    ),
  });

  sheet.spellcasting.knownSpells = spellListOutputs.knownSpells;
  sheet.spellcasting.preparedSpells = spellListOutputs.preparedSpells;

  Object.assign(sheet.spellcasting, {
    selectionState: resolveSpellSelectionState({
      draft,
      features: sheet.features,
    }),
  });

  applyAbilityScoreFeatAdjustments(sheet);
  applyFeatCarryoverToSheet(sheet);
  applyFeatEffectPayloads(sheet);
  applyInitiativeToSheet(sheet);
  applyPassivePerceptionToSheet(sheet);
  applyPrimarySpeedToSheet(sheet);

  return sheet;
}
