import type { CharacterDraft } from "../types/draft";
import type { ResolvedCharacterSheet } from "../types/sheet";
import type {
  NormalizedClass,
  NormalizedFeatEffects,
  NormalizedGrantedSpellcasting,
} from "../engine/contracts/dataContracts";
import spellsCsv from "../data/csv/spells.csv?raw";
import { parseCsv, splitCsvLine } from "../data/loaders/csvParser";

import { getBackgrounds } from "../data/loaders/backgroundsLoader";
import { getLineageById, getSpeciesById } from "../data/loaders/speciesLoader";
import { lineages } from "../data/lineages";
import { species } from "../data/species";
import { getClasses } from "../data/loaders/classLoader";
import { getSubclasses } from "../data/loaders/subclassLoader";
import { getClassFeatures } from "../data/loaders/classFeaturesLoader";
import { getTools } from "../data/loaders/toolsLoader";
import { resolveFeatureOutputs } from "./featureResolver";
import { resolveFeatOutputs } from "./featResolver";
import { resolveSpeciesFeatureOutputs } from "./speciesFeatureResolver";
import {
  resolveAbilities,
  resolveInitiative,
  resolveProficiencyBonus,
} from "./abilitiesResolver";
import { resolveDurabilityOutputs } from "./durabilityResolver";
import { resolveGearOutputs } from "./gearResolver";
import { resolveResources } from "./resourceResolver";
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
const tools = getTools();
const toolNameById = new Map(
  tools.map((tool) => [tool.id.trim().toLowerCase(), tool.name] as const)
);


function buildSpellNameMap(raw: string): Record<string, string> {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length < 2) {
    return {};
  }

  const headers = splitCsvLine(lines[0]);
  const idIndex = headers.findIndex((header) => header === "spell_id");
  const nameIndex = headers.findIndex((header) => header === "name");

  if (idIndex === -1 || nameIndex === -1) {
    return {};
  }

  return lines.slice(1).reduce<Record<string, string>>((map, line) => {
    const values = splitCsvLine(line);
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

  const csvFeatureSpellSources = csvClassFeatures.flatMap((feature) => {
    const base = [
      {
        sourceType: "feature" as const,
        sourceId: feature.sourceId,
        sourceName: feature.name,
        grantedSpellIds: feature.grantedSpellIds,
        isAlwaysPrepared: true,
        countsAgainstLimit: false,
      },
    ];

    // Include subclass spell grants if present (paladin oaths, etc.)
    if (Array.isArray((feature as any).subclassGrantedSpellIds)) {
      base.push({
        sourceType: "feature" as const,
        sourceId: feature.sourceId,
        sourceName: feature.name,
        grantedSpellIds: (feature as any).subclassGrantedSpellIds,
        isAlwaysPrepared: true,
        countsAgainstLimit: false,
      });
    }

    return base;
  });

  const jsonFeatureSpellSources = [
    ...getJsonFeatureSpellGrantSources(mappedFeatures),
    ...getJsonFeatureSpellGrantSources(
      mappedFeatures.filter((f) => f.sourceType === "species")
    ),
  ];
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
  if (!value) return;

  const normalized = value.trim().toLowerCase();
  if (!normalized) return;

  const exists = target.some((entry) => entry.trim().toLowerCase() === normalized);
  if (!exists) {
    target.push(normalized);
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

function toToolDisplayName(value: string): string {
  const normalized = value.trim().toLowerCase();
  return toolNameById.get(normalized) ?? value;
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

function applyBackgroundProficienciesToSheet(
  sheet: ResolvedCharacterSheet,
  draft: CharacterDraft
) {
  const backgroundRecord = backgrounds.find((entry) => entry.id === draft.backgroundId) as
    | {
        skillProficiencies?: string[];
        toolProficiencies?: string[];
        languages?: string[];
      }
    | undefined;

  if (!backgroundRecord) {
    return;
  }

  (backgroundRecord.skillProficiencies ?? []).forEach((entry) => {
    pushUniqueString(sheet.proficiencies.skills, entry);
  });

  (backgroundRecord.toolProficiencies ?? []).forEach((entry) => {
    pushUniqueString(sheet.proficiencies.tools, entry);
  });

  (backgroundRecord.languages ?? []).forEach((entry) => {
    const trimmed = entry.trim();
    if (!trimmed || trimmed.toLowerCase() === "choice") {
      return;
    }

    pushUniqueString(sheet.languages, trimmed);
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

function applySpellcastingCombatValuesToSheet(sheet: ResolvedCharacterSheet) {
  const spellcastingAbility = sheet.spellcasting.spellcastingAbility;
  const abilityKey = normalizeAbilityKey(spellcastingAbility);

  if (!abilityKey) {
    return;
  }

  const abilityModifier = sheet.abilities[abilityKey]?.modifier;
  const proficiencyBonus = sheet.combatBasics.proficiencyBonus.value;

  if (abilityModifier === null || abilityModifier === undefined) {
    return;
  }

  if (proficiencyBonus === null || proficiencyBonus === undefined) {
    return;
  }

  if (sheet.spellcasting.spellSaveDc == null) {
    sheet.spellcasting.spellSaveDc = 8 + proficiencyBonus + abilityModifier;
  }

  if (sheet.spellcasting.spellAttackBonus == null) {
    sheet.spellcasting.spellAttackBonus = proficiencyBonus + abilityModifier;
  }
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


function applySpeciesSpeedToSheet(sheet: ResolvedCharacterSheet, draft: CharacterDraft) {
  const lineageRecord = getLineageById(draft.speciesId, draft.lineageId);
  const speciesRecord = getSpeciesById(draft.speciesId);
  const speed = lineageRecord?.speed ?? speciesRecord?.speed ?? null;

  if (speed === null) {
    return;
  }

  const existingWalkSpeed = sheet.combatBasics.speeds.find((entry) => entry.type === "walk");

  if (existingWalkSpeed) {
    existingWalkSpeed.value = speed;
    existingWalkSpeed.source = draft.lineageId ?? draft.speciesId ?? "species";
    return;
  }

  sheet.combatBasics.speeds.push({
    type: "walk",
    value: speed,
    source: draft.lineageId ?? draft.speciesId ?? "species",
  });
}

function applySpeciesResistancesToSheet(sheet: ResolvedCharacterSheet, draft: CharacterDraft) {
  const lineageRecord = getLineageById(draft.speciesId, draft.lineageId);
  const speciesRecord = getSpeciesById(draft.speciesId);
  const resistances = lineageRecord?.resistances ?? speciesRecord?.resistances ?? [];

  resistances.forEach((resistance) => {
    pushUniqueString(sheet.durability.defenses.resistances, resistance);
  });
}

function applySpeciesLanguagesToSheet(sheet: ResolvedCharacterSheet, draft: CharacterDraft) {
  const lineageRecord = getLineageById(draft.speciesId, draft.lineageId);
  const speciesRecord = getSpeciesById(draft.speciesId);

  const languageEntries = [
    ...(lineageRecord?.languages ?? []),
    ...(speciesRecord?.languages ?? []),
  ];

  languageEntries.forEach((language) => {
    const trimmed = language.trim();
    if (!trimmed || trimmed.toLowerCase() === "choice") {
      return;
    }

    pushUniqueString(sheet.languages, trimmed);
  });
}

function normalizeGearProficiencyToken(value: string): string {
  return value.trim().toLowerCase().replace(/[_\s]+/g, "");
}

function hasArmorCategoryProficiency(
  proficiencies: string[],
  category: string
): boolean {
  const normalizedCategory = normalizeGearProficiencyToken(category);
  const normalizedProficiencies = new Set(
    proficiencies.map((entry) => normalizeGearProficiencyToken(entry))
  );

  if (normalizedCategory === "shield") {
    return (
      normalizedProficiencies.has("shield") ||
      normalizedProficiencies.has("shields") ||
      normalizedProficiencies.has("shieldtraining")
    );
  }

  if (normalizedCategory === "light") {
    return (
      normalizedProficiencies.has("light") ||
      normalizedProficiencies.has("lightarmor") ||
      normalizedProficiencies.has("lightarmortraining")
    );
  }

  if (normalizedCategory === "medium") {
    return (
      normalizedProficiencies.has("medium") ||
      normalizedProficiencies.has("mediumarmor") ||
      normalizedProficiencies.has("mediumarmortraining")
    );
  }

  if (normalizedCategory === "heavy") {
    return (
      normalizedProficiencies.has("heavy") ||
      normalizedProficiencies.has("heavyarmor") ||
      normalizedProficiencies.has("heavyarmortraining")
    );
  }

  return normalizedProficiencies.has(normalizedCategory);
}

function getUnarmoredArmorClassState(sheet: ResolvedCharacterSheet): {
  value: number;
  derivation: Array<{ label: string; value: number; source: string }>;
} {
  const dexModifier = sheet.abilities.dex.modifier ?? 0;
  const classId = sheet.identity.classId ?? null;

  if (classId === "barbarian") {
    const conModifier = sheet.abilities.con.modifier ?? 0;
    return {
      value: 10 + dexModifier + conModifier,
      derivation: [
        {
          label: "Base AC",
          value: 10,
          source: "unarmored",
        },
        {
          label: "Dexterity modifier",
          value: dexModifier,
          source: "dex",
        },
        {
          label: "Constitution modifier",
          value: conModifier,
          source: "barbarian_unarmored_defense",
        },
      ],
    };
  }

  if (classId === "monk") {
    const wisModifier = sheet.abilities.wis.modifier ?? 0;
    return {
      value: 10 + dexModifier + wisModifier,
      derivation: [
        {
          label: "Base AC",
          value: 10,
          source: "unarmored",
        },
        {
          label: "Dexterity modifier",
          value: dexModifier,
          source: "dex",
        },
        {
          label: "Wisdom modifier",
          value: wisModifier,
          source: "monk_unarmored_defense",
        },
      ],
    };
  }

  return {
    value: 10 + dexModifier,
    derivation: [
      {
        label: "Base AC",
        value: 10,
        source: "unarmored",
      },
      {
        label: "Dexterity modifier",
        value: dexModifier,
        source: "dex",
      },
    ],
  };
}

function applyGearToSheet(sheet: ResolvedCharacterSheet, draft: CharacterDraft) {
  const gear = resolveGearOutputs(draft);

  const equipmentItems: Array<Record<string, unknown>> = [];

  gear.weapons.forEach((weapon) => {
    equipmentItems.push({
      type: "weapon",
      id: weapon.id,
      name: weapon.name,
      category: weapon.category,
      weaponType: weapon.weaponType,
      damageDice: weapon.damageDice,
      damageType: weapon.damageType,
      masteryTrait: weapon.masteryTrait,
      masteryDetails: weapon.masteryDetails,
    });
  });

  if (gear.armor) {
    equipmentItems.push({
      type: "armor",
      id: gear.armor.id,
      name: gear.armor.name,
      category: gear.armor.category,
      baseAc: gear.armor.baseAc,
      dexBonusType: gear.armor.dexBonusType,
      dexCap: gear.armor.dexCap,
      strengthRequirement: gear.armor.strengthRequirement,
      stealthDisadvantage: gear.armor.stealthDisadvantage,
    });
  }

  if (gear.shield) {
    equipmentItems.push({
      type: "shield",
      id: gear.shield.id,
      name: gear.shield.name,
      acBonus: gear.shield.acBonus,
    });
  }

  sheet.equipment.items = equipmentItems as ResolvedCharacterSheet["equipment"]["items"];

  const armor = gear.armor;
  const shield = gear.shield;

  const armorProficiencies = sheet.proficiencies.armor ?? [];
  const canUseArmor = !!armor;
  const canUseShield = shield
    ? hasArmorCategoryProficiency(armorProficiencies, "shield")
    : false;

  const unarmoredState = getUnarmoredArmorClassState(sheet);
  let armorClassValue = unarmoredState.value;
  const derivation: Array<{ label: string; value: number; source: string }> = [
    ...unarmoredState.derivation,
  ];

  if (armor && canUseArmor) {
    let armorDexBonus = 0;

    if (armor.dexBonusType === "full") {
      armorDexBonus = sheet.abilities.dex.modifier ?? 0;
    } else if (armor.dexBonusType === "capped") {
      armorDexBonus = Math.min(sheet.abilities.dex.modifier ?? 0, armor.dexCap ?? 0);
    }

    armorClassValue = (armor.baseAc ?? 10) + armorDexBonus;
    derivation.splice(0, derivation.length,
      {
        label: `${armor.name} base AC`,
        value: armor.baseAc ?? 10,
        source: armor.id,
      },
      ...(armorDexBonus !== 0
        ? [
            {
              label: "Dexterity modifier",
              value: armorDexBonus,
              source: "dex",
            },
          ]
        : [])
    );
  }

  if (shield && canUseShield) {
    armorClassValue += shield.acBonus;
    derivation.push({
      label: `${shield.name} AC bonus`,
      value: shield.acBonus,
      source: shield.id,
    });
  }

  sheet.combatBasics.armorClass = {
    value: armorClassValue,
    derivation,
  };
}

function getWeaponAttackAbilityKey(
  weaponType: string | null | undefined
): keyof ResolvedCharacterSheet["abilities"] {
  return weaponType === "ranged" ? "dex" : "str";
}

function applyWeaponAttacksToSheet(sheet: ResolvedCharacterSheet, draft: CharacterDraft) {
  const gear = resolveGearOutputs(draft);
  const proficiencyBonus = sheet.combatBasics.proficiencyBonus.value ?? 0;

  const entries = gear.weapons.map((weapon) => {
    const abilityKey = getWeaponAttackAbilityKey(weapon.weaponType);
    const abilityModifier = sheet.abilities[abilityKey]?.modifier ?? 0;
    const attackBonus = proficiencyBonus + abilityModifier;
    const damageBonus = abilityModifier;
    const damageBonusText = damageBonus === 0
      ? ""
      : damageBonus > 0
        ? ` + ${damageBonus}`
        : ` - ${Math.abs(damageBonus)}`;

    return {
      id: weapon.id,
      name: weapon.name,
      attackBonus,
      damage: `${weapon.damageDice}${damageBonusText} ${weapon.damageType}`,
      damageDice: weapon.damageDice,
      damageType: weapon.damageType,
      ability: abilityKey,
      source: weapon.id,
    };
  });

  sheet.attacks.entries = entries as ResolvedCharacterSheet["attacks"]["entries"];
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
    const uncappedNextScore = currentScore + bonus;
    const nextScore = Math.min(uncappedNextScore, 20);
    const appliedBonus = nextScore - currentScore;
    const nextModifier = Math.floor((nextScore - 10) / 2);
    const modifierDelta = nextModifier - (ability.modifier ?? 0);

    ability.score = nextScore;
    ability.modifier = nextModifier;

    if (appliedBonus > 0) {
      ability.scoreDerivation = [
        ...(ability.scoreDerivation ?? []),
        {
          label: "Feat ability increase",
          value: appliedBonus,
          source: (sources[abilityKey] ?? []).join(", "),
        },
      ];
    }

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

function applyNonFeatHitPointBonusesToSheet(sheet: ResolvedCharacterSheet) {
  const features = sheet.features as Array<{
    sourceType: string;
    sourceName: string;
    effects?: Record<string, unknown> | null;
    derivedEffects?: Record<string, unknown> | null;
  }>;

  const nonFeatFeatures = features.filter((feature) => feature.sourceType !== "feat");

  nonFeatFeatures.forEach((feature) => {
    const mergedEffects = {
      ...((feature.derivedEffects ?? {}) as Record<string, unknown>),
      ...((feature.effects ?? {}) as Record<string, unknown>),
    };

    const hitPointBonus =
      (mergedEffects.hitPointBonus as { perLevel?: number } | undefined) ??
      (mergedEffects.hit_point_bonus as { per_level?: number } | undefined);

    const hitPointBonusPerLevel =
      typeof hitPointBonus?.perLevel === "number"
        ? hitPointBonus.perLevel
        : typeof (hitPointBonus as { per_level?: number } | undefined)?.per_level === "number"
          ? (hitPointBonus as { per_level?: number }).per_level
          : undefined;

    if (typeof hitPointBonusPerLevel !== "number" || hitPointBonusPerLevel <= 0) {
      return;
    }

    const level = sheet.identity.level ?? 0;
    const bonus = level * hitPointBonusPerLevel;

    if (bonus <= 0) {
      return;
    }

    sheet.durability.hpMax.value = (sheet.durability.hpMax.value ?? 0) + bonus;
    sheet.durability.hpMax.derivation = [
      ...sheet.durability.hpMax.derivation,
      {
        label: "Feature hit point bonus",
        value: bonus,
        source: feature.sourceName,
      },
    ];
  });
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

function applyFeatCarryoverToSheet(sheet: ResolvedCharacterSheet, draft: CharacterDraft) {
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

  // --- Fallback using draft.featureSelections ---
  const fallbackSpellEntries: any[] = [];
  const fallbackSkillProficiencies: string[] = [];
  const fallbackExpertise: string[] = [];

  Object.entries(draft.featureSelections ?? {}).forEach(([key, selections]) => {
    if (!Array.isArray(selections)) return;

    if (key.includes("spell_choice")) {
      selections.forEach((spellId: string) => {
        fallbackSpellEntries.push({
          spellId,
          spellName: spellNameById[spellId] ?? spellId,
          sourceType: "feat",
          sourceId: key,
          sourceName: "feat",
          isAlwaysPrepared: true,
          countsAgainstLimit: false,
        });
      });
    }

    if (key.includes("skill_proficiency")) {
      fallbackSkillProficiencies.push(...selections);
    }

    if (key.includes("expertise_choice")) {
      fallbackExpertise.push(...selections);
    }
  });

  if (fallbackSpellEntries.length > 0) {
    appendUniqueSpellEntries(sheet.spellcasting.knownSpells as unknown[], fallbackSpellEntries);
    appendUniqueSpellEntries(sheet.spellcasting.preparedSpells as unknown[], fallbackSpellEntries);
  }

  fallbackSkillProficiencies.forEach((skillId) => {
    applySkillAdjustment({
      sheet,
      skillId,
      targetProficiency: "proficient",
      sourceName: "feat",
    });
  });

  fallbackExpertise.forEach((skillId) => {
    applySkillAdjustment({
      sheet,
      skillId,
      targetProficiency: "expertise",
      sourceName: "feat",
    });
  });
  // --- End fallback ---

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

  const classFeatures = resolveFeatureOutputs(draft);
  const speciesFeatures = resolveSpeciesFeatureOutputs(draft);
  const featFeatures = resolveFeatOutputs(draft);
  sheet.features = [...classFeatures, ...speciesFeatures, ...featFeatures];
  sheet.resources = resolveResources(draft);

  applyDerivedEffectsToProficiencies(sheet);
  applyDraftProficienciesToSheet(sheet, draft);
  applyClassProficienciesToSheet(sheet, draft);
  applyBackgroundProficienciesToSheet(sheet, draft);

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

  const guaranteedCsvPreparedSpellEntries = csvClassFeatures.flatMap((feature) => {
    const spellIds = [
      ...(feature.grantedSpellIds ?? []),
      ...(((feature as unknown as { subclassGrantedSpellIds?: string[] }).subclassGrantedSpellIds) ?? []),
    ];

    return spellIds.map((spellId) => ({
      spellId,
      spellName: spellNameById[spellId] ?? spellId,
      sourceType: "feature" as const,
      sourceId: feature.sourceId,
      sourceName: feature.name,
      isAlwaysPrepared: true,
      countsAgainstLimit: false,
    }));
  });

  appendUniqueSpellEntries(
    sheet.spellcasting.preparedSpells as unknown[],
    guaranteedCsvPreparedSpellEntries
  );

  const guaranteedSpeciesSpellEntries = sheet.features
    .filter((feature) => feature.sourceType === "species")
    .flatMap((feature) => {
      const mergedEffects = {
        ...((feature.derivedEffects ?? {}) as Record<string, unknown>),
        ...((feature.effects ?? {}) as Record<string, unknown>),
      };

      const grantedSpellIds = normalizeStringArray(mergedEffects.granted_spell_ids);

      return grantedSpellIds.map((spellId) => ({
        spellId,
        spellName: spellNameById[spellId] ?? spellId,
        sourceType: "feature" as const,
        sourceId: feature.sourceId,
        sourceName: feature.featureName,
        isAlwaysPrepared: true,
        countsAgainstLimit: false,
      }));
    });

  appendUniqueSpellEntries(
    sheet.spellcasting.knownSpells as unknown[],
    guaranteedSpeciesSpellEntries
  );

  Object.assign(sheet.spellcasting, {
    selectionState: resolveSpellSelectionState({
      draft,
      features: sheet.features,
    }),
  });

  applyAbilityScoreFeatAdjustments(sheet);
  applyFeatCarryoverToSheet(sheet, draft);
  applySpeciesSpeedToSheet(sheet, draft);
  applySpeciesResistancesToSheet(sheet, draft);
  applySpeciesLanguagesToSheet(sheet, draft);
  applyNonFeatHitPointBonusesToSheet(sheet);
  applyFeatEffectPayloads(sheet);
  applySpellcastingCombatValuesToSheet(sheet);
  applyGearToSheet(sheet, draft);
  applyWeaponAttacksToSheet(sheet, draft);
  applyInitiativeToSheet(sheet);
  applyPassivePerceptionToSheet(sheet);
  applyPrimarySpeedToSheet(sheet);

  sheet.proficiencies.tools = sheet.proficiencies.tools.map(toToolDisplayName);

  return sheet;
}
